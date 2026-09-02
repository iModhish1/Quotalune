//! Profile management commands: the Tauri surface of `codexbar::profiles`.
//!
//! Switching a profile is atomic from the caller's perspective: the store is
//! updated and persisted, enabled providers / theme / surfaces are reconciled
//! into settings, surfaces windows are reconciled, and the tray menu is
//! rebuilt — then a single `profiles-changed` event notifies the frontend.

use codexbar::profiles::{ProfileStore, ProviderAccount, QuotaArcProfile};
use codexbar::settings::{Settings, ThemePreference};
use tauri::{AppHandle, Emitter, Manager};

fn emit_changed(app: &AppHandle) {
    let _ = app.emit("profiles-changed", ());
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
    settings.edge_arc_enabled = profile.surfaces.edge_arc;
    settings.top_arc_enabled = profile.surfaces.top_arc;
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
    crate::surfaces::apply_state(&app, &settings);
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
    crate::surfaces::apply_state(&app, &settings);
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
pub fn update_profile(
    app: AppHandle,
    profile_id: String,
    theme: Option<Option<ThemePreference>>,
    accent: Option<Option<String>>,
    edge_arc: Option<bool>,
    top_arc: Option<bool>,
    float_bar: Option<bool>,
) -> Result<(), String> {
    let mut store = ProfileStore::load();
    let Some(profile) = store.profiles.iter_mut().find(|p| p.id == profile_id) else {
        return Err("Profile not found".to_string());
    };
    if let Some(theme) = theme {
        profile.theme = theme;
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
        crate::surfaces::apply_state(&app, &settings);
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

#[cfg(test)]
mod tests {
    use super::*;
    use codexbar::core::ProviderId;

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
        let mut s2 = Settings::default();
        s2.enabled_providers = ["claude".to_string(), "codex".to_string()]
            .into_iter()
            .collect();
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
        store.profiles[0].surfaces.top_arc = true;
        let mut s2 = Settings::default();
        apply_active_profile_to_settings(&store, &mut s2);
        assert_eq!(s2.theme, ThemePreference::Light);
        assert!(s2.top_arc_enabled);
    }
}
