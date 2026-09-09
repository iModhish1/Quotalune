//! Records provider snapshots into the account-scoped history store.
//!
//! Account resolution uses only identity evidence carried by the provider
//! snapshot. Provider-reported email plus organization context becomes a
//! domain-separated digest; snapshots without email evidence remain explicitly
//! provider-scoped and unresolved.
//!
//! Recording is best-effort: history failures must never break the
//! provider refresh path.

use quotalis_core::core::{ProviderStateKind, sha256_hex};
use quotalis_core::dashboard_data::classify_monetary_observation;
use quotalis_core::history::{HistoryStore, UsageSample};

use crate::commands::ProviderUsageSnapshot;

static STORE: std::sync::OnceLock<HistoryStore> = std::sync::OnceLock::new();

fn store() -> &'static HistoryStore {
    STORE.get_or_init(HistoryStore::open)
}

fn iso_to_epoch(timestamp: &str) -> Option<i64> {
    chrono::DateTime::parse_from_rfc3339(timestamp)
        .ok()
        .map(|value| value.timestamp())
}

/// Resolve only identity the provider itself exposed with this snapshot.
/// Profile ordering is presentation state, not evidence that a refresh came
/// from that profile account. The digest is domain-separated and only the
/// digest reaches history storage; the raw email/organization never does.
fn account_identity(snapshot: &ProviderUsageSnapshot) -> (String, &'static str) {
    let email = snapshot
        .account_email
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_lowercase);
    let organization = snapshot
        .account_organization
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_lowercase);

    if let Some(email) = email {
        // Length-prefix each provider-controlled component so embedded
        // separator characters cannot make two distinct identities hash to
        // the same structured input. Organization absence is explicit and
        // differs from any present organization value.
        let organization_component = organization.as_deref().map_or_else(
            || "absent".to_string(),
            |value| format!("present:{}:{value}", value.len()),
        );
        let material = format!(
            "quotalis-history-account-v2\0provider:{}:{}\0email:{}:{}\0organization:{organization_component}",
            snapshot.provider_id.len(),
            snapshot.provider_id,
            email.len(),
            email,
        );
        return (
            format!("observed:{}", sha256_hex(material.as_bytes())),
            "observed",
        );
    }

    (format!("provider:{}", snapshot.provider_id), "unresolved")
}

fn valid_quota_window(window: &crate::commands::RateWindowSnapshot) -> bool {
    !window.is_informational
        && window.used_percent.is_finite()
        && (0.0..=100.0).contains(&window.used_percent)
        && window.remaining_percent.is_finite()
        && (0.0..=100.0).contains(&window.remaining_percent)
        && (window.used_percent + window.remaining_percent - 100.0).abs() <= 0.1
}

fn sample_for_window(
    account_key: &str,
    account_scope: &str,
    provider_cli: &str,
    window_key: String,
    window_label: Option<String>,
    window: &crate::commands::RateWindowSnapshot,
    captured_at: i64,
) -> UsageSample {
    UsageSample {
        account_id: account_key.to_string(),
        account_scope: Some(account_scope.to_string()),
        provider: provider_cli.to_string(),
        window_id: Some(window_key.clone()),
        window_key: Some(window_key),
        window_label,
        window_minutes: window.window_minutes,
        used_percent: window.used_percent,
        remaining_percent: window.remaining_percent,
        cost_used: None,
        cost_currency_code: None,
        cost_measurement_kind: None,
        monetary_quantity_kind: None,
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
    if snapshot.error.is_some() || snapshot.error_state != ProviderStateKind::Ready {
        return None;
    }
    let (account_key, account_scope) = account_identity(snapshot);
    let captured_at = iso_to_epoch(&snapshot.updated_at)?;

    let mut samples = Vec::new();
    let mut push_window = |window_key: String,
                           window_label: Option<String>,
                           window: &crate::commands::RateWindowSnapshot| {
        if valid_quota_window(window) {
            samples.push(sample_for_window(
                &account_key,
                account_scope,
                &snapshot.provider_id,
                window_key,
                window_label,
                window,
                captured_at,
            ));
        }
    };

    push_window(
        "primary".to_string(),
        snapshot.primary_label.clone(),
        &snapshot.primary,
    );
    if let Some(window) = &snapshot.secondary {
        push_window(
            "secondary".to_string(),
            snapshot.secondary_label.clone(),
            window,
        );
    }
    if let Some(window) = &snapshot.model_specific {
        push_window("modelSpecific".to_string(), None, window);
    }
    if let Some(window) = &snapshot.tertiary {
        push_window(
            "tertiary".to_string(),
            snapshot.tertiary_label.clone(),
            window,
        );
    }
    for extra in &snapshot.extra_rate_windows {
        if !extra.id.trim().is_empty() {
            push_window(
                format!("extra:{}", extra.id),
                Some(extra.title.clone()),
                &extra.window,
            );
        }
    }
    // Cost is a distinct fact from quota percentage -- recorded as its own
    // sample (window_id "cost") so dashboard spend queries never mix a
    // dollar amount into a percentage aggregate, and so a provider with no
    // cost data simply has no "cost" rows rather than a fabricated 0.
    if let Some(cost) = &snapshot.cost {
        let (quantity_kind, measurement_kind) =
            classify_monetary_observation(&snapshot.provider_id, &cost.period);
        samples.push(UsageSample {
            account_id: account_key.clone(),
            account_scope: Some(account_scope.to_string()),
            provider: snapshot.provider_id.clone(),
            window_id: Some("cost".to_string()),
            window_key: Some("cost".to_string()),
            window_label: Some(cost.period.clone()),
            window_minutes: None,
            used_percent: 0.0,
            remaining_percent: 0.0,
            cost_used: Some(cost.used),
            // Phase 4A: currency_code is a required (non-Option) field on
            // every provider's CostSnapshot, so every cost sample recorded
            // from here on carries its real currency -- never guessed,
            // never defaulted to USD. Only pre-Phase-4A rows (written
            // before this column existed) read back with `None`.
            cost_currency_code: Some(cost.currency_code.clone()),
            // Phase 4A.1: classify BOTH orthogonal dimensions (what the
            // number represents, and its temporal shape) using the
            // provider identity AND the adapter's own `period` label --
            // the label is real evidence the adapter itself produced
            // (e.g. it is what lets Codex's genuinely different "Credits"
            // vs "Monthly credits" cases resolve correctly instead of
            // being guessed by provider ID alone). See
            // `classify_monetary_observation`'s doc comment.
            cost_measurement_kind: Some(measurement_kind.as_str().to_string()),
            monetary_quantity_kind: Some(quantity_kind.as_str().to_string()),
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
    fn account_identity_hashes_provider_reported_identity_without_exposing_it() {
        let mut snapshot = test_snapshot();
        snapshot.account_email = Some(" Person@Example.COM ".to_string());
        snapshot.account_organization = Some(" Acme Org ".to_string());
        let (key, scope) = account_identity(&snapshot);
        assert_eq!(scope, "observed");
        assert!(key.starts_with("observed:"));
        assert!(!key.contains("person"));
        assert!(!key.contains("example.com"));
        assert!(!key.contains("acme"));

        let mut same = test_snapshot();
        same.account_email = Some("person@example.com".to_string());
        same.account_organization = Some("acme org".to_string());
        assert_eq!(account_identity(&same).0, key);

        let mut different_organization = same.clone();
        different_organization.account_organization = Some("other org".to_string());
        assert_ne!(account_identity(&different_organization).0, key);

        let mut absent_organization = same;
        absent_organization.account_organization = None;
        assert_ne!(account_identity(&absent_organization).0, key);
    }

    #[test]
    fn missing_provider_identity_stays_unresolved() {
        let snapshot = test_snapshot();
        assert_eq!(
            account_identity(&snapshot),
            ("provider:codex".to_string(), "unresolved")
        );

        let mut organization_only = test_snapshot();
        organization_only.account_organization = Some("shared organization".to_string());
        assert_eq!(
            account_identity(&organization_only),
            ("provider:codex".to_string(), "unresolved")
        );
    }

    #[test]
    fn iso_parsing_handles_rfc3339() {
        assert_eq!(iso_to_epoch("2026-09-02T00:00:00Z"), Some(1_788_307_200));
        assert_eq!(iso_to_epoch("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(
            iso_to_epoch("2026-09-02T12:34:56.789Z"),
            Some(1_788_352_496)
        );
        assert_eq!(
            iso_to_epoch("2026-09-02T03:00:00+03:00"),
            Some(1_788_307_200)
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
    fn unhealthy_snapshots_are_not_recorded() {
        let mut snapshot = test_snapshot();
        snapshot.error_state = ProviderStateKind::Unknown;
        assert!(samples_for_snapshot(&snapshot).is_none());
    }

    #[test]
    fn invalid_capture_timestamp_is_not_replaced_with_wall_clock_time() {
        let mut snapshot = test_snapshot();
        snapshot.updated_at = "not-a-timestamp".to_string();
        assert!(samples_for_snapshot(&snapshot).is_none());
    }

    #[test]
    fn records_each_physical_window_with_stable_slot_identity() {
        let mut snapshot = test_snapshot();
        let mut secondary = snapshot.primary.clone();
        secondary.window_minutes = Some(10_080);
        secondary.used_percent = 20.0;
        secondary.remaining_percent = 80.0;
        snapshot.secondary = Some(secondary.clone());
        snapshot.secondary_label = Some("Weekly display label".to_string());
        snapshot.model_specific = Some(secondary.clone());
        snapshot.tertiary = Some(secondary.clone());
        snapshot.tertiary_label = Some("Third display label".to_string());
        snapshot.extra_rate_windows = vec![crate::commands::NamedRateWindowSnapshot {
            id: "credits".to_string(),
            title: "Credits display label".to_string(),
            window: secondary,
        }];

        let samples = samples_for_snapshot(&snapshot).expect("healthy snapshot");
        let keys: Vec<_> = samples
            .iter()
            .filter_map(|sample| sample.window_key.as_deref())
            .collect();
        assert_eq!(
            keys,
            [
                "primary",
                "secondary",
                "modelSpecific",
                "tertiary",
                "extra:credits"
            ]
        );
        assert!(!keys.contains(&"selected"));
        assert!(samples.iter().all(|sample| {
            sample.account_scope.as_deref() == Some("unresolved")
                && sample.account_id == "provider:codex"
        }));
    }

    #[test]
    fn informational_and_invalid_percentage_windows_are_omitted() {
        let mut snapshot = test_snapshot();
        snapshot.primary.is_informational = true;
        let mut invalid = snapshot.primary.clone();
        invalid.is_informational = false;
        invalid.used_percent = 101.0;
        snapshot.secondary = Some(invalid);
        let mut non_finite = snapshot.primary.clone();
        non_finite.is_informational = false;
        non_finite.used_percent = f64::NAN;
        snapshot.model_specific = Some(non_finite);
        let mut inconsistent_total = snapshot.primary.clone();
        inconsistent_total.is_informational = false;
        inconsistent_total.used_percent = 50.0;
        inconsistent_total.remaining_percent = 40.0;
        snapshot.tertiary = Some(inconsistent_total);

        let samples = samples_for_snapshot(&snapshot).expect("healthy snapshot");
        assert!(samples.is_empty());
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
