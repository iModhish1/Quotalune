//! Auto-update checker for Quotalis
//! Checks GitHub releases for new versions and handles background downloads

use crate::settings::{Settings, UpdateChannel};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::watch;

/// Quotalis publishing target confirmed by the owner. No upstream update fallback.
const GITHUB_REPO: &str = "iModhish1/Quotalis";
const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// State of the update download process
#[derive(Debug, Clone, PartialEq, Default)]
pub enum UpdateState {
    /// No update available or not checked
    #[default]
    Idle,
    /// Update available but not downloaded
    Available,
    /// Currently downloading with progress (0.0 to 1.0)
    Downloading(f32),
    /// Download complete, ready to install
    Ready(PathBuf),
    /// Download or install failed
    Failed(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateDelivery {
    Installer,
    Manual,
}

#[derive(Debug, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub download_url: String,
    pub expected_sha256: Option<String>,
    #[allow(
        dead_code,
        reason = "update metadata fields are deserialized for version comparison but not all are read"
    )]
    pub release_url: String,
    #[allow(
        dead_code,
        reason = "update metadata fields are deserialized for version comparison but not all are read"
    )]
    pub release_notes: String,
    pub delivery: UpdateDelivery,
}

impl UpdateInfo {
    pub fn supports_auto_apply(&self) -> bool {
        self.delivery == UpdateDelivery::Installer
    }

    pub fn supports_auto_download(&self) -> bool {
        self.delivery == UpdateDelivery::Installer && self.expected_sha256.is_some()
    }
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    body: Option<String>,
    assets: Vec<GitHubAsset>,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    #[allow(
        dead_code,
        reason = "update metadata fields are deserialized for version comparison but not all are read"
    )]
    prerelease: bool,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    #[serde(default)]
    digest: Option<String>,
}

/// Check for updates from GitHub releases
///
/// When `channel` is `UpdateChannel::Beta`, includes pre-release versions.
/// When `channel` is `UpdateChannel::Stable`, only considers stable releases.
#[allow(
    dead_code,
    reason = "update check response fields are deserialized for parsing but not all are read"
)]
pub async fn check_for_updates() -> Option<UpdateInfo> {
    check_for_updates_with_channel(Settings::load().update_channel).await
}

/// Check for updates from GitHub releases with a specific channel
///
/// When `channel` is `UpdateChannel::Beta`, includes pre-release versions.
/// When `channel` is `UpdateChannel::Stable`, only considers stable releases.
pub async fn check_for_updates_with_channel(channel: UpdateChannel) -> Option<UpdateInfo> {
    if !channel.is_remote() {
        // Local channel: never poll a remote repository.
        return None;
    }
    let client = update_client()?;
    let response = client.get(release_url(channel)).send().await.ok()?;
    let release = parse_release_response(response, channel).await?;
    let remote_version = remote_version_from_tag(&release.tag_name);

    if is_newer_version(remote_version, CURRENT_VERSION) {
        select_release_target(&release)
    } else {
        None
    }
}

fn release_url(channel: UpdateChannel) -> String {
    match channel {
        UpdateChannel::Local => format!(
            "https://api.github.com/repos/{}/releases/latest",
            GITHUB_REPO
        ),
        UpdateChannel::Beta => format!("https://api.github.com/repos/{}/releases", GITHUB_REPO),
        UpdateChannel::Stable => {
            format!(
                "https://api.github.com/repos/{}/releases/latest",
                GITHUB_REPO
            )
        }
    }
}

fn update_client() -> Option<reqwest::Client> {
    crate::core::apply_app_proxy(reqwest::Client::builder())
        .user_agent(crate::paths::USER_AGENT)
        .build()
        .ok()
}

async fn parse_release_response(
    response: reqwest::Response,
    channel: UpdateChannel,
) -> Option<GitHubRelease> {
    if !response.status().is_success() {
        tracing::debug!("GitHub API returned status: {}", response.status());
        return None;
    }

    match channel {
        UpdateChannel::Local => None, // unreachable: Local never performs a request
        UpdateChannel::Beta => {
            let releases: Vec<GitHubRelease> = response.json().await.ok()?;
            releases.into_iter().find(|r| !r.draft)
        }
        UpdateChannel::Stable => response.json().await.ok(),
    }
}

fn remote_version_from_tag(tag_name: &str) -> &str {
    tag_name
        .trim_start_matches('v')
        .split('-')
        .next()
        .unwrap_or(tag_name)
}

fn select_release_target(release: &GitHubRelease) -> Option<UpdateInfo> {
    select_release_target_for_family(release, installed_windows_package_family())
}

fn select_release_target_for_family(
    release: &GitHubRelease,
    installed_family: WindowsPackageFamily,
) -> Option<UpdateInfo> {
    if release.draft || !is_owner_release_url(&release.html_url, &release.tag_name, "tag") {
        return None;
    }
    let compatible_kind = installed_family.compatible_installer_kind();

    // A release may contain several packaging technologies. Crossing from one
    // installer family to another can orphan uninstall/upgrade identity, so an
    // automatic target exists only when the installed family is proven and a
    // matching asset is present. Unknown and portable installs remain manual.
    let installer = release
        .assets
        .iter()
        .filter_map(|asset| {
            let kind = installer_kind_from_name(&asset.name)?;
            if Some(kind) != compatible_kind
                || !is_owner_release_url(&asset.browser_download_url, &release.tag_name, "download")
            {
                return None;
            }
            Some((installer_asset_preference(&asset.name, kind), asset))
        })
        .min_by(|(left, _), (right, _)| left.cmp(right))
        .map(|(_, asset)| asset);

    let (download_url, delivery, expected_sha256) = if let Some(asset) = installer {
        (
            asset.browser_download_url.clone(),
            UpdateDelivery::Installer,
            asset
                .digest
                .as_deref()
                .and_then(parse_sha256_digest)
                .map(str::to_string),
        )
    } else {
        (release.html_url.clone(), UpdateDelivery::Manual, None)
    };

    Some(UpdateInfo {
        version: release.tag_name.clone(),
        download_url,
        expected_sha256,
        release_url: release.html_url.clone(),
        release_notes: release.body.clone().unwrap_or_default(),
        delivery,
    })
}

/// API metadata must stay within this product's repository and release tag.
/// A GitHub lookalike host, credentials, query or another owner's asset is rejected.
fn is_owner_release_url(value: &str, tag: &str, kind: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };
    if url.scheme() != "https"
        || url.host_str() != Some("github.com")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || tag.is_empty()
        || tag.contains(['/', '\\', '?', '#', '%'])
    {
        return false;
    }
    let expected = format!("/{GITHUB_REPO}/releases/{kind}/{tag}");
    match kind {
        "tag" => url.path() == expected,
        "download" => url
            .path()
            .strip_prefix(&format!("{expected}/"))
            .is_some_and(|asset| !asset.is_empty() && !asset.contains(['/', '%', '\\'])),
        _ => false,
    }
}

fn is_installer_asset_name(name: &str) -> bool {
    installer_kind_from_name(name).is_some()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WindowsInstallerKind {
    Nsis,
    Inno,
    Msi,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WindowsPackageFamily {
    Nsis,
    Inno,
    Msi,
    PortableOrUnknown,
}

impl WindowsPackageFamily {
    fn compatible_installer_kind(self) -> Option<WindowsInstallerKind> {
        match self {
            Self::Nsis => Some(WindowsInstallerKind::Nsis),
            Self::Inno => Some(WindowsInstallerKind::Inno),
            Self::Msi => Some(WindowsInstallerKind::Msi),
            Self::PortableOrUnknown => None,
        }
    }
}

fn installed_windows_package_family() -> WindowsPackageFamily {
    #[cfg(target_os = "windows")]
    {
        let Ok(current_exe) = std::env::current_exe() else {
            return WindowsPackageFamily::PortableOrUnknown;
        };
        detect_windows_package_family(&current_exe)
    }

    #[cfg(not(target_os = "windows"))]
    {
        WindowsPackageFamily::PortableOrUnknown
    }
}

#[cfg(target_os = "windows")]
fn detect_windows_package_family(current_exe: &Path) -> WindowsPackageFamily {
    use winreg::RegKey;
    use winreg::enums::{
        HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY,
    };

    if !is_stable_windows_binary_name(current_exe) {
        return WindowsPackageFamily::PortableOrUnknown;
    }
    let Some(install_dir) = current_exe.parent() else {
        return WindowsPackageFamily::PortableOrUnknown;
    };

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if registry_install_matches(
        &hkcu,
        r"Software\Microsoft\Windows\CurrentVersion\Uninstall\QuotaArcDesktop_is1",
        install_dir,
        WindowsPackageFamily::Inno,
    ) {
        return WindowsPackageFamily::Inno;
    }

    for key_name in ["Quotalis", "QuotaArc"] {
        let key_path = format!(r"Software\Microsoft\Windows\CurrentVersion\Uninstall\{key_name}");
        if registry_install_matches(&hkcu, &key_path, install_dir, WindowsPackageFamily::Nsis) {
            return WindowsPackageFamily::Nsis;
        }
    }

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    for view in [KEY_READ | KEY_WOW64_64KEY, KEY_READ | KEY_WOW64_32KEY] {
        let Ok(uninstall) = hklm
            .open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Uninstall", view)
        else {
            continue;
        };
        for subkey_name in uninstall.enum_keys().filter_map(Result::ok) {
            let Ok(subkey) = uninstall.open_subkey_with_flags(&subkey_name, view) else {
                continue;
            };
            let display_name = subkey.get_value::<String, _>("DisplayName").ok();
            let publisher = subkey.get_value::<String, _>("Publisher").ok();
            let windows_installer = subkey.get_value::<u32, _>("WindowsInstaller").ok();
            let install_location = subkey.get_value::<String, _>("InstallLocation").ok();
            if windows_installer == Some(1)
                && display_name
                    .as_deref()
                    .is_some_and(is_quotalis_product_name)
                && publisher.as_deref().is_some_and(is_quotalis_publisher)
                && install_location
                    .as_deref()
                    .is_some_and(|path| registry_location_matches(path, install_dir))
            {
                return WindowsPackageFamily::Msi;
            }
        }
    }

    WindowsPackageFamily::PortableOrUnknown
}

#[cfg(target_os = "windows")]
fn is_stable_windows_binary_name(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| {
            [
                "Quotalis.exe",
                "quotalis-desktop.exe",
                "QuotaArc.exe",
                "codexbar.exe",
                "codexbar-desktop.exe",
            ]
            .iter()
            .any(|expected| name.eq_ignore_ascii_case(expected))
        })
}

#[cfg(target_os = "windows")]
fn registry_install_matches(
    root: &winreg::RegKey,
    key_path: &str,
    install_dir: &Path,
    family: WindowsPackageFamily,
) -> bool {
    let Ok(key) = root.open_subkey(key_path) else {
        return false;
    };
    let Ok(location) = key.get_value::<String, _>("InstallLocation") else {
        return false;
    };
    let Ok(uninstall_command) = key.get_value::<String, _>("UninstallString") else {
        return false;
    };
    if !registry_location_matches(&location, install_dir) {
        return false;
    }

    let Some(uninstaller) = quoted_command_executable(&uninstall_command) else {
        return false;
    };
    let expected_name = match family {
        WindowsPackageFamily::Nsis => uninstaller
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.eq_ignore_ascii_case("uninstall.exe")),
        WindowsPackageFamily::Inno => uninstaller
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(is_inno_uninstaller_name),
        _ => false,
    };
    expected_name
        && uninstaller
            .parent()
            .is_some_and(|parent| same_windows_path(parent, install_dir))
}

#[cfg(target_os = "windows")]
fn registry_location_matches(value: &str, install_dir: &Path) -> bool {
    let normalized = value.trim().trim_matches('"');
    !normalized.is_empty() && same_windows_path(Path::new(normalized), install_dir)
}

#[cfg(target_os = "windows")]
fn same_windows_path(left: &Path, right: &Path) -> bool {
    match (std::fs::canonicalize(left), std::fs::canonicalize(right)) {
        (Ok(left), Ok(right)) => left
            .to_string_lossy()
            .eq_ignore_ascii_case(&right.to_string_lossy()),
        _ => false,
    }
}

#[cfg(target_os = "windows")]
fn quoted_command_executable(command: &str) -> Option<PathBuf> {
    let command = command.trim();
    let rest = command.strip_prefix('"')?;
    let end = rest.find('"')?;
    let executable = &rest[..end];
    (!executable.is_empty()).then(|| PathBuf::from(executable))
}

#[cfg(target_os = "windows")]
fn is_inno_uninstaller_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower
        .strip_prefix("unins")
        .and_then(|rest| rest.strip_suffix(".exe"))
        .is_some_and(|digits| digits.len() == 3 && digits.chars().all(|ch| ch.is_ascii_digit()))
}

#[cfg(target_os = "windows")]
fn is_quotalis_product_name(name: &str) -> bool {
    name.eq_ignore_ascii_case("Quotalis") || name.eq_ignore_ascii_case("QuotaArc")
}

#[cfg(target_os = "windows")]
fn is_quotalis_publisher(name: &str) -> bool {
    name.eq_ignore_ascii_case("Quotalis") || name.eq_ignore_ascii_case("quotaarc")
}

/// Classify only installer names actually produced by Quotalis packaging.
///
/// Tauri NSIS uses `Quotalis_<version>_x64-setup.exe`; the legacy Inno
/// publisher uses `Quotalis-<version>-Setup.exe`; WiX uses
/// `Quotalis_<version>_x64_<locale>.msi`. The legacy public QuotaArc prefix
/// remains accepted for upgrade continuity. Dev packages are deliberately
/// rejected because remote updates are for the stable product identity.
fn installer_kind_from_name(name: &str) -> Option<WindowsInstallerKind> {
    let lower = name.to_ascii_lowercase();
    if strip_brand_prefix(&lower, '_')
        .and_then(|rest| rest.strip_suffix("_x64-setup.exe"))
        .filter(|version| is_numeric_version(version))
        .is_some()
    {
        return Some(WindowsInstallerKind::Nsis);
    }

    if strip_brand_prefix(&lower, '-')
        .and_then(|rest| rest.strip_suffix("-setup.exe"))
        .filter(|value| is_inno_version_fragment(value))
        .is_some()
    {
        return Some(WindowsInstallerKind::Inno);
    }

    if let Some(version_arch_locale) =
        strip_brand_prefix(&lower, '_').and_then(|rest| rest.strip_suffix(".msi"))
        && let Some((version, locale)) = version_arch_locale.split_once("_x64_")
        && is_numeric_version(version)
        && is_supported_msi_locale(locale)
    {
        return Some(WindowsInstallerKind::Msi);
    }

    None
}

fn strip_brand_prefix(name: &str, separator: char) -> Option<&str> {
    match separator {
        '_' => name
            .strip_prefix("quotalis_")
            .or_else(|| name.strip_prefix("quotaarc_")),
        '-' => name
            .strip_prefix("quotalis-")
            .or_else(|| name.strip_prefix("quotaarc-")),
        _ => None,
    }
}

fn is_numeric_version(value: &str) -> bool {
    let mut parts = value.split('.');
    let valid = (&mut parts)
        .take(3)
        .all(|part| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit()));
    valid && parts.next().is_none() && value.split('.').count() == 3
}

fn is_inno_version_fragment(value: &str) -> bool {
    let numeric = value.split('-').next().unwrap_or_default();
    is_numeric_version(numeric)
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-'))
}

fn is_supported_msi_locale(locale: &str) -> bool {
    matches!(
        locale,
        "en-us" | "zh-cn" | "zh-tw" | "ja-jp" | "ko-kr" | "es-es" | "ru-ru" | "tr-tr"
    )
}

fn installer_asset_preference(name: &str, kind: WindowsInstallerKind) -> (u8, u8, String) {
    let lower = name.to_ascii_lowercase();
    // `kind` is already constrained to the installed family. Keep the first
    // field for a stable tuple shape and prefer en-US among localized MSI files.
    let kind_rank = 0;
    let locale_rank = if kind == WindowsInstallerKind::Msi && !lower.ends_with("_en-us.msi") {
        1
    } else {
        0
    };
    (kind_rank, locale_rank, lower)
}

fn parse_version_triplet(v: &str) -> (u32, u32, u32) {
    let parts: Vec<u32> = v.split('.').filter_map(|p| p.parse().ok()).collect();
    (
        parts.first().copied().unwrap_or(0),
        parts.get(1).copied().unwrap_or(0),
        parts.get(2).copied().unwrap_or(0),
    )
}

fn installer_version_from_name(name: &str) -> Option<(u32, u32, u32)> {
    let kind = installer_kind_from_name(name)?;
    let lower = name.to_ascii_lowercase();
    let stem = lower
        .strip_suffix("-setup.exe")
        .or_else(|| lower.strip_suffix(".msi"))?;

    let separator = if kind == WindowsInstallerKind::Inno {
        '-'
    } else {
        '_'
    };
    let version_candidate = strip_brand_prefix(stem, separator)?;
    let version_text: String = version_candidate
        .chars()
        .skip_while(|ch| !ch.is_ascii_digit())
        .take_while(|ch| ch.is_ascii_digit() || *ch == '.')
        .collect();

    if version_text.is_empty() {
        return None;
    }

    let version = parse_version_triplet(&version_text);
    if version == (0, 0, 0) {
        return None;
    }

    Some(version)
}

fn parse_sha256_digest(digest: &str) -> Option<&str> {
    let (algo, hex) = digest.split_once(':')?;
    if !algo.eq_ignore_ascii_case("sha256") {
        return None;
    }

    let hex = hex.trim();
    if hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
        Some(hex)
    } else {
        None
    }
}

/// Compare semantic versions, returns true if remote is newer
fn is_newer_version(remote: &str, current: &str) -> bool {
    let remote_v = parse_version_triplet(remote);
    let current_v = parse_version_triplet(current);

    remote_v > current_v
}

/// Get the current version
#[allow(
    dead_code,
    reason = "update info struct reserved for future UI integration"
)]
pub fn current_version() -> &'static str {
    CURRENT_VERSION
}

/// Get the download directory for updates
fn get_download_dir() -> Option<PathBuf> {
    crate::paths::cache_dir().map(|p| p.join("updates"))
}

/// Download an update with progress reporting
///
/// Returns a receiver that will receive progress updates (0.0 to 1.0)
/// and the final downloaded file path on completion.
pub async fn download_update(
    update_info: &UpdateInfo,
    progress_tx: watch::Sender<UpdateState>,
) -> Result<PathBuf, String> {
    validate_auto_download(update_info)?;

    let file_path = prepare_download_path(update_info)?;
    let response = start_download(&update_info.download_url).await?;
    write_download_response(response, &file_path, &progress_tx).await?;
    verify_download_hash(&file_path, expected_update_sha256(update_info)?).await?;

    // Signal download complete; the receiver may be gone, which is fine.
    let _ready_signal = progress_tx.send(UpdateState::Ready(file_path.clone()));

    Ok(file_path)
}

fn validate_auto_download(update_info: &UpdateInfo) -> Result<(), String> {
    if !update_info.supports_auto_download() {
        return Err("This update must be downloaded manually from the release page.".to_string());
    }

    let file_name = download_filename(&update_info.download_url);
    validate_installer_family(&file_name, installed_windows_package_family()).map(|_| ())
}

fn validate_installer_family(
    installer_name: &str,
    installed_family: WindowsPackageFamily,
) -> Result<WindowsInstallerKind, String> {
    let installer_kind = installer_kind_from_name(installer_name).ok_or_else(|| {
        "Downloaded update installer format is not recognized; update manually from the release page"
            .to_string()
    })?;
    match installed_family.compatible_installer_kind() {
        Some(expected) if expected == installer_kind => Ok(installer_kind),
        Some(_) => Err(
            "Downloaded update uses a different installer family; update manually from the release page"
                .to_string(),
        ),
        None => Err(
            "The current installation type could not be verified for automatic update; update manually from the release page"
                .to_string(),
        ),
    }
}

fn prepare_download_path(update_info: &UpdateInfo) -> Result<PathBuf, String> {
    let download_dir =
        get_download_dir().ok_or_else(|| "Could not determine download directory".to_string())?;

    std::fs::create_dir_all(&download_dir)
        .map_err(|e| format!("Failed to create download directory: {}", e))?;

    Ok(download_dir.join(download_filename(&update_info.download_url)))
}

fn download_filename(download_url: &str) -> String {
    download_url
        .split('/')
        .next_back()
        .unwrap_or("QuotaArc-Setup.exe")
        .to_string()
}

fn expected_update_sha256(update_info: &UpdateInfo) -> Result<&str, String> {
    update_info
        .expected_sha256
        .as_deref()
        .ok_or_else(|| "Missing SHA256 digest for update asset".to_string())
}

fn update_http_client() -> Result<reqwest::Client, String> {
    crate::core::apply_app_proxy(reqwest::Client::builder())
        .user_agent(crate::paths::USER_AGENT)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}

async fn start_download(download_url: &str) -> Result<reqwest::Response, String> {
    let response = update_http_client()?
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;

    if response.status().is_success() {
        Ok(response)
    } else {
        Err(format!(
            "Download failed with status: {}",
            response.status()
        ))
    }
}

async fn write_download_response(
    response: reqwest::Response,
    file_path: &Path,
    progress_tx: &watch::Sender<UpdateState>,
) -> Result<(), String> {
    use futures::StreamExt;
    use tokio::io::AsyncWriteExt;

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut file = tokio::fs::File::create(file_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Error downloading chunk: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;
        send_download_progress(progress_tx, downloaded, total_size);
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush file: {}", e))
}

fn send_download_progress(
    progress_tx: &watch::Sender<UpdateState>,
    downloaded: u64,
    total_size: u64,
) {
    let progress = if total_size > 0 {
        (downloaded as f32 / total_size as f32).clamp(0.0, 1.0)
    } else {
        0.0
    };

    // Best-effort progress update; a dropped receiver is fine.
    let _progress_update = progress_tx.send(UpdateState::Downloading(progress));
}

/// Verify the SHA256 hash of a downloaded file against release metadata.
async fn verify_download_hash(file_path: &PathBuf, expected_hash: &str) -> Result<(), String> {
    let actual = sha256_file_async(file_path).await?;
    if let Err(e) = verify_sha256_hex(&actual, expected_hash) {
        // Best-effort cleanup of the corrupt download; the hash error is returned regardless.
        let _removed = std::fs::remove_file(file_path);
        return Err(e);
    }

    tracing::info!("SHA256 verification passed for {:?}", file_path);
    Ok(())
}

/// Re-verify an installer immediately before launching it.
pub fn verify_installer_hash(file_path: &Path, expected_hash: &str) -> Result<(), String> {
    let actual = sha256_file(file_path)?;
    verify_sha256_hex(&actual, expected_hash)
}

fn verify_sha256_hex(actual_hash: &str, expected_hash: &str) -> Result<(), String> {
    let expected = expected_hash.trim().to_ascii_lowercase();
    if expected.len() != 64 || !expected.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid SHA256 digest provided for update asset".to_string());
    }

    if actual_hash != expected {
        return Err("SHA256 mismatch. Download may be corrupted or tampered.".to_string());
    }

    Ok(())
}

async fn sha256_file_async(file_path: &Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};

    let file_bytes = tokio::fs::read(file_path)
        .await
        .map_err(|e| format!("Failed to read downloaded file for hashing: {}", e))?;

    let mut hasher = Sha256::new();
    hasher.update(&file_bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

fn sha256_file(file_path: &Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};

    let file_bytes = std::fs::read(file_path)
        .map_err(|e| format!("Failed to read downloaded file for hashing: {}", e))?;

    let mut hasher = Sha256::new();
    hasher.update(&file_bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

/// Start background download of an update
///
/// Returns a receiver that can be polled for progress updates.
#[allow(
    dead_code,
    reason = "update info struct reserved for future UI integration"
)]
pub fn start_background_download(
    update_info: UpdateInfo,
) -> (
    Arc<watch::Receiver<UpdateState>>,
    std::thread::JoinHandle<()>,
) {
    let (tx, rx) = watch::channel(UpdateState::Available);
    let rx = Arc::new(rx);

    let handle = std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            match download_update(&update_info, tx.clone()).await {
                Ok(_path) => {
                    // UpdateState::Ready is already sent by download_update
                }
                Err(e) => {
                    // Best-effort failure signal; the receiver may already be gone.
                    let _failure_signal = tx.send(UpdateState::Failed(e));
                }
            }
        });
    });

    (rx, handle)
}

/// Apply a downloaded update by spawning the installer and exiting
///
/// This function will:
/// 1. Spawn the installer executable
/// 2. Exit the current application
///
/// The installer should handle upgrading the application while it's closed.
pub fn apply_update(installer_path: &PathBuf) -> Result<(), String> {
    // Verify the file exists
    if !installer_path.exists() {
        return Err(format!("Installer not found: {:?}", installer_path));
    }

    let file_name = installer_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    if !is_installer_asset_name(file_name) {
        return Err(
            "Downloaded update is not an installer. Open the release page to update manually."
                .to_string(),
        );
    }
    validate_installer_family(file_name, installed_windows_package_family())?;

    #[cfg(target_os = "windows")]
    spawn_windows_installer(
        installer_path,
        &windows_update_relaunch_path(
            &std::env::current_exe()
                .map_err(|e| format!("Failed to determine current executable for restart: {e}"))?,
        ),
    )?;

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;

        Command::new(installer_path)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

    // Exit the application to allow the installer to proceed
    std::process::exit(0);
}

#[cfg(target_os = "windows")]
fn windows_update_relaunch_path(current_exe: &Path) -> PathBuf {
    let file_name = current_exe.file_name().and_then(|name| name.to_str());
    if file_name.is_some_and(|name| name.eq_ignore_ascii_case("codexbar-desktop.exe"))
        && let Some(primary_desktop_exe) = current_exe
            .parent()
            .map(|dir| dir.join("codexbar.exe"))
            .filter(|path| path.exists())
    {
        return primary_desktop_exe;
    }

    current_exe.to_path_buf()
}

#[cfg(target_os = "windows")]
fn spawn_windows_installer(installer_path: &Path, relaunch_path: &Path) -> Result<(), String> {
    use std::process::Command;

    let plan = windows_installer_launch_plan(installer_path)?;
    Command::new(windows_powershell_path())
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &windows_installer_apply_script(&plan, std::process::id(), relaunch_path),
        ])
        .spawn()
        .map_err(|e| format!("Failed to launch installer: {}", e))?;
    Ok(())
}

#[cfg(target_os = "windows")]
struct WindowsInstallerLaunchPlan {
    program: PathBuf,
    args: Vec<std::ffi::OsString>,
}

#[cfg(target_os = "windows")]
fn windows_installer_launch_plan(
    installer_path: &Path,
) -> Result<WindowsInstallerLaunchPlan, String> {
    let file_name = installer_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Downloaded update has no valid installer file name".to_string())?;
    let kind = installer_kind_from_name(file_name).ok_or_else(|| {
        "Downloaded update installer format is not recognized; update manually from the release page"
            .to_string()
    })?;

    match kind {
        WindowsInstallerKind::Msi => Ok(WindowsInstallerLaunchPlan {
            program: PathBuf::from("msiexec.exe"),
            args: vec![
                std::ffi::OsString::from("/i"),
                installer_path.as_os_str().to_os_string(),
                std::ffi::OsString::from("/quiet"),
                std::ffi::OsString::from("/norestart"),
            ],
        }),
        WindowsInstallerKind::Nsis => Ok(WindowsInstallerLaunchPlan {
            program: installer_path.to_path_buf(),
            args: vec![std::ffi::OsString::from("/S")],
        }),
        WindowsInstallerKind::Inno => Ok(WindowsInstallerLaunchPlan {
            program: installer_path.to_path_buf(),
            args: vec![
                std::ffi::OsString::from("/SILENT"),
                std::ffi::OsString::from("/SUPPRESSMSGBOXES"),
                std::ffi::OsString::from("/CLOSEAPPLICATIONS"),
                std::ffi::OsString::from("/NORESTART"),
            ],
        }),
    }
}

#[cfg(target_os = "windows")]
fn windows_installer_apply_script(
    plan: &WindowsInstallerLaunchPlan,
    current_pid: u32,
    relaunch_path: &Path,
) -> String {
    format!(
        "Wait-Process -Id {current_pid} -ErrorAction SilentlyContinue; \
         $p = Start-Process -FilePath {} -ArgumentList {} -PassThru -Wait; \
         if ($p.ExitCode -eq 0 -and (Test-Path {})) {{ \
           Start-Process -FilePath {} -ArgumentList @('menubar') \
         }}",
        powershell_single_quoted(&plan.program.to_string_lossy()),
        powershell_argument_list(&plan.args),
        powershell_single_quoted(&relaunch_path.to_string_lossy()),
        powershell_single_quoted(&relaunch_path.to_string_lossy()),
    )
}

#[cfg(target_os = "windows")]
fn powershell_argument_list(args: &[std::ffi::OsString]) -> String {
    let args = args
        .iter()
        .map(|arg| powershell_single_quoted(&arg.to_string_lossy()))
        .collect::<Vec<_>>()
        .join(",");
    format!("@({args})")
}

#[cfg(target_os = "windows")]
fn powershell_single_quoted(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(target_os = "windows")]
fn windows_powershell_path() -> PathBuf {
    std::env::var_os("SystemRoot")
        .map(PathBuf::from)
        .map(|root| {
            root.join("System32")
                .join("WindowsPowerShell")
                .join("v1.0")
                .join("powershell.exe")
        })
        .filter(|path| path.exists())
        .unwrap_or_else(|| PathBuf::from("powershell.exe"))
}

/// Check if there's a pending update ready to install
#[allow(
    dead_code,
    reason = "update info struct reserved for future UI integration"
)]
pub fn get_pending_update() -> Option<PathBuf> {
    let download_dir = get_download_dir()?;

    if !download_dir.exists() {
        return None;
    }

    find_pending_installer_in_dir(&download_dir)
}

fn find_pending_installer_in_dir(download_dir: &Path) -> Option<PathBuf> {
    find_pending_installer_in_dir_for_family(download_dir, installed_windows_package_family())
}

fn find_pending_installer_in_dir_for_family(
    download_dir: &Path,
    installed_family: WindowsPackageFamily,
) -> Option<PathBuf> {
    let compatible_kind = installed_family.compatible_installer_kind()?;
    let current_version = parse_version_triplet(CURRENT_VERSION);

    // Only treat newer installer assets as pending updates, and prefer the highest
    // installer version when multiple cached installers are present.
    std::fs::read_dir(download_dir)
        .ok()?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let path = entry.path();
            let file_name = path.file_name()?.to_str()?;
            if installer_kind_from_name(file_name)? != compatible_kind {
                return None;
            }
            let installer_version = installer_version_from_name(file_name)?;
            if installer_version <= current_version {
                return None;
            }

            let modified = entry
                .metadata()
                .ok()
                .and_then(|meta| meta.modified().ok())
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs())
                .unwrap_or(0);

            Some(((installer_version, modified), path))
        })
        .max_by_key(|(sort_key, _)| *sort_key)
        .map(|(_, path)| path)
}

/// Clean up downloaded updates
#[allow(
    dead_code,
    reason = "update info struct reserved for future UI integration"
)]
pub fn cleanup_downloads() {
    if let Some(download_dir) = get_download_dir() {
        let _cleaned = std::fs::remove_dir_all(&download_dir);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installer_asset_matching_accepts_only_verified_quotalis_formats() {
        assert!(is_installer_asset_name("QuotaArc-1.2.3-x64-Setup.exe"));
        assert!(is_installer_asset_name("Quotalis-1.2.3-Setup.exe"));
        assert!(is_installer_asset_name("Quotalis_1.2.3_x64-setup.exe"));
        assert!(is_installer_asset_name("Quotalis_1.2.3_x64_en-US.msi"));
        assert!(!is_installer_asset_name("Quotalis Dev_1.2.3_x64-setup.exe"));
        assert!(!is_installer_asset_name("CodexBar-1.2.3-Setup.exe"));
        assert!(!is_installer_asset_name("malware-1.2.3-Setup.exe"));
        assert!(!is_installer_asset_name("Quotalis-latest-Setup.exe"));
        assert!(!is_installer_asset_name("Quotalis_1.2.3_x64_unknown.msi"));
        assert!(!is_installer_asset_name("Quotalis-1.2.3-x64.zip"));
    }

    #[test]
    fn release_urls_use_canonical_publisher_repository() {
        assert_eq!(
            release_url(UpdateChannel::Stable),
            "https://api.github.com/repos/iModhish1/Quotalis/releases/latest"
        );
        assert_eq!(
            release_url(UpdateChannel::Beta),
            "https://api.github.com/repos/iModhish1/Quotalis/releases"
        );
    }

    #[test]
    fn release_links_reject_other_owners_lookalikes_and_tags() {
        assert!(is_owner_release_url(
            "https://github.com/iModhish1/Quotalis/releases/tag/v1.2.6",
            "v1.2.6",
            "tag"
        ));
        for value in [
            "https://github.com/nesszer/Win-CodexBar/releases/tag/v1.2.6",
            "https://github.com.evil.invalid/iModhish1/Quotalis/releases/tag/v1.2.6",
            "https://github.com/iModhish1/Quotalis/releases/tag/v1.2.7",
            "https://user@github.com/iModhish1/Quotalis/releases/tag/v1.2.6",
            "http://github.com/iModhish1/Quotalis/releases/tag/v1.2.6",
        ] {
            assert!(!is_owner_release_url(value, "v1.2.6", "tag"), "{value}");
        }
    }

    #[test]
    fn foreign_installer_never_becomes_automatic_update() {
        let mut release = GitHubRelease {
            tag_name: "v1.2.6".into(),
            html_url: "https://github.com/iModhish1/Quotalis/releases/tag/v1.2.6".into(),
            body: None, draft: false, prerelease: false,
            assets: vec![GitHubAsset {
                name: "Quotalis-1.2.6-Setup.exe".into(),
                browser_download_url: "https://github.com/another/Quotalis/releases/download/v1.2.6/Quotalis-1.2.6-Setup.exe".into(),
                digest: Some(format!("sha256:{}", "a".repeat(64))),
            }],
        };
        let selected =
            select_release_target_for_family(&release, WindowsPackageFamily::Inno).unwrap();
        assert_eq!(selected.delivery, UpdateDelivery::Manual);
        assert!(!selected.supports_auto_download());
        release.html_url = "https://github.com/nesszer/Win-CodexBar/releases/tag/v1.2.6".into();
        assert!(select_release_target_for_family(&release, WindowsPackageFamily::Inno).is_none());
    }

    #[test]
    fn test_version_comparison() {
        assert!(is_newer_version("1.0.1", "1.0.0"));
        assert!(is_newer_version("1.1.0", "1.0.0"));
        assert!(is_newer_version("2.0.0", "1.0.0"));
        assert!(!is_newer_version("1.0.0", "1.0.0"));
        assert!(!is_newer_version("0.9.0", "1.0.0"));
        assert!(is_newer_version("1.0.0", "0.1.0"));
    }

    #[test]
    fn prefers_installer_asset_for_auto_update() {
        let release = GitHubRelease {
            tag_name: "v1.2.6".to_string(),
            html_url: "https://github.com/iModhish1/Quotalis/releases/tag/v1.2.6".to_string(),
            body: None,
            assets: vec![
                GitHubAsset {
                    name: "codexbar.exe".to_string(),
                    browser_download_url: "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/codexbar.exe".to_string(),
                    digest: None,
                },
                GitHubAsset {
                    name: "Quotalis-1.2.6-Setup.exe".to_string(),
                    browser_download_url: "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/Quotalis-1.2.6-Setup.exe"
                        .to_string(),
                    digest: Some(
                        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                            .to_string(),
                    ),
                },
            ],
            draft: false,
            prerelease: false,
        };

        let update = select_release_target_for_family(&release, WindowsPackageFamily::Inno)
            .expect("update target");

        assert_eq!(
            update.download_url,
            "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/Quotalis-1.2.6-Setup.exe"
        );
        assert!(update.supports_auto_apply());
        assert!(update.supports_auto_download());
    }

    #[test]
    fn installer_selection_is_deterministic_and_matches_installed_family() {
        let asset = |name: &str| GitHubAsset {
            name: name.to_string(),
            browser_download_url: format!(
                "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/{name}"
            ),
            digest: Some(format!("sha256:{}", "a".repeat(64))),
        };
        let release_with = |assets| GitHubRelease {
            tag_name: "v1.2.6".to_string(),
            html_url: "https://github.com/iModhish1/Quotalis/releases/tag/v1.2.6".to_string(),
            body: None,
            assets,
            draft: false,
            prerelease: false,
        };
        let names = [
            "Quotalis_1.2.6_x64_tr-TR.msi",
            "Quotalis-1.2.6-Setup.exe",
            "Quotalis_1.2.6_x64_en-US.msi",
            "Quotalis_1.2.6_x64-setup.exe",
        ];
        let forward = release_with(names.iter().map(|name| asset(name)).collect());
        let reverse = release_with(names.iter().rev().map(|name| asset(name)).collect());

        for release in [&forward, &reverse] {
            let selected = select_release_target_for_family(release, WindowsPackageFamily::Inno)
                .expect("Inno target");
            assert_eq!(
                selected.download_url,
                "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/Quotalis-1.2.6-Setup.exe"
            );

            let selected = select_release_target_for_family(release, WindowsPackageFamily::Nsis)
                .expect("NSIS target");
            assert_eq!(
                selected.download_url,
                "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/Quotalis_1.2.6_x64-setup.exe"
            );

            let selected = select_release_target_for_family(release, WindowsPackageFamily::Msi)
                .expect("MSI target");
            assert_eq!(
                selected.download_url,
                "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/Quotalis_1.2.6_x64_en-US.msi"
            );
        }
    }

    #[test]
    fn installer_selection_fails_closed_for_mismatch_unknown_and_portable() {
        let release = GitHubRelease {
            tag_name: "v1.2.6".to_string(),
            html_url: "https://github.com/iModhish1/Quotalis/releases/tag/v1.2.6".to_string(),
            body: None,
            assets: vec![GitHubAsset {
                name: "Quotalis_1.2.6_x64-setup.exe".to_string(),
                browser_download_url:
                    "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/nsis.exe"
                        .to_string(),
                digest: Some(format!("sha256:{}", "a".repeat(64))),
            }],
            draft: false,
            prerelease: false,
        };

        for family in [
            WindowsPackageFamily::Inno,
            WindowsPackageFamily::Msi,
            WindowsPackageFamily::PortableOrUnknown,
        ] {
            let update = select_release_target_for_family(&release, family).expect("manual target");
            assert_eq!(update.delivery, UpdateDelivery::Manual);
            assert_eq!(update.download_url, release.html_url);
            assert!(!update.supports_auto_apply());
            assert!(!update.supports_auto_download());
        }
    }

    #[test]
    fn direct_installer_validation_rejects_cross_family_and_unproven_installs() {
        assert_eq!(
            validate_installer_family("Quotalis-1.2.6-Setup.exe", WindowsPackageFamily::Inno),
            Ok(WindowsInstallerKind::Inno)
        );
        assert!(
            validate_installer_family("Quotalis_1.2.6_x64-setup.exe", WindowsPackageFamily::Inno)
                .unwrap_err()
                .contains("different installer family")
        );
        assert!(
            validate_installer_family(
                "Quotalis-1.2.6-Setup.exe",
                WindowsPackageFamily::PortableOrUnknown,
            )
            .unwrap_err()
            .contains("could not be verified")
        );
    }

    #[test]
    fn msi_fallback_prefers_en_us_independent_of_asset_order() {
        let release = GitHubRelease {
            tag_name: "v1.2.6".to_string(),
            html_url: "https://github.com/iModhish1/Quotalis/releases/tag/v1.2.6".to_string(),
            body: None,
            assets: vec![
                GitHubAsset {
                    name: "Quotalis_1.2.6_x64_tr-TR.msi".to_string(),
                    browser_download_url:
                        "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/tr.msi"
                            .to_string(),
                    digest: None,
                },
                GitHubAsset {
                    name: "Quotalis_1.2.6_x64_en-US.msi".to_string(),
                    browser_download_url:
                        "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/en.msi"
                            .to_string(),
                    digest: None,
                },
            ],
            draft: false,
            prerelease: false,
        };

        let selected = select_release_target_for_family(&release, WindowsPackageFamily::Msi)
            .expect("update target");
        assert_eq!(
            selected.download_url,
            "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/en.msi"
        );
    }

    #[test]
    fn falls_back_to_manual_release_when_only_portable_exe_exists() {
        let release = GitHubRelease {
            tag_name: "v1.2.6".to_string(),
            html_url: "https://github.com/iModhish1/Quotalis/releases/tag/v1.2.6".to_string(),
            body: None,
            assets: vec![GitHubAsset {
                name: "codexbar.exe".to_string(),
                browser_download_url:
                    "https://github.com/iModhish1/Quotalis/releases/download/v1.2.6/codexbar.exe"
                        .to_string(),
                digest: None,
            }],
            draft: false,
            prerelease: false,
        };

        let update =
            select_release_target_for_family(&release, WindowsPackageFamily::PortableOrUnknown)
                .expect("update target");

        assert_eq!(
            update.download_url,
            "https://github.com/iModhish1/Quotalis/releases/tag/v1.2.6"
        );
        assert!(!update.supports_auto_apply());
    }

    #[test]
    fn finds_newest_pending_installer_and_ignores_portable_exe() {
        let temp = tempfile::tempdir().expect("temp dir");
        let (major, minor, patch) = parse_version_triplet(CURRENT_VERSION);
        let portable = temp.path().join("codexbar.exe");
        let older = temp.path().join(format!(
            "QuotaArc-{}.{}.{}-x64-Setup.exe",
            major, minor, patch
        ));
        let newer = temp.path().join(format!(
            "QuotaArc-{}.{}.{}-x64-Setup.exe",
            major,
            minor,
            patch + 1
        ));

        std::fs::write(&portable, b"portable").expect("write portable");
        std::fs::write(&older, b"older installer").expect("write older installer");
        std::fs::write(&newer, b"newer installer").expect("write newer installer");

        let pending =
            find_pending_installer_in_dir_for_family(temp.path(), WindowsPackageFamily::Inno)
                .expect("pending installer");

        assert_eq!(pending, newer);
    }

    #[test]
    fn cached_msi_and_nsis_versions_are_independent_of_locale_hyphens() {
        let (major, minor, patch) = parse_version_triplet(CURRENT_VERSION);
        for (family, suffix) in [
            (WindowsPackageFamily::Msi, "_x64_en-US.msi"),
            (WindowsPackageFamily::Msi, "_x64_tr-TR.msi"),
            (WindowsPackageFamily::Nsis, "_x64-setup.exe"),
        ] {
            let temp = tempfile::tempdir().unwrap();
            let old = temp
                .path()
                .join(format!("Quotalis_{major}.{minor}.{patch}{suffix}"));
            let new = temp
                .path()
                .join(format!("Quotalis_{major}.{minor}.{}{suffix}", patch + 1));
            std::fs::write(&old, b"synthetic old installer").unwrap();
            std::fs::write(&new, b"synthetic new installer").unwrap();
            assert_eq!(
                find_pending_installer_in_dir_for_family(temp.path(), family),
                Some(new)
            );
        }
    }

    #[test]
    fn ignores_cached_installers_for_current_or_older_versions() {
        let temp = tempfile::tempdir().expect("temp dir");
        let (major, minor, patch) = parse_version_triplet(CURRENT_VERSION);
        let current = temp.path().join(format!(
            "QuotaArc-{}.{}.{}-x64-Setup.exe",
            major, minor, patch
        ));
        let older = temp.path().join(format!(
            "QuotaArc-{}.{}.{}-x64-Setup.exe",
            major,
            minor,
            patch.saturating_sub(1)
        ));

        std::fs::write(&current, b"current installer").expect("write current installer");
        std::fs::write(&older, b"older installer").expect("write older installer");

        assert!(
            find_pending_installer_in_dir_for_family(temp.path(), WindowsPackageFamily::Inno)
                .is_none()
        );
    }

    #[test]
    fn parses_prerelease_installer_names_for_beta_updates() {
        let (major, minor, patch) = parse_version_triplet(CURRENT_VERSION);
        assert_eq!(
            installer_version_from_name(&format!(
                "QuotaArc-{}.{}.{}-x64-beta.1-Setup.exe",
                major,
                minor,
                patch + 1
            )),
            Some((major, minor, patch + 1))
        );
    }

    #[test]
    fn verify_installer_hash_accepts_matching_sha256() {
        let temp = tempfile::tempdir().expect("temp dir");
        let path = temp.path().join("QuotaArc-1.2.3-x64-Setup.exe");
        std::fs::write(&path, b"installer bytes").expect("write installer");

        let expected = sha256_file(&path).expect("hash");
        assert!(verify_installer_hash(&path, &expected).is_ok());
    }

    #[test]
    fn verify_installer_hash_rejects_mismatched_sha256() {
        let temp = tempfile::tempdir().expect("temp dir");
        let path = temp.path().join("QuotaArc-1.2.3-x64-Setup.exe");
        std::fs::write(&path, b"installer bytes").expect("write installer");

        let wrong = "0".repeat(64);
        let err = verify_installer_hash(&path, &wrong).unwrap_err();
        assert!(err.contains("SHA256 mismatch"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_inno_setup_uses_inno_silent_flags() {
        let path = PathBuf::from(r"C:\Temp\Quotalis-1.2.3-Setup.exe");

        let plan = windows_installer_launch_plan(&path).expect("launch plan");

        assert_eq!(plan.program, path);
        assert_eq!(
            plan.args,
            vec![
                std::ffi::OsString::from("/SILENT"),
                std::ffi::OsString::from("/SUPPRESSMSGBOXES"),
                std::ffi::OsString::from("/CLOSEAPPLICATIONS"),
                std::ffi::OsString::from("/NORESTART"),
            ]
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_install_evidence_path_and_uninstaller_parsing_are_strict() {
        for name in [
            "Quotalis.exe",
            "quotalis-desktop.exe",
            "QuotaArc.exe",
            "codexbar.exe",
            "codexbar-desktop.exe",
        ] {
            assert!(is_stable_windows_binary_name(Path::new(name)), "{name}");
        }
        for name in ["QuotalisDev.exe", "Quotalis-Dev.exe", "unrelated.exe"] {
            assert!(!is_stable_windows_binary_name(Path::new(name)), "{name}");
        }
        let temp = tempfile::tempdir().expect("temp dir");
        let differently_cased = PathBuf::from(temp.path().to_string_lossy().to_ascii_uppercase());

        assert!(same_windows_path(temp.path(), &differently_cased));
        assert!(registry_location_matches(
            &format!("\"{}\"", temp.path().display()),
            temp.path()
        ));
        assert_eq!(
            quoted_command_executable(&format!(
                "\"{}\" /SILENT",
                temp.path().join("unins000.exe").display()
            )),
            Some(temp.path().join("unins000.exe"))
        );
        assert!(quoted_command_executable("unins000.exe /SILENT").is_none());
        assert!(is_inno_uninstaller_name("unins000.exe"));
        assert!(!is_inno_uninstaller_name("uninstall.exe"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_tauri_nsis_setup_uses_nsis_silent_flag() {
        let path = PathBuf::from(r"C:\Temp\Quotalis_1.2.3_x64-setup.exe");

        let plan = windows_installer_launch_plan(&path).expect("launch plan");

        assert_eq!(plan.program, path);
        assert_eq!(plan.args, vec![std::ffi::OsString::from("/S")]);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_installer_plan_rejects_unrecognized_setup_names() {
        let path = PathBuf::from(r"C:\Temp\ThirdParty-1.2.3-Setup.exe");
        let error = windows_installer_launch_plan(&path)
            .err()
            .expect("unrecognized installer must fail closed");

        assert!(error.contains("not recognized"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_apply_script_waits_for_current_process_before_installing() {
        let path = PathBuf::from(r"C:\Temp\Quotalis-1.2.3-Setup.exe");
        let relaunch_path = PathBuf::from(r"C:\Program Files\Quotalis\Quotalis.exe");
        let plan = windows_installer_launch_plan(&path).expect("launch plan");

        let script = windows_installer_apply_script(&plan, 12345, &relaunch_path);

        assert!(script.contains("Wait-Process -Id 12345"));
        assert!(script.contains(r"Start-Process -FilePath 'C:\Temp\Quotalis-1.2.3-Setup.exe'"));
        assert!(script.contains(
            "-ArgumentList @('/SILENT','/SUPPRESSMSGBOXES','/CLOSEAPPLICATIONS','/NORESTART')"
        ));
        assert!(script.contains("-PassThru -Wait"));
        assert!(script.contains(r"Start-Process -FilePath 'C:\Program Files\Quotalis\Quotalis.exe' -ArgumentList @('menubar')"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_update_relaunch_path_prefers_primary_desktop_exe_from_legacy_alias() {
        let temp = tempfile::tempdir().expect("temp dir");
        let desktop_path = temp.path().join("codexbar.exe");
        let legacy_desktop_path = temp.path().join("codexbar-desktop.exe");
        std::fs::write(&desktop_path, b"desktop").expect("write desktop");
        std::fs::write(&legacy_desktop_path, b"legacy desktop").expect("write legacy desktop");

        assert_eq!(
            windows_update_relaunch_path(&legacy_desktop_path),
            desktop_path
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_msi_uses_msiexec_quiet_install() {
        let path = PathBuf::from(r"C:\Temp\Quotalis_1.2.3_x64_en-US.msi");

        let plan = windows_installer_launch_plan(&path).expect("launch plan");

        assert_eq!(plan.program, PathBuf::from("msiexec.exe"));
        assert_eq!(
            plan.args,
            vec![
                std::ffi::OsString::from("/i"),
                path.as_os_str().to_os_string(),
                std::ffi::OsString::from("/quiet"),
                std::ffi::OsString::from("/norestart"),
            ]
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn powershell_quoting_escapes_single_quotes() {
        assert_eq!(
            powershell_single_quoted(r"C:\Temp\CodexBar's Setup.exe"),
            r"'C:\Temp\CodexBar''s Setup.exe'"
        );
    }
}
