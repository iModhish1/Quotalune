use serde::{Deserialize, Serialize};

/// Wave 1B theme composition. `catalog_theme` (Main Application / floating
/// structures' fallback) and `theme` (Light/Dark/System) already have real,
/// independently-working persistence and cross-window propagation — this
/// module does not duplicate either of them (see
/// `docs/validation/THEME_COMPOSITION_AUDIT.md` for the full architecture
/// trace this was built from).
///
/// What was missing was a place to record, for a small set of *other*
/// appearance scopes that today are flat independent settings with no
/// relationship to the Main Application theme at all (the floating-window
/// logo finish, the provider identity card skin, tray presentation,
/// workspace background), whether the user wants that scope to track
/// whatever the Main Application theme recommends (`Global`) or to keep its
/// own explicitly-chosen value regardless of theme changes (`Override`).
///
/// `floatingStructures` deliberately has NO field here: it already has a
/// real Global-vs-Override mechanism today via `surface_catalog_themes`
/// (empty for a surface = inherits `catalog_theme`; present = an explicit
/// per-surface override) — see `resolveCatalogTheme` in
/// `themeResolution.ts`. Adding a second, parallel flag for it would be
/// exactly the "duplicate design truth" this wave was told not to build.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum AppearanceSource {
    /// Follow whatever the applied Main Application theme recommends for
    /// this scope (`CatalogTheme.recommendedAppearance` on the frontend).
    Global,
    /// Keep this scope's own explicitly-set value regardless of Main
    /// Application theme changes.
    ///
    /// Every one of these scopes already has a real, independently
    /// persisted flat value today (logo_variant, global_limit_presentation,
    /// provider_tray_configs/tray_scale_percent, workspace_preferences).
    /// Defaulting a user who has never touched this new field to
    /// `Override` means "keep exactly the appearance you already have" —
    /// the same zero-visible-change guarantee the wave's migration section
    /// requires, achieved here by serde's own field default rather than a
    /// one-shot marker-file migration (compare `promote_tray_icon`'s
    /// marker in settings.rs, which was needed because ITS default value
    /// actually changes behavior for existing users; this default does
    /// not).
    #[default]
    Override,
}

/// Per-scope Global-vs-Override state for the appearance scopes that have
/// no pre-existing relationship to the Main Application theme. See the
/// module doc comment for why `floatingStructures` is intentionally absent.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct AppearanceComposition {
    pub quotalis_logo: AppearanceSource,
    pub provider_identity: AppearanceSource,
    pub tray: AppearanceSource,
    pub workspace_background: AppearanceSource,
}

/// The scope ids `set_appearance_scope` accepts, matching this struct's
/// field names (camelCase, matching the frontend `AppearanceScopeId` union
/// in `appearanceComposition.ts` — kept as a single source of truth via
/// this list rather than duplicating the id strings at each call site).
pub const APPEARANCE_SCOPE_IDS: [&str; 4] = [
    "quotalisLogo",
    "providerIdentity",
    "tray",
    "workspaceBackground",
];

impl AppearanceComposition {
    /// Sets one scope's source by id. Returns `Err` for an unrecognized id
    /// (including `"floatingStructures"`, which is intentionally not a
    /// field on this struct — see the module doc comment) rather than
    /// silently ignoring it.
    pub fn set_scope(&mut self, scope: &str, source: AppearanceSource) -> Result<(), String> {
        match scope {
            "quotalisLogo" => self.quotalis_logo = source,
            "providerIdentity" => self.provider_identity = source,
            "tray" => self.tray = source,
            "workspaceBackground" => self.workspace_background = source,
            other => {
                return Err(format!(
                    "unknown appearance scope '{other}' (expected one of {APPEARANCE_SCOPE_IDS:?})"
                ));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_composition_keeps_every_scope_on_override_preserving_current_appearance() {
        // This is the migration guarantee for users who have never touched
        // the new field: their existing logo_variant/tray/background/
        // provider-identity values keep being used exactly as before,
        // because Override (not Global) is what "use my current explicit
        // value" means in this model.
        let composition = AppearanceComposition::default();
        assert_eq!(composition.quotalis_logo, AppearanceSource::Override);
        assert_eq!(composition.provider_identity, AppearanceSource::Override);
        assert_eq!(composition.tray, AppearanceSource::Override);
        assert_eq!(composition.workspace_background, AppearanceSource::Override);
    }

    #[test]
    fn set_scope_updates_only_the_named_field() {
        let mut composition = AppearanceComposition::default();
        composition
            .set_scope("tray", AppearanceSource::Global)
            .unwrap();
        assert_eq!(composition.tray, AppearanceSource::Global);
        assert_eq!(composition.quotalis_logo, AppearanceSource::Override);
        assert_eq!(composition.provider_identity, AppearanceSource::Override);
        assert_eq!(composition.workspace_background, AppearanceSource::Override);
    }

    #[test]
    fn set_scope_rejects_floating_structures_and_unknown_ids() {
        let mut composition = AppearanceComposition::default();
        assert!(
            composition
                .set_scope("floatingStructures", AppearanceSource::Global)
                .is_err()
        );
        assert!(
            composition
                .set_scope("nonsense", AppearanceSource::Global)
                .is_err()
        );
    }

    #[test]
    fn round_trips_through_json_with_camel_case_field_names() {
        let mut composition = AppearanceComposition::default();
        composition
            .set_scope("quotalisLogo", AppearanceSource::Global)
            .unwrap();
        let json = serde_json::to_string(&composition).unwrap();
        assert!(json.contains("\"quotalisLogo\":\"global\""));
        assert!(json.contains("\"providerIdentity\":\"override\""));
        let round_tripped: AppearanceComposition = serde_json::from_str(&json).unwrap();
        assert_eq!(round_tripped, composition);
    }

    #[test]
    fn missing_field_in_stored_json_defaults_to_all_override() {
        // Simulates loading a pre-Wave-1B settings.json that has no
        // appearance_composition key at all.
        let composition: AppearanceComposition = serde_json::from_str("{}").unwrap();
        assert_eq!(composition, AppearanceComposition::default());
    }
}
