use std::collections::HashMap;
use std::sync::Mutex;

use quotalis_core::codex_accounts::{
    AccountStore, AccountUsageSnapshot, CodexAccount, CodexAccountSource, SnapshotStore,
    UsageWindowSnapshot,
};
use quotalis_core::core::{ProviderStateKind, RateWindowCadence};
use quotalis_core::settings::Settings;
use serde::Serialize;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;

use super::{
    ProviderUsagePresentationSnapshot, ProviderUsageSnapshot, RateWindowSnapshot,
    filter_hidden_codex_spark_rows,
};

/// One independently addressable provider/account lane.
///
/// `provider_id` always remains the canonical provider brand. Account identity
/// is carried separately so a second Codex account never becomes a synthetic
/// provider brand such as `codex-2`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInstanceSnapshot {
    pub instance_id: String,
    pub provider_id: String,
    pub account_id: Option<String>,
    pub account_ordinal: Option<u32>,
    pub account_label: Option<String>,
    pub reset_facts: Option<quotalis_core::core::ProviderResetFacts>,
    pub snapshot: Option<ProviderUsagePresentationSnapshot>,
}

/// Read the live provider cache and the last-known per-account Codex snapshots
/// without mutating either store or touching authentication state.
#[tauri::command]
pub fn get_provider_instances(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ProviderInstanceSnapshot>, String> {
    let provider_cache = state
        .lock()
        .map_err(|error| error.to_string())?
        .provider_cache
        .clone();
    let settings = Settings::load();
    // Discovery can create transient UUIDs. Only explicitly persisted account
    // identities are addressable across later refresh/reorder commands.
    let accounts = AccountStore::new()
        .load_accounts()
        .map_err(|error| error.to_string())?;
    let account_snapshots = SnapshotStore::new()
        .load()
        .map_err(|error| error.to_string())?;
    Ok(build_provider_instances(
        &provider_cache,
        &accounts,
        &account_snapshots,
        &settings,
    ))
}

pub(crate) fn build_provider_instances(
    provider_cache: &[ProviderUsageSnapshot],
    accounts: &[CodexAccount],
    account_snapshots: &HashMap<Uuid, AccountUsageSnapshot>,
    settings: &Settings,
) -> Vec<ProviderInstanceSnapshot> {
    let has_ambient_codex_lane = provider_cache
        .iter()
        .any(|snapshot| snapshot.provider_id == "codex");
    let ambient_account_id = has_ambient_codex_lane
        .then(|| unique_explicit_ambient_account_id(accounts))
        .flatten();

    let mut instances: Vec<ProviderInstanceSnapshot> = provider_cache
        .iter()
        .map(|snapshot| {
            let is_codex = snapshot.provider_id == "codex";
            let mut snapshot = snapshot.clone();
            filter_hidden_codex_spark_rows(&mut snapshot, settings.codex_spark_usage_visible());
            ProviderInstanceSnapshot {
                instance_id: snapshot.provider_id.clone(),
                provider_id: snapshot.provider_id.clone(),
                // The cache does not retain the provider-account id used for
                // its fetch. A login switch can therefore make current auth
                // identity newer than the cached quota. Keep this ordinary
                // lane unattributed rather than attaching a stale reading to
                // the wrong account.
                account_id: None,
                account_ordinal: is_codex.then_some(1),
                account_label: None,
                reset_facts: snapshot.reset_facts.clone(),
                snapshot: Some(ProviderUsagePresentationSnapshot::new(snapshot, settings)),
            }
        })
        .collect();

    let mut additional_accounts: Vec<&CodexAccount> = accounts
        .iter()
        .filter(|account| Some(account.id) != ambient_account_id)
        .collect();
    additional_accounts.sort_by(|left, right| {
        left.created_at
            .cmp(&right.created_at)
            .then_with(|| left.id.cmp(&right.id))
    });

    for (index, account) in additional_accounts.into_iter().enumerate() {
        let ordinal = u32::try_from(index).unwrap_or(u32::MAX).saturating_add(2);
        instances.push(ProviderInstanceSnapshot {
            instance_id: format!("codex:{}", account.id),
            provider_id: "codex".to_string(),
            account_id: Some(account.id.to_string()),
            account_ordinal: Some(ordinal),
            account_label: safe_account_label(account, account_snapshots, settings),
            reset_facts: account_snapshots
                .get(&account.id)
                .filter(|snapshot| !provider_account_ids_conflict(account, snapshot))
                .and_then(|snapshot| snapshot.reset_facts.clone()),
            snapshot: account_snapshots
                .get(&account.id)
                .and_then(|snapshot| account_usage_presentation(account, snapshot, settings)),
        });
    }

    instances
}

/// The ordinary Codex provider always reads the ambient Codex home. A unique
/// account whose source is explicitly Ambient is therefore the only safe
/// structural deduplication available. The cached quota itself remains
/// unattributed because the cache does not retain the provider-account id used
/// for its fetch and may predate a login switch.
fn unique_explicit_ambient_account_id(accounts: &[CodexAccount]) -> Option<Uuid> {
    unique_account_id(
        accounts
            .iter()
            .filter(|account| account.source == CodexAccountSource::Ambient),
    )
}

fn unique_account_id<'a>(mut accounts: impl Iterator<Item = &'a CodexAccount>) -> Option<Uuid> {
    let first = accounts.next()?.id;
    accounts.next().is_none().then_some(first)
}

fn normalize_provider_account_id(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_ascii_lowercase)
}

fn provider_account_ids_conflict(account: &CodexAccount, snapshot: &AccountUsageSnapshot) -> bool {
    let stored_id = normalize_provider_account_id(account.provider_account_id.as_deref());
    let observed_id = normalize_provider_account_id(snapshot.provider_account_id.as_deref());
    matches!((stored_id, observed_id), (Some(stored), Some(observed)) if stored != observed)
}

fn safe_account_label(
    account: &CodexAccount,
    snapshots: &HashMap<Uuid, AccountUsageSnapshot>,
    settings: &Settings,
) -> Option<String> {
    account
        .nickname
        .as_deref()
        .and_then(clean_label)
        .or_else(|| {
            (!settings.hide_personal_info)
                .then(|| {
                    account
                        .email_hint
                        .as_deref()
                        .and_then(clean_label)
                        .or_else(|| {
                            snapshots
                                .get(&account.id)
                                .filter(|snapshot| {
                                    !provider_account_ids_conflict(account, snapshot)
                                })
                                .and_then(|snapshot| snapshot.email.as_deref())
                                .and_then(clean_label)
                        })
                })
                .flatten()
        })
}

fn clean_label(value: &str) -> Option<String> {
    let value = value.trim();
    (!value.is_empty() && value.len() <= 200 && !value.chars().any(char::is_control))
        .then(|| value.to_string())
}

fn account_usage_presentation(
    account: &CodexAccount,
    usage: &AccountUsageSnapshot,
    settings: &Settings,
) -> Option<ProviderUsagePresentationSnapshot> {
    if provider_account_ids_conflict(account, usage) {
        return None;
    }
    let primary = usage.primary_window.as_ref().map(account_rate_window);
    let secondary = usage.secondary_window.as_ref().map(account_rate_window);
    if primary.as_ref().is_some_and(Result::is_err)
        || secondary.as_ref().is_some_and(Result::is_err)
    {
        return None;
    }
    let primary = primary.transpose().ok().flatten();
    let secondary = secondary.transpose().ok().flatten();
    let (primary, primary_label, secondary, secondary_label) = match (primary, secondary) {
        (Some(primary), secondary) => (
            primary,
            usage.primary_window.as_ref().map(window_label),
            secondary,
            usage.secondary_window.as_ref().map(window_label),
        ),
        (None, Some(secondary)) => (
            secondary,
            usage.secondary_window.as_ref().map(window_label),
            None,
            None,
        ),
        (None, None) => return None,
    };

    Some(ProviderUsagePresentationSnapshot::new(
        ProviderUsageSnapshot {
            provider_id: "codex".to_string(),
            display_name: "Codex".to_string(),
            primary,
            primary_label,
            secondary,
            secondary_label,
            model_specific: None,
            tertiary: None,
            tertiary_label: None,
            extra_rate_windows: Vec::new(),
            reset_facts: usage.reset_facts.clone(),
            cost: None,
            plan_name: usage.plan.clone(),
            account_email: None,
            source_label: "codex-account-snapshot".to_string(),
            updated_at: usage
                .updated_at
                .to_rfc3339_opts(chrono::SecondsFormat::AutoSi, true),
            error: None,
            error_state: ProviderStateKind::Ready,
            pace: None,
            account_organization: None,
            tray_status_label: None,
            fetch_duration_ms: None,
            wayfinder_usage: None,
            session_equivalent_forecast: None,
        },
        settings,
    ))
}

fn account_rate_window(window: &UsageWindowSnapshot) -> Result<RateWindowSnapshot, ()> {
    if !window.used_percent.is_finite()
        || !(0.0..=100.0).contains(&window.used_percent)
        || window.limit_window_seconds <= 0
    {
        return Err(());
    }
    let window_minutes = u32::try_from(window.limit_window_seconds / 60)
        .ok()
        .filter(|minutes| *minutes > 0)
        .ok_or(())?;
    Ok(RateWindowSnapshot {
        used_percent: window.used_percent,
        remaining_percent: 100.0 - window.used_percent,
        window_minutes: Some(window_minutes),
        resets_at: window.reset_at.map(|reset| reset.to_rfc3339()),
        reset_description: None,
        is_exhausted: window.used_percent >= 100.0,
        is_informational: false,
        reserve_percent: None,
        reserve_description: None,
        reserve_will_last_to_reset: false,
        reserve_eta_seconds: None,
    })
}

fn window_label(window: &UsageWindowSnapshot) -> String {
    match RateWindowCadence::from_seconds(window.limit_window_seconds) {
        RateWindowCadence::Session => "Session",
        RateWindowCadence::Weekly => "Weekly",
        RateWindowCadence::Monthly => "Monthly",
        RateWindowCadence::Unknown => "Limit",
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use chrono::{TimeZone, Utc};
    use quotalis_core::core::ProviderId;
    use quotalis_core::settings::MetricPreference;

    use super::*;
    use crate::commands::NamedRateWindowSnapshot;

    fn account(
        id: &str,
        created_second: u32,
        source: CodexAccountSource,
        provider_account_id: Option<&str>,
    ) -> CodexAccount {
        let created_at = Utc
            .with_ymd_and_hms(2026, 1, 1, 0, 0, created_second)
            .unwrap();
        CodexAccount::new(
            Uuid::parse_str(id).unwrap(),
            None,
            Some(format!("{id}@example.com")),
            None,
            provider_account_id.map(str::to_string),
            std::path::PathBuf::from(format!("/private/{id}")),
            source,
            created_at,
            created_at,
            Some(created_at),
        )
    }

    fn account_usage(provider_account_id: &str, used_percent: f64) -> AccountUsageSnapshot {
        AccountUsageSnapshot {
            reset_facts: None,
            email: Some(format!("{provider_account_id}@example.com")),
            provider_account_id: Some(provider_account_id.to_string()),
            plan: Some("pro".to_string()),
            allowed: Some(true),
            limit_reached: Some(false),
            primary_window: Some(UsageWindowSnapshot::new(
                used_percent,
                Some(Utc.with_ymd_and_hms(2026, 1, 2, 0, 0, 0).unwrap()),
                18_000,
            )),
            secondary_window: Some(UsageWindowSnapshot::new(
                used_percent / 2.0,
                Some(Utc.with_ymd_and_hms(2026, 1, 8, 0, 0, 0).unwrap()),
                604_800,
            )),
            credits: None,
            updated_at: Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap(),
        }
    }

    fn rate_window(used_percent: f64) -> RateWindowSnapshot {
        RateWindowSnapshot {
            used_percent,
            remaining_percent: 100.0 - used_percent,
            window_minutes: Some(300),
            resets_at: None,
            reset_description: None,
            is_exhausted: false,
            is_informational: false,
            reserve_percent: None,
            reserve_description: None,
            reserve_will_last_to_reset: false,
            reserve_eta_seconds: None,
        }
    }

    fn provider_snapshot(provider_id: &str, used_percent: f64) -> ProviderUsageSnapshot {
        ProviderUsageSnapshot {
            provider_id: provider_id.to_string(),
            display_name: provider_id.to_string(),
            primary: rate_window(used_percent),
            primary_label: Some("Session".to_string()),
            secondary: None,
            secondary_label: None,
            model_specific: None,
            tertiary: None,
            tertiary_label: None,
            extra_rate_windows: Vec::new(),
            reset_facts: None,
            cost: None,
            plan_name: None,
            account_email: None,
            source_label: "test".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
            error: None,
            error_state: ProviderStateKind::Ready,
            pace: None,
            account_organization: None,
            tray_status_label: None,
            fetch_duration_ms: None,
            wayfinder_usage: None,
            session_equivalent_forecast: None,
        }
    }

    #[test]
    fn two_accounts_keep_disjoint_usage_windows() {
        let first = account(
            "11111111-1111-1111-1111-111111111111",
            1,
            CodexAccountSource::Ambient,
            Some("acct-1"),
        );
        let second = account(
            "22222222-2222-2222-2222-222222222222",
            2,
            CodexAccountSource::ManagedByApp,
            Some("acct-2"),
        );
        let snapshots = HashMap::from([
            (first.id, account_usage("acct-1", 21.0)),
            (second.id, account_usage("acct-2", 82.0)),
        ]);

        let instances = build_provider_instances(
            &[provider_snapshot("codex", 21.0)],
            &[first.clone(), second.clone()],
            &snapshots,
            &Settings::default(),
        );

        assert_eq!(instances.len(), 2);
        assert_eq!(instances[0].instance_id, "codex");
        assert!(instances[0].account_id.is_none());
        assert_eq!(instances[0].account_ordinal, Some(1));
        assert_eq!(
            instances[0]
                .snapshot
                .as_ref()
                .unwrap()
                .snapshot
                .primary
                .used_percent,
            21.0
        );
        assert_eq!(instances[1].instance_id, format!("codex:{}", second.id));
        assert_eq!(instances[1].provider_id, "codex");
        assert_eq!(instances[1].account_ordinal, Some(2));
        assert_eq!(
            instances[1]
                .snapshot
                .as_ref()
                .unwrap()
                .snapshot
                .primary
                .used_percent,
            82.0
        );
        assert!(
            instances[1]
                .snapshot
                .as_ref()
                .unwrap()
                .snapshot
                .cost
                .is_none()
        );
        assert!(
            instances[1]
                .snapshot
                .as_ref()
                .unwrap()
                .snapshot
                .pace
                .is_none()
        );
    }

    #[test]
    fn account_without_usage_is_present_without_a_fabricated_zero() {
        let current = account(
            "11111111-1111-1111-1111-111111111111",
            1,
            CodexAccountSource::Ambient,
            Some("acct-1"),
        );
        let missing = account(
            "22222222-2222-2222-2222-222222222222",
            2,
            CodexAccountSource::ManagedByApp,
            Some("acct-2"),
        );
        let instances = build_provider_instances(
            &[provider_snapshot("codex", 30.0)],
            &[current, missing.clone()],
            &HashMap::new(),
            &Settings::default(),
        );

        let missing_instance = instances
            .iter()
            .find(|instance| instance.account_id == Some(missing.id.to_string()))
            .unwrap();
        assert!(missing_instance.snapshot.is_none());
    }

    #[test]
    fn invalid_percentage_fails_closed_for_the_account_snapshot() {
        let account = account(
            "22222222-2222-2222-2222-222222222222",
            2,
            CodexAccountSource::ManagedByApp,
            Some("acct-2"),
        );
        let mut usage = account_usage("acct-2", 110.0);
        usage.secondary_window = Some(UsageWindowSnapshot::new(f64::NAN, None, 604_800));
        assert!(account_usage_presentation(&account, &usage, &Settings::default()).is_none());
    }

    #[test]
    fn extra_account_identity_and_order_are_stable_by_creation_then_id() {
        let later = account(
            "33333333-3333-3333-3333-333333333333",
            3,
            CodexAccountSource::ManagedByApp,
            Some("acct-3"),
        );
        let same_time_high_id = account(
            "22222222-2222-2222-2222-222222222222",
            2,
            CodexAccountSource::ManagedByApp,
            Some("acct-2"),
        );
        let same_time_low_id = account(
            "11111111-1111-1111-1111-111111111111",
            2,
            CodexAccountSource::ManagedByApp,
            Some("acct-1"),
        );
        let instances = build_provider_instances(
            &[provider_snapshot("claude", 10.0)],
            &[later, same_time_high_id.clone(), same_time_low_id.clone()],
            &HashMap::new(),
            &Settings::default(),
        );

        assert_eq!(instances[0].instance_id, "claude");
        assert_eq!(
            instances[1].instance_id,
            format!("codex:{}", same_time_low_id.id)
        );
        assert_eq!(instances[1].account_ordinal, Some(2));
        assert_eq!(
            instances[2].instance_id,
            format!("codex:{}", same_time_high_id.id)
        );
        assert_eq!(instances[2].account_ordinal, Some(3));
        assert_eq!(instances[3].account_ordinal, Some(4));
    }

    #[test]
    fn managed_identity_does_not_label_or_replace_the_cached_ambient_lane() {
        let current = account(
            "11111111-1111-1111-1111-111111111111",
            1,
            CodexAccountSource::ManagedByApp,
            Some("ACCOUNT-1"),
        );
        let instances = build_provider_instances(
            &[provider_snapshot("codex", 10.0)],
            std::slice::from_ref(&current),
            &HashMap::new(),
            &Settings::default(),
        );

        assert_eq!(instances.len(), 2);
        assert_eq!(instances[0].instance_id, "codex");
        assert!(instances[0].account_id.is_none());
        assert_eq!(instances[1].instance_id, format!("codex:{}", current.id));
    }

    #[test]
    fn unknown_active_identity_never_deduplicates_by_email_or_nickname() {
        let mut account = account(
            "11111111-1111-1111-1111-111111111111",
            1,
            CodexAccountSource::ManagedByApp,
            None,
        );
        account.nickname = Some("Same visible label".to_string());
        account.email_hint = Some("same@example.com".to_string());
        let mut ambient = provider_snapshot("codex", 10.0);
        ambient.account_email = Some("same@example.com".to_string());
        let instances = build_provider_instances(
            &[ambient],
            std::slice::from_ref(&account),
            &HashMap::new(),
            &Settings::default(),
        );

        assert_eq!(instances.len(), 2);
        assert!(instances[0].account_id.is_none());
        assert_eq!(instances[1].instance_id, format!("codex:{}", account.id));
    }

    #[test]
    fn unique_explicit_ambient_source_deduplicates_without_display_identity() {
        let ambient = account(
            "11111111-1111-1111-1111-111111111111",
            1,
            CodexAccountSource::Ambient,
            None,
        );
        let instances = build_provider_instances(
            &[provider_snapshot("codex", 10.0)],
            std::slice::from_ref(&ambient),
            &HashMap::new(),
            &Settings::default(),
        );

        assert_eq!(instances.len(), 1);
        assert!(instances[0].account_id.is_none());
    }

    #[test]
    fn conflicting_provider_account_ids_fail_closed() {
        let current = account(
            "11111111-1111-1111-1111-111111111111",
            1,
            CodexAccountSource::ManagedByApp,
            Some("stored-id"),
        );
        let snapshots = HashMap::from([(current.id, account_usage("different-id", 25.0))]);
        let instances = build_provider_instances(
            &[provider_snapshot("codex", 25.0)],
            std::slice::from_ref(&current),
            &snapshots,
            &Settings::default(),
        );

        assert_eq!(instances.len(), 2);
        assert!(instances[0].account_id.is_none());
        assert!(instances[1].snapshot.is_none());
    }

    #[test]
    fn account_labels_never_fall_back_to_private_home_paths() {
        let anonymous = account(
            "11111111-1111-1111-1111-111111111111",
            1,
            CodexAccountSource::ManagedByApp,
            None,
        );
        let settings = Settings {
            hide_personal_info: true,
            ..Settings::default()
        };

        assert!(safe_account_label(&anonymous, &HashMap::new(), &settings).is_none());
    }

    #[test]
    fn bridge_serializes_the_required_camel_case_contract() {
        let bridge = ProviderInstanceSnapshot {
            instance_id: "codex:11111111-1111-1111-1111-111111111111".to_string(),
            provider_id: "codex".to_string(),
            account_id: Some("11111111-1111-1111-1111-111111111111".to_string()),
            account_ordinal: Some(2),
            account_label: Some("Work".to_string()),
            reset_facts: None,
            snapshot: None,
        };

        let value = serde_json::to_value(bridge).unwrap();
        assert!(value.get("instanceId").is_some());
        assert!(value.get("providerId").is_some());
        assert!(value.get("accountId").is_some());
        assert!(value.get("accountOrdinal").is_some());
        assert!(value.get("accountLabel").is_some());
    }

    #[test]
    fn ordinary_cache_keeps_metric_selection_and_hides_disabled_codex_spark_rows() {
        let mut cached = provider_snapshot("codex", 10.0);
        cached.secondary = Some(rate_window(70.0));
        cached.secondary_label = Some("Weekly".to_string());
        cached.extra_rate_windows.push(NamedRateWindowSnapshot {
            id: "codex-spark".to_string(),
            title: "Codex Spark".to_string(),
            window: rate_window(55.0),
        });
        let mut settings = Settings::default();
        settings.set_provider_metric(ProviderId::Codex, MetricPreference::Weekly);
        settings.set_codex_spark_usage_visible(false);

        let instances = build_provider_instances(&[cached], &[], &HashMap::new(), &settings);
        let presentation = instances[0].snapshot.as_ref().unwrap();

        assert_eq!(presentation.selected_metric.used_percent, 70.0);
        assert!(presentation.snapshot.extra_rate_windows.is_empty());
    }
}
