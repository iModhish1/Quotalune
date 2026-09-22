//! Security regression gate for provider onboarding (Wave 3): representative
//! fixture secrets must never reach serialized settings, notification history,
//! toast text, CLI probe output or an unprotected credential file.

#[cfg(test)]
mod tests {
    use crate::core::{ProviderId, UserFacingText};
    use crate::notification_journal::{JournalEventKind, NotificationJournal, NotificationRecord};
    use crate::settings::Settings;

    const FIXTURE_SECRETS: [&str; 6] = [
        "sk-fixture-1234567890abcdef",
        "sessionKey=sk-ant-sid01-FIXTURECOOKIE",
        "Bearer fixture.bearer.token",
        "refresh_token=FIXTUREREFRESH",
        "Authorization: Basic RklYVFVSRQ==",
        "ghp_FIXTUREPERSONALTOKEN123456",
    ];

    #[test]
    fn serialized_settings_never_contain_fixture_secrets_after_onboarding_mutations() {
        let mut settings = Settings::default();
        // Everything the unified flow persists through Settings: enablement,
        // cookie source, usage source, region. Keys and cookies go elsewhere.
        for provider in [
            ProviderId::Codex,
            ProviderId::OpenRouter,
            ProviderId::Perplexity,
        ] {
            settings
                .enabled_providers
                .insert(provider.cli_name().to_string());
        }
        let json = serde_json::to_string(&settings).unwrap();
        for secret in FIXTURE_SECRETS {
            assert!(!json.contains(secret), "{secret} leaked into settings.json");
        }
    }

    #[test]
    fn protected_credential_files_never_hold_plaintext_on_windows() {
        let dir = tempfile::tempdir().unwrap();
        for (index, secret) in FIXTURE_SECRETS.iter().enumerate() {
            let path = dir.path().join(format!("secret-{index}.json"));
            crate::secure_file::write_string(&path, secret).unwrap();
            let bytes = std::fs::read(&path).unwrap();
            let text = String::from_utf8_lossy(&bytes);
            if cfg!(windows) {
                assert!(!text.contains(secret), "plaintext secret in protected file");
                assert!(text.contains("codexbar.secure-file"));
            }
            assert_eq!(crate::secure_file::read_string(&path).unwrap(), *secret);
        }
    }

    #[test]
    fn notification_history_refuses_secret_bearing_detail_and_stores_no_free_text() {
        let store = NotificationJournal::in_memory();
        for secret in FIXTURE_SECRETS {
            let refused = store.record_notification(
                ProviderId::Codex,
                "",
                "status",
                NotificationRecord {
                    kind: JournalEventKind::ProviderStatusIssue,
                    previous_value: None,
                    current_value: None,
                    detail: Some(Box::leak(secret.to_string().into_boxed_str())),
                    observed_at: 10,
                },
            );
            assert!(refused.is_err(), "{secret}");
        }
    }

    #[test]
    fn hostile_provider_output_is_sanitized_before_any_surface() {
        let hostile = format!(
            "{}\r\n{}\nuser@example.com C:\\Users\\JaneDoe\\.codex\\auth.json\x1b[31mERR\x1b[0m {} {} {}",
            FIXTURE_SECRETS[0],
            FIXTURE_SECRETS[1],
            FIXTURE_SECRETS[2],
            FIXTURE_SECRETS[3],
            FIXTURE_SECRETS[5]
        );
        let clean = UserFacingText::sanitize(&hostile);
        for leaked in [
            "sk-fixture-1234567890abcdef",
            "FIXTURECOOKIE",
            "fixture.bearer.token",
            "FIXTUREREFRESH",
            "ghp_FIXTUREPERSONALTOKEN123456",
            "user@example.com",
            "JaneDoe",
            "\x1b",
            "\r",
        ] {
            assert!(!clean.contains(leaked), "{leaked} leaked: {clean}");
        }
    }

    #[test]
    fn install_plans_never_embed_provider_or_user_text() {
        for dependency in crate::connection_capabilities::CLI_DEPENDENCIES {
            if let Some(plan) = crate::connection_capabilities::install_plan(dependency) {
                for arg in plan.args {
                    assert!(
                        !arg.contains(dependency.tool),
                        "tool name is not an argument"
                    );
                    assert!(
                        arg.is_ascii() && !arg.contains(char::is_whitespace),
                        "{arg}"
                    );
                }
            }
        }
    }
}
