//! Profile management commands: the Tauri surface of `codexbar::profiles`.
//!
//! Switching a profile is atomic from the caller's perspective: the store is
//! updated and persisted, enabled providers / theme / surfaces are reconciled
//! into settings, surfaces windows are reconciled, and the tray menu is
//! rebuilt — then a single `profiles-changed` event notifies the frontend.

use codexbar::profiles::{ProfileStore, ProviderAccount, QuotaArcProfile};
use codexbar::settings::{Settings, ThemePreference};
use tauri::{AppHandle, Emitter};

fn emit_changed(app: &AppHandle) {
    let _ = app.emit("profiles-changed", ());
    // Active-profile fields are projected into Settings; detached orbital
    // windows listen to this event and must re-resolve their theme immediately.
    let _ = app.emit("codexbar:settings-updated", ());
}

/// Reconcile global settings with the active profile: enabled providers,
/// theme override, and surface visibility. Persisted together so a crash
/// cannot leave settings half-applied.
fn apply_active_profile_to_settings(store: &ProfileStore, settings: &mut Settings) {
    let profile = store.active_profile();
    let mut providers: Vec<String> = store
        .accounts
        .iter()
        .filter(|a| profile.account_ids.contains(&a.id) && a.enabled)
        .filter_map(|a| a.provider_id())
        .map(|p| p.cli_name().to_string())
        .collect();
    providers.sort();
    providers.dedup();
    settings.enabled_providers = providers.into_iter().collect();

    if let Some(theme) = profile.theme {
        settings.theme = theme;
    }
    settings.active_profile_catalog_theme = profile.catalog_theme.clone();
    settings.edge_arc_enabled = profile.surfaces.edge_arc;
    settings.top_arc_enabled = profile.surfaces.top_arc;
    settings.taskbar_arc_enabled = profile.surfaces.taskbar_arc;
    settings.float_bar_enabled = profile.surfaces.float_bar;
}

fn save_settings(settings: &Settings) -> Result<(), String> {
    settings.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_profile_store() -> Result<ProfileStore, String> {
    Ok(ProfileStore::load())
}

#[tauri::command]
pub fn switch_profile(app: AppHandle, profile_id: String) -> Result<(), String> {
    let mut store = ProfileStore::load();
    if !store.profiles.iter().any(|p| p.id == profile_id) {
        return Err("Profile not found".to_string());
    }
    store.active_profile_id = profile_id;
    let mut settings = Settings::load();
    apply_active_profile_to_settings(&store, &mut settings);
    store.save()?;
    save_settings(&settings)?;
    crate::surfaces::reconcile_persisted_state_async(app.clone());
    crate::tray_bridge::rebuild_tray_menu(&app);
    emit_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn create_profile(
    app: AppHandle,
    name: String,
    description: Option<String>,
) -> Result<QuotaArcProfile, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    let mut store = ProfileStore::load();
    if store
        .profiles
        .iter()
        .any(|p| p.name.eq_ignore_ascii_case(name))
    {
        return Err(format!("A profile named \"{name}\" already exists"));
    }
    let mut profile = QuotaArcProfile::new(name);
    profile.description = description.filter(|d| !d.trim().is_empty());
    store.profiles.push(profile.clone());
    store.save()?;
    emit_changed(&app);
    Ok(profile)
}

#[tauri::command]
pub fn rename_profile(app: AppHandle, profile_id: String, name: String) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    let mut store = ProfileStore::load();
    if store
        .profiles
        .iter()
        .any(|p| p.id != profile_id && p.name.eq_ignore_ascii_case(name))
    {
        return Err(format!("A profile named \"{name}\" already exists"));
    }
    let Some(profile) = store.profiles.iter_mut().find(|p| p.id == profile_id) else {
        return Err("Profile not found".to_string());
    };
    profile.name = name.to_string();
    profile.touch();
    store.save()?;
    emit_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn duplicate_profile(
    app: AppHandle,
    profile_id: String,
    new_name: String,
) -> Result<QuotaArcProfile, String> {
    let new_name = new_name.trim();
    if new_name.is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    let mut store = ProfileStore::load();
    let source = store
        .profiles
        .iter()
        .find(|p| p.id == profile_id)
        .ok_or("Profile not found")?
        .clone();
    let mut copy = source.clone();
    copy.id = uuid::Uuid::new_v4().to_string();
    copy.name = new_name.to_string();
    copy.description = source.description.clone();
    copy.created_at = copy.updated_at;
    store.profiles.push(copy.clone());
    store.save()?;
    emit_changed(&app);
    Ok(copy)
}

#[tauri::command]
pub fn delete_profile(app: AppHandle, profile_id: String) -> Result<(), String> {
    let mut store = ProfileStore::load();
    if store.profiles.len() <= 1 {
        return Err("The last profile cannot be deleted".to_string());
    }
    if !store.profiles.iter().any(|p| p.id == profile_id) {
        return Err("Profile not found".to_string());
    }
    store.profiles.retain(|p| p.id != profile_id);
    store.normalize();
    let mut settings = Settings::load();
    apply_active_profile_to_settings(&store, &mut settings);
    store.save()?;
    save_settings(&settings)?;
    crate::surfaces::reconcile_persisted_state_async(app.clone());
    crate::tray_bridge::rebuild_tray_menu(&app);
    emit_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn reorder_profiles(app: AppHandle, profile_ids: Vec<String>) -> Result<(), String> {
    let mut store = ProfileStore::load();
    let mut ordered = Vec::with_capacity(store.profiles.len());
    for id in &profile_ids {
        if let Some(pos) = store.profiles.iter().position(|p| &p.id == id) {
            ordered.push(store.profiles.remove(pos));
        }
    }
    ordered.append(&mut store.profiles);
    store.profiles = ordered;
    store.normalize();
    store.save()?;
    emit_changed(&app);
    Ok(())
}

#[tauri::command]
// Tauri exposes command parameters as named bridge arguments. Keeping this
// boundary flat preserves the existing TypeScript contract and lets callers
// patch one profile field without wrapping it in a second payload object.
#[allow(clippy::too_many_arguments)]
pub fn update_profile(
    app: AppHandle,
    profile_id: String,
    theme: Option<Option<ThemePreference>>,
    catalog_theme: Option<Option<String>>,
    accent: Option<Option<String>>,
    edge_arc: Option<bool>,
    top_arc: Option<bool>,
    taskbar_arc: Option<bool>,
    float_bar: Option<bool>,
) -> Result<(), String> {
    let mut store = ProfileStore::load();
    let Some(profile) = store.profiles.iter_mut().find(|p| p.id == profile_id) else {
        return Err("Profile not found".to_string());
    };
    if let Some(theme) = theme {
        profile.theme = theme;
    }
    if let Some(catalog_theme) = catalog_theme {
        profile.catalog_theme = match catalog_theme {
            Some(slug) => Some(
                codexbar::settings::canonical_catalog_theme(slug.trim())
                    .ok_or_else(|| format!("Unknown catalog theme: {slug}"))?,
            ),
            None => None,
        };
    }
    if let Some(accent) = accent {
        profile.accent = accent.filter(|a| !a.trim().is_empty());
    }
    if let Some(v) = edge_arc {
        profile.surfaces.edge_arc = v;
    }
    if let Some(v) = top_arc {
        profile.surfaces.top_arc = v;
    }
    if let Some(v) = taskbar_arc {
        profile.surfaces.taskbar_arc = v;
    }
    if let Some(v) = float_bar {
        profile.surfaces.float_bar = v;
    }
    profile.touch();
    store.normalize();
    let is_active = store.active_profile_id == profile_id;
    let mut settings = Settings::load();
    if is_active {
        apply_active_profile_to_settings(&store, &mut settings);
        store.save()?;
        save_settings(&settings)?;
        crate::surfaces::reconcile_persisted_state_async(app.clone());
    } else {
        store.save()?;
    }
    emit_changed(&app);
    Ok(())
}

/// Add a provider account to a profile. The account references credentials
/// only by source/id — never a secret.
#[tauri::command]
pub fn add_account(
    app: AppHandle,
    provider: String,
    display_name: String,
    profile_ids: Option<Vec<String>>,
    credential_source: Option<String>,
    credential_id: Option<String>,
) -> Result<ProviderAccount, String> {
    let display_name = display_name.trim();
    if display_name.is_empty() {
        return Err("Account name cannot be empty".to_string());
    }
    let Some(provider_id) = codexbar::core::ProviderId::from_cli_name(provider.trim()) else {
        return Err("Unknown provider".to_string());
    };
    let mut store = ProfileStore::load();
    if store.accounts.iter().any(|a| {
        a.provider_id() == Some(provider_id) && a.display_name.eq_ignore_ascii_case(display_name)
    }) {
        return Err(format!(
            "A {provider} account named \"{display_name}\" already exists"
        ));
    }
    let mut account = ProviderAccount::new(provider_id, display_name);
    if let Some(source) = credential_source {
        account.credential_reference.source = source;
    }
    if let Some(id) = credential_id {
        account.credential_reference.id = Some(id);
    }
    let account_id = account.id.clone();
    store.accounts.push(account.clone());

    let target_profiles: Vec<String> = match profile_ids {
        Some(ids) if !ids.is_empty() => ids,
        _ => vec![store.active_profile_id.clone()],
    };
    for profile in &mut store.profiles {
        if target_profiles.contains(&profile.id) && !profile.account_ids.contains(&account_id) {
            profile.account_ids.push(account_id.clone());
            profile.touch();
        }
    }
    store.normalize();

    // A new account on the active profile makes its provider visible.
    let mut settings = Settings::load();
    let was_active = store.active_profile().account_ids.contains(&account_id);
    if was_active {
        apply_active_profile_to_settings(&store, &mut settings);
        save_settings(&settings)?;
    }
    store.save()?;
    if was_active {
        crate::tray_bridge::rebuild_tray_menu(&app);
        emit_changed(&app);
    }
    Ok(account)
}

#[tauri::command]
pub fn update_account(
    app: AppHandle,
    account_id: String,
    display_name: Option<String>,
    enabled: Option<bool>,
    accent: Option<Option<String>>,
    tags: Option<Vec<String>>,
) -> Result<(), String> {
    let mut store = ProfileStore::load();
    let Some(account) = store.accounts.iter_mut().find(|a| a.id == account_id) else {
        return Err("Account not found".to_string());
    };
    if let Some(name) = display_name {
        let name = name.trim();
        if name.is_empty() {
            return Err("Account name cannot be empty".to_string());
        }
        account.display_name = name.to_string();
    }
    if let Some(v) = enabled {
        account.enabled = v;
    }
    if let Some(accent) = accent {
        account.accent = accent.filter(|a| !a.trim().is_empty());
    }
    if let Some(tags) = tags {
        account.tags = tags
            .into_iter()
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect();
    }
    account.touch();
    store.normalize();

    let mut settings = Settings::load();
    apply_active_profile_to_settings(&store, &mut settings);
    store.save()?;
    save_settings(&settings)?;
    crate::tray_bridge::rebuild_tray_menu(&app);
    emit_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn remove_account(app: AppHandle, account_id: String) -> Result<(), String> {
    let mut store = ProfileStore::load();
    if !store.accounts.iter().any(|a| a.id == account_id) {
        return Err("Account not found".to_string());
    }
    store.accounts.retain(|a| a.id != account_id);
    for profile in &mut store.profiles {
        profile.account_ids.retain(|id| id != &account_id);
        profile.touch();
    }
    store.normalize();
    let mut settings = Settings::load();
    apply_active_profile_to_settings(&store, &mut settings);
    store.save()?;
    save_settings(&settings)?;
    crate::tray_bridge::rebuild_tray_menu(&app);
    emit_changed(&app);
    Ok(())
}

/// Toggle Privacy Mode (hide account/profile names, emails, costs).
#[tauri::command]
pub fn set_privacy_mode(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = Settings::load();
    settings.privacy_mode = enabled;
    settings.hide_personal_info = settings.hide_personal_info || enabled;
    settings.save().map_err(|e| e.to_string())?;
    use tauri::Emitter;
    let _ = app.emit("codexbar:settings-updated", ());
    Ok(())
}

fn apply_catalog_theme_scope(
    settings: &mut Settings,
    store: &mut ProfileStore,
    scope: &str,
    slug: &str,
) -> Result<bool, String> {
    let requested = slug.trim();
    let normalized = || {
        codexbar::settings::canonical_catalog_theme(requested)
            .ok_or_else(|| format!("Unknown catalog theme: {slug}"))
    };

    match scope {
        "global" => {
            settings.catalog_theme = if requested.is_empty() {
                codexbar::settings::normalize_catalog_theme("")
            } else {
                normalized()?
            };
            Ok(false)
        }
        "profile" => {
            let profile = store
                .active_profile_mut()
                .ok_or_else(|| "Active profile not found".to_string())?;
            profile.catalog_theme = if requested.is_empty() {
                None
            } else {
                Some(normalized()?)
            };
            profile.touch();
            settings.active_profile_catalog_theme = profile.catalog_theme.clone();
            Ok(true)
        }
        value if value.starts_with("surface:") => {
            let surface = &value["surface:".len()..];
            const SURFACES: &[&str] = &["taskbar", "top", "edge", "hud", "quick", "dashboard"];
            if !SURFACES.contains(&surface) {
                return Err(format!("Unknown catalog surface: {surface}"));
            }
            if requested.is_empty() {
                settings.surface_catalog_themes.remove(surface);
            } else {
                settings
                    .surface_catalog_themes
                    .insert(surface.to_string(), normalized()?);
            }
            Ok(false)
        }
        _ => Err(format!("Unknown catalog theme scope: {scope}")),
    }
}

/// Apply a catalog theme to the global, active-profile or surface scope.
/// Empty profile/surface slugs clear the override and resume inheritance.
#[tauri::command]
pub fn set_catalog_theme(
    app: AppHandle,
    slug: String,
    scope: Option<String>,
) -> Result<(), String> {
    let mut settings = Settings::load();
    let mut store = ProfileStore::load();
    let profile_changed = apply_catalog_theme_scope(
        &mut settings,
        &mut store,
        scope.as_deref().unwrap_or("global"),
        &slug,
    )?;
    if profile_changed {
        store.save()?;
        let _ = app.emit("profiles-changed", ());
    }
    settings.save().map_err(|e| e.to_string())?;
    use tauri::Emitter;
    let _ = app.emit("codexbar:settings-updated", ());
    Ok(())
}

/// Persist the usage display configuration: global mode + per-provider
/// overrides. Provider overrides absent from the map are REMOVED from
/// persistence (Follow-global = no stored entry). Unknown mode strings are
/// rejected server-side; the broadcast re-themes every live surface.
#[tauri::command]
pub fn set_usage_settings(
    app: AppHandle,
    global_mode: String,
    provider_overrides: std::collections::HashMap<String, String>,
) -> Result<(), String> {
    let (normalized_global, normalized_overrides) =
        normalize_usage_settings_input(&global_mode, &provider_overrides)?;

    let mut settings = Settings::load();
    settings.usage_display_mode = Some(normalized_global);
    settings.provider_usage_overrides = normalized_overrides;
    settings.save().map_err(|e| e.to_string())?;
    use tauri::Emitter;
    let _ = app.emit("codexbar:settings-updated", ());
    Ok(())
}

fn normalize_usage_settings_input(
    global_mode: &str,
    provider_overrides: &std::collections::HashMap<String, String>,
) -> Result<(String, std::collections::HashMap<String, String>), String> {
    let normalized_global = codexbar::settings::normalize_usage_display_mode(global_mode.trim())
        .ok_or_else(|| format!("invalid usage display mode: {global_mode}"))?;

    let mut normalized_overrides = std::collections::HashMap::new();
    for (provider, mode) in provider_overrides {
        let provider_id = codexbar::core::ProviderId::from_cli_name(provider.trim())
            .ok_or_else(|| format!("unknown provider: {provider}"))?;
        if mode == "global" || mode.trim().is_empty() {
            continue; // Follow-global = remove the stored override.
        }
        let normalized = codexbar::settings::normalize_usage_display_mode(mode)
            .ok_or_else(|| format!("invalid usage mode: {mode}"))?;
        normalized_overrides.insert(provider_id.cli_name().to_string(), normalized);
    }
    Ok((normalized_global, normalized_overrides))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usage_settings_accept_all_three_global_modes() {
        let overrides = std::collections::HashMap::new();
        for mode in ["remaining", "used", "hybrid"] {
            let (normalized, stored) =
                normalize_usage_settings_input(mode, &overrides).expect("valid usage mode");
            assert_eq!(normalized, mode);
            assert!(stored.is_empty());
        }
    }

    #[test]
    fn usage_settings_follow_global_removes_override_and_aliases_provider() {
        let overrides = std::collections::HashMap::from([
            ("claude".to_string(), "global".to_string()),
            ("openai".to_string(), "remaining".to_string()),
        ]);
        let (_, stored) =
            normalize_usage_settings_input("used", &overrides).expect("valid settings");
        assert!(!stored.contains_key("claude"));
        assert_eq!(stored.get("codex").map(String::as_str), Some("remaining"));
    }

    #[test]
    fn usage_settings_reject_invalid_global_override_and_provider() {
        let empty = std::collections::HashMap::new();
        assert!(normalize_usage_settings_input("future", &empty).is_err());
        assert!(
            normalize_usage_settings_input(
                "used",
                &std::collections::HashMap::from([("claude".to_string(), "future".to_string(),)]),
            )
            .is_err()
        );
        assert!(
            normalize_usage_settings_input(
                "used",
                &std::collections::HashMap::from([(
                    "not-a-provider".to_string(),
                    "used".to_string(),
                )]),
            )
            .is_err()
        );
    }

    #[test]
    fn apply_profile_maps_enabled_accounts_to_providers() {
        let settings = Settings::default();
        let mut store = codexbar::profiles::migrate_from_legacy(&settings);
        let claude = store
            .accounts
            .iter()
            .find(|a| a.provider == "claude")
            .cloned()
            .expect("claude account");
        // Disable Claude's only account; enabled providers must drop it.
        let mut s2 = Settings {
            enabled_providers: ["claude".to_string(), "codex".to_string()]
                .into_iter()
                .collect(),
            ..Settings::default()
        };
        let mut account = claude;
        account.enabled = false;
        store.accounts.retain(|a| a.id != account.id);
        store.accounts.push(account);
        apply_active_profile_to_settings(&store, &mut s2);
        assert!(!s2.enabled_providers.contains("claude"));
        assert!(s2.enabled_providers.contains("codex"));
    }

    #[test]
    fn apply_profile_carries_theme_and_surfaces() {
        let settings = Settings::default();
        let mut store = codexbar::profiles::migrate_from_legacy(&settings);
        store.profiles[0].theme = Some(ThemePreference::Light);
        store.profiles[0].catalog_theme = Some("02-aurora-bloom".to_string());
        store.profiles[0].surfaces.top_arc = true;
        store.profiles[0].surfaces.taskbar_arc = true;
        let mut s2 = Settings::default();
        apply_active_profile_to_settings(&store, &mut s2);
        assert_eq!(s2.theme, ThemePreference::Light);
        assert_eq!(
            s2.active_profile_catalog_theme.as_deref(),
            Some("02-aurora-bloom")
        );
        assert!(s2.top_arc_enabled);
        assert!(s2.taskbar_arc_enabled);
    }

    #[test]
    fn catalog_scope_precedence_storage_is_bounded_and_clearable() {
        let mut settings = Settings::default();
        let mut store = ProfileStore::default();

        assert!(
            !apply_catalog_theme_scope(&mut settings, &mut store, "global", "03-solar-ember",)
                .unwrap()
        );
        assert_eq!(settings.catalog_theme, "03-solar-ember");

        assert!(
            apply_catalog_theme_scope(&mut settings, &mut store, "profile", "02-aurora-bloom",)
                .unwrap()
        );
        assert_eq!(
            settings.active_profile_catalog_theme.as_deref(),
            Some("02-aurora-bloom")
        );

        apply_catalog_theme_scope(
            &mut settings,
            &mut store,
            "surface:taskbar",
            "12-crimson-nova",
        )
        .unwrap();
        assert_eq!(
            settings
                .surface_catalog_themes
                .get("taskbar")
                .map(String::as_str),
            Some("12-crimson-nova"),
        );

        apply_catalog_theme_scope(&mut settings, &mut store, "profile", "").unwrap();
        apply_catalog_theme_scope(&mut settings, &mut store, "surface:taskbar", "").unwrap();
        assert!(settings.active_profile_catalog_theme.is_none());
        assert!(!settings.surface_catalog_themes.contains_key("taskbar"));
    }

    #[test]
    fn deleted_active_profile_falls_back_without_stale_catalog_theme() {
        let mut store = ProfileStore::default();
        let mut second = QuotaArcProfile::new("Second");
        second.catalog_theme = Some("12-crimson-nova".to_string());
        store.active_profile_id = second.id.clone();
        store.profiles.push(second.clone());

        let mut settings = Settings::default();
        apply_active_profile_to_settings(&store, &mut settings);
        assert_eq!(
            settings.active_profile_catalog_theme.as_deref(),
            Some("12-crimson-nova"),
        );

        store.profiles.retain(|profile| profile.id != second.id);
        store.normalize();
        apply_active_profile_to_settings(&store, &mut settings);
        assert!(settings.active_profile_catalog_theme.is_none());
    }
}
