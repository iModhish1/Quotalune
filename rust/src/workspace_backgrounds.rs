//! Bounded storage for user-imported workspace background images.

use std::fs::{self, File, Metadata, OpenOptions};
use std::io::{self, Cursor, Read, Write};
use std::path::{Path, PathBuf};

use base64::Engine;
use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView, ImageFormat, ImageReader, Limits};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const MAX_CATALOG_ITEMS: usize = 40;
const MAX_DIRECTORY_ENTRIES: usize = 160;
const MAX_NAME_CHARACTERS: usize = 80;
const MAX_METADATA_BYTES: u64 = 1_024;
const MAX_IMAGE_BYTES: usize = 8 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES: usize = 256 * 1024;
const MAX_INPUT_DIMENSION: u32 = 4_096;
const MAX_INPUT_PIXELS: u64 = 8_000_000;
const MAX_OUTPUT_DIMENSION: u32 = 2_560;
const MAX_THUMBNAIL_INPUT_DIMENSION: u32 = 512;
const MAX_THUMBNAIL_PIXELS: u64 = 512 * 512;
const MAX_THUMBNAIL_OUTPUT_DIMENSION: u32 = 240;
const MAIN_DECODE_ALLOCATION_LIMIT: u64 = 64 * 1024 * 1024;
const THUMBNAIL_DECODE_ALLOCATION_LIMIT: u64 = 2 * 1024 * 1024;
const METADATA_VERSION: u8 = 1;
const DATA_URL_PREFIX: &str = "data:image/png;base64,";

/// A safe, UI-facing description of one imported background.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredBackground {
    pub id: String,
    pub name: String,
    pub thumbnail_data_url: String,
}

/// Owns files inside one application-managed background directory.
#[derive(Debug, Clone)]
pub struct BackgroundStore {
    root: PathBuf,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredMetadata {
    version: u8,
    id: String,
    name: String,
}

impl BackgroundStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    /// Decode bounded base64 payloads from the Tauri JSON boundary, then use
    /// the same PNG validation and storage path as byte-oriented callers.
    pub fn import_base64(
        &self,
        name: &str,
        png_base64: &str,
        thumbnail_png_base64: &str,
    ) -> Result<StoredBackground, String> {
        let png = decode_base64_bounded(png_base64, MAX_IMAGE_BYTES, "image")?;
        let thumbnail =
            decode_base64_bounded(thumbnail_png_base64, MAX_THUMBNAIL_BYTES, "thumbnail")?;
        self.import(name, &png, &thumbnail)
    }

    pub fn list(&self) -> Result<Vec<StoredBackground>, String> {
        if !self.safe_root(false)? {
            return Ok(Vec::new());
        }

        let mut metadata_paths = Vec::new();
        let entries = fs::read_dir(&self.root).map_err(storage_unavailable)?;
        for (index, entry) in entries.enumerate() {
            if index >= MAX_DIRECTORY_ENTRIES {
                return Err("Background storage contains too many entries".to_string());
            }
            let entry = entry.map_err(storage_unavailable)?;
            let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
                continue;
            };
            let Some(id) = name.strip_suffix(".json") else {
                continue;
            };
            if canonical_id(id).is_ok() {
                metadata_paths.push((id.to_string(), entry.path()));
            }
        }

        if metadata_paths.len() > MAX_CATALOG_ITEMS {
            return Err("The custom background catalog is full".to_string());
        }

        let mut backgrounds = Vec::with_capacity(metadata_paths.len());
        for (filename_id, metadata_path) in metadata_paths {
            self.assert_direct_child(&metadata_path)?;
            let metadata = self.read_metadata(&filename_id)?;

            let image_available = assert_optional_bounded_regular_file(
                &self.image_path(&filename_id),
                u64::try_from(MAX_IMAGE_BYTES).expect("image limit fits u64"),
            )?;
            let thumbnail_path = self.thumbnail_path(&filename_id);
            let thumbnail = read_optional_bounded_regular(
                &thumbnail_path,
                u64::try_from(MAX_THUMBNAIL_BYTES).expect("thumbnail limit fits u64"),
            )?;
            if let Some(thumbnail) = thumbnail.as_deref() {
                decode_png(
                    thumbnail,
                    MAX_THUMBNAIL_INPUT_DIMENSION,
                    MAX_THUMBNAIL_PIXELS,
                    THUMBNAIL_DECODE_ALLOCATION_LIMIT,
                    "thumbnail",
                )?;
            }

            backgrounds.push(StoredBackground {
                id: metadata.id,
                name: metadata.name,
                thumbnail_data_url: match (image_available, thumbnail) {
                    (true, Some(thumbnail)) => png_data_url(&thumbnail),
                    _ => String::new(),
                },
            });
        }

        backgrounds.sort_by(|left, right| {
            left.name
                .to_lowercase()
                .cmp(&right.name.to_lowercase())
                .then_with(|| left.id.cmp(&right.id))
        });
        Ok(backgrounds)
    }

    pub fn import(
        &self,
        name: &str,
        png: &[u8],
        thumbnail_png: &[u8],
    ) -> Result<StoredBackground, String> {
        let name = validate_name(name)?;
        if png.len() > MAX_IMAGE_BYTES {
            return Err("Background image exceeds the 8 MiB limit".to_string());
        }
        if thumbnail_png.len() > MAX_THUMBNAIL_BYTES {
            return Err("Background thumbnail exceeds the 256 KiB limit".to_string());
        }

        // Decode before creating any catalog files. The decoder has strict dimension
        // limits and a bounded allocation budget, and the result is re-encoded so no
        // untrusted PNG ancillary chunks are retained.
        let image = decode_png(
            png,
            MAX_INPUT_DIMENSION,
            MAX_INPUT_PIXELS,
            MAIN_DECODE_ALLOCATION_LIMIT,
            "image",
        )?;
        let thumbnail = decode_png(
            thumbnail_png,
            MAX_THUMBNAIL_INPUT_DIMENSION,
            MAX_THUMBNAIL_PIXELS,
            THUMBNAIL_DECODE_ALLOCATION_LIMIT,
            "thumbnail",
        )?;
        let image = fit_within(image, MAX_OUTPUT_DIMENSION);
        let thumbnail = fit_within(thumbnail, MAX_THUMBNAIL_OUTPUT_DIMENSION);
        let encoded_image = encode_png_bounded(&image, MAX_IMAGE_BYTES, "image")?;
        let encoded_thumbnail = encode_png_bounded(&thumbnail, MAX_THUMBNAIL_BYTES, "thumbnail")?;

        self.safe_root(true)?;
        if self.list()?.len() >= MAX_CATALOG_ITEMS {
            return Err("The custom background catalog is full".to_string());
        }

        let id = Uuid::new_v4().to_string();
        let image_path = self.image_path(&id);
        let thumbnail_path = self.thumbnail_path(&id);
        let metadata_path = self.metadata_path(&id);
        for path in [&image_path, &thumbnail_path, &metadata_path] {
            self.assert_direct_child(path)?;
        }

        let metadata = StoredMetadata {
            version: METADATA_VERSION,
            id: id.clone(),
            name: name.clone(),
        };
        let metadata_bytes = serde_json::to_vec(&metadata)
            .map_err(|_| "Could not prepare background metadata".to_string())?;
        if metadata_bytes.len()
            > usize::try_from(MAX_METADATA_BYTES).expect("metadata limit fits usize")
        {
            return Err("Background metadata exceeds its storage limit".to_string());
        }

        let mut created = Vec::with_capacity(2);
        let publication = (|| {
            write_new_file(&image_path, &encoded_image)?;
            created.push(image_path.clone());
            write_new_file(&thumbnail_path, &encoded_thumbnail)?;
            created.push(thumbnail_path.clone());
            // Metadata is the commit marker. It is synced under an ignored
            // same-directory temporary name, then published atomically last.
            publish_metadata_atomic(&metadata_path, &metadata_bytes)?;
            Ok::<(), String>(())
        })();
        if let Err(error) = publication {
            for path in created.iter().rev() {
                remove_created_regular_file(path);
            }
            return Err(error);
        }

        Ok(StoredBackground {
            id,
            name,
            thumbnail_data_url: png_data_url(&encoded_thumbnail),
        })
    }

    pub fn image_data_url(&self, id: &str) -> Result<String, String> {
        let id = canonical_id(id)?;
        if !self.safe_root(false)? {
            return Err("Custom background was not found".to_string());
        }
        self.read_metadata(&id)?;
        let image_path = self.image_path(&id);
        self.assert_direct_child(&image_path)?;
        let image = read_bounded_regular(
            &image_path,
            u64::try_from(MAX_IMAGE_BYTES).expect("image limit fits u64"),
        )?;
        decode_png(
            &image,
            MAX_OUTPUT_DIMENSION,
            MAX_INPUT_PIXELS,
            MAIN_DECODE_ALLOCATION_LIMIT,
            "image",
        )?;
        Ok(png_data_url(&image))
    }

    pub fn remove(&self, id: &str) -> Result<(), String> {
        let id = canonical_id(id)?;
        if !self.safe_root(false)? {
            return Err("Custom background was not found".to_string());
        }
        let metadata_path = self.metadata_path(&id);
        let thumbnail_path = self.thumbnail_path(&id);
        let image_path = self.image_path(&id);
        self.assert_direct_child(&metadata_path)?;
        for path in [&thumbnail_path, &image_path] {
            self.assert_direct_child(path)?;
            assert_optional_regular_file(path)?;
        }

        self.read_metadata(&id)?;

        // Removing the commit marker first makes an interrupted removal disappear
        // from the catalog. Remaining generated files are harmless bounded orphans.
        fs::remove_file(&metadata_path).map_err(storage_unavailable)?;
        remove_optional_owned_file(&thumbnail_path)?;
        remove_optional_owned_file(&image_path)?;
        Ok(())
    }

    fn safe_root(&self, create: bool) -> Result<bool, String> {
        if !self.root.is_absolute() {
            return Err("Background storage root must be absolute".to_string());
        }
        validate_existing_ancestors(&self.root)?;
        match fs::symlink_metadata(&self.root) {
            Ok(metadata) => {
                if is_link_or_reparse(&metadata) || !metadata.is_dir() {
                    return Err("Background storage root is unavailable".to_string());
                }
                Ok(true)
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound && !create => Ok(false),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                fs::create_dir_all(&self.root).map_err(storage_unavailable)?;
                // Re-check every now-existing component so a raced junction or
                // symlink in a newly-created ancestor cannot become trusted.
                validate_existing_ancestors(&self.root)?;
                let metadata = fs::symlink_metadata(&self.root).map_err(storage_unavailable)?;
                if is_link_or_reparse(&metadata) || !metadata.is_dir() {
                    return Err("Background storage root is unavailable".to_string());
                }
                restrict_directory_permissions(&self.root).map_err(storage_unavailable)?;
                Ok(true)
            }
            Err(error) => Err(storage_unavailable(error)),
        }
    }

    fn assert_direct_child(&self, path: &Path) -> Result<(), String> {
        if path.parent() != Some(self.root.as_path()) {
            return Err("Background storage path escaped its managed root".to_string());
        }
        Ok(())
    }

    fn metadata_path(&self, id: &str) -> PathBuf {
        self.root.join(format!("{id}.json"))
    }

    fn image_path(&self, id: &str) -> PathBuf {
        self.root.join(format!("{id}.png"))
    }

    fn thumbnail_path(&self, id: &str) -> PathBuf {
        self.root.join(format!("{id}.thumb.png"))
    }

    fn read_metadata(&self, id: &str) -> Result<StoredMetadata, String> {
        let metadata_path = self.metadata_path(id);
        self.assert_direct_child(&metadata_path)?;
        let metadata_bytes = read_bounded_regular(&metadata_path, MAX_METADATA_BYTES)?;
        let metadata: StoredMetadata = serde_json::from_slice(&metadata_bytes)
            .map_err(|_| "Background metadata is invalid".to_string())?;
        validate_metadata(&metadata, id)?;
        Ok(metadata)
    }
}

fn validate_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty()
        || name.chars().count() > MAX_NAME_CHARACTERS
        || name.chars().any(char::is_control)
    {
        return Err("Background name must contain 1 to 80 visible characters".to_string());
    }
    Ok(name.to_string())
}

fn canonical_id(id: &str) -> Result<String, String> {
    let parsed = Uuid::parse_str(id).map_err(|_| "Custom background ID is invalid".to_string())?;
    let canonical = parsed.to_string();
    if canonical != id || parsed.get_version_num() != 4 {
        return Err("Custom background ID is invalid".to_string());
    }
    Ok(canonical)
}

fn validate_metadata(metadata: &StoredMetadata, filename_id: &str) -> Result<(), String> {
    if metadata.version != METADATA_VERSION
        || canonical_id(&metadata.id)? != filename_id
        || validate_name(&metadata.name)? != metadata.name
    {
        return Err("Background metadata is invalid".to_string());
    }
    Ok(())
}

fn decode_png(
    bytes: &[u8],
    max_dimension: u32,
    max_pixels: u64,
    max_alloc: u64,
    label: &str,
) -> Result<DynamicImage, String> {
    if bytes.is_empty() {
        return Err(format!("Background {label} is empty"));
    }
    let mut reader = ImageReader::with_format(Cursor::new(bytes), ImageFormat::Png);
    let mut limits = Limits::default();
    limits.max_image_width = Some(max_dimension);
    limits.max_image_height = Some(max_dimension);
    limits.max_alloc = Some(max_alloc);
    reader.limits(limits);
    let image = reader
        .decode()
        .map_err(|_| format!("Background {label} is not a valid bounded PNG"))?;
    let (width, height) = image.dimensions();
    let pixels = u64::from(width).saturating_mul(u64::from(height));
    if width == 0 || height == 0 || pixels > max_pixels {
        return Err(format!("Background {label} dimensions exceed the limit"));
    }
    Ok(image)
}

fn fit_within(image: DynamicImage, maximum: u32) -> DynamicImage {
    let (width, height) = image.dimensions();
    if width <= maximum && height <= maximum {
        image
    } else {
        image.resize(maximum, maximum, FilterType::Triangle)
    }
}

fn encode_png_bounded(
    image: &DynamicImage,
    maximum_bytes: usize,
    label: &str,
) -> Result<Vec<u8>, String> {
    let mut writer = BoundedWriter::new(maximum_bytes);
    image
        .write_with_encoder(image::codecs::png::PngEncoder::new(&mut writer))
        .map_err(|_| format!("Background {label} could not be encoded within its limit"))?;
    Ok(writer.into_inner())
}

fn png_data_url(bytes: &[u8]) -> String {
    format!(
        "{DATA_URL_PREFIX}{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    )
}

fn maximum_base64_length(maximum_decoded_bytes: usize) -> usize {
    maximum_decoded_bytes
        .saturating_add(2)
        .saturating_div(3)
        .saturating_mul(4)
}

fn decode_base64_bounded(
    encoded: &str,
    maximum_decoded_bytes: usize,
    label: &str,
) -> Result<Vec<u8>, String> {
    if encoded.is_empty() || encoded.len() > maximum_base64_length(maximum_decoded_bytes) {
        return Err(format!(
            "Background {label} base64 payload exceeds its limit"
        ));
    }
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|_| format!("Background {label} base64 payload is invalid"))?;
    if decoded.len() > maximum_decoded_bytes {
        return Err(format!("Background {label} payload exceeds its limit"));
    }
    Ok(decoded)
}

struct BoundedWriter {
    bytes: Vec<u8>,
    maximum: usize,
}

impl BoundedWriter {
    fn new(maximum: usize) -> Self {
        Self {
            bytes: Vec::with_capacity(maximum.min(64 * 1024)),
            maximum,
        }
    }

    fn into_inner(self) -> Vec<u8> {
        self.bytes
    }
}

impl Write for BoundedWriter {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        if buffer.len() > self.maximum.saturating_sub(self.bytes.len()) {
            return Err(io::Error::new(
                io::ErrorKind::FileTooLarge,
                "encoded PNG exceeds its storage limit",
            ));
        }
        self.bytes.extend_from_slice(buffer);
        Ok(buffer.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

fn read_bounded_regular(path: &Path, maximum: u64) -> Result<Vec<u8>, String> {
    assert_regular_file(path)?;
    let mut file = File::open(path).map_err(storage_unavailable)?;
    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take(maximum.saturating_add(1))
        .read_to_end(&mut bytes)
        .map_err(storage_unavailable)?;
    if u64::try_from(bytes.len()).unwrap_or(u64::MAX) > maximum {
        return Err("Background storage file exceeds its limit".to_string());
    }
    Ok(bytes)
}

fn read_optional_bounded_regular(path: &Path, maximum: u64) -> Result<Option<Vec<u8>>, String> {
    let Some(metadata) = optional_regular_metadata(path)? else {
        return Ok(None);
    };
    if metadata.len() > maximum {
        return Err("Background storage file exceeds its limit".to_string());
    }
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(storage_unavailable(error)),
    };
    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take(maximum.saturating_add(1))
        .read_to_end(&mut bytes)
        .map_err(storage_unavailable)?;
    if u64::try_from(bytes.len()).unwrap_or(u64::MAX) > maximum {
        return Err("Background storage file exceeds its limit".to_string());
    }
    Ok(Some(bytes))
}

fn assert_regular_file(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            "Custom background was not found".to_string()
        } else {
            storage_unavailable(error)
        }
    })?;
    if is_link_or_reparse(&metadata) || !metadata.is_file() {
        return Err("Background storage contains an unsafe file".to_string());
    }
    Ok(())
}

fn optional_regular_metadata(path: &Path) -> Result<Option<Metadata>, String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(storage_unavailable(error)),
    };
    if is_link_or_reparse(&metadata) || !metadata.is_file() {
        return Err("Background storage contains an unsafe file".to_string());
    }
    Ok(Some(metadata))
}

fn assert_optional_regular_file(path: &Path) -> Result<bool, String> {
    optional_regular_metadata(path).map(|metadata| metadata.is_some())
}

fn assert_optional_bounded_regular_file(path: &Path, maximum: u64) -> Result<bool, String> {
    let Some(metadata) = optional_regular_metadata(path)? else {
        return Ok(false);
    };
    if metadata.len() > maximum {
        return Err("Background storage file exceeds its limit".to_string());
    }
    Ok(true)
}

fn validate_existing_ancestors(path: &Path) -> Result<(), String> {
    let ancestors = path.ancestors().collect::<Vec<_>>();
    for ancestor in ancestors.into_iter().rev() {
        match fs::symlink_metadata(ancestor) {
            Ok(metadata) => {
                if is_link_or_reparse(&metadata) || !metadata.is_dir() {
                    return Err("Background storage path contains an unsafe directory".to_string());
                }
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(storage_unavailable(error)),
        }
    }
    Ok(())
}

#[cfg(windows)]
fn is_link_or_reparse(metadata: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_link_or_reparse(metadata: &Metadata) -> bool {
    metadata.file_type().is_symlink()
}

fn write_new_file(path: &Path, bytes: &[u8]) -> Result<(), String> {
    write_new_file_with(path, |file| file.write_all(bytes))
}

fn write_new_file_with(
    path: &Path,
    write: impl FnOnce(&mut File) -> io::Result<()>,
) -> Result<(), String> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path).map_err(storage_unavailable)?;
    let result = write(&mut file).and_then(|()| file.sync_all());
    drop(file);
    if let Err(error) = result {
        remove_created_regular_file(path);
        return Err(storage_unavailable(error));
    }
    Ok(())
}

fn publish_metadata_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Background metadata path has no managed parent".to_string())?;
    let staging = parent.join(format!(".background-metadata-{}.tmp", Uuid::new_v4()));
    write_new_file(&staging, bytes)?;
    let result = publish_staged_without_overwrite(&staging, path);
    if result.is_err() {
        remove_created_regular_file(&staging);
    }
    result
}

#[cfg(any(unix, windows))]
fn publish_staged_without_overwrite(staging: &Path, destination: &Path) -> Result<(), String> {
    // A same-directory hard link publishes the complete inode atomically and
    // fails when the destination exists. The staging name is then best-effort
    // cleanup; leaving it cannot create a catalog entry.
    fs::hard_link(staging, destination).map_err(storage_unavailable)?;
    let _cleanup = fs::remove_file(staging);
    Ok(())
}

#[cfg(not(any(unix, windows)))]
fn publish_staged_without_overwrite(staging: &Path, destination: &Path) -> Result<(), String> {
    if fs::symlink_metadata(destination).is_ok() {
        return Err("Background metadata destination already exists".to_string());
    }
    fs::rename(staging, destination).map_err(storage_unavailable)
}

fn remove_optional_owned_file(path: &Path) -> Result<(), String> {
    if !assert_optional_regular_file(path)? {
        return Ok(());
    }
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(storage_unavailable(error)),
    }
}

fn remove_created_regular_file(path: &Path) {
    if fs::symlink_metadata(path)
        .is_ok_and(|metadata| metadata.is_file() && !is_link_or_reparse(&metadata))
    {
        let _cleanup = fs::remove_file(path);
    }
}

fn storage_unavailable(error: io::Error) -> String {
    format!("Background storage is unavailable: {error}")
}

#[cfg(unix)]
fn restrict_directory_permissions(path: &Path) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = fs::metadata(path)?.permissions();
    permissions.set_mode(0o700);
    fs::set_permissions(path, permissions)
}

#[cfg(not(unix))]
fn restrict_directory_permissions(_path: &Path) -> io::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use base64::Engine;
    use image::{DynamicImage, GenericImageView, ImageFormat};

    use super::*;

    fn png(width: u32, height: u32) -> Vec<u8> {
        let mut bytes = Vec::new();
        DynamicImage::new_rgba8(width, height)
            .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
            .unwrap();
        bytes
    }

    fn decode_data_url(value: &str) -> DynamicImage {
        let encoded = value.strip_prefix("data:image/png;base64,").unwrap();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .unwrap();
        image::load_from_memory_with_format(&bytes, ImageFormat::Png).unwrap()
    }

    #[test]
    fn import_list_read_and_remove_roundtrip() {
        let directory = tempfile::tempdir().unwrap();
        let store = BackgroundStore::new(directory.path().join("workspace-backgrounds"));

        let stored = store
            .import("  My nebula  ", &png(2800, 1400), &png(300, 180))
            .unwrap();

        assert_eq!(stored.name, "My nebula");
        assert_eq!(
            uuid::Uuid::parse_str(&stored.id).unwrap().to_string(),
            stored.id
        );
        assert_eq!(
            decode_data_url(&stored.thumbnail_data_url).dimensions(),
            (240, 144)
        );
        assert_eq!(store.list().unwrap(), vec![stored.clone()]);
        assert_eq!(
            decode_data_url(&store.image_data_url(&stored.id).unwrap()).dimensions(),
            (2560, 1280)
        );

        store.remove(&stored.id).unwrap();
        assert!(store.list().unwrap().is_empty());
        assert!(store.image_data_url(&stored.id).is_err());
    }

    #[test]
    fn invalid_names_and_png_payloads_are_rejected_without_creating_catalog_entries() {
        let directory = tempfile::tempdir().unwrap();
        let store = BackgroundStore::new(directory.path().join("workspace-backgrounds"));
        let valid = png(2, 2);

        assert!(store.import("", &valid, &valid).is_err());
        assert!(store.import("bad\nname", &valid, &valid).is_err());
        assert!(store.import("bad image", b"not a png", &valid).is_err());
        assert!(store.import("bad thumbnail", &valid, b"not a png").is_err());
        assert!(store.list().unwrap().is_empty());
    }

    #[test]
    fn base64_import_is_bounded_before_decode_and_roundtrips_valid_pngs() {
        let directory = tempfile::tempdir().unwrap();
        let store = BackgroundStore::new(directory.path().join("workspace-backgrounds"));
        let image = base64::engine::general_purpose::STANDARD.encode(png(2, 2));
        let thumbnail = base64::engine::general_purpose::STANDARD.encode(png(1, 1));

        assert!(
            store
                .import_base64(
                    "too large",
                    &"A".repeat(maximum_base64_length(MAX_IMAGE_BYTES) + 1),
                    &thumbnail,
                )
                .is_err()
        );
        assert!(
            store
                .import_base64("invalid", "not-base64", &thumbnail)
                .is_err()
        );
        let stored = store.import_base64("encoded", &image, &thumbnail).unwrap();
        assert_eq!(store.list().unwrap(), vec![stored]);
    }

    #[test]
    fn byte_and_dimension_limits_fail_closed() {
        let directory = tempfile::tempdir().unwrap();
        let store = BackgroundStore::new(directory.path().join("workspace-backgrounds"));
        let tiny = png(1, 1);

        assert!(
            store
                .import("large bytes", &vec![0; 8 * 1024 * 1024 + 1], &tiny)
                .is_err()
        );
        assert!(
            store
                .import("large thumb bytes", &tiny, &vec![0; 256 * 1024 + 1])
                .is_err()
        );
        assert!(store.import("wide image", &png(4097, 1), &tiny).is_err());
        assert!(store.import("wide thumbnail", &tiny, &png(513, 1)).is_err());
    }

    #[test]
    fn foreign_ids_never_become_paths() {
        let directory = tempfile::tempdir().unwrap();
        let store = BackgroundStore::new(directory.path().join("workspace-backgrounds"));

        for foreign in [
            "../outside",
            "not-a-uuid",
            "00000000-0000-0000-0000-000000000000.png",
        ] {
            assert!(store.image_data_url(foreign).is_err());
            assert!(store.remove(foreign).is_err());
        }
    }

    #[test]
    fn unavailable_storage_root_fails_without_touching_the_blocking_file() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("workspace-backgrounds");
        std::fs::write(&root, b"neighbor").unwrap();
        let store = BackgroundStore::new(root.clone());

        assert!(store.import("image", &png(1, 1), &png(1, 1)).is_err());
        assert_eq!(std::fs::read(root).unwrap(), b"neighbor");
    }

    #[test]
    fn removal_preserves_the_original_and_unmanaged_neighbor_files() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("source.png");
        let source_bytes = png(2, 2);
        std::fs::write(&source, &source_bytes).unwrap();
        let root = directory.path().join("workspace-backgrounds");
        let store = BackgroundStore::new(root.clone());
        let stored = store
            .import("source", &std::fs::read(&source).unwrap(), &png(1, 1))
            .unwrap();
        let neighbor = root.join("notes.txt");
        std::fs::write(&neighbor, b"keep me").unwrap();

        store.remove(&stored.id).unwrap();

        assert_eq!(std::fs::read(source).unwrap(), source_bytes);
        assert_eq!(std::fs::read(neighbor).unwrap(), b"keep me");
    }

    #[test]
    fn corrupt_managed_metadata_fails_closed_without_unbounded_read() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("workspace-backgrounds");
        std::fs::create_dir(&root).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        std::fs::write(root.join(format!("{id}.json")), vec![b'x'; 5000]).unwrap();
        let store = BackgroundStore::new(root);

        assert!(store.list().is_err());
    }

    #[test]
    fn catalog_capacity_is_bounded() {
        let directory = tempfile::tempdir().unwrap();
        let store = BackgroundStore::new(directory.path().join("workspace-backgrounds"));
        let tiny = png(1, 1);

        for index in 0..MAX_CATALOG_ITEMS {
            store
                .import(&format!("background {index}"), &tiny, &tiny)
                .unwrap();
        }

        assert_eq!(store.list().unwrap().len(), MAX_CATALOG_ITEMS);
        assert!(store.import("one too many", &tiny, &tiny).is_err());
    }

    #[test]
    fn failed_new_file_write_removes_its_partial_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("partial.png");

        let result = write_new_file_with(&path, |file| {
            file.write_all(b"partial")?;
            Err(io::Error::other("injected write failure"))
        });

        assert!(result.is_err());
        assert!(!path.exists());
    }

    #[test]
    fn atomic_metadata_publication_never_overwrites_a_collision() {
        let directory = tempfile::tempdir().unwrap();
        let metadata_path = directory.path().join("background.json");
        std::fs::write(&metadata_path, b"existing").unwrap();

        assert!(publish_metadata_atomic(&metadata_path, b"replacement").is_err());
        assert_eq!(std::fs::read(&metadata_path).unwrap(), b"existing");
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn incomplete_owned_item_does_not_hide_healthy_items_and_remains_removable() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("workspace-backgrounds");
        let store = BackgroundStore::new(root.clone());
        let tiny = png(1, 1);
        let incomplete = store.import("incomplete", &tiny, &tiny).unwrap();
        let healthy = store.import("healthy", &tiny, &tiny).unwrap();
        std::fs::remove_file(root.join(format!("{}.png", incomplete.id))).unwrap();
        std::fs::remove_file(root.join(format!("{}.thumb.png", incomplete.id))).unwrap();

        let items = store.list().unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(
            items
                .iter()
                .find(|item| item.id == incomplete.id)
                .unwrap()
                .thumbnail_data_url,
            ""
        );
        assert!(
            items
                .iter()
                .find(|item| item.id == healthy.id)
                .unwrap()
                .thumbnail_data_url
                .starts_with(DATA_URL_PREFIX)
        );
        assert!(store.image_data_url(&incomplete.id).is_err());

        store.remove(&incomplete.id).unwrap();
        assert_eq!(store.list().unwrap(), vec![healthy]);
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_storage_root_is_rejected() {
        let directory = tempfile::tempdir().unwrap();
        let outside = directory.path().join("outside");
        std::fs::create_dir(&outside).unwrap();
        let root = directory.path().join("workspace-backgrounds");
        std::os::unix::fs::symlink(&outside, &root).unwrap();
        let store = BackgroundStore::new(root);

        assert!(store.import("image", &png(1, 1), &png(1, 1)).is_err());
        assert!(std::fs::read_dir(outside).unwrap().next().is_none());
    }

    #[cfg(windows)]
    #[test]
    fn symlinked_storage_root_is_rejected_when_windows_allows_symlink_creation() {
        let directory = tempfile::tempdir().unwrap();
        let outside = directory.path().join("outside");
        std::fs::create_dir(&outside).unwrap();
        let root = directory.path().join("workspace-backgrounds");
        if let Err(error) = std::os::windows::fs::symlink_dir(&outside, &root) {
            if error.kind() == io::ErrorKind::PermissionDenied || error.raw_os_error() == Some(1314)
            {
                return;
            }
            panic!("unexpected symlink creation error: {error}");
        }
        let store = BackgroundStore::new(root);

        assert!(store.import("image", &png(1, 1), &png(1, 1)).is_err());
        assert!(std::fs::read_dir(outside).unwrap().next().is_none());
    }
}
