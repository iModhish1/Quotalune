use crate::state::AppState;
use quotalis_core::notification_journal::{NotificationPage, NotificationQuery};
use std::sync::Mutex;
use tauri::{Emitter, State};

fn authorize_history(label: &str, demo: bool) -> Result<(), String> {
    if label != "settings" || demo {
        return Err("Notification history is unavailable in this context".into());
    }
    Ok(())
}

#[tauri::command]
pub fn get_notification_history(
    window: tauri::WebviewWindow,
    state: State<'_, Mutex<AppState>>,
    query: NotificationQuery,
) -> Result<NotificationPage, String> {
    let state = state
        .lock()
        .map_err(|_| "Notification history is unavailable")?;
    authorize_history(
        window.label(),
        quotalis_core::settings::Settings::load().demo_mode_enabled,
    )?;
    state
        .notification_manager
        .notification_history()?
        .page(&query)
}

#[tauri::command]
pub fn mark_notification_read(
    window: tauri::WebviewWindow,
    state: State<'_, Mutex<AppState>>,
    id: i64,
) -> Result<bool, String> {
    let changed = {
        let state = state
            .lock()
            .map_err(|_| "Notification history is unavailable")?;
        authorize_history(
            window.label(),
            quotalis_core::settings::Settings::load().demo_mode_enabled,
        )?;
        state
            .notification_manager
            .notification_history()?
            .mark_read(id)?
    };
    if changed {
        let _ = window.emit("notification-history-changed", ());
    }
    Ok(changed)
}

#[tauri::command]
pub fn mark_all_notifications_read(
    window: tauri::WebviewWindow,
    state: State<'_, Mutex<AppState>>,
    through_id: i64,
) -> Result<usize, String> {
    let changed = {
        let state = state
            .lock()
            .map_err(|_| "Notification history is unavailable")?;
        authorize_history(
            window.label(),
            quotalis_core::settings::Settings::load().demo_mode_enabled,
        )?;
        state
            .notification_manager
            .notification_history()?
            .mark_all_read(through_id)?
    };
    if changed > 0 {
        let _ = window.emit("notification-history-changed", ());
    }
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn real_history_is_never_accessible_from_demo_or_other_surfaces() {
        assert!(authorize_history("settings", false).is_ok());
        assert!(authorize_history("settings", true).is_err());
        for label in ["main", "floatbar", "", "settings-other"] {
            assert!(authorize_history(label, false).is_err());
        }
    }
}
