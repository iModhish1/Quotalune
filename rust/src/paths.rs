//! Single source of truth for Quotalis product identity and filesystem
//! layout.
//!
//! Every place that needs the product's directory name, registry value name,
//! toast AUMID, or HTTP user agent must go through this module so the product
//! brand can never drift apart across stores, logs, and integrations.
//!
//! ## Public brand vs. legacy Windows identity (Quotalis rebrand, Option A)
//!
//! The public product is **Quotalis** (see `USER_AGENT`, `INSTALLER_STEM`,
//! and Tauri's own `productName`/`mainBinaryName` in `tauri.conf.json`,
//! which now say Quotalis). The **Windows/filesystem identity below this
//! module's `APP_DIR_NAME`/`REGISTRY_RUN_VALUE`/`TOAST_AUMID` intentionally
//! still says "QuotaArc"** — this is not an incomplete rebrand, it is a
//! deliberate decision recorded in
//! `docs/validation/QUOTALIS_WINDOWS_IDENTITY_MIGRATION.md` (Option A):
//! preserving the stable bundle/AppUserModel identity and data directory
//! avoids an unnecessary data-migration event, keeps Start Menu pins working,
//! and prevents Windows from treating an upgrade as installing a second,
//! unrelated application. None of these three constants are ever rendered to
//! a user; they are purely internal Windows-integration identifiers. Do not
//! "fix" them to say Quotalis without first re-reading that document — doing
//! so would either move a real user's data or require a real data-migration
//! implementation, neither of which this phase does.
//!
//! This is also what separates QuotaArc's on-disk state from a co-installed
//! Win-CodexBar (`%AppData%\QuotaArc` vs `%AppData%\CodexBar`) -- unrelated
//! upstream-provenance naming, not part of the Quotalis rebrand.
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
    if is_dev_channel() { " Dev" } else { "" }
}

/// LEGACY_DATA_DIR_NAME: product directory name under the user's
/// config/data/cache roots. Intentionally still "QuotaArc" -- see the
/// module doc for why this is not renamed to "Quotalis" (Option A: no data
/// migration this phase).
pub const APP_DIR_NAME: &str = if cfg!(feature = "dev-channel") {
    "QuotaArc-Dev"
} else {
    "QuotaArc"
};

/// LEGACY_SECURITY_COMPATIBILITY: value name for the
/// `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` entry used by
/// start-at-login. Intentionally still "QuotaArc" this phase -- renaming it
/// would leave a stale Run-key entry under the old name for any user who
/// already enabled start-at-login, since nothing would know to remove it.
pub const REGISTRY_RUN_VALUE: &str = if cfg!(feature = "dev-channel") {
    "QuotaArc Dev"
} else {
    "QuotaArc"
};

/// LEGACY_SECURITY_COMPATIBILITY: the stable bundle/AppUserModelID,
/// intentionally preserved per
/// `docs/validation/QUOTALIS_WINDOWS_IDENTITY_MIGRATION.md` (Option A) --
/// this is what lets Windows recognize a future Quotalis-branded build as
/// the same application as today's QuotaArc for toast notifications,
/// single-instance identity, and Start Menu pin continuity.
/// Fresh Dev-only AUMID (Claude continuation wave, 2026-09-10 --
/// see `docs/validation/CLAUDE_DEV_WINDOWS_IDENTITY_AUDIT.md`). The
/// previous Dev AUMID (`app.quotaarc.desktop.dev`) carried a stale
/// "QuotaArc Dev" display name cached by Windows' own notification
/// database from before the Quotalis rebrand; a real installed Start
/// Menu shortcut carrying that same old AUMID did not clear the cache
/// (proven, not assumed -- see `docs/validation/CLAUDE_NOTIFICATION_VALIDATION.md`).
/// A never-before-seen AUMID has no stale cache to inherit. Personal's
/// AUMID (`app.quotaarc.desktop`) is deliberately unchanged -- this is
/// Dev-only, with zero effect on Personal's upgrade/toast/single-instance
/// continuity.
pub const TOAST_AUMID: &str = if cfg!(feature = "dev-channel") {
    "app.quotalis.desktop.dev"
} else {
    "app.quotaarc.desktop"
};

/// HTTP user agent for update downloads and release metadata checks. Public
/// brand, not tied to any on-disk/Windows identity -- safe to rename outright
/// (self-referential outbound header, no external allowlist depends on it).
pub const USER_AGENT: &str = "Quotalis";

/// Current installer artifact stem, e.g. `Quotalis-0.1.0-x64-Setup.exe`.
/// Public brand -- update-artifact matching (`updater.rs::
/// is_installer_asset_name`) is suffix-only ("-setup.exe"/".msi") and does
/// not depend on this stem, so changing it carries no update-detection risk.
pub const INSTALLER_STEM: &str = if cfg!(feature = "dev-channel") {
    "Quotalis-Dev"
} else {
    "Quotalis"
};

/// LEGACY_INSTALLER_STEM: the installer stem used by every QuotaArc-branded
/// release prior to the Quotalis rebrand. Kept only for reference/rollback
/// documentation (`docs/validation/QUOTALIS_ROLLBACK_PLAN.md`) -- no code
/// path needs to recognize this at runtime, since
/// `updater.rs::is_installer_asset_name` never matched on the product-name
/// prefix in the first place.
pub const LEGACY_INSTALLER_STEM: &str = if cfg!(feature = "dev-channel") {
    "QuotaArc-Dev"
} else {
    "QuotaArc"
};

/// Current Personal/Dev executable basename Tauri's bundler produces
/// (`productName`/`mainBinaryName` in tauri.conf.json / tauri.dev.conf.json).
pub const CURRENT_EXE_NAME: &str = if cfg!(feature = "dev-channel") {
    "QuotalisDev.exe"
} else {
    "Quotalis.exe"
};

/// LEGACY_SECURITY_COMPATIBILITY: the executable basename every QuotaArc-
/// branded release prior to the Quotalis rebrand produced. No current
/// production code path compares against this string today (single-instance,
/// tray-ownership, and updater relaunch logic all resolve
/// `std::env::current_exe()` dynamically rather than hardcoding a brand
/// name -- verified during this audit), so this constant exists purely for
/// documentation/rollback reference, not as a required runtime check.
pub const LEGACY_EXE_NAME: &str = if cfg!(feature = "dev-channel") {
    "QuotaArcDev.exe"
} else {
    "QuotaArc.exe"
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

/// Installer file name for a version, e.g. `Quotalis-1.2.3-x64-Setup.exe`.
pub fn installer_file_name(version: &str) -> String {
    format!("{INSTALLER_STEM}-{version}-x64-Setup.exe")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installer_file_name_formats_version() {
        let stem = if cfg!(feature = "dev-channel") {
            "Quotalis-Dev"
        } else {
            "Quotalis"
        };
        assert_eq!(
            installer_file_name("1.2.3"),
            format!("{stem}-1.2.3-x64-Setup.exe")
        );
    }

    /// The public brand (installer stem, user agent, current exe name) is
    /// Quotalis; the legacy Windows/filesystem identity (data dir, registry
    /// run value, toast AUMID) intentionally still says QuotaArc -- Option A
    /// from docs/validation/QUOTALIS_WINDOWS_IDENTITY_MIGRATION.md. This
    /// test pins both halves so neither drifts silently.
    #[test]
    fn public_brand_is_quotalis_legacy_windows_identity_is_quotaarc() {
        assert_eq!(USER_AGENT, "Quotalis");
        if cfg!(feature = "dev-channel") {
            assert_eq!(INSTALLER_STEM, "Quotalis-Dev");
            assert_eq!(CURRENT_EXE_NAME, "QuotalisDev.exe");
            assert_eq!(LEGACY_EXE_NAME, "QuotaArcDev.exe");
            assert_eq!(LEGACY_INSTALLER_STEM, "QuotaArc-Dev");
        } else {
            assert_eq!(INSTALLER_STEM, "Quotalis");
            assert_eq!(CURRENT_EXE_NAME, "Quotalis.exe");
            assert_eq!(LEGACY_EXE_NAME, "QuotaArc.exe");
            assert_eq!(LEGACY_INSTALLER_STEM, "QuotaArc");
        }
        // The legacy Windows/filesystem identity below is intentionally
        // unchanged this phase -- see app_dir_name_matches_channel.
    }

    #[test]
    fn app_dir_name_matches_channel() {
        if cfg!(feature = "dev-channel") {
            assert_eq!(APP_DIR_NAME, "QuotaArc-Dev");
            assert_eq!(REGISTRY_RUN_VALUE, "QuotaArc Dev");
            assert_eq!(TOAST_AUMID, "app.quotalis.desktop.dev");
        } else {
            assert_eq!(APP_DIR_NAME, "QuotaArc");
            assert_eq!(REGISTRY_RUN_VALUE, "QuotaArc");
            assert_eq!(TOAST_AUMID, "app.quotaarc.desktop");
        }
    }

    #[test]
    fn channels_are_disjoint_from_codoxbar() {
        assert_ne!(APP_DIR_NAME, "CodexBar");
    }
}
