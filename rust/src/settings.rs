//! Settings management for CodexBar
//!
//! Handles persistent configuration including:
//! - Enabled/disabled providers
//! - Refresh interval
//! - Manual cookies
//! - Other user preferences

#![allow(
    dead_code,
    reason = "settings types mirror the full config schema; some fields are not yet consumed"
)]

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use crate::core::ProviderId;

mod provider_instances;
pub use provider_instances::{ProviderInstancePresentation, valid_provider_instance_id};
mod provider_tray;
pub use provider_tray::{ProviderTrayConfig, normalize_provider_tray};
mod analytics_preferences;
mod api_keys;
pub use analytics_preferences::AnalyticsPreferences;
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LimitPresentation {
    pub shape: String,
    pub content: String,
    pub direction: String,
    #[serde(default = "default_provider_presentation_identity")]
    pub identity: String,
}

impl Default for LimitPresentation {
    fn default() -> Self {
        Self {
            shape: "horizontal".to_string(),
            content: "both".to_string(),
            direction: "forward".to_string(),
            identity: default_provider_presentation_identity(),
        }
    }
}

fn default_provider_presentation_identity() -> String {
    "adaptive".to_string()
}

impl LimitPresentation {
    pub fn is_valid(&self) -> bool {
        matches!(self.shape.as_str(), "ring" | "horizontal" | "vertical")
            && matches!(self.content.as_str(), "bar" | "both" | "value")
            && matches!(self.direction.as_str(), "forward" | "reverse")
            && matches!(
                self.identity.as_str(),
                "adaptive"
                    | "precision"
                    | "glass"
                    | "pearl"
                    | "prism"
                    | "mono"
                    | "signal"
                    | "luxe"
                    | "frost"
                    | "ember"
                    | "jade"
                    | "rose"
                    | "cobalt"
                    | "bronze"
                    | "paper"
                    | "ultraviolet"
                    | "midnight"
                    | "aerogel"
                    | "porcelain"
                    | "champagne"
                    | "terracotta"
                    | "cyberlime"
                    | "graphite"
                    | "royal"
            )
    }
}

#[cfg(test)]
mod limit_presentation_tests {
    use super::LimitPresentation;

    #[test]
    fn accepts_every_provider_presentation_identity() {
        let identities = [
            "adaptive",
            "precision",
            "glass",
            "pearl",
            "prism",
            "mono",
            "signal",
            "luxe",
            "frost",
            "ember",
            "jade",
            "rose",
            "cobalt",
            "bronze",
            "paper",
            "ultraviolet",
            "midnight",
            "aerogel",
            "porcelain",
            "champagne",
            "terracotta",
            "cyberlime",
            "graphite",
            "royal",
        ];
        for identity in identities {
            assert!(
                LimitPresentation {
                    identity: identity.to_string(),
                    ..LimitPresentation::default()
                }
                .is_valid(),
                "identity {identity} must round-trip through persisted settings"
            );
        }
    }

    #[test]
    fn rejects_unknown_provider_presentation_identity() {
        assert!(
            !LimitPresentation {
                identity: "unregistered".to_string(),
                ..LimitPresentation::default()
            }
            .is_valid()
        );
    }
}
/// Persisted user configuration for the Reset Time / Presentation system
/// (`apps/desktop-tauri/src/lib/resetPresentation.ts` is the frontend
/// counterpart this mirrors -- keep field semantics in sync). Only the
/// *display* preference lives here; the authoritative reset instant itself
/// (`resetsAt`) is never persisted or derived from this struct.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResetPresentationSettings {
    pub preset: String,
    pub modules: Vec<String>,
    pub order: Vec<String>,
    pub timezone_mode: String,
    #[serde(default)]
    pub timezone_id: Option<String>,
    #[serde(default = "default_regional_format")]
    pub regional_format: String,
    /// Explicit BCP-47 locale tag, used only when `regional_format` is
    /// "custom".
    #[serde(default)]
    pub regional_locale: Option<String>,
    #[serde(default = "default_clock_format")]
    pub clock_format: String,
    #[serde(default = "default_meridiem_style")]
    pub meridiem_style: String,
    #[serde(default = "default_month_style")]
    pub month_style: String,
    #[serde(default = "default_weekday_style")]
    pub weekday_style: String,
    #[serde(default = "default_year_style")]
    pub year_style: String,
    #[serde(default = "default_countdown_detail")]
    pub countdown_detail: String,
    #[serde(default = "default_numbering_system")]
    pub numbering_system: String,
}

fn default_regional_format() -> String {
    "system".to_string()
}
fn default_clock_format() -> String {
    "system".to_string()
}
fn default_meridiem_style() -> String {
    "auto".to_string()
}
fn default_month_style() -> String {
    "short".to_string()
}
fn default_weekday_style() -> String {
    "off".to_string()
}
fn default_year_style() -> String {
    "auto".to_string()
}
fn default_countdown_detail() -> String {
    "adaptive".to_string()
}
fn default_numbering_system() -> String {
    "latn".to_string()
}

const RESET_MODULES: &[&str] = &["countdown", "date", "time", "weekday", "timezone"];

impl Default for ResetPresentationSettings {
    /// Matches the product's current (pre-existing) countdown behavior, per
    /// the migration requirement that existing users see no surprise
    /// change: countdown-only, adaptive detail, system timezone/clock.
    fn default() -> Self {
        Self {
            preset: "countdownOnly".to_string(),
            modules: vec!["countdown".to_string()],
            order: RESET_MODULES.iter().map(|m| m.to_string()).collect(),
            timezone_mode: "system".to_string(),
            timezone_id: None,
            regional_format: default_regional_format(),
            regional_locale: None,
            clock_format: default_clock_format(),
            meridiem_style: default_meridiem_style(),
            month_style: default_month_style(),
            weekday_style: default_weekday_style(),
            year_style: default_year_style(),
            countdown_detail: default_countdown_detail(),
            numbering_system: default_numbering_system(),
        }
    }
}

impl ResetPresentationSettings {
    /// Validate every field independently; a settings file with one corrupt
    /// field should never crash the app, only fall back to the default.
    pub fn is_valid(&self) -> bool {
        matches!(
            self.preset.as_str(),
            "countdownOnly"
                | "dateAndTime"
                | "countdownDateAndTime"
                | "full"
                | "compact"
                | "custom"
        ) && !self.modules.is_empty()
            && self
                .modules
                .iter()
                .all(|m| RESET_MODULES.contains(&m.as_str()))
            && self
                .modules
                .iter()
                .collect::<std::collections::HashSet<_>>()
                .len()
                == self.modules.len()
            && self
                .order
                .iter()
                .all(|m| RESET_MODULES.contains(&m.as_str()))
            && self
                .order
                .iter()
                .collect::<std::collections::HashSet<_>>()
                .len()
                == self.order.len()
            && matches!(self.timezone_mode.as_str(), "system" | "custom")
            && self
                .timezone_id
                .as_deref()
                .is_none_or(is_valid_iana_timezone)
            && matches!(
                self.regional_format.as_str(),
                "system" | "uiLanguage" | "custom"
            )
            && self
                .regional_locale
                .as_deref()
                .is_none_or(is_valid_bcp47_locale)
            && matches!(self.clock_format.as_str(), "system" | "h12" | "h24")
            && matches!(self.meridiem_style.as_str(), "auto" | "latin" | "localized")
            && matches!(self.month_style.as_str(), "numeric" | "short" | "full")
            && matches!(self.weekday_style.as_str(), "off" | "short" | "full")
            && matches!(self.year_style.as_str(), "off" | "on" | "auto")
            && matches!(
                self.countdown_detail.as_str(),
                "adaptive" | "compact" | "detailed"
            )
            && self.numbering_system == "latn"
    }

    /// Best-effort repair: keep whatever validates, replace whatever
    /// doesn't with the matching field from the default. Never rejects the
    /// whole settings file over one bad field.
    pub fn normalized(self) -> Self {
        // Always runs the full reconciliation rather than short-circuiting
        // on `is_valid()`: field-level validity doesn't guarantee `order`
        // covers every enabled module, and that gap must still be repaired.
        let fallback = Self::default();
        let modules: Vec<String> = {
            let mut seen = std::collections::HashSet::new();
            let cleaned: Vec<String> = self
                .modules
                .into_iter()
                .filter(|m| RESET_MODULES.contains(&m.as_str()) && seen.insert(m.clone()))
                .collect();
            if cleaned.is_empty() {
                fallback.modules.clone()
            } else {
                cleaned
            }
        };
        let order: Vec<String> = {
            let mut seen = std::collections::HashSet::new();
            let mut cleaned: Vec<String> = self
                .order
                .into_iter()
                .filter(|m| RESET_MODULES.contains(&m.as_str()) && seen.insert(m.clone()))
                .collect();
            // Any enabled module missing from a corrupt order is appended
            // rather than silently unrenderable.
            for module in &modules {
                if !cleaned.contains(module) {
                    cleaned.push(module.clone());
                }
            }
            if cleaned.is_empty() {
                fallback.order.clone()
            } else {
                cleaned
            }
        };
        Self {
            preset: if matches!(
                self.preset.as_str(),
                "countdownOnly"
                    | "dateAndTime"
                    | "countdownDateAndTime"
                    | "full"
                    | "compact"
                    | "custom"
            ) {
                self.preset
            } else {
                fallback.preset
            },
            modules,
            order,
            timezone_mode: if matches!(self.timezone_mode.as_str(), "system" | "custom") {
                self.timezone_mode
            } else {
                fallback.timezone_mode
            },
            timezone_id: self.timezone_id.filter(|id| is_valid_iana_timezone(id)),
            regional_format: if matches!(
                self.regional_format.as_str(),
                "system" | "uiLanguage" | "custom"
            ) {
                self.regional_format
            } else {
                fallback.regional_format
            },
            regional_locale: self
                .regional_locale
                .filter(|tag| is_valid_bcp47_locale(tag)),
            clock_format: if matches!(self.clock_format.as_str(), "system" | "h12" | "h24") {
                self.clock_format
            } else {
                fallback.clock_format
            },
            meridiem_style: if matches!(
                self.meridiem_style.as_str(),
                "auto" | "latin" | "localized"
            ) {
                self.meridiem_style
            } else {
                fallback.meridiem_style
            },
            month_style: if matches!(self.month_style.as_str(), "numeric" | "short" | "full") {
                self.month_style
            } else {
                fallback.month_style
            },
            weekday_style: if matches!(self.weekday_style.as_str(), "off" | "short" | "full") {
                self.weekday_style
            } else {
                fallback.weekday_style
            },
            year_style: if matches!(self.year_style.as_str(), "off" | "on" | "auto") {
                self.year_style
            } else {
                fallback.year_style
            },
            countdown_detail: if matches!(
                self.countdown_detail.as_str(),
                "adaptive" | "compact" | "detailed"
            ) {
                self.countdown_detail
            } else {
                fallback.countdown_detail
            },
            numbering_system: fallback.numbering_system,
        }
    }
}

/// Minimal structural IANA timezone id check: `Region/City[/Subcity]`,
/// ASCII letters/digits/`_`/`+`/`-` per segment. This is not a full IANA
/// database lookup (the crate doesn't bundle one) but it rejects the
/// dangerous/nonsensical cases -- empty, a raw UTC offset like `+03:00`,
/// control characters, absurd length -- so a corrupt or hostile value can
/// never reach `Intl` on the frontend unchecked.
pub fn is_valid_iana_timezone(value: &str) -> bool {
    if value.is_empty() || value.len() > 128 {
        return false;
    }
    if value == "UTC" || value == "GMT" {
        return true;
    }
    let segments: Vec<&str> = value.split('/').collect();
    if segments.len() < 2 {
        return false;
    }
    segments.iter().all(|segment| {
        !segment.is_empty()
            && segment
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '+' | '-'))
    })
}

/// Minimal structural BCP-47 language-tag check: `language[-Region]`,
/// ASCII letters/digits/`-` only, reasonable length. Not a full BCP-47
/// validator (no registry lookup) -- like `is_valid_iana_timezone`, this
/// exists to reject empty/control-character/absurd-length garbage before
/// it reaches `Intl` on the frontend, not to certify every tag is real.
pub fn is_valid_bcp47_locale(value: &str) -> bool {
    if value.is_empty() || value.len() > 64 {
        return false;
    }
    value
        .split('-')
        .all(|segment| !segment.is_empty() && segment.chars().all(|c| c.is_ascii_alphanumeric()))
}

#[cfg(test)]
mod reset_presentation_settings_tests {
    use super::{ResetPresentationSettings, is_valid_bcp47_locale, is_valid_iana_timezone};

    #[test]
    fn default_matches_pre_existing_countdown_behavior() {
        let defaults = ResetPresentationSettings::default();
        assert!(defaults.is_valid());
        assert_eq!(defaults.preset, "countdownOnly");
        assert_eq!(defaults.modules, vec!["countdown".to_string()]);
        assert_eq!(defaults.timezone_mode, "system");
        assert_eq!(defaults.clock_format, "system");
        assert_eq!(defaults.countdown_detail, "adaptive");
    }

    #[test]
    fn accepts_every_named_preset() {
        for preset in [
            "countdownOnly",
            "dateAndTime",
            "countdownDateAndTime",
            "full",
            "compact",
            "custom",
        ] {
            let settings = ResetPresentationSettings {
                preset: preset.to_string(),
                ..ResetPresentationSettings::default()
            };
            assert!(settings.is_valid(), "preset {preset} must be valid");
        }
    }

    #[test]
    fn rejects_empty_modules() {
        let settings = ResetPresentationSettings {
            modules: vec![],
            ..ResetPresentationSettings::default()
        };
        assert!(!settings.is_valid());
    }

    #[test]
    fn rejects_duplicate_modules() {
        let settings = ResetPresentationSettings {
            modules: vec!["countdown".to_string(), "countdown".to_string()],
            ..ResetPresentationSettings::default()
        };
        assert!(!settings.is_valid());
    }

    #[test]
    fn rejects_unknown_module_id() {
        let settings = ResetPresentationSettings {
            modules: vec!["seconds-ticker".to_string()],
            ..ResetPresentationSettings::default()
        };
        assert!(!settings.is_valid());
    }

    #[test]
    fn rejects_duplicate_order_entries() {
        let settings = ResetPresentationSettings {
            order: vec![
                "countdown".to_string(),
                "countdown".to_string(),
                "date".to_string(),
            ],
            ..ResetPresentationSettings::default()
        };
        assert!(!settings.is_valid());
    }

    #[test]
    fn validates_iana_timezone_ids() {
        for zone in [
            "Asia/Riyadh",
            "Europe/London",
            "America/New_York",
            "America/Los_Angeles",
            "Asia/Tokyo",
            "Australia/Sydney",
            "UTC",
        ] {
            assert!(
                is_valid_iana_timezone(zone),
                "{zone} should be a valid IANA id"
            );
        }
    }

    #[test]
    fn rejects_raw_utc_offsets_and_garbage() {
        for zone in ["+03:00", "GMT+3", "", "not a timezone", "../../etc/passwd"] {
            assert!(!is_valid_iana_timezone(zone), "{zone} should be rejected");
        }
    }

    #[test]
    fn normalized_repairs_a_corrupt_field_without_discarding_the_rest() {
        let settings = ResetPresentationSettings {
            clock_format: "26-hour".to_string(), // corrupt
            modules: vec!["date".to_string(), "time".to_string()],
            ..ResetPresentationSettings::default()
        };
        let normalized = settings.normalized();
        assert!(normalized.is_valid());
        assert_eq!(normalized.clock_format, "system"); // repaired
        assert_eq!(
            normalized.modules,
            vec!["date".to_string(), "time".to_string()]
        ); // preserved
    }

    #[test]
    fn normalized_appends_an_enabled_module_missing_from_a_corrupt_order() {
        let settings = ResetPresentationSettings {
            modules: vec!["countdown".to_string(), "timezone".to_string()],
            order: vec!["countdown".to_string()],
            ..ResetPresentationSettings::default()
        };
        let normalized = settings.normalized();
        assert!(normalized.is_valid());
        assert!(normalized.order.contains(&"timezone".to_string()));
    }

    #[test]
    fn validates_bcp47_locale_tags() {
        for tag in ["en-US", "ar-SA", "en", "zh-Hans", "pt-BR"] {
            assert!(
                is_valid_bcp47_locale(tag),
                "{tag} should be a valid BCP-47 tag"
            );
        }
        for tag in ["", "not a locale", "en_US", "../../etc"] {
            assert!(!is_valid_bcp47_locale(tag), "{tag} should be rejected");
        }
    }

    #[test]
    fn normalized_falls_back_to_default_timezone_id_when_invalid() {
        let settings = ResetPresentationSettings {
            timezone_mode: "custom".to_string(),
            timezone_id: Some("not-a-real-zone!!".to_string()),
            ..ResetPresentationSettings::default()
        };
        let normalized = settings.normalized();
        assert!(normalized.is_valid());
        assert_eq!(normalized.timezone_id, None);
    }
}

pub mod collections;
pub mod interactions;
mod manual_cookies;
mod provider_workspace;
mod raw;
mod status;
mod types;

pub use api_keys::*;
pub use manual_cookies::*;
pub use provider_workspace::*;
use raw::RawSettings;
pub use status::*;
pub use types::*;

#[cfg(test)]
mod tests;

/// Application settings
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum LowPowerModePreference {
    #[default]
    Off,
    On,
    Automatic,
}

impl LowPowerModePreference {
    pub fn resolve(self, system_battery_saver_enabled: bool) -> bool {
        match self {
            Self::Off => false,
            Self::On => true,
            Self::Automatic => system_battery_saver_enabled,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::On => "on",
            Self::Automatic => "automatic",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "off" => Some(Self::Off),
            "on" => Some(Self::On),
            "automatic" => Some(Self::Automatic),
            _ => None,
        }
    }
}

/// Compatibility field for previously persisted Dashboard modes.
/// All retired values resolve to the single Analytics Dashboard on read.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum DashboardModeId {
    #[default]
    #[serde(alias = "providers3d", alias = "hybrid", alias = "spatial")]
    Analytics2d,
}
impl DashboardModeId {
    pub fn as_str(self) -> &'static str {
        "analytics2d"
    }
    pub fn parse(value: &str) -> Option<Self> {
        match value.trim() {
            "analytics2d" | "providers3d" | "hybrid" | "spatial" => Some(Self::Analytics2d),
            _ => None,
        }
    }
}

/// Dashboard *rendering* performance preset -- animation/visual-quality
/// budget for whichever `DashboardModeId` is mounted. Independent of
/// provider-refresh power settings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum DashboardPerformancePreset {
    LowCpu,
    #[default]
    Balanced,
    HighFidelity,
}

impl DashboardPerformancePreset {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::LowCpu => "lowCpu",
            Self::Balanced => "balanced",
            Self::HighFidelity => "highFidelity",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value.trim() {
            "lowCpu" => Some(Self::LowCpu),
            "balanced" => Some(Self::Balanced),
            "highFidelity" => Some(Self::HighFidelity),
            _ => None,
        }
    }
}

/// Shared desktop workspace presentation; no provider data or credentials.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase")]
pub struct WorkspacePreferences {
    pub density: String,
    pub navigation: String,
    pub sidebar_width: u16,
    pub provider_sidebar_width: u16,
    pub sidebar_collapsed: bool,
    pub background: String,
    pub background_motion: String,
    pub background_intensity: String,
}
impl Default for WorkspacePreferences {
    fn default() -> Self {
        Self {
            density: "comfortable".into(),
            navigation: "side".into(),
            sidebar_width: 232,
            provider_sidebar_width: 256,
            sidebar_collapsed: false,
            background: "cosmic".into(),
            background_motion: "static".into(),
            background_intensity: "balanced".into(),
        }
    }
}
impl WorkspacePreferences {
    pub fn normalized(mut self) -> Self {
        if !matches!(self.density.as_str(), "compact" | "dense") {
            self.density = "comfortable".into();
        }
        if !matches!(self.navigation.as_str(), "side" | "top" | "bottom") {
            self.navigation = "side".into();
        }
        self.sidebar_width = self.sidebar_width.clamp(184, 360);
        self.provider_sidebar_width = self.provider_sidebar_width.clamp(184, 360);
        let generated_background = ["atmosphere-", "motion-"].iter().any(|prefix| {
            self.background
                .strip_prefix(prefix)
                .is_some_and(|number| (1..=12).any(|value| number == format!("{value:02}")))
        });
        let custom_background = self.background.strip_prefix("custom:").is_some_and(|id| {
            uuid::Uuid::parse_str(id)
                .is_ok_and(|value| value.get_version_num() == 4 && value.to_string() == id)
        });
        if !generated_background
            && !custom_background
            && !matches!(
                self.background.as_str(),
                "none" | "cosmic" | "aurora" | "starfield"
            )
        {
            self.background = "cosmic".into();
        }
        if self.background_motion != "interactive" {
            self.background_motion = "static".into();
        }
        if !matches!(self.background_intensity.as_str(), "subtle" | "vivid") {
            self.background_intensity = "balanced".into();
        }
        self
    }
}

#[cfg(test)]
mod dashboard_mode_tests {
    use super::{DashboardModeId, DashboardPerformancePreset};

    #[test]
    fn dashboard_mode_defaults_to_analytics2d() {
        assert_eq!(DashboardModeId::default(), DashboardModeId::Analytics2d);
    }

    #[test]
    fn retired_dashboard_modes_resolve_to_analytics() {
        for value in ["analytics2d", "providers3d", "hybrid", "spatial"] {
            assert_eq!(
                DashboardModeId::parse(value),
                Some(DashboardModeId::Analytics2d)
            );
            let decoded: DashboardModeId =
                serde_json::from_value(serde_json::json!(value)).unwrap();
            assert_eq!(decoded, DashboardModeId::Analytics2d);
        }
    }

    #[test]
    fn dashboard_mode_rejects_unknown_strings() {
        assert_eq!(DashboardModeId::parse("3d"), None);
        assert_eq!(DashboardModeId::parse(""), None);
        assert_eq!(DashboardModeId::parse("Analytics2d"), None); // case-sensitive: exact wire value only
    }

    #[test]
    fn performance_preset_defaults_to_balanced() {
        assert_eq!(
            DashboardPerformancePreset::default(),
            DashboardPerformancePreset::Balanced
        );
    }

    #[test]
    fn performance_preset_round_trips_every_variant() {
        for preset in [
            DashboardPerformancePreset::LowCpu,
            DashboardPerformancePreset::Balanced,
            DashboardPerformancePreset::HighFidelity,
        ] {
            assert_eq!(
                DashboardPerformancePreset::parse(preset.as_str()),
                Some(preset)
            );
        }
    }

    #[test]
    fn performance_preset_rejects_unknown_strings() {
        assert_eq!(DashboardPerformancePreset::parse("ultra"), None);
        assert_eq!(DashboardPerformancePreset::parse(""), None);
    }
}

#[cfg(test)]
mod workspace_library_preferences_tests {
    use super::WorkspacePreferences;

    #[test]
    fn accepts_catalog_batches_and_generated_custom_ids_without_accepting_paths() {
        for prefix in ["atmosphere-", "motion-"] {
            for number in 1..=12 {
                let background = format!("{prefix}{number:02}");
                let prefs = WorkspacePreferences {
                    background: background.clone(),
                    ..Default::default()
                };
                assert_eq!(prefs.normalized().background, background);
            }
        }
        let custom = format!("custom:{}", uuid::Uuid::new_v4());
        assert_eq!(
            WorkspacePreferences {
                background: custom.clone(),
                ..Default::default()
            }
            .normalized()
            .background,
            custom
        );
        for background in [
            "motion-00",
            "motion-13",
            "atmosphere-1",
            "custom:../../settings.json",
            "file:///image.png",
        ] {
            assert_eq!(
                WorkspacePreferences {
                    background: background.into(),
                    ..Default::default()
                }
                .normalized()
                .background,
                "cosmic"
            );
        }
    }

    #[test]
    fn missing_provider_width_defaults_and_out_of_range_values_are_clamped() {
        let old: WorkspacePreferences =
            serde_json::from_str(r#"{"sidebarWidth":280,"background":"cosmic"}"#).unwrap();
        assert_eq!(old.provider_sidebar_width, 256);
        assert_eq!(old.sidebar_width, 280);
        assert_eq!(
            WorkspacePreferences {
                provider_sidebar_width: 999,
                ..Default::default()
            }
            .normalized()
            .provider_sidebar_width,
            360
        );
    }
}

/// Phase 5.2: how Demo Mode picks which providers to simulate. `Curated`
/// deterministically selects `demo_provider_count` real registered
/// providers (see the frontend's `demoMode/curatedProviders.ts`, which
/// mirrors this choice); `Custom` uses the explicit `demo_provider_ids`
/// list instead. Real product setting -- not gated behind any dev flag.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum DemoProviderMode {
    #[default]
    Curated,
    Custom,
}

impl DemoProviderMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Curated => "curated",
            Self::Custom => "custom",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value.trim() {
            "curated" => Some(Self::Curated),
            "custom" => Some(Self::Custom),
            _ => None,
        }
    }
}

/// Phase 5.2: which deterministic simulated dataset Demo Mode generates.
/// Every scenario stays within Phase 4's monetary truth model (Spend vs
/// Balance vs Credits vs Unavailable) -- see
/// `docs/validation/PHASE5_DEMO_MODE.md`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum DemoScenario {
    #[default]
    ConnectedShowcase,
    BalancedActivity,
    HighUsage,
    ResetSoon,
    MixedStatus,
    MonetarySemantics,
}

impl DemoScenario {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ConnectedShowcase => "connectedShowcase",
            Self::BalancedActivity => "balancedActivity",
            Self::HighUsage => "highUsage",
            Self::ResetSoon => "resetSoon",
            Self::MixedStatus => "mixedStatus",
            Self::MonetarySemantics => "monetarySemantics",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value.trim() {
            "connectedShowcase" => Some(Self::ConnectedShowcase),
            "balancedActivity" => Some(Self::BalancedActivity),
            "highUsage" => Some(Self::HighUsage),
            "resetSoon" => Some(Self::ResetSoon),
            "mixedStatus" => Some(Self::MixedStatus),
            "monetarySemantics" => Some(Self::MonetarySemantics),
            _ => None,
        }
    }
}

#[cfg(test)]
mod demo_mode_settings_tests {
    use super::{DemoProviderMode, DemoScenario};

    #[test]
    fn demo_provider_mode_defaults_to_curated() {
        assert_eq!(DemoProviderMode::default(), DemoProviderMode::Curated);
    }

    #[test]
    fn demo_provider_mode_round_trips_every_variant() {
        for mode in [DemoProviderMode::Curated, DemoProviderMode::Custom] {
            assert_eq!(DemoProviderMode::parse(mode.as_str()), Some(mode));
        }
    }

    #[test]
    fn demo_provider_mode_rejects_unknown_strings() {
        assert_eq!(DemoProviderMode::parse("all"), None);
        assert_eq!(DemoProviderMode::parse(""), None);
    }

    #[test]
    fn demo_scenario_defaults_to_connected_showcase() {
        assert_eq!(DemoScenario::default(), DemoScenario::ConnectedShowcase);
    }

    #[test]
    fn demo_scenario_round_trips_every_variant() {
        for scenario in [
            DemoScenario::ConnectedShowcase,
            DemoScenario::BalancedActivity,
            DemoScenario::HighUsage,
            DemoScenario::ResetSoon,
            DemoScenario::MixedStatus,
            DemoScenario::MonetarySemantics,
        ] {
            assert_eq!(DemoScenario::parse(scenario.as_str()), Some(scenario));
        }
    }

    #[test]
    fn demo_scenario_rejects_unknown_strings() {
        assert_eq!(DemoScenario::parse("chaos"), None);
        assert_eq!(DemoScenario::parse(""), None);
    }

    #[test]
    fn clamp_demo_provider_count_enforces_1_to_70() {
        assert_eq!(super::clamp_demo_provider_count(0), 1);
        assert_eq!(super::clamp_demo_provider_count(1), 1);
        assert_eq!(super::clamp_demo_provider_count(6), 6);
        assert_eq!(super::clamp_demo_provider_count(24), 24);
        assert_eq!(super::clamp_demo_provider_count(25), 25);
        assert_eq!(super::clamp_demo_provider_count(u32::MAX), 70);
    }

    #[test]
    fn normalize_demo_history_days_only_accepts_7_or_30() {
        assert_eq!(super::normalize_demo_history_days(0), 7);
        assert_eq!(super::normalize_demo_history_days(7), 7);
        assert_eq!(super::normalize_demo_history_days(15), 7);
        assert_eq!(super::normalize_demo_history_days(29), 7);
        assert_eq!(super::normalize_demo_history_days(30), 30);
        assert_eq!(super::normalize_demo_history_days(365), 30);
    }
}

/// Default number of simulated providers the first time Demo Mode is
/// enabled (owner Phase 5.2 section 5).
pub const DEFAULT_DEMO_PROVIDER_COUNT: u32 = 6;
/// Hard bounds enforced wherever `demo_provider_count` is set (owner
/// section 6: "1 through 24", "Do not allow 0 while Demo Mode is
/// enabled").
pub const MIN_DEMO_PROVIDER_COUNT: u32 = 1;
pub const MAX_DEMO_PROVIDER_COUNT: u32 = 70;
/// Clamps a requested demo provider count into the supported range.
pub fn clamp_demo_provider_count(count: u32) -> u32 {
    count.clamp(MIN_DEMO_PROVIDER_COUNT, MAX_DEMO_PROVIDER_COUNT)
}
/// The only two supported simulated-history lengths (owner section 4/39).
pub fn normalize_demo_history_days(days: u32) -> u32 {
    if days >= 30 { 30 } else { 7 }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(from = "RawSettings", default)]
pub struct Settings {
    /// Enabled provider IDs (by CLI name)
    pub enabled_providers: HashSet<String>,

    /// Refresh interval in seconds (0 = manual only).
    /// Ignored when [`Self::adaptive_refresh`] is true.
    pub refresh_interval_secs: u64,

    /// When true, ignore the fixed interval and use adaptive refresh delays.
    #[serde(default)]
    pub adaptive_refresh: bool,

    /// Force-refresh enabled providers whenever the tray/menu surface opens.
    #[serde(default)]
    pub refresh_all_providers_on_menu_open: bool,

    /// Off/On/Automatic background-work power preference (upstream 0.53).
    #[serde(default)]
    pub low_power_mode_preference: LowPowerModePreference,

    /// Which Dashboard experience (2D Analytics / 3D Providers / Hybrid) is
    /// currently selected. Exactly one is ever mounted.
    #[serde(default)]
    pub dashboard_mode: DashboardModeId,

    /// Dashboard rendering performance budget, independent of
    /// `low_power_mode_preference` (which governs provider polling).
    #[serde(default)]
    pub dashboard_performance_preset: DashboardPerformancePreset,
    #[serde(default)]
    pub workspace_preferences: Option<WorkspacePreferences>,
    pub analytics_preferences: Option<AnalyticsPreferences>,

    /// Phase 5.2: user-accessible Demo Mode -- previews Quotalis with
    /// simulated provider data, entirely generated on the frontend (this
    /// flag and the fields below are only CONFIGURATION; no simulated
    /// observation is ever persisted here or anywhere else). Global, not
    /// profile-scoped (owner section 33: a preview mode, not an account
    /// configuration). Default off -- real users see real data unless
    /// they explicitly opt in.
    #[serde(default)]
    pub demo_mode_enabled: bool,
    #[serde(default)]
    pub demo_provider_mode: DemoProviderMode,
    #[serde(default)]
    pub demo_provider_count: u32,
    /// Only meaningful when `demo_provider_mode` is `Custom`.
    #[serde(default)]
    pub demo_provider_ids: Vec<String>,
    #[serde(default)]
    pub demo_scenario: DemoScenario,
    /// Deterministic seed for the frontend's demo data generator --
    /// changing it (via "Regenerate Demo Data") produces a new but still
    /// fully reproducible dataset. Never used for anything security-
    /// sensitive; a plain u64 counter is sufficient.
    #[serde(default)]
    pub demo_seed: u64,
    #[serde(default)]
    pub demo_history_days: u32,

    /// Whether to start minimized
    pub start_minimized: bool,

    /// Which surface a plain desktop launch (no CLI args, not minimized, no
    /// compact overlay enabled) opens directly into: "dashboard" (the
    /// compact Pop Out Dashboard, the old default), "providerDisplay" (the
    /// main Settings workspace's Provider Display tab, the current default),
    /// or "lastOpened" (whichever Settings tab was last active, tracked in
    /// [`Self::last_settings_tab`]). Explicit tray/menu-bar launches are
    /// unaffected — they always open the compact tray experience.
    #[serde(default = "default_startup_destination")]
    pub startup_destination: String,

    /// The most recently active Settings tab, used when
    /// [`Self::startup_destination`] is "lastOpened". Validated against the
    /// current supported tab list at the point of use (in the desktop shell,
    /// which owns that list) rather than here, so a tab removed in a later
    /// release safely falls back instead of ever being treated as fatal.
    #[serde(default)]
    pub last_settings_tab: Option<String>,

    /// Whether to start at login
    pub start_at_login: bool,

    /// Whether to show notifications
    pub show_notifications: bool,

    /// Individual alert categories; the global switch remains the master gate.
    #[serde(default)]
    pub notification_events: NotificationEventPreferences,

    /// Optional local-time interval that suppresses delivery without pausing
    /// refresh, state tracking, or dedupe advancement.
    #[serde(default)]
    pub notification_quiet_hours: NotificationQuietHours,

    /// Whether to play sound effects for threshold alerts
    pub sound_enabled: bool,

    /// Per-notification WAV files. Unassigned events use the selected sound theme.
    #[serde(default)]
    pub notification_sound_paths: NotificationSoundPaths,

    /// Sound theme used when an event has no custom WAV file.
    #[serde(default)]
    pub notification_sound_theme: NotificationSoundTheme,

    /// High usage threshold for warnings (percentage)
    pub high_usage_threshold: f64,

    /// Critical usage threshold for alerts (percentage)
    pub critical_usage_threshold: f64,

    /// Optional usage milestone interval (1..=100). `None` disables step alerts.
    #[serde(default)]
    pub usage_step_notification_percent: Option<u8>,

    pub provider_usage_thresholds: HashMap<String, UsageThresholdOverride>,

    /// Merge mode: show all enabled providers in a single tray icon
    pub merge_tray_icons: bool,

    /// Tray icon display mode: single icon or per-provider icons
    #[serde(default)]
    pub tray_icon_mode: TrayIconMode,
    #[serde(default)]
    pub provider_instance_presentation: ProviderInstancePresentation,
    #[serde(default)]
    pub provider_tray_configs: HashMap<String, ProviderTrayConfig>,

    /// Show provider icons in the merged switcher UI
    #[serde(default = "default_true")]
    pub switcher_shows_icons: bool,

    /// Prefer the provider closest to its limit in merged menu bar display
    #[serde(default)]
    pub menu_bar_shows_highest_usage: bool,

    /// Replace bar-only tray display with provider branding plus percent text where supported
    #[serde(default)]
    pub menu_bar_shows_percent: bool,

    /// Show usage bars as "used" (true) or "remaining" (false)
    pub show_as_used: bool,

    /// Enable UI animations (chart entrances, transitions)
    pub enable_animations: bool,

    /// Show reset times as relative (e.g., "2h 30m" instead of "3:00 PM")
    pub reset_time_relative: bool,

    /// Replace exhausted quota text with its concrete future reset time.
    #[serde(default)]
    pub show_reset_when_exhausted: bool,

    /// Warn when Codex or Claude pace predicts exhaustion before reset.
    #[serde(default)]
    pub predictive_pace_warning_enabled: bool,

    /// Show pace visualizations and forecast text in provider menu cards.
    #[serde(default = "default_true")]
    pub show_pace: bool,

    /// Menu bar display mode: "minimal", "compact", or "detailed"
    pub menu_bar_display_mode: String,

    /// Show all token accounts in provider menus instead of collapsing behind switchers
    #[serde(default)]
    pub show_all_token_accounts_in_menu: bool,

    /// Per-provider configuration map (cookie/usage source, region, manual
    /// headers, API tokens, etc). Replaces the legacy flat per-provider
    /// fields; legacy `settings.json` files are migrated via [`RawSettings`].
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub provider_configs: HashMap<ProviderId, ProviderConfig>,

    /// Disable credential/keychain-style reads where supported
    #[serde(default)]
    pub disable_keychain_access: bool,

    /// Hide personal info (emails, account names) for streaming/sharing
    pub hide_personal_info: bool,

    /// Update channel for receiving updates (Stable or Beta)
    pub update_channel: UpdateChannel,

    /// Per-provider metric preference for tray display
    #[serde(default)]
    pub provider_metrics: HashMap<String, MetricPreference>,

    /// Preferred display order of provider IDs (CLI names).
    ///
    /// An empty list means "fall back to the canonical `ProviderId::all()`
    /// order". Unknown or duplicated ids are filtered out on load; new
    /// providers are appended in their canonical order.
    #[serde(default)]
    pub provider_order: Vec<String>,

    /// Global keyboard shortcut to open the menu (e.g., "Ctrl+Shift+U")
    #[serde(default = "default_global_shortcut")]
    pub global_shortcut: String,

    /// Additional Codex home or sessions directories to include in local cost scans.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub codex_custom_sessions_dirs: Vec<String>,

    /// Discover local and configured SSH Codex/Claude sessions.
    #[serde(default)]
    pub agent_sessions_enabled: bool,

    /// SSH targets queried for remote agent sessions.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub agent_session_ssh_hosts: Vec<String>,

    /// Master switch for external hooks (`hooks.json` next to settings).
    #[serde(default)]
    pub hooks_enabled: bool,

    /// Route provider/app HTTPS through a user-configured HTTP(S) proxy (#235).
    #[serde(default)]
    pub http_proxy_enabled: bool,

    /// Proxy base URL, e.g. `http://127.0.0.1:7890`.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub http_proxy_url: String,

    /// Optional proxy basic-auth username.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub http_proxy_username: String,

    /// Optional proxy basic-auth password (stored in local settings.json).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub http_proxy_password: String,

    /// Automatically download updates in the background
    #[serde(default)]
    pub auto_download_updates: bool,

    /// Install pending updates when quitting the application
    #[serde(default)]
    pub install_updates_on_quit: bool,

    /// UI language for the application (English default for backward compatibility)
    #[serde(default)]
    pub ui_language: Language,

    /// UI theme preference (Phase 12). Defaults to Auto (prefers-color-scheme).
    #[serde(default)]
    pub theme: ThemePreference,

    /// Finish applied to the single official QuotaArc mark in web surfaces
    /// and the generated tray/application identity.
    #[serde(default = "default_logo_variant")]
    pub logo_variant: String,

    /// Visual prominence of the QuotaArc mark, in the inclusive range 90..=125.
    #[serde(default = "default_logo_scale_percent")]
    pub logo_scale_percent: u16,

    /// Main PopOut window display scale, in the inclusive range 100..=250.
    /// 100 % is normal size; higher values enlarge the window content.
    #[serde(default = "default_window_scale_percent")]
    pub window_scale_percent: u16,

    /// Tray flyout display scale, in the inclusive range 100..=200.
    /// 100 % is normal size; higher values enlarge the flyout content.
    #[serde(default = "default_tray_scale_percent")]
    pub tray_scale_percent: u16,

    /// Enable the local PowerToys Command Palette status pipe.
    #[serde(default)]
    pub powertoys_status_pipe_enabled: bool,

    /// Show the always-on-top floating capacity bar.
    #[serde(default)]
    pub float_bar_enabled: bool,

    /// Opacity of the floating bar window, in the inclusive range 30..=100.
    /// Stored as `u8` so the on-disk format remains stable.
    #[serde(default = "default_float_bar_opacity")]
    pub float_bar_opacity: u8,

    /// Floating-bar visual scale, in the inclusive range 75..=200.
    #[serde(default = "default_float_bar_scale")]
    pub float_bar_scale: u8,

    /// Floating-bar orientation: "horizontal" (default) or "vertical".
    #[serde(default = "default_float_bar_orientation")]
    pub float_bar_orientation: String,

    /// Floating-bar visual style: "floating" (default) or "taskbar".
    #[serde(default = "default_float_bar_style")]
    pub float_bar_style: String,

    /// When true the floating bar is fully click-through (overlay mode).
    #[serde(default)]
    pub float_bar_click_through: bool,

    /// Provider CLI names to display in the floating bar. Empty = all enabled.
    #[serde(default)]
    pub float_bar_provider_ids: Vec<String>,

    /// When true, the floating bar uses a dark-on-light palette so it
    /// stays legible on light desktop backgrounds. Defaults to false
    /// (light-on-dark, the original look).
    #[serde(default)]
    pub float_bar_dark_text: bool,

    /// When true, show the primary window's next reset inline in each pill.
    #[serde(default)]
    pub float_bar_show_reset_inline: bool,

    /// When true, show local cost summaries in the floating bar.
    #[serde(default)]
    pub float_bar_show_cost: bool,

    // ── QuotaArc Surface Engine ─────────────────────────────────────────
    //
    // QuotaArc's own surfaces (Edge Arc, Top Arc). All fields serde-default
    // so existing settings.json files load unchanged and surfaces stay off
    // until the user turns them on.
    /// Enable the Edge Arc: a vertical capacity strip attached to a screen
    /// edge (right or left).
    #[serde(default)]
    pub edge_arc_enabled: bool,

    /// Edge Arc screen side: "right" (default) or "left".
    #[serde(default = "default_edge_arc_side")]
    pub edge_arc_side: String,

    /// Edge Arc window opacity, 30..=100.
    #[serde(default = "default_surface_opacity")]
    pub edge_arc_opacity: u8,

    /// Edge Arc visual scale, 75..=200 (percent).
    #[serde(default = "default_surface_scale")]
    pub edge_arc_scale: u8,

    /// Edge Arc full click-through (overlay) mode.
    #[serde(default)]
    pub edge_arc_click_through: bool,

    /// Hide the Edge Arc while a fullscreen app/game is in the foreground.
    /// Defaults on so games are never obstructed.
    #[serde(default = "default_true")]
    pub edge_arc_hide_fullscreen: bool,

    /// Enable the Top Arc: a top-center capacity pill with hover expansion.
    #[serde(default)]
    pub top_arc_enabled: bool,

    /// Top Arc window opacity, 30..=100.
    #[serde(default = "default_surface_opacity")]
    pub top_arc_opacity: u8,

    /// Top Arc visual scale, 75..=200 (percent).
    #[serde(default = "default_surface_scale")]
    pub top_arc_scale: u8,

    /// Quota Island placement: top-left, top-center, top-right, or free.
    /// Free placement is chosen automatically when the user drags the island.
    #[serde(default = "default_top_arc_placement")]
    pub top_arc_placement: String,

    /// Theme-neutral silhouette for the one live QuotaArc surface.
    /// A form changes geometry only; visual material remains a theme concern.
    #[serde(default = "default_flow_surface_form")]
    pub top_arc_form: String,
    #[serde(default)]
    pub collection_layout: collections::CollectionLayout,
    #[serde(default)]
    pub surface_interactions: interactions::SurfaceInteractions,

    /// Form-aware screen anchor. `free` uses the remembered drag position.
    #[serde(default = "default_flow_surface_anchor")]
    pub top_arc_anchor: String,

    /// Retract to a small reachable reveal tab after the pointer leaves.
    #[serde(default = "default_true")]
    pub top_arc_auto_hide: bool,

    /// Delay before the compact surface retracts, in milliseconds.
    #[serde(default = "default_flow_surface_auto_hide_delay")]
    pub top_arc_auto_hide_delay_ms: u16,

    /// Top Arc full click-through (overlay) mode.
    #[serde(default)]
    pub top_arc_click_through: bool,

    /// Hide the Top Arc while a fullscreen app/game is in the foreground.
    #[serde(default = "default_true")]
    pub top_arc_hide_fullscreen: bool,

    /// Enable the Taskbar Arc: a taskbar-adjacent capacity strip sitting on
    /// the monitor's work-area bottom edge.
    #[serde(default)]
    pub taskbar_arc_enabled: bool,

    /// Taskbar Arc window opacity, 30..=100.
    #[serde(default = "default_surface_opacity")]
    pub taskbar_arc_opacity: u8,

    /// Taskbar Arc full click-through (overlay) mode.
    #[serde(default)]
    pub taskbar_arc_click_through: bool,

    /// Taskbar Arc visual scale, 75..=200 (percent). INDEPENDENT of
    /// top_arc_scale: changing one must never move the other.
    #[serde(default = "default_surface_scale")]
    pub taskbar_arc_scale: u8,

    /// Hide the Taskbar Arc while a fullscreen app/game is in the foreground.
    #[serde(default = "default_true")]
    pub taskbar_arc_hide_fullscreen: bool,

    /// Global usage display mode: "used" | "remaining" | "hybrid".
    /// Per-provider overrides live in provider_usage_overrides.
    #[serde(default)]
    pub usage_display_mode: Option<String>,

    /// Per-provider usage mode overrides keyed by provider CLI name.
    #[serde(default)]
    pub provider_usage_overrides: std::collections::HashMap<String, String>,
    /// Detail-window visibility, independent of the selected primary metric.
    #[serde(default)]
    pub provider_detail_windows: std::collections::HashMap<String, String>,
    /// Explicit ordered source-limit IDs. Empty means hidden; absent follows legacy/default.
    #[serde(default)]
    pub provider_limit_order: std::collections::HashMap<String, Vec<String>>,
    #[serde(default)]
    pub provider_limit_presentation: std::collections::HashMap<String, LimitPresentation>,
    /// Shared presentation inherited by providers without an explicit override.
    #[serde(default)]
    pub global_limit_presentation: LimitPresentation,

    /// Global Reset Time / Presentation configuration (countdown/date/time
    /// modules, ordering, timezone, clock format, ...). Surfaces that don't
    /// yet support an override use this directly; `reset_presentation_overrides`
    /// holds any per-surface overrides, consulted first.
    #[serde(default)]
    pub reset_presentation: ResetPresentationSettings,

    /// Per-surface overrides of `reset_presentation`, keyed by surface id
    /// ("taskbar", "top", "edge", "hud", "quickPanel", "dashboard",
    /// "providerDisplay", "tray"). A surface absent here inherits the
    /// global `reset_presentation` unchanged.
    #[serde(default)]
    pub reset_presentation_overrides: std::collections::HashMap<String, ResetPresentationSettings>,

    /// Orbital theme catalog selection (themeCatalog slug, e.g.
    /// "01-obsidian-orbit"). Invalid or missing slugs fall back to the
    /// Obsidian Orbit default at read time.
    #[serde(default = "default_catalog_theme")]
    pub catalog_theme: String,

    /// Catalog theme assigned by the active profile. This is a derived cache
    /// refreshed on profile switches; `None` means inherit the global theme.
    #[serde(default)]
    pub active_profile_catalog_theme: Option<String>,

    /// Per-surface catalog overrides. Keys are the bounded public surface ids
    /// (taskbar/top/edge/hud/quick/dashboard).
    #[serde(default)]
    pub surface_catalog_themes: std::collections::HashMap<String, String>,

    /// Privacy Mode: hide account/profile names, emails, and costs across
    /// surfaces. Persisted so it survives restarts; toggleable from the tray.
    #[serde(default)]
    pub privacy_mode: bool,

    /// Promote the tray icon out of the Windows hidden-icons overflow area.
    /// Only has effect on Windows 11 (build ≥ 22000); silently ignored elsewhere.
    /// Defaults on so upgrades keep the icon pinned to the taskbar notification area.
    #[serde(default = "default_true")]
    pub promote_tray_icon: bool,

    /// When true, show Claude Daily Routines usage in extras.
    /// Defaults on to match upstream visibility.
    #[serde(default = "default_true")]
    pub claude_daily_routines_usage_visible: bool,

    /// Explicit consent to read (and refresh) Claude Code's own credentials
    /// (`~/.claude/.credentials.json` / Credential Manager). Default OFF —
    /// upstream #2634: without consent the OAuth source stays closed and Auto
    /// falls back to labeled reduced-fidelity CLI usage; refreshed tokens are
    /// never rotated into Claude Code's storage without consent (#2745).
    #[serde(default)]
    pub claude_allow_reading_claude_code_credentials: bool,

    /// Optional work-week length [2,6] for session-equivalent weekly forecast.
    /// `None` uses wall-clock time until weekly reset.
    #[serde(default)]
    pub weekly_progress_work_days: Option<u8>,

    /// Alibaba Token Plan API region: "cn" | "intl" | "cn-personal" | "intl-personal".
    #[serde(default = "default_alibaba_token_plan_region")]
    pub alibaba_token_plan_region: String,

    /// Opt-in: allow Codex usage reads from external (non-CLI-owned) OAuth
    /// credential sources. Default OFF — when disabled, stale external OAuth
    /// credential files fail closed instead of being used silently (upstream
    /// 0.50.1 #2944). The CLI-owned `auth.json` is always read read-only; this
    /// gate only controls whether stale external OAuth tokens are trusted.
    #[serde(default)]
    pub codex_external_oauth_sources_allowed: bool,

    /// How cost is rendered on provider MenuCards (#2976).
    #[serde(default)]
    pub cost_summary_display_style: CostSummaryDisplayStyle,

    /// Opt-in read-only import of OpenCodex usage.jsonl into Usage & Spend / CLI cost output.
    #[serde(default)]
    pub open_codex_usage_logs_enabled: bool,

    /// Hide native Codex spend rows when an OpenCodex import is present.
    #[serde(default)]
    pub hide_native_codex_cost_when_open_codex_present: bool,
}

fn default_window_scale_percent() -> u16 {
    100
}

fn default_logo_variant() -> String {
    "silver".to_string()
}

fn default_logo_scale_percent() -> u16 {
    116
}

pub fn normalize_logo_variant(value: &str) -> String {
    match value {
        "silver" | "arctic" | "aurora" | "ember" | "violet" => value.to_string(),
        _ => default_logo_variant(),
    }
}

pub fn clamp_logo_scale_percent(value: u16) -> u16 {
    value.clamp(90, 125)
}

fn default_alibaba_token_plan_region() -> String {
    "cn".to_string()
}

pub fn clamp_window_scale_percent(value: u16) -> u16 {
    value.clamp(100, 250)
}

fn default_tray_scale_percent() -> u16 {
    100
}

pub fn clamp_tray_scale_percent(value: u16) -> u16 {
    value.clamp(100, 200)
}

fn default_float_bar_opacity() -> u8 {
    80
}

fn default_float_bar_scale() -> u8 {
    100
}

fn default_float_bar_orientation() -> String {
    "horizontal".to_string()
}

fn default_float_bar_style() -> String {
    "floating".to_string()
}

/// Clamp the floating-bar opacity to the supported range.
///
/// Opacity values below 30% would make the bar effectively invisible, so we
/// pin the lower bound; the upper bound is the natural 100%.
pub fn clamp_float_bar_opacity(value: u8) -> u8 {
    value.clamp(30, 100)
}

/// Clamp the floating-bar visual scale to the supported range.
pub fn clamp_float_bar_scale(value: u8) -> u8 {
    value.clamp(75, 200)
}

// ── QuotaArc Surface Engine defaults/clamps ──────────────────────────────

fn default_catalog_theme() -> String {
    "01-obsidian-orbit".to_string()
}

/// Validate a catalog theme slug; unknown values fall back to the default
/// so a corrupt settings file can never select a nonexistent theme.
/// Normalize a usage display mode; unknown values become None (remaining).
pub fn normalize_usage_display_mode(value: &str) -> Option<String> {
    match value {
        "remaining" => Some("remaining".to_string()),
        "used" => Some("used".to_string()),
        "hybrid" => Some("hybrid".to_string()),
        _ => None,
    }
}

pub fn normalize_catalog_theme(value: &str) -> String {
    canonical_catalog_theme(value).unwrap_or_else(default_catalog_theme)
}

/// Selectable token-only materials. Earlier geometry experiments stay archived.
pub fn canonical_catalog_theme(value: &str) -> Option<String> {
    matches!(
        value,
        "01-obsidian-orbit"
            | "smoked-silver"
            | "tidal-glass"
            | "ember-alloy"
            | "aurora-bloom-material"
            | "solar-ember-material"
            | "ceramic-pearl-material"
            | "sapphire-observatory"
            | "eclipse-ember"
            | "02-graphite-precision"
            | "03-midnight-glass"
            | "05-stealth-mono"
            | "06-aurora-prism"
            | "07-solar-pearl"
            | "08-oceanic-glass"
            | "09-rose-quartz"
            | "10-verdant-halo"
            | "11-copper-ember"
            | "12-arctic-spectrum"
            | "13-lavender-mist"
            | "14-sapphire-circuit"
            | "15-crimson-atelier"
            | "17-jade-pavilion"
            | "33-ink-and-gold"
    )
    .then(|| value.to_string())
}

pub fn normalize_surface_catalog_themes(
    values: std::collections::HashMap<String, String>,
) -> std::collections::HashMap<String, String> {
    const SURFACES: &[&str] = &["taskbar", "top", "edge", "hud", "quick", "dashboard"];
    values
        .into_iter()
        .filter_map(|(surface, slug)| {
            if !SURFACES.contains(&surface.as_str()) {
                return None;
            }
            canonical_catalog_theme(&slug).map(|slug| (surface, slug))
        })
        .collect()
}

fn default_edge_arc_side() -> String {
    "right".to_string()
}

fn default_top_arc_placement() -> String {
    "top-center".to_string()
}

fn default_flow_surface_form() -> String {
    "flowline".to_string()
}

fn default_flow_surface_anchor() -> String {
    "right".to_string()
}

fn default_flow_surface_auto_hide_delay() -> u16 {
    900
}

fn default_surface_opacity() -> u8 {
    95
}

fn default_surface_scale() -> u8 {
    100
}

/// Clamp a surface opacity to 30..=100 (below 30% a surface is unusable).
pub fn clamp_surface_opacity(value: u8) -> u8 {
    value.clamp(30, 100)
}

/// Clamp a surface scale to 75..=200.
pub fn clamp_surface_scale(value: u8) -> u8 {
    value.clamp(75, 200)
}

/// Normalize an Edge Arc side. Unknown values fall back to "right".
pub fn normalize_edge_arc_side(value: &str) -> String {
    match value {
        "left" => "left".to_string(),
        _ => "right".to_string(),
    }
}

fn default_startup_destination() -> String {
    "providerDisplay".to_string()
}

/// Keep the startup destination bounded even when a settings file was
/// hand-edited or produced by an older build that predates this field.
pub fn normalize_startup_destination(value: &str) -> String {
    match value {
        "dashboard" | "providerDisplay" | "lastOpened" => value.to_string(),
        _ => default_startup_destination(),
    }
}

/// Keep placement values bounded even when a settings file was hand-edited or
/// produced by an older build. The island always has a safe top-center escape.
pub fn normalize_top_arc_placement(value: &str) -> String {
    match value {
        "top-left" | "top-center" | "top-right" | "free" => value.to_string(),
        _ => default_top_arc_placement(),
    }
}

/// The supported structural forms for the one live QuotaArc overlay.
/// Unknown legacy tokens resolve to the compact Flowline default.
pub fn normalize_flow_surface_form(value: &str) -> String {
    match value {
        "reel" => "reel".to_string(),
        "seam" | "ribbon" | "cradle" | "deck" | "satellite" | "pebble" | "fan" | "crescent" => {
            value.to_string()
        }
        "horizon" => "horizon".to_string(),
        "petal" => "petal".to_string(),
        "orbital" => "orbital".to_string(),
        "lens" => "lens".to_string(),
        _ => default_flow_surface_form(),
    }
}

/// Keep an anchor valid for the selected structural form. `free` is always
/// allowed and is separately protected by the visible-work-area restore path.
pub fn normalize_flow_surface_anchor(form: &str, anchor: &str) -> String {
    if anchor == "free" {
        return "free".to_string();
    }
    if matches!(
        normalize_flow_surface_form(form).as_str(),
        "flowline"
            | "horizon"
            | "seam"
            | "ribbon"
            | "satellite"
            | "cradle"
            | "crescent"
            | "petal"
            | "orbital"
            | "lens"
            | "reel"
            | "deck"
            | "pebble"
            | "fan"
    ) && matches!(
        anchor,
        "left"
            | "right"
            | "top"
            | "bottom"
            | "top-left"
            | "top-right"
            | "bottom-left"
            | "bottom-right"
    ) {
        return anchor.to_string();
    }
    match normalize_flow_surface_form(form).as_str() {
        "horizon" | "ribbon" => match anchor {
            "bottom" => "bottom".to_string(),
            _ => "top".to_string(),
        },
        "seam" | "satellite" | "crescent" => match anchor {
            "left" => "left".to_string(),
            _ => "right".to_string(),
        },
        "cradle" => match anchor {
            "top-left" | "top-right" | "bottom-left" | "bottom-right" => anchor.to_string(),
            _ => "bottom-right".to_string(),
        },
        "petal" | "orbital" | "lens" | "reel" | "deck" | "pebble" | "fan" => match anchor {
            "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left"
            | "bottom-right" => anchor.to_string(),
            _ => "bottom-right".to_string(),
        },
        _ => match anchor {
            "left" => "left".to_string(),
            _ => default_flow_surface_anchor(),
        },
    }
}

/// Bounded hover retraction keeps the surface responsive but never flickery.
pub fn clamp_flow_surface_auto_hide_delay(value: u16) -> u16 {
    value.clamp(300, 3_000)
}

/// Normalize a floating-bar orientation string. Unknown values fall back to
/// the default ("horizontal") so a corrupt settings file can't put the
/// renderer into an undefined state.
pub fn normalize_float_bar_orientation(value: &str) -> String {
    match value {
        "vertical" => "vertical".to_string(),
        _ => "horizontal".to_string(),
    }
}

/// Normalize a floating-bar style string. Unknown values fall back to the
/// original floating style so existing settings keep their previous look.
pub fn normalize_float_bar_style(value: &str) -> String {
    match value {
        "taskbar" => "taskbar".to_string(),
        "hud" => "hud".to_string(),
        _ => "floating".to_string(),
    }
}

/// Canonicalize a requested provider display order.
///
/// Keeps requested provider IDs that map to a real [`ProviderId`], drops
/// duplicates, and appends omitted providers in canonical order. An empty
/// request intentionally returns the full canonical order so display callers
/// can use one path for default and customized ordering.
pub fn normalize_provider_order(requested: &[String]) -> Vec<String> {
    let canonical = ProviderId::all()
        .iter()
        .map(|provider| provider.cli_name().to_string())
        .collect::<Vec<_>>();
    let valid = canonical.iter().map(String::as_str).collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    let mut out = Vec::with_capacity(canonical.len());

    for provider_id in requested {
        if valid.contains(provider_id.as_str()) && seen.insert(provider_id.clone()) {
            out.push(provider_id.clone());
        }
    }
    for provider_id in canonical {
        if seen.insert(provider_id.clone()) {
            out.push(provider_id);
        }
    }

    out
}

fn default_global_shortcut() -> String {
    "Ctrl+Shift+U".to_string()
}

fn default_true() -> bool {
    true
}

/// Default cookie source value for browser-authenticated providers.
///
/// Browser cookie extraction reads browser profile databases and decrypts
/// Chromium cookies via Windows DPAPI, which can trigger behavior-based AV
/// engines. Keep that path explicit opt-in by default.
const DEFAULT_COOKIE_SOURCE: &str = "manual";

/// Default usage source value for any provider.
const DEFAULT_PROVIDER_SOURCE: &str = "auto";

/// Default API region for providers that expose one.
fn default_api_region(id: ProviderId) -> &'static str {
    match id {
        ProviderId::Alibaba => crate::providers::AlibabaRegion::Singapore.settings_value(),
        ProviderId::AlibabaTokenPlan => "cn",
        ProviderId::Zai | ProviderId::MiniMax => "global",
        _ => "",
    }
}

/// Default for the codex `openai_web_extras` boolean (true = show extras).
const DEFAULT_CODEX_OPENAI_WEB_EXTRAS: bool = true;
const DEFAULT_CODEX_SPARK_USAGE_VISIBLE: bool = true;

impl Default for Settings {
    fn default() -> Self {
        let mut enabled = HashSet::new();
        // Default enabled providers
        enabled.insert("claude".to_string());
        enabled.insert("codex".to_string());

        Self {
            enabled_providers: enabled,
            refresh_interval_secs: 300, // 5 minutes
            adaptive_refresh: false,
            refresh_all_providers_on_menu_open: false,
            low_power_mode_preference: LowPowerModePreference::Off,
            dashboard_mode: DashboardModeId::default(),
            dashboard_performance_preset: DashboardPerformancePreset::default(),
            workspace_preferences: None,
            analytics_preferences: None,
            demo_mode_enabled: false,
            demo_provider_mode: DemoProviderMode::default(),
            demo_provider_count: DEFAULT_DEMO_PROVIDER_COUNT,
            demo_provider_ids: Vec::new(),
            demo_scenario: DemoScenario::default(),
            demo_seed: 1,
            demo_history_days: 7,
            start_minimized: false,
            startup_destination: default_startup_destination(),
            last_settings_tab: None,
            start_at_login: false,
            show_notifications: true,
            notification_events: NotificationEventPreferences::default(),
            notification_quiet_hours: NotificationQuietHours::default(),
            sound_enabled: true,
            notification_sound_paths: NotificationSoundPaths::default(),
            notification_sound_theme: NotificationSoundTheme::default(),
            high_usage_threshold: 70.0,
            critical_usage_threshold: 90.0,
            usage_step_notification_percent: None,
            provider_usage_thresholds: HashMap::new(),
            merge_tray_icons: false, // Show single provider by default
            provider_instance_presentation: ProviderInstancePresentation::default(),
            provider_tray_configs: HashMap::new(),
            tray_icon_mode: TrayIconMode::default(), // Single icon by default
            switcher_shows_icons: true,
            menu_bar_shows_highest_usage: false,
            menu_bar_shows_percent: false,
            show_as_used: true,        // Show as "used" by default
            enable_animations: true,   // Animations enabled by default
            reset_time_relative: true, // Show relative times by default
            show_reset_when_exhausted: false,
            predictive_pace_warning_enabled: false,
            show_pace: true,
            menu_bar_display_mode: "detailed".to_string(), // Detailed mode by default
            show_all_token_accounts_in_menu: false,
            provider_configs: HashMap::new(),
            disable_keychain_access: false,
            hide_personal_info: false, // Show personal info by default
            update_channel: UpdateChannel::default(), // Stable by default
            provider_metrics: HashMap::new(), // Empty = use Automatic for all
            provider_order: Vec::new(), // Empty = canonical ProviderId::all() order
            global_shortcut: default_global_shortcut(), // Ctrl+Shift+U by default
            codex_custom_sessions_dirs: Vec::new(),
            agent_sessions_enabled: false,
            agent_session_ssh_hosts: Vec::new(),
            hooks_enabled: false,
            http_proxy_enabled: false,
            http_proxy_url: String::new(),
            http_proxy_username: String::new(),
            http_proxy_password: String::new(),
            auto_download_updates: false, // Require explicit opt-in for background downloads
            install_updates_on_quit: false, // Don't auto-install on quit by default
            ui_language: Language::default(), // English by default
            theme: ThemePreference::default(), // Auto (follows prefers-color-scheme)
            logo_variant: default_logo_variant(),
            logo_scale_percent: default_logo_scale_percent(),
            window_scale_percent: default_window_scale_percent(),
            tray_scale_percent: default_tray_scale_percent(),
            powertoys_status_pipe_enabled: false,
            float_bar_enabled: false,
            float_bar_opacity: default_float_bar_opacity(),
            float_bar_scale: default_float_bar_scale(),
            float_bar_orientation: default_float_bar_orientation(),
            float_bar_style: default_float_bar_style(),
            float_bar_click_through: false,
            float_bar_provider_ids: Vec::new(),
            float_bar_dark_text: false,
            float_bar_show_reset_inline: false,
            float_bar_show_cost: false,
            edge_arc_enabled: false,
            edge_arc_side: default_edge_arc_side(),
            edge_arc_opacity: default_surface_opacity(),
            edge_arc_scale: default_surface_scale(),
            edge_arc_click_through: false,
            edge_arc_hide_fullscreen: true,
            top_arc_enabled: false,
            top_arc_opacity: default_surface_opacity(),
            top_arc_scale: default_surface_scale(),
            top_arc_placement: default_top_arc_placement(),
            top_arc_form: default_flow_surface_form(),
            collection_layout: collections::CollectionLayout::default(),
            surface_interactions: interactions::SurfaceInteractions::default(),
            top_arc_anchor: default_flow_surface_anchor(),
            top_arc_auto_hide: true,
            top_arc_auto_hide_delay_ms: default_flow_surface_auto_hide_delay(),
            top_arc_click_through: false,
            top_arc_hide_fullscreen: true,
            taskbar_arc_enabled: false,
            taskbar_arc_opacity: default_surface_opacity(),
            taskbar_arc_scale: default_surface_scale(),
            taskbar_arc_click_through: false,
            taskbar_arc_hide_fullscreen: true,
            usage_display_mode: None,
            provider_usage_overrides: std::collections::HashMap::new(),
            provider_detail_windows: std::collections::HashMap::new(),
            provider_limit_order: std::collections::HashMap::new(),
            provider_limit_presentation: std::collections::HashMap::new(),
            global_limit_presentation: LimitPresentation::default(),
            reset_presentation: ResetPresentationSettings::default(),
            reset_presentation_overrides: std::collections::HashMap::new(),
            catalog_theme: default_catalog_theme(),
            active_profile_catalog_theme: None,
            surface_catalog_themes: std::collections::HashMap::new(),
            privacy_mode: false,
            promote_tray_icon: true,
            claude_daily_routines_usage_visible: true,
            claude_allow_reading_claude_code_credentials: false,
            weekly_progress_work_days: None,
            alibaba_token_plan_region: default_alibaba_token_plan_region(),
            codex_external_oauth_sources_allowed: false,
            cost_summary_display_style: CostSummaryDisplayStyle::default(),
            open_codex_usage_logs_enabled: false,
            hide_native_codex_cost_when_open_codex_present: false,
        }
    }
}

impl Settings {
    /// Get the settings file path
    pub fn settings_path() -> Option<PathBuf> {
        crate::logging::config_root().map(|p| p.join("settings.json"))
    }

    /// Load settings from disk
    pub fn load() -> Self {
        #[allow(
            unused_mut,
            reason = "mutability is needed for conditional initialization paths that the compiler cannot prove"
        )]
        let mut settings = match Self::settings_path() {
            Some(path) if path.exists() => match crate::secure_file::read_string(&path) {
                Ok(content) => {
                    serde_json::from_str(content.trim_start_matches('\u{feff}')).unwrap_or_default()
                }
                Err(_) => Self::default(),
            },
            _ => Self::default(),
        };

        // Sync autostart toggle with actual registry state and repair stale commands from older builds.
        #[cfg(target_os = "windows")]
        {
            settings.start_at_login = Self::sync_start_at_login_registry();
            settings.apply_promote_tray_default_migration();
        }

        // The canonical foundation intentionally ignores persisted selections
        // for the archived themes. Keep this migration in-memory until a
        // normal settings save so a read can never destroy user history.
        settings.startup_destination = normalize_startup_destination(&settings.startup_destination);
        settings.catalog_theme = normalize_catalog_theme(&settings.catalog_theme);
        settings.active_profile_catalog_theme = settings
            .active_profile_catalog_theme
            .as_deref()
            .and_then(canonical_catalog_theme);
        settings.surface_catalog_themes =
            normalize_surface_catalog_themes(std::mem::take(&mut settings.surface_catalog_themes));
        settings.top_arc_placement = normalize_top_arc_placement(&settings.top_arc_placement);
        settings.top_arc_form = normalize_flow_surface_form(&settings.top_arc_form);
        settings.top_arc_anchor =
            normalize_flow_surface_anchor(&settings.top_arc_form, &settings.top_arc_anchor);
        settings.top_arc_auto_hide_delay_ms =
            clamp_flow_surface_auto_hide_delay(settings.top_arc_auto_hide_delay_ms);
        settings.reset_presentation = std::mem::take(&mut settings.reset_presentation).normalized();
        settings.reset_presentation_overrides =
            std::mem::take(&mut settings.reset_presentation_overrides)
                .into_iter()
                .map(|(surface, config)| (surface, config.normalized()))
                .collect();

        // V9 retires the competing edge and taskbar overlays. Preserve their
        // old configuration on disk until a normal save, but never restore a
        // large legacy surface over the desktop again.
        settings.edge_arc_enabled = false;
        settings.taskbar_arc_enabled = false;

        settings
    }

    /// Marker written after the one-shot "pin tray by default" migration (issue #237).
    fn promote_tray_default_marker_path() -> Option<PathBuf> {
        crate::logging::config_root().map(|p| p.join(".tray-pin-default-v1"))
    }

    /// Old builds defaulted `promote_tray_icon` to false and persisted that on any
    /// settings save. Flip those installs to the new default once; later opt-outs
    /// are preserved because the marker file remains.
    fn should_migrate_promote_tray_default(
        promote_tray_icon: bool,
        already_migrated: bool,
    ) -> bool {
        !already_migrated && !promote_tray_icon
    }

    fn apply_promote_tray_default_migration(&mut self) {
        let Some(marker) = Self::promote_tray_default_marker_path() else {
            return;
        };
        let already_migrated = marker.exists();
        if Self::should_migrate_promote_tray_default(self.promote_tray_icon, already_migrated) {
            self.promote_tray_icon = true;
            if let Err(error) = self.save() {
                tracing::warn!("Failed to persist promote_tray_icon default migration: {error}");
            }
        }
        if !already_migrated && let Some(parent) = marker.parent() {
            // Best-effort marker dir creation; the write below reports failure.
            let _created_dir = std::fs::create_dir_all(parent);
            if let Err(error) = std::fs::write(&marker, b"1") {
                tracing::warn!("Failed to write promote_tray_icon migration marker: {error}");
            }
        }
    }

    /// Save settings to disk
    pub fn save(&self) -> anyhow::Result<()> {
        let path = Self::settings_path()
            .ok_or_else(|| anyhow::anyhow!("Could not determine settings path"))?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let json = serde_json::to_string_pretty(self)?;
        crate::secure_file::write_string_atomic(&path, &json)?;

        Ok(())
    }

    fn start_at_login_exe_path(current_exe: &std::path::Path) -> std::path::PathBuf {
        let file_name = current_exe.file_name().and_then(|name| name.to_str());
        if file_name.is_some_and(|name| {
            name.eq_ignore_ascii_case("codexbar-cli.exe")
                || name.eq_ignore_ascii_case("codexbar-desktop.exe")
        }) && let Some(desktop_exe) = current_exe
            .parent()
            .map(|dir| dir.join("codexbar.exe"))
            .filter(|path| path.exists())
        {
            return desktop_exe;
        }

        current_exe.to_path_buf()
    }

    fn start_at_login_command(current_exe: &std::path::Path) -> String {
        let exe_path = Self::start_at_login_exe_path(current_exe);
        format!("\"{}\"", exe_path.display())
    }

    fn start_at_login_command_needs_repair(existing: &str, current_exe: &std::path::Path) -> bool {
        existing != Self::start_at_login_command(current_exe)
    }

    #[cfg(target_os = "windows")]
    pub fn apply_start_at_login_registry(enabled: bool) -> anyhow::Result<()> {
        use winreg::RegKey;
        use winreg::enums::*;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = hkcu.open_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            KEY_READ | KEY_WRITE,
        )?;

        if enabled {
            let exe_path = std::env::current_exe()?;
            let command = Self::start_at_login_command(&exe_path);
            run_key.set_value(crate::paths::REGISTRY_RUN_VALUE, &command)?;
        } else {
            // Best-effort removal; a missing value means the desired state already.
            let _removed_value = run_key.delete_value(crate::paths::REGISTRY_RUN_VALUE);
        }

        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn sync_start_at_login_registry() -> bool {
        use winreg::RegKey;
        use winreg::enums::*;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let Ok(run_key) = hkcu.open_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            KEY_READ | KEY_WRITE,
        ) else {
            return false;
        };

        let Ok(existing) = run_key.get_value::<String, _>(crate::paths::REGISTRY_RUN_VALUE) else {
            return false;
        };

        match std::env::current_exe() {
            Ok(exe_path) if Self::start_at_login_command_needs_repair(&existing, &exe_path) => {
                let command = Self::start_at_login_command(&exe_path);
                if let Err(error) = run_key.set_value(crate::paths::REGISTRY_RUN_VALUE, &command) {
                    tracing::warn!("Failed to repair QuotaArc start-at-login command: {error}");
                }
            }
            Err(error) => {
                tracing::warn!(
                    "Failed to resolve current executable for start-at-login sync: {error}"
                );
            }
            _ => {}
        }

        true
    }

    #[cfg(not(target_os = "windows"))]
    pub fn apply_start_at_login_registry(_enabled: bool) -> anyhow::Result<()> {
        Ok(())
    }

    /// Set start at login (updates Windows registry)
    pub fn set_start_at_login(&mut self, enabled: bool) -> anyhow::Result<()> {
        self.start_at_login = enabled;
        Self::apply_start_at_login_registry(enabled)?;
        Ok(())
    }

    /// Check if start at login is actually enabled in registry
    #[cfg(target_os = "windows")]
    pub fn is_start_at_login_enabled() -> bool {
        use winreg::RegKey;
        use winreg::enums::*;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(run_key) = hkcu.open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Run") {
            run_key
                .get_value::<String, _>(crate::paths::REGISTRY_RUN_VALUE)
                .is_ok()
        } else {
            false
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn is_start_at_login_enabled() -> bool {
        false
    }

    /// Check if a provider is enabled
    pub fn is_provider_enabled(&self, id: ProviderId) -> bool {
        self.enabled_providers.contains(id.cli_name())
    }

    /// Enable a provider
    pub fn enable_provider(&mut self, id: ProviderId) {
        self.enabled_providers.insert(id.cli_name().to_string());
    }

    /// Disable a provider
    pub fn disable_provider(&mut self, id: ProviderId) {
        self.enabled_providers.remove(id.cli_name());
    }

    /// Toggle a provider's enabled state
    pub fn toggle_provider(&mut self, id: ProviderId) -> bool {
        let name = id.cli_name().to_string();
        if self.enabled_providers.contains(&name) {
            self.enabled_providers.remove(&name);
            false
        } else {
            self.enabled_providers.insert(name);
            true
        }
    }

    /// Get list of enabled provider IDs
    pub fn get_enabled_provider_ids(&self) -> Vec<ProviderId> {
        self.provider_display_order()
            .into_iter()
            .filter(|id| self.is_provider_enabled(*id))
            .collect()
    }

    /// Get all available providers with their enabled status
    pub fn get_all_providers_status(&self) -> Vec<ProviderStatus> {
        self.provider_display_order()
            .into_iter()
            .map(|id| ProviderStatus {
                id: id.cli_name().to_string(),
                name: id.display_name().to_string(),
                enabled: self.is_provider_enabled(id),
            })
            .collect()
    }

    /// Provider display order as typed IDs, falling back to canonical order
    /// when no custom order has been persisted.
    pub fn provider_display_order(&self) -> Vec<ProviderId> {
        normalize_provider_order(&self.provider_order)
            .into_iter()
            .filter_map(|provider_id| ProviderId::from_cli_name(&provider_id))
            .collect()
    }

    /// Provider display order as CLI-name strings.
    pub fn provider_display_order_names(&self) -> Vec<String> {
        normalize_provider_order(&self.provider_order)
    }

    /// Get the metric preference for a provider
    pub fn get_provider_metric(&self, id: ProviderId) -> MetricPreference {
        self.provider_metrics
            .get(id.cli_name())
            .copied()
            .unwrap_or_default()
    }

    /// Set the metric preference for a provider
    pub fn set_provider_metric(&mut self, id: ProviderId, metric: MetricPreference) {
        self.provider_metrics
            .insert(id.cli_name().to_string(), metric);
    }

    // ── Per-provider configuration accessors ─────────────────────────
    //
    // These thin wrappers around `provider_configs` apply provider-specific
    // defaults (e.g. cookie/usage source defaults to `"auto"`) so callers
    // never have to reach into the raw `Option<String>` fields. The
    // `*_str` / boolean / setter pairs intentionally mirror the names of
    // the legacy flat fields so call-site migration is mechanical.

    /// Read-only access to a provider's stored config, if any.
    pub fn provider_config(&self, id: ProviderId) -> Option<&ProviderConfig> {
        self.provider_configs.get(&id)
    }

    /// Mutable access to a provider's config, lazily creating an empty
    /// entry if none exists.
    pub fn provider_config_mut(&mut self, id: ProviderId) -> &mut ProviderConfig {
        self.provider_configs.entry(id).or_default()
    }

    /// Cookie source for `id`, or the default `"manual"` if unset.
    pub fn cookie_source(&self, id: ProviderId) -> &str {
        self.provider_configs
            .get(&id)
            .and_then(|c| c.cookie_source.as_deref())
            .unwrap_or(DEFAULT_COOKIE_SOURCE)
    }

    pub fn set_cookie_source(&mut self, id: ProviderId, source: impl Into<String>) {
        self.provider_config_mut(id).cookie_source = Some(source.into());
    }

    /// Usage source for `id`, or the default `"auto"` if unset.
    pub fn usage_source(&self, id: ProviderId) -> &str {
        self.provider_configs
            .get(&id)
            .and_then(|c| c.usage_source.as_deref())
            .unwrap_or(DEFAULT_PROVIDER_SOURCE)
    }

    pub fn set_usage_source(&mut self, id: ProviderId, source: impl Into<String>) {
        self.provider_config_mut(id).usage_source = Some(source.into());
    }

    /// API region for `id`, or the provider-specific default if unset.
    pub fn api_region(&self, id: ProviderId) -> &str {
        if id == ProviderId::AlibabaTokenPlan && !self.alibaba_token_plan_region.trim().is_empty() {
            return self.alibaba_token_plan_region.as_str();
        }
        self.provider_configs
            .get(&id)
            .and_then(|c| c.api_region.as_deref())
            .unwrap_or_else(|| default_api_region(id))
    }

    pub fn set_api_region(&mut self, id: ProviderId, region: impl Into<String>) {
        let region = region.into();
        if id == ProviderId::AlibabaTokenPlan {
            self.alibaba_token_plan_region = region.clone();
        }
        self.provider_config_mut(id).api_region = Some(region);
    }

    /// Manual cookie header for `id`, or `""` if unset.
    pub fn manual_cookie_header(&self, id: ProviderId) -> &str {
        self.provider_configs
            .get(&id)
            .and_then(|c| c.manual_cookie_header.as_deref())
            .unwrap_or("")
    }

    pub fn set_manual_cookie_header(&mut self, id: ProviderId, header: impl Into<String>) {
        self.provider_config_mut(id).manual_cookie_header = Some(header.into());
    }

    /// API token for `id`, or `""` if unset.
    pub fn api_token(&self, id: ProviderId) -> &str {
        self.provider_configs
            .get(&id)
            .and_then(|c| c.api_token.as_deref())
            .unwrap_or("")
    }

    pub fn set_api_token(&mut self, id: ProviderId, token: impl Into<String>) {
        self.provider_config_mut(id).api_token = Some(token.into());
    }

    pub fn management_api_token(&self, id: ProviderId) -> Option<&str> {
        self.provider_configs
            .get(&id)
            .and_then(|config| config.management_api_token.as_deref())
            .map(str::trim)
            .filter(|value| !value.is_empty())
    }

    pub fn set_management_api_token(&mut self, id: ProviderId, token: Option<String>) {
        let token = token
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        self.provider_config_mut(id).management_api_token = token;
    }

    /// Workspace ID override for `id`, or `""` if unset.
    pub fn workspace_id(&self, id: ProviderId) -> &str {
        self.provider_configs
            .get(&id)
            .and_then(|c| c.workspace_id.as_deref())
            .unwrap_or("")
    }

    pub fn set_workspace_id(&mut self, id: ProviderId, value: impl Into<String>) {
        self.provider_config_mut(id).workspace_id = Some(value.into());
    }

    /// Wayfinder gateway URL, defaulting to the local loopback gateway.
    pub fn gateway_url(&self, id: ProviderId) -> &str {
        self.provider_configs
            .get(&id)
            .and_then(|c| c.gateway_url.as_deref())
            .unwrap_or_else(|| {
                if id == ProviderId::Wayfinder {
                    crate::providers::wayfinder::DEFAULT_GATEWAY_URL
                } else {
                    ""
                }
            })
    }

    pub fn set_gateway_url(&mut self, id: ProviderId, value: impl Into<String>) {
        self.provider_config_mut(id).gateway_url = Some(value.into());
    }

    /// IDE base path override for `id`, or `""` if unset.
    pub fn ide_base_path(&self, id: ProviderId) -> &str {
        self.provider_configs
            .get(&id)
            .and_then(|c| c.ide_base_path.as_deref())
            .unwrap_or("")
    }

    pub fn set_ide_base_path(&mut self, id: ProviderId, value: impl Into<String>) {
        self.provider_config_mut(id).ide_base_path = Some(value.into());
    }

    /// Codex `openai_web_extras` toggle, default `true`.
    pub fn openai_web_extras(&self, id: ProviderId) -> bool {
        self.provider_configs
            .get(&id)
            .and_then(|c| c.openai_web_extras)
            .unwrap_or(DEFAULT_CODEX_OPENAI_WEB_EXTRAS)
    }

    pub fn set_openai_web_extras(&mut self, id: ProviderId, value: bool) {
        self.provider_config_mut(id).openai_web_extras = Some(value);
    }

    /// Codex Spark rows are visible by default.
    pub fn spark_usage_visible(&self, id: ProviderId) -> bool {
        self.provider_configs
            .get(&id)
            .and_then(|c| c.spark_usage_visible)
            .unwrap_or(DEFAULT_CODEX_SPARK_USAGE_VISIBLE)
    }

    pub fn set_spark_usage_visible(&mut self, id: ProviderId, value: bool) {
        self.provider_config_mut(id).spark_usage_visible = Some(value);
    }

    /// Per-provider historical-tracking toggle (currently codex-only).
    pub fn historical_tracking(&self, id: ProviderId) -> bool {
        self.provider_configs
            .get(&id)
            .map(|c| c.historical_tracking)
            .unwrap_or(false)
    }

    pub fn set_historical_tracking(&mut self, id: ProviderId, value: bool) {
        self.provider_config_mut(id).historical_tracking = value;
    }

    /// Per-provider "avoid keychain prompts" toggle (currently claude-only).
    pub fn avoid_keychain_prompts(&self, id: ProviderId) -> bool {
        self.provider_configs
            .get(&id)
            .map(|c| c.avoid_keychain_prompts)
            .unwrap_or(false)
    }

    pub fn set_avoid_keychain_prompts(&mut self, id: ProviderId, value: bool) {
        self.provider_config_mut(id).avoid_keychain_prompts = value;
    }

    // ── Legacy field-name aliases ────────────────────────────────────
    //
    // Keep the names of the old flat per-provider fields available as
    // accessor methods so existing call sites only need a `()` (read) or
    // `set_` prefix (write). New code should prefer the typed accessors
    // above.

    pub fn codex_cookie_source(&self) -> &str {
        self.cookie_source(ProviderId::Codex)
    }
    pub fn set_codex_cookie_source(&mut self, v: impl Into<String>) {
        self.set_cookie_source(ProviderId::Codex, v)
    }
    pub fn claude_cookie_source(&self) -> &str {
        self.cookie_source(ProviderId::Claude)
    }
    pub fn set_claude_cookie_source(&mut self, v: impl Into<String>) {
        self.set_cookie_source(ProviderId::Claude, v)
    }
    pub fn cursor_cookie_source(&self) -> &str {
        self.cookie_source(ProviderId::Cursor)
    }
    pub fn set_cursor_cookie_source(&mut self, v: impl Into<String>) {
        self.set_cookie_source(ProviderId::Cursor, v)
    }
    pub fn opencode_cookie_source(&self) -> &str {
        self.cookie_source(ProviderId::OpenCode)
    }
    pub fn set_opencode_cookie_source(&mut self, v: impl Into<String>) {
        self.set_cookie_source(ProviderId::OpenCode, v)
    }
    pub fn factory_cookie_source(&self) -> &str {
        self.cookie_source(ProviderId::Factory)
    }
    pub fn set_factory_cookie_source(&mut self, v: impl Into<String>) {
        self.set_cookie_source(ProviderId::Factory, v)
    }
    pub fn alibaba_cookie_source(&self) -> &str {
        self.cookie_source(ProviderId::Alibaba)
    }
    pub fn set_alibaba_cookie_source(&mut self, v: impl Into<String>) {
        self.set_cookie_source(ProviderId::Alibaba, v)
    }
    pub fn kimi_cookie_source(&self) -> &str {
        self.cookie_source(ProviderId::Kimi)
    }
    pub fn set_kimi_cookie_source(&mut self, v: impl Into<String>) {
        self.set_cookie_source(ProviderId::Kimi, v)
    }
    pub fn minimax_cookie_source(&self) -> &str {
        self.cookie_source(ProviderId::MiniMax)
    }
    pub fn set_minimax_cookie_source(&mut self, v: impl Into<String>) {
        self.set_cookie_source(ProviderId::MiniMax, v)
    }
    pub fn augment_cookie_source(&self) -> &str {
        self.cookie_source(ProviderId::Augment)
    }
    pub fn set_augment_cookie_source(&mut self, v: impl Into<String>) {
        self.set_cookie_source(ProviderId::Augment, v)
    }
    pub fn amp_cookie_source(&self) -> &str {
        self.cookie_source(ProviderId::Amp)
    }
    pub fn set_amp_cookie_source(&mut self, v: impl Into<String>) {
        self.set_cookie_source(ProviderId::Amp, v)
    }
    pub fn ollama_cookie_source(&self) -> &str {
        self.cookie_source(ProviderId::Ollama)
    }
    pub fn set_ollama_cookie_source(&mut self, v: impl Into<String>) {
        self.set_cookie_source(ProviderId::Ollama, v)
    }

    pub fn claude_usage_source(&self) -> &str {
        self.usage_source(ProviderId::Claude)
    }
    pub fn set_claude_usage_source(&mut self, v: impl Into<String>) {
        self.set_usage_source(ProviderId::Claude, v)
    }
    pub fn codex_usage_source(&self) -> &str {
        self.usage_source(ProviderId::Codex)
    }
    pub fn set_codex_usage_source(&mut self, v: impl Into<String>) {
        self.set_usage_source(ProviderId::Codex, v)
    }

    pub fn alibaba_api_region(&self) -> &str {
        self.api_region(ProviderId::Alibaba)
    }
    pub fn set_alibaba_api_region(&mut self, v: impl Into<String>) {
        self.set_api_region(ProviderId::Alibaba, v)
    }
    pub fn zai_api_region(&self) -> &str {
        self.api_region(ProviderId::Zai)
    }
    pub fn set_zai_api_region(&mut self, v: impl Into<String>) {
        self.set_api_region(ProviderId::Zai, v)
    }
    pub fn minimax_api_region(&self) -> &str {
        self.api_region(ProviderId::MiniMax)
    }
    pub fn set_minimax_api_region(&mut self, v: impl Into<String>) {
        self.set_api_region(ProviderId::MiniMax, v)
    }

    pub fn alibaba_cookie_header(&self) -> &str {
        self.manual_cookie_header(ProviderId::Alibaba)
    }
    pub fn set_alibaba_cookie_header(&mut self, v: impl Into<String>) {
        self.set_manual_cookie_header(ProviderId::Alibaba, v)
    }
    pub fn kimi_manual_cookie_header(&self) -> &str {
        self.manual_cookie_header(ProviderId::Kimi)
    }
    pub fn set_kimi_manual_cookie_header(&mut self, v: impl Into<String>) {
        self.set_manual_cookie_header(ProviderId::Kimi, v)
    }
    pub fn augment_cookie_header(&self) -> &str {
        self.manual_cookie_header(ProviderId::Augment)
    }
    pub fn set_augment_cookie_header(&mut self, v: impl Into<String>) {
        self.set_manual_cookie_header(ProviderId::Augment, v)
    }
    pub fn amp_cookie_header(&self) -> &str {
        self.manual_cookie_header(ProviderId::Amp)
    }
    pub fn set_amp_cookie_header(&mut self, v: impl Into<String>) {
        self.set_manual_cookie_header(ProviderId::Amp, v)
    }
    pub fn ollama_cookie_header(&self) -> &str {
        self.manual_cookie_header(ProviderId::Ollama)
    }
    pub fn set_ollama_cookie_header(&mut self, v: impl Into<String>) {
        self.set_manual_cookie_header(ProviderId::Ollama, v)
    }
    pub fn minimax_cookie_header(&self) -> &str {
        self.manual_cookie_header(ProviderId::MiniMax)
    }
    pub fn set_minimax_cookie_header(&mut self, v: impl Into<String>) {
        self.set_manual_cookie_header(ProviderId::MiniMax, v)
    }

    pub fn opencode_workspace_id(&self) -> &str {
        self.workspace_id(ProviderId::OpenCode)
    }
    pub fn set_opencode_workspace_id(&mut self, v: impl Into<String>) {
        self.set_workspace_id(ProviderId::OpenCode, v)
    }
    pub fn minimax_api_token(&self) -> &str {
        self.api_token(ProviderId::MiniMax)
    }
    pub fn set_minimax_api_token(&mut self, v: impl Into<String>) {
        self.set_api_token(ProviderId::MiniMax, v)
    }
    pub fn jetbrains_ide_base_path(&self) -> &str {
        self.ide_base_path(ProviderId::JetBrains)
    }
    pub fn set_jetbrains_ide_base_path(&mut self, v: impl Into<String>) {
        self.set_ide_base_path(ProviderId::JetBrains, v)
    }

    pub fn codex_openai_web_extras(&self) -> bool {
        self.openai_web_extras(ProviderId::Codex)
    }
    pub fn set_codex_openai_web_extras(&mut self, v: bool) {
        self.set_openai_web_extras(ProviderId::Codex, v)
    }
    pub fn codex_spark_usage_visible(&self) -> bool {
        self.spark_usage_visible(ProviderId::Codex)
    }
    pub fn set_codex_spark_usage_visible(&mut self, v: bool) {
        self.set_spark_usage_visible(ProviderId::Codex, v)
    }
    pub fn codex_historical_tracking(&self) -> bool {
        self.historical_tracking(ProviderId::Codex)
    }
    pub fn set_codex_historical_tracking(&mut self, v: bool) {
        self.set_historical_tracking(ProviderId::Codex, v)
    }
    pub fn claude_avoid_keychain_prompts(&self) -> bool {
        self.avoid_keychain_prompts(ProviderId::Claude)
    }
    pub fn set_claude_avoid_keychain_prompts(&mut self, v: bool) {
        self.set_avoid_keychain_prompts(ProviderId::Claude, v)
    }

    // ── Per-provider accent color override (#2972) ──────────────────

    /// The user-overridden accent color for `id`, or `None` to use the
    /// shipped brand color.
    pub fn accent_color(&self, id: ProviderId) -> Option<&str> {
        self.provider_configs
            .get(&id)
            .and_then(|c| c.accent_color.as_deref())
            .filter(|s| !s.trim().is_empty())
    }

    /// Set the accent color override for `id`. Pass an empty string or
    /// `None` to clear the override and revert to the shipped brand color.
    pub fn set_accent_color(&mut self, id: ProviderId, color: Option<impl Into<String>>) {
        let entry = self.provider_config_mut(id);
        entry.accent_color = color
            .map(Into::into)
            .filter(|s: &String| !s.trim().is_empty());
    }

    /// Resolve the effective accent color for `id`: the user override if
    /// set, otherwise the shipped brand color from the provider registry.
    pub fn effective_accent_color(&self, id: ProviderId) -> String {
        if let Some(override_color) = self.accent_color(id) {
            return override_color.trim().to_string();
        }
        crate::core::brand_color(id).to_string()
    }
}
