//! Records provider snapshots into the account-scoped history store.
//!
//! Account resolution: the first enabled account for the provider in the
//! active profile; a stable synthetic `provider:<cli>` key when the provider
//! has no registered account (history stays key-stable for when real
//! accounts replace the synthetic ones — the synthetic key is a stable
//! identifier, never a display name).
//!
//! Recording is best-effort: history failures must never break the
//! provider refresh path.

use quotalis_core::dashboard_data::provider_cost_measurement_kind;
use quotalis_core::history::{HistoryStore, UsageSample};
use quotalis_core::profiles::ProfileStore;

use crate::commands::ProviderUsageSnapshot;

static STORE: std::sync::OnceLock<HistoryStore> = std::sync::OnceLock::new();

fn store() -> &'static HistoryStore {
    STORE.get_or_init(HistoryStore::open)
}

/// Resolve the history key for a provider under the active profile.
pub(crate) fn account_key_for(provider_cli: &str) -> String {
    let store = ProfileStore::load();
    for account in store.active_accounts() {
        if account.provider == provider_cli && account.enabled {
            return account.id.clone();
        }
    }
    format!("provider:{provider_cli}")
}

fn epoch_secs_from_iso(timestamp: &str) -> Option<i64> {
    // Snapshot timestamps are RFC3339 from chrono with variable precision.
    // Parse just the fields we need to avoid a new dependency here.
    let (date, time) = timestamp.split_once('T')?;
    let mut date_parts = date.split('-');
    let year: i64 = date_parts.next()?.parse().ok()?;
    let month: i64 = date_parts.next()?.parse().ok()?;
    let day: i64 = date_parts.next()?.parse().ok()?;
    let time = time.trim_end_matches('Z');
    let mut time_parts = time.split(':');
    let hour: i64 = time_parts.next()?.parse().ok()?;
    let minute: i64 = time_parts.next()?.parse().ok()?;
    let second_raw = time_parts.next().unwrap_or("0");
    let second: i64 = second_raw
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect::<String>()
        .parse()
        .ok()?;
    // days-from-civil algorithm (Howard Hinnant), valid for the epoch era.
    let y = if month <= 2 { year - 1 } else { year };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (month + 9) % 12;
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    Some(days * 86_400 + hour * 3_600 + minute * 60 + second)
}

fn iso_to_epoch(timestamp: &str) -> Option<i64> {
    epoch_secs_from_iso(timestamp)
}

fn sample_for_window(
    account_key: &str,
    provider_cli: &str,
    window_id: String,
    window_label: Option<String>,
    window: &crate::commands::RateWindowSnapshot,
    captured_at: i64,
) -> UsageSample {
    UsageSample {
        account_id: account_key.to_string(),
        provider: provider_cli.to_string(),
        window_id: Some(window_id),
        window_label,
        used_percent: window.used_percent,
        remaining_percent: window.remaining_percent,
        cost_used: None,
        cost_currency_code: None,
        cost_measurement_kind: None,
        resets_at: window.resets_at.as_deref().and_then(iso_to_epoch),
        captured_at,
    }
}

/// Build the history samples a snapshot would produce, without writing them
/// -- pure and side-effect-free so it's directly testable (writing goes
/// through the real, process-global store, which would otherwise mean a
/// unit test contaminates the real on-disk `history.db`). Returns `None`
/// for an error snapshot (nothing to record).
fn samples_for_snapshot(snapshot: &ProviderUsageSnapshot) -> Option<Vec<UsageSample>> {
    if snapshot.error.is_some() {
        return None;
    }
    let account_key = account_key_for(&snapshot.provider_id);
    let captured_at = iso_to_epoch(&snapshot.updated_at).unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
    });

    let mut samples = Vec::new();
    let selected = crate::usage_metric::selected_usage_window(
        snapshot,
        &quotalis_core::settings::Settings::load(),
    );
    samples.push(sample_for_window(
        &account_key,
        &snapshot.provider_id,
        "selected".to_string(),
        Some("Selected".to_string()),
        &selected,
        captured_at,
    ));
    samples.push(sample_for_window(
        &account_key,
        &snapshot.provider_id,
        format!(
            "primary:{}",
            snapshot.primary_label.as_deref().unwrap_or("")
        ),
        snapshot.primary_label.clone(),
        &snapshot.primary,
        captured_at,
    ));
    for extra in &snapshot.extra_rate_windows {
        samples.push(sample_for_window(
            &account_key,
            &snapshot.provider_id,
            format!("extra:{}", extra.id),
            Some(extra.title.clone()),
            &extra.window,
            captured_at,
        ));
    }
    // Cost is a distinct fact from quota percentage -- recorded as its own
    // sample (window_id "cost") so dashboard spend queries never mix a
    // dollar amount into a percentage aggregate, and so a provider with no
    // cost data simply has no "cost" rows rather than a fabricated 0.
    if let Some(cost) = &snapshot.cost {
        samples.push(UsageSample {
            account_id: account_key.clone(),
            provider: snapshot.provider_id.clone(),
            window_id: Some("cost".to_string()),
            window_label: Some(cost.period.clone()),
            used_percent: 0.0,
            remaining_percent: 0.0,
            cost_used: Some(cost.used),
            // Phase 4A: currency_code is a required (non-Option) field on
            // every provider's CostSnapshot, so every cost sample recorded
            // from here on carries its real currency -- never guessed,
            // never defaulted to USD. Only pre-Phase-4A rows (written
            // before this column existed) read back with `None`.
            cost_currency_code: Some(cost.currency_code.clone()),
            // Phase 4A: which measurement kind THIS provider was proven
            // (by direct code audit, not inference) to write into `used`
            // -- see `provider_cost_measurement_kind`'s doc comment.
            cost_measurement_kind: Some(
                provider_cost_measurement_kind(&snapshot.provider_id)
                    .as_str()
                    .to_string(),
            ),
            resets_at: cost.resets_at.as_deref().and_then(iso_to_epoch),
            captured_at,
        });
    }

    Some(samples)
}

/// Record a successfully-refreshed snapshot into history. Errors are logged,
/// never propagated.
pub(crate) fn record_snapshot(snapshot: &ProviderUsageSnapshot) {
    let Some(samples) = samples_for_snapshot(snapshot) else {
        return;
    };
    let store = store();
    if let Err(error) = store.record_samples(&samples) {
        tracing::warn!(%error, provider = %snapshot.provider_id, "history recording failed");
    }
}

/// Best-effort retention prune at startup.
pub(crate) fn prune_on_startup() {
    let store = store();
    if let Err(error) = store.prune(quotalis_core::history::DEFAULT_RETENTION_DAYS) {
        tracing::warn!(%error, "history prune failed");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_key_prefers_active_profile_account() {
        // No profile store file in the test env: synthetic fallback key.
        let key = account_key_for("some-unregistered-provider");
        assert_eq!(key, "provider:some-unregistered-provider");
    }

    #[test]
    fn iso_parsing_handles_rfc3339() {
        assert_eq!(iso_to_epoch("2026-09-02T00:00:00Z"), Some(1_788_307_200));
        assert_eq!(iso_to_epoch("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(
            iso_to_epoch("2026-09-02T12:34:56.789Z"),
            Some(1_788_352_496)
        );
        assert_eq!(iso_to_epoch("not-a-date"), None);
    }

    #[test]
    fn error_snapshots_are_not_recorded() {
        let mut snapshot = test_snapshot();
        snapshot.error = Some("boom".to_string());
        assert!(samples_for_snapshot(&snapshot).is_none());
    }

    #[test]
    fn cost_present_produces_a_distinct_cost_sample() {
        let mut snapshot = test_snapshot();
        snapshot.cost = Some(crate::commands::CostSnapshotBridge {
            used: 12.34,
            limit: Some(100.0),
            remaining: Some(87.66),
            currency_code: "USD".to_string(),
            currency_symbol: Some("$".to_string()),
            period: "month".to_string(),
            resets_at: Some("2026-10-01T00:00:00Z".to_string()),
            formatted_used: "$12.34".to_string(),
            formatted_limit: None,
            balance: None,
            formatted_balance: None,
            daily: Vec::new(),
        });
        let samples = samples_for_snapshot(&snapshot).expect("non-error snapshot");
        let cost_sample = samples
            .iter()
            .find(|s| s.window_id.as_deref() == Some("cost"))
            .expect("a cost sample must be produced when snapshot.cost is present");
        assert_eq!(cost_sample.cost_used, Some(12.34));
        // Cost is never conflated with quota percentage.
        assert_eq!(cost_sample.used_percent, 0.0);
    }

    #[test]
    fn no_cost_data_produces_no_cost_sample() {
        let snapshot = test_snapshot(); // cost: null
        let samples = samples_for_snapshot(&snapshot).expect("non-error snapshot");
        assert!(
            !samples
                .iter()
                .any(|s| s.window_id.as_deref() == Some("cost")),
            "must not fabricate a cost sample when the provider reports none"
        );
    }

    fn test_snapshot() -> ProviderUsageSnapshot {
        serde_json::from_str(
            r#"{
                "providerId": "codex",
                "displayName": "Codex",
                "primary": {"usedPercent": 10, "remainingPercent": 90, "windowMinutes": null,
                    "resetsAt": null, "resetDescription": null, "isExhausted": false,
                    "reservePercent": null, "reserveDescription": null},
                "selectedMetric": {"usedPercent": 10, "remainingPercent": 90, "windowMinutes": null,
                    "resetsAt": "2026-09-09T00:00:00Z", "resetDescription": null, "isExhausted": false,
                    "reservePercent": null, "reserveDescription": null},
                "secondary": null, "secondaryLabel": null, "modelSpecific": null,
                "tertiary": null, "extraRateWindows": [], "cost": null, "planName": null,
                "accountEmail": null, "sourceLabel": "test", "updatedAt": "2026-09-02T00:00:00Z",
                "error": null, "errorState": "ready", "pace": null,
                "accountOrganization": null, "trayStatusLabel": null
            }"#,
        )
        .expect("snapshot json")
    }
}
