use quotalis_core::settings::{Settings, collections::CollectionLayout};
use std::sync::Mutex;
use tauri::Emitter;

static WRITE_LOCK: Mutex<()> = Mutex::new(());

fn advance_revision(
    mut next: CollectionLayout,
    current: &CollectionLayout,
) -> Result<CollectionLayout, String> {
    next.validate()?;
    if next.revision != current.revision {
        return Err("Collection settings changed elsewhere. Reload before saving.".into());
    }
    next.revision = current
        .revision
        .checked_add(1)
        .ok_or("Collection revision exhausted")?;
    Ok(next)
}

#[tauri::command]
pub fn get_collection_layout() -> CollectionLayout {
    Settings::load().collection_layout
}

#[tauri::command]
pub fn set_collection_layout(
    app: tauri::AppHandle,
    layout: CollectionLayout,
) -> Result<CollectionLayout, String> {
    let _guard = WRITE_LOCK
        .lock()
        .map_err(|_| "Collection settings are temporarily unavailable")?;
    let mut settings = Settings::load();
    let next = advance_revision(layout, &settings.collection_layout)?;
    settings.collection_layout = next.clone();
    settings.save().map_err(|e| e.to_string())?;
    if let Err(error) = app.emit("quotaarc:collections-changed", next.revision) {
        tracing::warn!(%error, "Collection settings saved but broadcast failed");
    }
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_stale_edits_and_advances_revision() {
        let current = CollectionLayout::default();
        let saved = advance_revision(current.clone(), &current).unwrap();
        assert_eq!(saved.revision, 1);
        assert!(advance_revision(current, &saved).is_err());
    }
    #[test]
    fn invalid_layout_never_reaches_save() {
        let current = CollectionLayout::default();
        let mut next = current.clone();
        next.scale = 1;
        assert!(advance_revision(next, &current).is_err());
    }
}
