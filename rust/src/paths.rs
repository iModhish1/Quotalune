//! Single source of truth for QuotaArc product identity and filesystem layout.
//!
//! Every place that needs the product's directory name, registry value name,
//! toast AUMID, or HTTP user agent must go through this module so the product
//! brand can never drift apart across stores, logs, and integrations. This is
//! also what separates QuotaArc's on-disk state from a co-installed
//! Win-CodexBar (`%AppData%\QuotaArc` vs `%AppData%\CodexBar`).
//!
//! Channels: the default build is the Personal/Stable channel. A build with
//! the `dev-channel` cargo feature (shell crate: `--features dev-channel`)
//! targets `QuotaArc-Dev` directories and a distinct registry/AUMID identity
//! so a development build can never touch the owner's personal data. See
//! docs/LOCAL_DEVELOPMENT.md.

use std::path::PathBuf;

/// True when this build targets the development channel.
pub const fn is_dev_channel() -> bool {
    cfg!(feature = "dev-channel")
}

/// Channel display suffix used in About/diagnostics (`""` for Personal).
pub const fn channel_suffix() -> &'static str {
    if is_dev_channel() {
        " Dev"
    } else {
        ""
    }
}

/// Product directory name under the user's config/data/cache roots.
pub const APP_DIR_NAME: &str = if cfg!(feature = "dev-channel") {
    "QuotaArc-Dev"
} else {
    "QuotaArc"
};

/// Value name for the `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
/// entry used by start-at-login.
pub const REGISTRY_RUN_VALUE: &str = if cfg!(feature = "dev-channel") {
    "QuotaArc Dev"
} else {
    "QuotaArc"
};

/// AppUserModelID registered for Windows toast notifications.
pub const TOAST_AUMID: &str = if cfg!(feature = "dev-channel") {
    "QuotaArc.Dev"
} else {
    "QuotaArc"
};

/// HTTP user agent for update downloads and release metadata checks.
pub const USER_AGENT: &str = "QuotaArc";

/// Installer artifact stem, e.g. `QuotaArc-0.1.0-x64-Setup.exe`.
pub const INSTALLER_STEM: &str = if cfg!(feature = "dev-channel") {
    "QuotaArc-Dev"
} else {
    "QuotaArc"
};

/// QuotaArc config root: hosts the settings file, stores, and logs.
pub fn config_dir() -> Option<PathBuf> {
    dirs::config_dir().map(|p| p.join(APP_DIR_NAME))
}

/// QuotaArc per-user local data root (device-local state, caches that may
/// contain user identifiers).
pub fn data_local_dir() -> Option<PathBuf> {
    dirs::data_local_dir().map(|p| p.join(APP_DIR_NAME))
}

/// QuotaArc cache root (regenerable artifacts: pricing caches, update downloads).
pub fn cache_dir() -> Option<PathBuf> {
    dirs::cache_dir().map(|p| p.join(APP_DIR_NAME))
}

/// Installer file name for a version, e.g. `QuotaArc-1.2.3-x64-Setup.exe`.
pub fn installer_file_name(version: &str) -> String {
    format!("{INSTALLER_STEM}-{version}-x64-Setup.exe")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installer_file_name_formats_version() {
        let stem = if cfg!(feature = "dev-channel") {
            "QuotaArc-Dev"
        } else {
            "QuotaArc"
        };
        assert_eq!(
            installer_file_name("1.2.3"),
            format!("{stem}-1.2.3-x64-Setup.exe")
        );
    }

    #[test]
    fn app_dir_name_matches_channel() {
        if cfg!(feature = "dev-channel") {
            assert_eq!(APP_DIR_NAME, "QuotaArc-Dev");
            assert_eq!(REGISTRY_RUN_VALUE, "QuotaArc Dev");
            assert_eq!(TOAST_AUMID, "QuotaArc.Dev");
        } else {
            assert_eq!(APP_DIR_NAME, "QuotaArc");
            assert_eq!(REGISTRY_RUN_VALUE, "QuotaArc");
            assert_eq!(TOAST_AUMID, "QuotaArc");
        }
    }

    #[test]
    fn channels_are_disjoint_from_codoxbar() {
        assert_ne!(APP_DIR_NAME, "CodexBar");
    }
}
