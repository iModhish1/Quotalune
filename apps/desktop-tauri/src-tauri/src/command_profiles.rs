//! Profile management commands: the Tauri surface of `quotalis_core::profiles`.
//!
//! Switching a profile is atomic from the caller's perspective: the store is
//! updated and persisted, enabled providers / theme / surfaces are reconciled
//! into settings, surfaces windows are reconciled, and the tray menu is
//! rebuilt — then a single `profiles-changed` event notifies the frontend.

use quotalis_core::profiles::{ProfileStore, ProviderAccount, QuotaArcProfile};
use quotalis_core::settings::{Settings, ThemePreference};
use tauri::{AppHandle, Emitter};

fn emit_changed(app: &AppHandle) {
    let _ = app.emit("profiles-changed", ());
    // Active-profile fields are projected into Settings; detached orbital
    // windows listen to this event and must re-resolve their theme immediately.
    let _ = app.emit("quotalis:settings-updated", ());
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

    // Light/dark overrides are resolved in the runtime snapshot, never written
    // over the user's global preference. Clearing an override must restore it.
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

fn remove_profile_from_store(
    store: &mut ProfileStore,
    settings: &mut Settings,
    profile_id: &str,
) -> Result<bool, String> {
    if store.profiles.len() <= 1 {
        return Err("The last profile cannot be deleted".to_string());
    }
    if !store.profiles.iter().any(|p| p.id == profile_id) {
        return Err("Profile not found".to_string());
    }
    let active_removed = store.active_profile_id == profile_id;
    store.profiles.retain(|p| p.id != profile_id);
    store.normalize();
    if active_removed {
        apply_active_profile_to_settings(store, settings);
    }
    Ok(active_removed)
}

#[tauri::command]
pub fn delete_profile(app: AppHandle, profile_id: String) -> Result<(), String> {
    let mut store = ProfileStore::load();
    let mut settings = Settings::load();
    let active_removed = remove_profile_from_store(&mut store, &mut settings, &profile_id)?;
    store.save()?;
    if active_removed {
        save_settings(&settings)?;
        crate::surfaces::reconcile_persisted_state_async(app.clone());
    }
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

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileUpdate {
    profile_id: String,
    #[serde(default, deserialize_with = "nullable_profile_field")]
    theme: Option<Option<ThemePreference>>,
    #[serde(default, deserialize_with = "nullable_profile_field")]
    catalog_theme: Option<Option<String>>,
    #[serde(default, deserialize_with = "nullable_profile_field")]
    accent: Option<Option<String>>,
    edge_arc: Option<bool>,
    top_arc: Option<bool>,
    taskbar_arc: Option<bool>,
    float_bar: Option<bool>,
}

// Absent = no edit, null = clear, value = assign. Plain Option<Option<T>>
// collapses absent and null, making the existing "inherit" UI a silent no-op.
fn nullable_profile_field<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::Deserialize<'de>,
{
    <Option<T> as serde::Deserialize>::deserialize(deserializer).map(Some)
}

fn decode_profile_update(body: &tauri::ipc::InvokeBody) -> Result<ProfileUpdate, String> {
    match body {
        tauri::ipc::InvokeBody::Json(value) => {
            serde_json::from_value(value.clone()).map_err(|e| e.to_string())
        }
        _ => Err("Profile update requires a JSON object".into()),
    }
}

#[tauri::command]
pub fn update_profile(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    // Preserve the flat TypeScript payload while decoding nullable fields as
    // part of the complete object, before Tauri's optional-argument coercion.
    let ProfileUpdate {
        profile_id,
        theme,
        catalog_theme,
        accent,
        edge_arc,
        top_arc,
        taskbar_arc,
        float_bar,
    } = decode_profile_update(request.body())?;
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
                quotalis_core::settings::canonical_catalog_theme(slug.trim())
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

// Profile entries currently select provider visibility, not a credential store.
fn validate_profile_credential_reference(
    source: Option<&str>,
    id: Option<&str>,
) -> Result<(), String> {
    if source.is_some_and(|value| value != "none") || id.is_some() {
        return Err("Profile credential linking is not supported. Manage credentials in Providers; profiles control monitoring membership.".into());
    }
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
    validate_profile_credential_reference(credential_source.as_deref(), credential_id.as_deref())?;
    let display_name = display_name.trim();
    if display_name.is_empty() {
        return Err("Account name cannot be empty".to_string());
    }
    let Some(provider_id) = quotalis_core::core::ProviderId::from_cli_name(provider.trim()) else {
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

/// Pure mutation for `set_account_profile_membership`: add or remove one
/// account from one profile's `account_ids`. Reuses the same field
/// `add_account` seeds at creation time — no second membership model.
fn apply_account_profile_membership(
    store: &mut ProfileStore,
    account_id: &str,
    profile_id: &str,
    member: bool,
) -> Result<(), String> {
    if !store.accounts.iter().any(|a| a.id == account_id) {
        return Err("Account not found".to_string());
    }
    let Some(profile) = store.profiles.iter_mut().find(|p| p.id == profile_id) else {
        return Err("Profile not found".to_string());
    };
    if member {
        if !profile.account_ids.iter().any(|id| id == account_id) {
            profile.account_ids.push(account_id.to_string());
            profile.touch();
        }
    } else if profile.account_ids.iter().any(|id| id == account_id) {
        profile.account_ids.retain(|id| id != account_id);
        profile.touch();
    }
    store.normalize();
    Ok(())
}

/// Add or remove an existing account from one profile's membership (the
/// Profiles page's account checklist).
#[tauri::command]
pub fn set_account_profile_membership(
    app: AppHandle,
    account_id: String,
    profile_id: String,
    member: bool,
) -> Result<(), String> {
    let mut store = ProfileStore::load();
    apply_account_profile_membership(&mut store, &account_id, &profile_id, member)?;

    let is_active = store.active_profile_id == profile_id;
    let mut settings = Settings::load();
    if is_active {
        apply_active_profile_to_settings(&store, &mut settings);
        store.save()?;
        save_settings(&settings)?;
        crate::surfaces::reconcile_persisted_state_async(app.clone());
        crate::tray_bridge::rebuild_tray_menu(&app);
    } else {
        store.save()?;
    }
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
    let _ = app.emit("quotalis:settings-updated", ());
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
        quotalis_core::settings::canonical_catalog_theme(requested)
            .ok_or_else(|| format!("Unknown catalog theme: {slug}"))
    };

    match scope {
        "global" => {
            settings.catalog_theme = if requested.is_empty() {
                quotalis_core::settings::normalize_catalog_theme("")
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
    let _ = app.emit("quotalis:settings-updated", ());
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
    let _ = app.emit("quotalis:settings-updated", ());
    Ok(())
}

#[tauri::command]
pub fn set_provider_limit_presentation(
    app: AppHandle,
    provider: String,
    presentation: Option<quotalis_core::settings::LimitPresentation>,
) -> Result<(), String> {
    let id = quotalis_core::core::ProviderId::from_cli_name(&provider)
        .ok_or_else(|| format!("unknown provider: {provider}"))?;
    if presentation.as_ref().is_some_and(|value| !value.is_valid()) {
        return Err("invalid limit presentation".into());
    }
    let mut settings = Settings::load();
    if let Some(value) = presentation {
        settings
            .provider_limit_presentation
            .insert(id.cli_name().into(), value);
    } else {
        settings.provider_limit_presentation.remove(id.cli_name());
    }
    settings.save().map_err(|e| e.to_string())?;
    app.emit("quotalis:settings-updated", ())
        .map_err(|e| e.to_string())
}

/// Persist the shared provider presentation. Individual provider entries keep
/// their explicit override and inherit this value again when reset.
#[tauri::command]
pub fn set_global_limit_presentation(
    app: AppHandle,
    presentation: quotalis_core::settings::LimitPresentation,
) -> Result<(), String> {
    if !presentation.is_valid() {
        return Err("invalid global limit presentation".into());
    }
    let mut settings = Settings::load();
    settings.global_limit_presentation = presentation;
    settings.save().map_err(|e| e.to_string())?;
    app.emit("quotalis:settings-updated", ())
        .map_err(|e| e.to_string())
}

/// Persist the global Reset Time / Presentation configuration. Rejected
/// (not saved) if any field is invalid -- the settings file on disk is
/// never overwritten with a corrupt config from this path; a corrupt
/// config already on disk from another source is instead repaired at load
/// time by `ResetPresentationSettings::normalized()`.
#[tauri::command]
pub fn set_reset_presentation(
    app: AppHandle,
    config: quotalis_core::settings::ResetPresentationSettings,
) -> Result<(), String> {
    if !config.is_valid() {
        return Err("invalid reset presentation configuration".into());
    }
    let mut settings = Settings::load();
    settings.reset_presentation = config;
    settings.save().map_err(|e| e.to_string())?;
    app.emit("quotalis:settings-updated", ())
        .map_err(|e| e.to_string())
}

/// Persist (or clear, when `config` is `None`) a per-surface override of
/// the global Reset Time / Presentation configuration.
#[tauri::command]
pub fn set_reset_presentation_surface_override(
    app: AppHandle,
    surface: String,
    config: Option<quotalis_core::settings::ResetPresentationSettings>,
) -> Result<(), String> {
    if surface.is_empty() || surface.len() > 64 || surface.chars().any(char::is_control) {
        return Err("invalid surface id".into());
    }
    let mut settings = Settings::load();
    match config {
        Some(config) if config.is_valid() => {
            settings
                .reset_presentation_overrides
                .insert(surface, config);
        }
        Some(_) => return Err("invalid reset presentation configuration".into()),
        None => {
            settings.reset_presentation_overrides.remove(&surface);
        }
    }
    settings.save().map_err(|e| e.to_string())?;
    app.emit("quotalis:settings-updated", ())
        .map_err(|e| e.to_string())
}

fn apply_limit_order(
    settings: &mut Settings,
    provider: &str,
    order: Option<Vec<String>>,
) -> Result<(), String> {
    let id = quotalis_core::core::ProviderId::from_cli_name(provider)
        .ok_or_else(|| format!("unknown provider: {provider}"))?;
    if let Some(mut ids) = order {
        if ids.len() > 128
            || ids
                .iter()
                .any(|id| id.is_empty() || id.len() > 256 || id.chars().any(char::is_control))
        {
            return Err("invalid limit IDs".into());
        }
        let mut seen = std::collections::HashSet::new();
        ids.retain(|id| seen.insert(id.clone()));
        settings
            .provider_limit_order
            .insert(id.cli_name().into(), ids);
    } else {
        settings.provider_limit_order.remove(id.cli_name());
    }
    Ok(())
}

#[tauri::command]
pub fn set_provider_limit_order(
    app: AppHandle,
    provider: String,
    order: Option<Vec<String>>,
) -> Result<(), String> {
    let mut settings = Settings::load();
    apply_limit_order(&mut settings, &provider, order)?;
    settings.save().map_err(|e| e.to_string())?;
    app.emit("quotalis:settings-updated", ())
        .map_err(|e| e.to_string())
}

fn apply_detail_window(
    settings: &mut Settings,
    provider: &str,
    selection: &str,
) -> Result<(), String> {
    let id = quotalis_core::core::ProviderId::from_cli_name(provider)
        .ok_or_else(|| format!("unknown provider: {provider}"))?;
    if !matches!(selection, "all" | "session" | "weekly" | "both" | "none") {
        return Err(format!("invalid detail window selection: {selection}"));
    }
    if selection == "all" {
        settings.provider_detail_windows.remove(id.cli_name());
    } else {
        settings
            .provider_detail_windows
            .insert(id.cli_name().to_string(), selection.to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn set_provider_detail_window(
    app: AppHandle,
    provider: String,
    selection: String,
) -> Result<(), String> {
    let mut settings = Settings::load();
    apply_detail_window(&mut settings, &provider, &selection)?;
    settings.save().map_err(|e| e.to_string())?;
    app.emit("quotalis:settings-updated", ())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
#[test]
fn detail_window_choice_validates_and_preserves_other_provider_settings() {
    let mut settings = Settings::default();
    settings
        .provider_limit_order
        .insert("claude".into(), vec!["model".into(), "primary".into()]);
    settings.provider_limit_order.insert("codex".into(), vec![]);
    apply_detail_window(&mut settings, "claude", "weekly").unwrap();
    apply_detail_window(&mut settings, "openai", "session").unwrap();
    assert_eq!(settings.provider_detail_windows["codex"], "session");
    assert!(apply_detail_window(&mut settings, "claude", "invalid").is_err());
    assert!(apply_detail_window(&mut settings, "unknown-provider", "weekly").is_err());
    assert_eq!(settings.provider_detail_windows["claude"], "weekly");
    apply_detail_window(&mut settings, "claude", "all").unwrap();
    assert!(!settings.provider_detail_windows.contains_key("claude"));
    assert_eq!(settings.provider_detail_windows.len(), 1);
    apply_detail_window(&mut settings, "codex", "none").unwrap();
    assert_eq!(settings.provider_detail_windows["codex"], "none");
    let loaded: Settings =
        serde_json::from_str(&serde_json::to_string(&settings).unwrap()).unwrap();
    assert_eq!(
        loaded.provider_detail_windows,
        settings.provider_detail_windows
    );
    assert_eq!(loaded.provider_limit_order, settings.provider_limit_order);
}

#[cfg(test)]
#[test]
fn ordered_limits_preserve_other_providers_and_validate_before_mutation() {
    let mut settings = Settings::default();
    apply_limit_order(
        &mut settings,
        "claude",
        Some(vec!["model".into(), "primary".into(), "model".into()]),
    )
    .unwrap();
    apply_limit_order(&mut settings, "openai", Some(vec![])).unwrap();
    assert_eq!(
        settings.provider_limit_order["claude"],
        vec!["model", "primary"]
    );
    assert!(settings.provider_limit_order["codex"].is_empty());
    let before = settings.provider_limit_order.clone();
    assert!(apply_limit_order(&mut settings, "claude", Some(vec!["".into()])).is_err());
    assert!(apply_limit_order(&mut settings, "unknown", Some(vec![])).is_err());
    assert_eq!(settings.provider_limit_order, before);
    apply_limit_order(&mut settings, "claude", None).unwrap();
    assert!(!settings.provider_limit_order.contains_key("claude"));
    assert!(settings.provider_limit_order.contains_key("codex"));
}

#[cfg(test)]
#[test]
fn limit_presentation_round_trips_and_rejects_invalid_variants() {
    let presentation = quotalis_core::settings::LimitPresentation {
        shape: "ring".into(),
        content: "both".into(),
        direction: "reverse".into(),
        identity: "glass".into(),
    };
    assert!(presentation.is_valid());
    let mut settings = Settings {
        global_limit_presentation: presentation.clone(),
        ..Default::default()
    };
    settings
        .provider_limit_presentation
        .insert("claude".into(), presentation.clone());
    let loaded: Settings =
        serde_json::from_str(&serde_json::to_string(&settings).unwrap()).unwrap();
    assert_eq!(loaded.provider_limit_presentation["claude"], presentation);
    assert_eq!(loaded.global_limit_presentation, presentation);
    let legacy: quotalis_core::settings::LimitPresentation =
        serde_json::from_value(serde_json::json!({
            "shape":"horizontal","content":"both","direction":"forward"
        }))
        .unwrap();
    assert_eq!(legacy.identity, "adaptive");
    assert!(
        !quotalis_core::settings::LimitPresentation {
            shape: "invalid".into(),
            ..presentation.clone()
        }
        .is_valid()
    );
    assert!(
        !quotalis_core::settings::LimitPresentation {
            identity: "invisible".into(),
            ..presentation
        }
        .is_valid()
    );
}

fn normalize_usage_settings_input(
    global_mode: &str,
    provider_overrides: &std::collections::HashMap<String, String>,
) -> Result<(String, std::collections::HashMap<String, String>), String> {
    let normalized_global =
        quotalis_core::settings::normalize_usage_display_mode(global_mode.trim())
            .ok_or_else(|| format!("invalid usage display mode: {global_mode}"))?;

    let mut normalized_overrides = std::collections::HashMap::new();
    for (provider, mode) in provider_overrides {
        let provider_id = quotalis_core::core::ProviderId::from_cli_name(provider.trim())
            .ok_or_else(|| format!("unknown provider: {provider}"))?;
        if mode == "global" || mode.trim().is_empty() {
            continue; // Follow-global = remove the stored override.
        }
        let normalized = quotalis_core::settings::normalize_usage_display_mode(mode)
            .ok_or_else(|| format!("invalid usage mode: {mode}"))?;
        normalized_overrides.insert(provider_id.cli_name().to_string(), normalized);
    }
    Ok((normalized_global, normalized_overrides))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deleting_inactive_profile_preserves_all_current_settings_and_accounts() {
        let mut settings = Settings {
            theme: ThemePreference::Dark,
            top_arc_enabled: true,
            ..Settings::default()
        };
        let (mut store, active, removed, _) = store_with_second_profile_and_account();
        store.profiles[0].theme = Some(ThemePreference::Light);
        let before = serde_json::to_value(&settings).unwrap();
        let accounts = serde_json::to_value(&store.accounts).unwrap();
        assert!(!remove_profile_from_store(&mut store, &mut settings, &removed).unwrap());
        assert_eq!(serde_json::to_value(&settings).unwrap(), before);
        assert_eq!(serde_json::to_value(&store.accounts).unwrap(), accounts);
        assert_eq!(store.active_profile_id, active);
    }

    #[test]
    fn profile_removal_rejects_missing_and_last_without_mutation() {
        let mut settings = Settings::default();
        let mut store = ProfileStore::default();
        let before = serde_json::to_value(&store).unwrap();
        let id = store.active_profile_id.clone();
        assert!(remove_profile_from_store(&mut store, &mut settings, &id).is_err());
        assert!(remove_profile_from_store(&mut store, &mut settings, "missing").is_err());
        assert_eq!(serde_json::to_value(&store).unwrap(), before);
    }

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
        let mut store = quotalis_core::profiles::migrate_from_legacy(&settings);
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
        let mut store = quotalis_core::profiles::migrate_from_legacy(&settings);
        store.profiles[0].theme = Some(ThemePreference::Light);
        store.profiles[0].catalog_theme = Some("01-obsidian-orbit".to_string());
        store.profiles[0].surfaces.top_arc = true;
        store.profiles[0].surfaces.taskbar_arc = true;
        let mut s2 = Settings::default();
        apply_active_profile_to_settings(&store, &mut s2);
        assert_eq!(s2.theme, Settings::default().theme);
        assert_eq!(
            s2.active_profile_catalog_theme.as_deref(),
            Some("01-obsidian-orbit")
        );
        assert!(s2.top_arc_enabled);
        assert!(s2.taskbar_arc_enabled);
    }

    #[test]
    fn switching_profile_preserves_the_global_theme_preference() {
        let mut settings = Settings {
            theme: ThemePreference::Dark,
            ..Settings::default()
        };
        let mut store = ProfileStore::default();
        store.profiles[0].theme = Some(ThemePreference::Light);
        apply_active_profile_to_settings(&store, &mut settings);
        assert_eq!(settings.theme, ThemePreference::Dark);
        store.profiles[0].theme = None;
        apply_active_profile_to_settings(&store, &mut settings);
        assert_eq!(settings.theme, ThemePreference::Dark);
    }

    #[test]
    fn flat_profile_update_distinguishes_missing_clear_and_assign() {
        let decode = |value| decode_profile_update(&tauri::ipc::InvokeBody::Json(value)).unwrap();
        let absent = decode(serde_json::json!({"profileId":"test", "topArc":true}));
        assert!(absent.theme.is_none());
        assert!(absent.catalog_theme.is_none());
        assert!(absent.accent.is_none());
        assert_eq!(absent.top_arc, Some(true));
        let clear = decode(
            serde_json::json!({"profileId":"test", "theme":null, "catalogTheme":null, "accent":null}),
        );
        assert_eq!(clear.theme, Some(None));
        assert_eq!(clear.catalog_theme, Some(None));
        assert_eq!(clear.accent, Some(None));
        let assign = decode(
            serde_json::json!({"profileId":"test", "theme":"light", "catalogTheme":"01-obsidian-orbit", "accent":"#ffffff"}),
        );
        assert_eq!(assign.theme, Some(Some(ThemePreference::Light)));
        assert_eq!(
            assign.catalog_theme.as_ref().and_then(|v| v.as_deref()),
            Some("01-obsidian-orbit")
        );
        assert!(
            decode_profile_update(&tauri::ipc::InvokeBody::Json(
                serde_json::json!({"profileId":"test", "theme":false})
            ))
            .is_err()
        );
        assert!(
            decode_profile_update(&tauri::ipc::InvokeBody::Json(
                serde_json::json!({"theme":null})
            ))
            .is_err()
        );
    }

    #[test]
    fn canonical_theme_scope_storage_is_bounded_and_clearable() {
        let mut settings = Settings::default();
        let mut store = ProfileStore::default();

        assert!(
            !apply_catalog_theme_scope(&mut settings, &mut store, "global", "01-obsidian-orbit",)
                .unwrap()
        );
        assert_eq!(settings.catalog_theme, "01-obsidian-orbit");

        assert!(
            apply_catalog_theme_scope(&mut settings, &mut store, "profile", "01-obsidian-orbit",)
                .unwrap()
        );
        assert_eq!(
            settings.active_profile_catalog_theme.as_deref(),
            Some("01-obsidian-orbit")
        );

        apply_catalog_theme_scope(
            &mut settings,
            &mut store,
            "surface:taskbar",
            "01-obsidian-orbit",
        )
        .unwrap();
        assert_eq!(
            settings
                .surface_catalog_themes
                .get("taskbar")
                .map(String::as_str),
            Some("01-obsidian-orbit"),
        );

        apply_catalog_theme_scope(&mut settings, &mut store, "profile", "").unwrap();
        apply_catalog_theme_scope(&mut settings, &mut store, "surface:taskbar", "").unwrap();
        assert!(settings.active_profile_catalog_theme.is_none());
        assert!(!settings.surface_catalog_themes.contains_key("taskbar"));
        assert!(
            apply_catalog_theme_scope(&mut settings, &mut store, "global", "12-crimson-nova",)
                .is_err()
        );
    }

    #[test]
    fn deleted_active_profile_falls_back_without_stale_catalog_theme() {
        let mut store = ProfileStore::default();
        let mut second = QuotaArcProfile::new("Second");
        second.catalog_theme = Some("01-obsidian-orbit".to_string());
        store.active_profile_id = second.id.clone();
        store.profiles.push(second.clone());

        let mut settings = Settings::default();
        apply_active_profile_to_settings(&store, &mut settings);
        assert_eq!(
            settings.active_profile_catalog_theme.as_deref(),
            Some("01-obsidian-orbit"),
        );

        assert!(remove_profile_from_store(&mut store, &mut settings, &second.id).unwrap());
        assert!(settings.active_profile_catalog_theme.is_none());
    }

    fn store_with_second_profile_and_account() -> (ProfileStore, String, String, String) {
        let mut store = ProfileStore::default();
        let first_id = store.profiles[0].id.clone();
        let second = QuotaArcProfile::new("Second");
        let second_id = second.id.clone();
        store.profiles.push(second);
        let account = quotalis_core::profiles::ProviderAccount::new(
            quotalis_core::core::ProviderId::Claude,
            "Work",
        );
        let account_id = account.id.clone();
        store.accounts.push(account);
        (store, first_id, second_id, account_id)
    }

    #[test]
    fn membership_toggle_adds_and_removes_without_duplicating() {
        let (mut store, first_id, second_id, account_id) = store_with_second_profile_and_account();

        apply_account_profile_membership(&mut store, &account_id, &second_id, true).unwrap();
        let second = store.profiles.iter().find(|p| p.id == second_id).unwrap();
        assert_eq!(second.account_ids, vec![account_id.clone()]);

        // Adding twice must not duplicate the id.
        apply_account_profile_membership(&mut store, &account_id, &second_id, true).unwrap();
        let second = store.profiles.iter().find(|p| p.id == second_id).unwrap();
        assert_eq!(second.account_ids, vec![account_id.clone()]);

        // The first profile is untouched by membership changes on the second.
        let first = store.profiles.iter().find(|p| p.id == first_id).unwrap();
        assert!(!first.account_ids.contains(&account_id));

        apply_account_profile_membership(&mut store, &account_id, &second_id, false).unwrap();
        let second = store.profiles.iter().find(|p| p.id == second_id).unwrap();
        assert!(second.account_ids.is_empty());
    }

    #[test]
    fn membership_toggle_rejects_unknown_account_or_profile() {
        let (mut store, _first_id, second_id, account_id) = store_with_second_profile_and_account();
        assert!(
            apply_account_profile_membership(&mut store, "ghost-account", &second_id, true)
                .is_err()
        );
        assert!(
            apply_account_profile_membership(&mut store, &account_id, "ghost-profile", true)
                .is_err()
        );
    }
}

#[cfg(test)]
mod profile_link_validation_tests {
    #[test]
    fn unresolved_credential_links_are_rejected_before_store_access() {
        assert!(super::validate_profile_credential_reference(None, None).is_ok());
        assert!(super::validate_profile_credential_reference(Some("none"), None).is_ok());
        assert!(
            super::validate_profile_credential_reference(Some("api-keys-store"), None).is_err()
        );
        assert!(
            super::validate_profile_credential_reference(None, Some("unknown-account")).is_err()
        );
    }
}
