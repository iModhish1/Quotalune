//! Dashboard data bridge: exposes `quotalis_core::dashboard_data::DashboardSnapshot`
//! (the one normalized data contract every Dashboard widget should consume)
//! to the frontend as a single typed command. No widget-specific commands
//! -- one snapshot, targeted by range/timezone/provider filter.

use quotalis_core::dashboard_data::{
    self, CostAvailability, CostContract, CostMeasurementKind, CostOrigin, DashboardRangeKind,
    DashboardSnapshot, DataAvailability, MonetaryQuantityKind, PricingStatus, ProviderSummary,
    QuotaHistoryPoint, SpendDailyPoint, UsageDailyPoint,
};
use quotalis_core::history::HistoryStore;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataAvailabilityBridge {
    pub first_sample_at: Option<i64>,
    pub last_sample_at: Option<i64>,
    pub sample_count: usize,
    pub has_cost_data: bool,
    pub has_token_data: bool,
    pub has_request_data: bool,
    pub has_model_data: bool,
}

impl From<DataAvailability> for DataAvailabilityBridge {
    fn from(a: DataAvailability) -> Self {
        Self {
            first_sample_at: a.first_sample_at,
            last_sample_at: a.last_sample_at,
            sample_count: a.sample_count,
            has_cost_data: a.has_cost_data,
            has_token_data: a.has_token_data,
            has_request_data: a.has_request_data,
            has_model_data: a.has_model_data,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSummaryBridge {
    pub provider: String,
    pub account_id: String,
    pub used_percent: f64,
    pub remaining_percent: f64,
    /// Authoritative reset instant as an ISO-8601 string -- the Reset
    /// Presentation system owns display formatting; this is the raw
    /// instant only.
    pub resets_at: Option<String>,
    pub last_sample_at: i64,
}

impl From<ProviderSummary> for ProviderSummaryBridge {
    fn from(p: ProviderSummary) -> Self {
        Self {
            provider: p.provider,
            account_id: p.account_id,
            used_percent: p.used_percent,
            remaining_percent: p.remaining_percent,
            resets_at: p.resets_at.and_then(epoch_to_iso),
            last_sample_at: p.last_sample_at,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageTrendPointBridge {
    pub provider: String,
    pub account_id: String,
    pub bucket_start: i64,
    pub used_percent: f64,
    pub remaining_percent: f64,
    pub sample_count: u32,
}

impl From<UsageDailyPoint> for UsageTrendPointBridge {
    fn from(p: UsageDailyPoint) -> Self {
        Self {
            provider: p.provider,
            account_id: p.account_id,
            bucket_start: p.bucket_start,
            used_percent: p.used_percent,
            remaining_percent: p.remaining_percent,
            sample_count: p.sample_count,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaHistoryPointBridge {
    pub provider: String,
    pub account_id: String,
    pub account_scope: &'static str,
    pub window_key: String,
    pub window_label: Option<String>,
    pub window_minutes: Option<u32>,
    pub bucket_start: i64,
    pub observed_at: i64,
    pub used_percent: f64,
    pub remaining_percent: f64,
    pub resets_at: Option<i64>,
    pub sample_count: u32,
    pub has_conflicting_samples: bool,
    pub counter_decreased: bool,
}

impl From<QuotaHistoryPoint> for QuotaHistoryPointBridge {
    fn from(p: QuotaHistoryPoint) -> Self {
        Self {
            provider: p.provider,
            account_id: p.account_id,
            account_scope: p.account_scope.as_str(),
            window_key: p.window_key,
            window_label: p.window_label,
            window_minutes: p.window_minutes,
            bucket_start: p.bucket_start,
            observed_at: p.observed_at,
            used_percent: p.used_percent,
            remaining_percent: p.remaining_percent,
            resets_at: p.resets_at,
            sample_count: p.sample_count,
            has_conflicting_samples: p.has_conflicting_samples,
            counter_decreased: p.counter_decreased,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpendTrendPointBridge {
    pub provider: String,
    pub account_id: String,
    pub bucket_start: i64,
    /// A reading in whatever this bucket's `measurement_kind` says it is
    /// -- ProviderReported always (see `DashboardSnapshotBridge`'s
    /// `cost_contract` for the origin), never a Quotalis-computed figure.
    pub cost_used: f64,
    /// ISO 4217 currency code, `null` for a legacy (pre-Phase-4A) sample.
    pub currency_code: Option<String>,
    /// "cumulative" | "point_in_time" | "delta" | "unknown" -- see
    /// `quotalis_core::dashboard_data::CostMeasurementKind`. Frontend
    /// code must not combine values across buckets/series with different
    /// measurement kinds.
    pub measurement_kind: &'static str,
    /// "spend" | "balance" | "credits" | "unknown" -- see
    /// `quotalis_core::dashboard_data::MonetaryQuantityKind`, the
    /// orthogonal dimension to `measurement_kind`. The Spend KPI may
    /// consume ONLY buckets where this is `"spend"`.
    pub quantity_kind: &'static str,
}

impl From<SpendDailyPoint> for SpendTrendPointBridge {
    fn from(p: SpendDailyPoint) -> Self {
        Self {
            provider: p.provider,
            account_id: p.account_id,
            bucket_start: p.bucket_start,
            cost_used: p.cost_used,
            currency_code: p.currency_code,
            measurement_kind: p.measurement_kind.as_str(),
            quantity_kind: p.quantity_kind.as_str(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CostContractBridge {
    pub origin: &'static str,
    pub quantity_kind: &'static str,
    pub measurement_kind: &'static str,
    pub currency_code: Option<String>,
    pub period: String,
    pub availability: &'static str,
    pub pricing_status: &'static str,
}

impl From<CostContract> for CostContractBridge {
    fn from(c: CostContract) -> Self {
        Self {
            origin: match c.origin {
                CostOrigin::ProviderReported => "providerReported",
                CostOrigin::LocallyEstimated => "locallyEstimated",
                CostOrigin::UserConfigured => "userConfigured",
                CostOrigin::Unavailable => "unavailable",
            },
            quantity_kind: match c.quantity_kind {
                MonetaryQuantityKind::Spend => "spend",
                MonetaryQuantityKind::Balance => "balance",
                MonetaryQuantityKind::Credits => "credits",
                MonetaryQuantityKind::Unknown => "unknown",
            },
            measurement_kind: match c.measurement_kind {
                CostMeasurementKind::Cumulative => "cumulative",
                CostMeasurementKind::Delta => "delta",
                CostMeasurementKind::PointInTime => "pointInTime",
                CostMeasurementKind::Unknown => "unknown",
            },
            currency_code: c.currency_code,
            period: c.period,
            availability: match c.availability {
                CostAvailability::Available => "available",
                CostAvailability::LegacyAmbiguous => "legacyAmbiguous",
                CostAvailability::Unavailable => "unavailable",
            },
            pricing_status: match c.pricing_status {
                PricingStatus::NotRequired => "notRequired",
                PricingStatus::Unverified => "unverified",
                PricingStatus::Verified => "verified",
            },
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSnapshotBridge {
    pub generated_at: i64,
    pub range_since: i64,
    pub range_until: i64,
    pub grain: &'static str,
    pub timezone: String,
    pub availability: DataAvailabilityBridge,
    pub providers: Vec<ProviderSummaryBridge>,
    pub usage_trend: Vec<UsageTrendPointBridge>,
    pub spend_trend: Vec<SpendTrendPointBridge>,
    pub quota_history: Vec<QuotaHistoryPointBridge>,
    /// Phase 4A: the formal, structured description of what `spend_trend`
    /// means -- origin/measurement kind/currency/period/availability/
    /// pricing status. The frontend must read this instead of guessing
    /// semantics from the raw numbers.
    pub cost_contract: CostContractBridge,
}

impl From<DashboardSnapshot> for DashboardSnapshotBridge {
    fn from(s: DashboardSnapshot) -> Self {
        Self {
            generated_at: s.generated_at,
            range_since: s.range.since,
            range_until: s.range.until,
            grain: match s.range.grain {
                dashboard_data::Grain::Hourly => "hourly",
                dashboard_data::Grain::Daily => "daily",
            },
            timezone: s.timezone,
            availability: s.availability.into(),
            providers: s.providers.into_iter().map(Into::into).collect(),
            usage_trend: s.usage_trend.into_iter().map(Into::into).collect(),
            spend_trend: s.spend_trend.into_iter().map(Into::into).collect(),
            quota_history: s.quota_history.into_iter().map(Into::into).collect(),
            cost_contract: s.cost_contract.into(),
        }
    }
}

fn epoch_to_iso(epoch: i64) -> Option<String> {
    chrono::DateTime::<chrono::Utc>::from_timestamp(epoch, 0).map(|dt| dt.to_rfc3339())
}

fn parse_range_kind(range: &str) -> Result<DashboardRangeKind, String> {
    match range {
        "today" => Ok(DashboardRangeKind::Today),
        "last7Days" => Ok(DashboardRangeKind::Last7Days),
        "last30Days" => Ok(DashboardRangeKind::Last30Days),
        "thisMonth" => Ok(DashboardRangeKind::ThisMonth),
        "last3Months" => Ok(DashboardRangeKind::Last3Months),
        "thisYear" => Ok(DashboardRangeKind::ThisYear),
        other => Err(format!("unknown dashboard range: {other}")),
    }
}

/// Fetch the normalized Dashboard data contract for `range` (one of
/// "today"/"last7Days"/"last30Days"/"thisMonth"/"last3Months"/"thisYear",
/// or "custom" with `customSince`/`customUntil` epoch seconds), in
/// `timezone` (an IANA zone name, or omitted/"system" to use the
/// currently-resolved system zone), optionally scoped to `providers`.
/// Built entirely from real local history -- never fabricates a value.
#[tauri::command]
pub fn get_dashboard_snapshot(
    range: String,
    timezone: Option<String>,
    custom_since: Option<i64>,
    custom_until: Option<i64>,
    providers: Option<Vec<String>>,
) -> Result<DashboardSnapshotBridge, String> {
    let timezone_name = match timezone.as_deref() {
        None | Some("system") | Some("") => dashboard_data::resolve_system_timezone(),
        Some(explicit) => explicit.to_string(),
    };
    let tz = dashboard_data::resolve_timezone(&timezone_name);
    let now = chrono::Utc::now();

    let resolved_range = if range == "custom" {
        let since = custom_since.ok_or("custom range requires customSince")?;
        let until = custom_until.unwrap_or_else(|| now.timestamp());
        dashboard_data::resolve_custom_range(since, until)
    } else {
        dashboard_data::resolve_range(parse_range_kind(&range)?, tz, now)
    };

    let store = HistoryStore::open();
    let providers = providers.unwrap_or_default();
    let snapshot = dashboard_data::build_dashboard_snapshot(
        &store,
        resolved_range,
        &timezone_name,
        &providers,
        &[],
    )?;
    Ok(snapshot.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_range_kind_accepts_every_named_range() {
        for (name, expected) in [
            ("today", DashboardRangeKind::Today),
            ("last7Days", DashboardRangeKind::Last7Days),
            ("last30Days", DashboardRangeKind::Last30Days),
            ("thisMonth", DashboardRangeKind::ThisMonth),
            ("last3Months", DashboardRangeKind::Last3Months),
            ("thisYear", DashboardRangeKind::ThisYear),
        ] {
            assert_eq!(parse_range_kind(name), Ok(expected));
        }
    }

    #[test]
    fn parse_range_kind_rejects_unknown_values() {
        assert!(parse_range_kind("nextWeek").is_err());
        assert!(parse_range_kind("").is_err());
    }

    #[test]
    fn epoch_to_iso_round_trips_a_known_instant() {
        assert_eq!(
            epoch_to_iso(1_788_307_200),
            Some("2026-09-02T00:00:00+00:00".to_string())
        );
    }

    #[test]
    fn quota_history_bridge_serializes_the_frozen_contract() {
        let value = serde_json::to_value(QuotaHistoryPointBridge::from(QuotaHistoryPoint {
            provider: "codex".to_string(),
            account_id: "observed:abc".to_string(),
            account_scope: quotalis_core::dashboard_data::QuotaAccountScope::Observed,
            window_key: "secondary".to_string(),
            window_label: Some("Weekly".to_string()),
            window_minutes: Some(10_080),
            bucket_start: 100,
            observed_at: 120,
            used_percent: 25.0,
            remaining_percent: 75.0,
            resets_at: Some(1_000),
            sample_count: 3,
            has_conflicting_samples: false,
            counter_decreased: false,
        }))
        .expect("quota history bridge must serialize");

        assert_eq!(
            value,
            serde_json::json!({
                "provider": "codex",
                "accountId": "observed:abc",
                "accountScope": "observed",
                "windowKey": "secondary",
                "windowLabel": "Weekly",
                "windowMinutes": 10_080,
                "bucketStart": 100,
                "observedAt": 120,
                "usedPercent": 25.0,
                "remainingPercent": 75.0,
                "resetsAt": 1_000,
                "sampleCount": 3,
                "hasConflictingSamples": false,
                "counterDecreased": false
            })
        );
    }

    /// Native/Dev verification (owner's spec section 35): reads the real,
    /// already-populated `%APPDATA%\QuotaArc\history.db` on this machine
    /// (written by the real running Dev/Personal instance's actual
    /// provider refreshes, via `history_recorder.rs` -- not a fixture)
    /// through the exact production `get_dashboard_snapshot` code path.
    /// `#[ignore]`d so normal `cargo test` runs never touch a real user's
    /// database; run explicitly with `--ignored` for manual verification.
    #[test]
    #[ignore = "reads the real on-disk history.db; run manually with --ignored"]
    fn manual_verification_against_real_history_db() {
        let snapshot = get_dashboard_snapshot(
            "last30Days".to_string(),
            None, // "system" timezone
            None,
            None,
            None,
        )
        .expect("real history.db should be queryable");
        println!("{snapshot:#?}");
        assert!(
            snapshot.availability.sample_count > 0,
            "expected real history on this machine"
        );
    }
}
