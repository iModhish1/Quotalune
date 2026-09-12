use crate::core::ProviderId;
use sha2::{Digest, Sha256};
use std::borrow::Cow;
use std::fs::OpenOptions;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

const APP_ICON: &[u8] = include_bytes!("../../../assets/brand/icons/quotaarc-icon-128.png");

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct MaterializedIcon {
    pub(super) path: PathBuf,
    pub(super) alternate_text: String,
}

fn content_name_and_bytes(provider: Option<ProviderId>) -> (String, Cow<'static, [u8]>, String) {
    if let Some(provider) = provider
        && let Some(bytes) = crate::tray::provider_logo_png(provider.cli_name())
    {
        return (
            format!("provider-{}", provider.cli_name()),
            Cow::Borrowed(bytes),
            provider.display_name().to_string(),
        );
    }
    (
        "quotalis".to_string(),
        Cow::Borrowed(APP_ICON),
        "Quotalis".to_string(),
    )
}

fn write_immutable(path: &Path, bytes: &[u8]) -> io::Result<()> {
    if path.is_file() && std::fs::read(path).is_ok_and(|existing| existing == bytes) {
        return Ok(());
    }

    match OpenOptions::new().write(true).create_new(true).open(path) {
        Ok(mut file) => {
            if let Err(error) = file.write_all(bytes).and_then(|()| file.sync_all()) {
                drop(file);
                drop(std::fs::remove_file(path));
                return Err(error);
            }
            Ok(())
        }
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            let existing = std::fs::read(path)?;
            if existing == bytes {
                Ok(())
            } else {
                Err(io::Error::new(
                    io::ErrorKind::AlreadyExists,
                    "notification icon path contains unexpected content",
                ))
            }
        }
        Err(error) => Err(error),
    }
}

/// Materialize the embedded icon under the current channel's config root.
/// Windows resolves toast images outside the WebView process; a local profile
/// path remains readable when a Dev executable itself lives on a mapped drive.
pub(super) fn materialize_icon(
    config_root: &Path,
    provider: Option<ProviderId>,
) -> io::Result<MaterializedIcon> {
    let (name, bytes, alternate_text) = content_name_and_bytes(provider);
    let digest = Sha256::digest(bytes.as_ref());
    let revision = format!("{:x}", digest);
    let asset_dir = config_root.join("notification-assets");
    std::fs::create_dir_all(&asset_dir)?;
    let path = asset_dir.join(format!("{name}-{}.png", &revision[..16]));
    write_immutable(&path, bytes.as_ref())?;
    Ok(MaterializedIcon {
        path,
        alternate_text,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::GenericImageView;

    #[test]
    fn materializes_provider_logo_as_bounded_png() {
        let root = tempfile::tempdir().unwrap();
        let icon = materialize_icon(root.path(), Some(ProviderId::Claude)).unwrap();
        let image = image::load_from_memory(&std::fs::read(&icon.path).unwrap()).unwrap();

        assert_eq!(icon.alternate_text, "Claude");
        assert_eq!(
            icon.path.extension().and_then(|value| value.to_str()),
            Some("png")
        );
        assert_eq!(image.dimensions(), (96, 96));
    }

    #[test]
    fn provider_without_verified_mark_falls_back_to_original_quotalis_asset() {
        let root = tempfile::tempdir().unwrap();
        let icon = materialize_icon(root.path(), Some(ProviderId::AzureOpenAI)).unwrap();

        assert_eq!(icon.alternate_text, "Quotalis");
        assert_eq!(std::fs::read(icon.path).unwrap(), APP_ICON);
    }

    #[test]
    fn all_verified_provider_marks_decode_as_bounded_pngs() {
        let mut verified = 0;
        for provider in ProviderId::all() {
            let Some(bytes) = crate::tray::provider_logo_png(provider.cli_name()) else {
                continue;
            };
            let image = image::load_from_memory(bytes).unwrap();
            assert_eq!(image.dimensions(), (96, 96), "{}", provider.cli_name());
            verified += 1;
        }
        assert_eq!(verified, 62);
    }

    #[test]
    fn materialization_is_stable_and_does_not_rewrite_valid_assets() {
        let root = tempfile::tempdir().unwrap();
        let first = materialize_icon(root.path(), Some(ProviderId::Codex)).unwrap();
        let before = std::fs::metadata(&first.path).unwrap().modified().unwrap();
        let second = materialize_icon(root.path(), Some(ProviderId::Codex)).unwrap();

        assert_eq!(first, second);
        assert_eq!(
            before,
            std::fs::metadata(&second.path).unwrap().modified().unwrap()
        );
    }
}
