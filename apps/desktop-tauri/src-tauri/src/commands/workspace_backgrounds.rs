use quotalis_core::workspace_backgrounds::{BackgroundStore, StoredBackground};
use tauri::Emitter;

// Serialize catalog publication/removal across windows. Image decoding runs off the UI thread.
static BACKGROUND_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

async fn with_store<T: Send + 'static>(
    operation: impl FnOnce(BackgroundStore) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = BACKGROUND_LOCK
            .lock()
            .map_err(|_| "Background storage is busy".to_string())?;
        let root =
            quotalis_core::paths::config_dir().ok_or("Configuration directory is unavailable")?;
        operation(BackgroundStore::new(root.join("workspace-backgrounds")))
    })
    .await
    .map_err(|_| "Background operation could not complete".to_string())?
}

#[tauri::command]
pub async fn list_workspace_backgrounds() -> Result<Vec<StoredBackground>, String> {
    with_store(|store| store.list()).await
}

#[tauri::command]
pub async fn read_workspace_background(id: String) -> Result<String, String> {
    with_store(move |store| store.image_data_url(&id)).await
}

#[tauri::command]
pub async fn import_workspace_background(
    app: tauri::AppHandle,
    name: String,
    png: String,
    thumbnail: String,
) -> Result<StoredBackground, String> {
    let item = with_store(move |store| store.import_base64(&name, &png, &thumbnail)).await?;
    let _ = app.emit("workspace-backgrounds-changed", ());
    Ok(item)
}

#[tauri::command]
pub async fn remove_workspace_background(app: tauri::AppHandle, id: String) -> Result<(), String> {
    with_store(move |store| {
        let _settings_guard = super::settings::SETTINGS_PATCH_LOCK
            .lock()
            .map_err(|_| "Settings are busy".to_string())?;
        let settings = quotalis_core::settings::Settings::load();
        if settings
            .workspace_preferences
            .as_ref()
            .is_some_and(|prefs| prefs.background == format!("custom:{id}"))
        {
            return Err("Choose another background before deleting the active image".to_string());
        }
        store.remove(&id)
    })
    .await?;
    let _ = app.emit("workspace-backgrounds-changed", ());
    Ok(())
}
