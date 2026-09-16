//! Dev-only notification proof: sends the real localized toast for a chosen
//! case through the production toast path. It never records history, never
//! touches dedupe state and is refused by the backend outside the Dev channel.
use quotalis_core::{
    core::{ProviderId, ProviderStateKind},
    notifications::{self, NotificationDestination, NotificationManager, NotificationType},
    settings::Language,
};
use std::{
    sync::Mutex,
    time::{Duration, Instant},
};

static LAST_SENT: Mutex<Option<Instant>> = Mutex::new(None);

pub const NOTIFICATION_QA_KINDS: [&str; 6] = [
    "info",
    "warning",
    "critical",
    "reset",
    "providerUnavailable",
    "authRequired",
];

#[derive(Debug, PartialEq)]
struct FixtureToast {
    title: String,
    body: String,
    provider: ProviderId,
    destination: NotificationDestination,
}

fn fixture_toast(
    dev_channel: bool,
    kind: &str,
    provider_id: &str,
    language: Language,
) -> Result<FixtureToast, String> {
    if !dev_channel {
        return Err("Notification QA fixture is Dev-channel only.".into());
    }
    let provider = ProviderId::from_cli_name(provider_id)
        .filter(|p| p.cli_name() == provider_id)
        .ok_or_else(|| "Unknown provider".to_string())?;
    let alert = |notif_type, window: &str, used| {
        NotificationManager::alert_preview(provider, window, used, notif_type, language)
    };
    let status = |state| {
        let (title, body) =
            NotificationManager::status_notification_text(provider, state, language);
        (title, body, NotificationDestination::Providers(provider))
    };
    let (title, body, destination) = match kind {
        "info" => alert(NotificationType::SessionRestored, "session", 12.0),
        "warning" => alert(NotificationType::HighUsage, "session", 76.0),
        "critical" => alert(NotificationType::CriticalUsage, "weekly", 94.0),
        "reset" => alert(NotificationType::ExpectedReset(0), "weekly", 0.0),
        "providerUnavailable" => status(ProviderStateKind::Unknown),
        "authRequired" => status(ProviderStateKind::NeedsAuthentication),
        _ => return Err("Unknown notification QA case".into()),
    };
    Ok(FixtureToast {
        title,
        body,
        provider,
        destination,
    })
}

#[tauri::command]
pub fn send_notification_qa_fixture(kind: String, provider_id: String) -> Result<(), String> {
    let toast = fixture_toast(
        crate::build_info::CHANNEL == "dev",
        &kind,
        &provider_id,
        quotalis_core::locale::current_language(),
    )?;
    let mut last = LAST_SENT
        .lock()
        .map_err(|_| "Notification QA fixture unavailable")?;
    if last.is_some_and(|time| time.elapsed() < Duration::from_secs(1)) {
        return Err("Wait before sending another fixture toast".into());
    }
    *last = Some(Instant::now());
    drop(last);
    notifications::show_provider_notification_to(
        &toast.title,
        &toast.body,
        toast.provider,
        toast.destination,
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refused_outside_dev_and_for_unknown_cases_or_providers() {
        assert!(fixture_toast(false, "warning", "claude", Language::English).is_err());
        assert!(fixture_toast(true, "sparkle", "claude", Language::English).is_err());
        assert!(fixture_toast(true, "warning", "invented", Language::English).is_err());
    }

    #[test]
    fn every_case_uses_production_copy_and_routes_to_a_real_destination() {
        for kind in NOTIFICATION_QA_KINDS {
            for language in [Language::English, Language::Arabic] {
                let toast = fixture_toast(true, kind, "codex", language).unwrap();
                assert!(!toast.title.is_empty() && !toast.body.is_empty(), "{kind}");
                assert!(!toast.body.contains("{}"), "{kind}: {}", toast.body);
                assert_eq!(toast.provider, ProviderId::Codex);
                let uri = notifications::notification_uri(toast.destination);
                assert_eq!(
                    notifications::parse_notification_uri(&uri),
                    Some(toast.destination),
                    "{kind}"
                );
            }
        }
        let auth = fixture_toast(true, "authRequired", "codex", Language::English).unwrap();
        assert_eq!(
            auth.destination,
            NotificationDestination::Providers(ProviderId::Codex)
        );
        let reset = fixture_toast(true, "reset", "codex", Language::English).unwrap();
        assert_eq!(reset.destination, NotificationDestination::Dashboard);
        let english = fixture_toast(true, "critical", "codex", Language::English).unwrap();
        let arabic = fixture_toast(true, "critical", "codex", Language::Arabic).unwrap();
        assert_ne!(english.body, arabic.body);
    }
}
