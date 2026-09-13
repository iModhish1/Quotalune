use quotalis_core::{
    core::ProviderId,
    locale::{self, LocaleKey},
    notifications::{self, NotificationDestination},
};
use std::{
    sync::Mutex,
    time::{Duration, Instant},
};

static LAST_TEST: Mutex<Option<Instant>> = Mutex::new(None);

fn test_destination(
    window_label: &str,
    provider_id: Option<&str>,
) -> Result<NotificationDestination, String> {
    if window_label != "settings" {
        return Err("Notification tests require the Settings window".into());
    }
    match provider_id {
        None => Ok(NotificationDestination::Dashboard),
        Some(id) => ProviderId::from_cli_name(id)
            .filter(|_| id.len() <= 64 && !id.chars().any(char::is_control))
            .map(NotificationDestination::Providers)
            .ok_or_else(|| "Unknown notification test provider".into()),
    }
}

/// An explicit user-requested test, never an observed usage or account alert.
/// Only fixed localized text and a catalog display name enter the notification.
#[tauri::command]
pub fn send_test_notification(
    window: tauri::WebviewWindow,
    provider_id: Option<String>,
) -> Result<(), String> {
    let destination = test_destination(window.label(), provider_id.as_deref())?;
    let mut last = LAST_TEST
        .lock()
        .map_err(|_| "Notification test is unavailable")?;
    if last.is_some_and(|time| time.elapsed() < Duration::from_secs(3)) {
        return Err("Wait before requesting another test notification".into());
    }
    *last = Some(Instant::now());
    drop(last);
    let language = locale::current_language();
    let title = locale::get_text(language, LocaleKey::NotificationTestTitle);
    let body = locale::get_text(language, LocaleKey::NotificationTestBody);
    let body = match destination {
        NotificationDestination::Providers(provider) => {
            format!("{} — {body}", provider.display_name())
        }
        _ => body,
    };
    notifications::show_notification_to(&title, &body, destination);
    // This acknowledges the request; Windows controls visibility and suppression.
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn notification_tests_accept_only_settings_and_known_destinations() {
        assert_eq!(
            test_destination("settings", None).unwrap(),
            NotificationDestination::Dashboard
        );
        assert_eq!(
            test_destination("settings", Some("claude")).unwrap(),
            NotificationDestination::Providers(ProviderId::Claude)
        );
        assert!(test_destination("main", Some("claude")).is_err());
        assert!(test_destination("settings", Some("unknown-provider")).is_err());
        assert!(test_destination("settings", Some("claude\n")).is_err());
    }
}
