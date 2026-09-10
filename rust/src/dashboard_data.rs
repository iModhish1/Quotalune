//! Dashboard analytics: timezone-aware range resolution, aggregation, and
//! the normalized `DashboardSnapshot` contract, built entirely on top of
//! the existing local [`crate::history`] store.
//!
//! Core rule, non-negotiable: **never fabricate data**. A metric with no
//! real samples is reported as unavailable via [`DataAvailability`], never
//! zero-filled, interpolated, or extrapolated. `resets_at` values pass
//! through as the authoritative epoch instant the reset-presentation
//! system already owns display formatting for -- this module never
//! formats a reset time itself, only aggregates the instant.

use std::{collections::HashMap, str::FromStr};

use chrono::{DateTime, Datelike, Duration, LocalResult, NaiveDate, TimeZone, Timelike, Utc};
use chrono_tz::Tz;

use crate::history::{HistoryQuery, HistoryStore, UsageSample};

const COST_WINDOW_ID: &str = "cost";
const SELECTED_WINDOW_ID: &str = "selected";

/// A requested dashboard time range. Resolved against a specific timezone
/// at query time -- "today" in `Asia/Riyadh` is not the same UTC window as
/// "today" in `America/New_York`, so the same `Today` request produces a
/// different `[since, until)` depending on the caller's timezone.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DashboardRangeKind {
    Today,
    Last7Days,
    Last30Days,
    ThisMonth,
    Last3Months,
    ThisYear,
}

/// Aggregation grain for a resolved range's buckets.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Grain {
    Hourly,
    Daily,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResolvedRange {
    /// Epoch seconds, inclusive.
    pub since: i64,
    /// Epoch seconds, inclusive (the moment the range was resolved, not a
    /// rounded boundary -- "now" always ends a range).
    pub until: i64,
    pub grain: Grain,
}

/// The system's currently-resolved IANA timezone name, re-resolved fresh
/// on every call (never permanently cached) -- same `local_timezone_name()`
/// the reset-presentation system's Rust-side formatting already uses, so
/// "system timezone" means the same thing everywhere in the app.
pub fn resolve_system_timezone() -> String {
    crate::core::local_timezone_name()
}

/// Resolve an IANA timezone name to a real `chrono_tz::Tz`. Falls back to
/// UTC for an unrecognized name rather than erroring -- the caller (bridge
/// command) is responsible for validating the name is one the user
/// actually configured; this is a defensive fallback, not silent
/// correction of a user mistake.
pub fn resolve_timezone(name: &str) -> Tz {
    Tz::from_str(name).unwrap_or(chrono_tz::UTC)
}

/// Local midnight (00:00:00) of `date` in `tz`, as an epoch-second instant.
/// Handles both DST transitions explicitly:
/// - **Fall-back** (`LocalResult::Ambiguous`): the wall-clock midnight
///   occurs twice; the earlier (pre-transition) instant is used, so a
///   "day" always starts at the first occurrence of its local midnight.
/// - **Spring-forward** (`LocalResult::None`): local midnight doesn't
///   exist for this date (the clock jumps past it); steps forward in
///   whole hours until a valid local instant is found, which is always
///   within a few hours for every real-world DST rule.
fn local_midnight_epoch(date: NaiveDate, tz: Tz) -> i64 {
    let naive = date.and_hms_opt(0, 0, 0).expect("00:00:00 is always valid");
    match tz.from_local_datetime(&naive) {
        LocalResult::Single(dt) => dt.timestamp(),
        LocalResult::Ambiguous(earliest, _latest) => earliest.timestamp(),
        LocalResult::None => {
            for hour in 1..=6 {
                let shifted = date
                    .and_hms_opt(hour, 0, 0)
                    .expect("hour in 1..=6 is always valid");
                if let LocalResult::Single(dt) = tz.from_local_datetime(&shifted) {
                    return dt.timestamp();
                }
            }
            // Should be unreachable for any real IANA zone (no DST shift
            // exceeds a few hours), but never panic over a boundary calc.
            Utc.from_utc_datetime(&naive).timestamp()
        }
    }
}

/// Local top-of-hour (`HH:00:00`) of `at` in `tz`, as an epoch-second
/// instant. Used for the `Today` range's hourly grain.
fn local_hour_start_epoch(at: DateTime<Utc>, tz: Tz) -> i64 {
    let local = at.with_timezone(&tz);
    let naive = local
        .date_naive()
        .and_hms_opt(local.hour(), 0, 0)
        .expect("hour-of-day from a valid DateTime is always a valid hms");
    match tz.from_local_datetime(&naive) {
        LocalResult::Single(dt) => dt.timestamp(),
        LocalResult::Ambiguous(earliest, _) => earliest.timestamp(),
        LocalResult::None => at.timestamp(), // inside a spring-forward gap; bucket by the instant itself
    }
}

pub fn resolve_range(kind: DashboardRangeKind, tz: Tz, now: DateTime<Utc>) -> ResolvedRange {
    let today = now.with_timezone(&tz).date_naive();
    let until = now.timestamp();
    match kind {
        DashboardRangeKind::Today => ResolvedRange {
            since: local_midnight_epoch(today, tz),
            until,
            grain: Grain::Hourly,
        },
        DashboardRangeKind::Last7Days => ResolvedRange {
            since: local_midnight_epoch(today - Duration::days(6), tz),
            until,
            grain: Grain::Daily,
        },
        DashboardRangeKind::Last30Days => ResolvedRange {
            since: local_midnight_epoch(today - Duration::days(29), tz),
            until,
            grain: Grain::Daily,
        },
        DashboardRangeKind::ThisMonth => {
            let first_of_month = today.with_day(1).unwrap_or(today);
            ResolvedRange {
                since: local_midnight_epoch(first_of_month, tz),
                until,
                grain: Grain::Daily,
            }
        }
        DashboardRangeKind::Last3Months => {
            let first_of_month = today.with_day(1).unwrap_or(today);
            let start = shift_months_back(first_of_month, 2);
            ResolvedRange {
                since: local_midnight_epoch(start, tz),
                until,
                grain: Grain::Daily,
            }
        }
        DashboardRangeKind::ThisYear => {
            let jan_1 = NaiveDate::from_ymd_opt(today.year(), 1, 1).unwrap_or(today);
            ResolvedRange {
                since: local_midnight_epoch(jan_1, tz),
                until,
                grain: Grain::Daily,
            }
        }
    }
}

/// A `Custom` range's boundaries are caller-supplied epoch seconds; the
/// grain is always daily (matches section 13's "Custom: adaptive" with the
/// simplest adaptive rule that still downsamples before rendering).
pub fn resolve_custom_range(since: i64, until: i64) -> ResolvedRange {
    ResolvedRange {
        since,
        until,
        grain: Grain::Daily,
    }
}

fn shift_months_back(date: NaiveDate, months: i32) -> NaiveDate {
    let total = date.year() * 12 + i32::try_from(date.month()).unwrap_or(1) - 1 - months;
    let year = total.div_euclid(12);
    let month = u32::try_from(total.rem_euclid(12)).unwrap_or(0) + 1;
    NaiveDate::from_ymd_opt(year, month, 1).unwrap_or(date)
}

/// What real data actually exists for a query -- computed once and exposed
/// alongside every `DashboardSnapshot` so the UI can say "data available
/// since <date>" instead of implying deeper history than exists, and can
/// gate cost/token/request/model widgets on real availability rather than
/// rendering fabricated zeros.
///
/// `has_token_data`, `has_request_data`, and `has_model_data` are always
/// `false` today: the current `usage_samples` schema (see `history.rs`)
/// has no columns for token counts, request counts, or model attribution
/// -- providers only ever report percentage/cost facts through this
/// pipeline. Flipping these to a real signal is a schema change, out of
/// this phase's scope; keeping them explicitly `false` here is what keeps
/// a future Dashboard UI from inventing per-model or per-token analytics
/// this store cannot support.
#[derive(Debug, Clone, PartialEq)]
pub struct DataAvailability {
    pub first_sample_at: Option<i64>,
    pub last_sample_at: Option<i64>,
    pub sample_count: usize,
    pub has_cost_data: bool,
    pub has_token_data: bool,
    pub has_request_data: bool,
    pub has_model_data: bool,
}

impl DataAvailability {
    fn from_samples(samples: &[UsageSample]) -> Self {
        let first_sample_at = samples.iter().map(|s| s.captured_at).min();
        let last_sample_at = samples.iter().map(|s| s.captured_at).max();
        Self {
            first_sample_at,
            last_sample_at,
            sample_count: samples.len(),
            has_cost_data: samples.iter().any(|s| s.cost_used.is_some()),
            has_token_data: false,
            has_request_data: false,
            has_model_data: false,
        }
    }
}

// ── Phase 4A: formal cost-measurement contract ──────────────────────────
// docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md. Nothing downstream may
// infer monetary semantics from a naked `f64` any more -- every consumer
// of `DashboardSnapshot`'s cost fields gets an explicit origin, an
// explicit measurement kind, and an explicit (or explicitly-unknown)
// currency instead.

/// Where a monetary figure came from. Quotalis today only ever produces
/// `ProviderReported` (real) or `Unavailable` (no usable figure) --
/// `LocallyEstimated` and `UserConfigured` are modeled here because the
/// contract must be able to state them, but nothing in this codebase
/// constructs them yet (see PHASE4_DATA_ACCURACY_AUDIT.md section 8: the
/// history schema does not carry the model/token/request billing inputs
/// a trustworthy local estimate would require).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CostOrigin {
    /// The provider's own API/dashboard reported this dollar figure --
    /// Quotalis performed no local token-pricing computation for it.
    ProviderReported,
    /// Computed locally by Quotalis from verified token usage and a
    /// verified pricing-catalog record. Not produced anywhere today.
    LocallyEstimated,
    /// Supplied directly by the user as a manual override, not derived
    /// from any provider response. Not produced anywhere today.
    UserConfigured,
    /// No monetary figure exists for the requested scope at all.
    Unavailable,
}

/// What kind of number a monetary reading actually is. This is the field
/// that stops "sum every bucket" from ever being a safe default again --
/// callers must check `kind` before choosing how to aggregate across
/// buckets/time.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum CostMeasurementKind {
    /// A running total for the provider's current billing/reporting
    /// period (`CostSnapshot::used`'s documented meaning: "amount used in
    /// the current period"). Must never be summed across time buckets of
    /// the same provider/account series -- only the latest reading in a
    /// bucket/period is meaningful; two readings of the same period are
    /// the same fact measured twice, not two facts.
    Cumulative,
    /// A genuinely incremental amount that covers only its own bucket,
    /// safe to sum across buckets. No provider adapter produces this
    /// today (every current adapter reports a period-cumulative `used`),
    /// but the contract must be able to say so once/if one does.
    Delta,
    /// A single point-in-time reading with no accumulation semantics
    /// (e.g. a prepaid balance) -- can legitimately decrease as money is
    /// spent or increase on top-up; summing or diffing it as if it were
    /// spend is wrong.
    PointInTime,
    /// Semantics could not be established for at least one sample in the
    /// aggregated set (this is what a pre-Phase-4A legacy history row --
    /// no recorded currency/origin -- reads back as). Must not be
    /// aggregated into a trusted total; treat as unavailable for
    /// computation purposes even though the raw row is still visible in
    /// history for inspection.
    Unknown,
}

impl CostMeasurementKind {
    /// Stable string form persisted to `history.db`'s `cost_measurement_kind`
    /// column -- never renamed; a future variant gets a new string, an old
    /// build reading a newer string it doesn't recognize falls back to
    /// `Unknown` via `parse`, not a decode error.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Cumulative => "cumulative",
            Self::Delta => "delta",
            Self::PointInTime => "point_in_time",
            Self::Unknown => "unknown",
        }
    }

    fn parse(value: Option<&str>) -> Self {
        match value {
            Some("cumulative") => Self::Cumulative,
            Some("delta") => Self::Delta,
            Some("point_in_time") => Self::PointInTime,
            _ => Self::Unknown,
        }
    }
}

/// Evidence-based classification of what `CostSnapshot.used` actually
/// means for each provider adapter, from a direct read of every one of
/// the 24 `CostSnapshot`-constructing provider modules (Phase 4A audit,
/// see PHASE4_DATA_ACCURACY_AUDIT.md). Do NOT infer this from a field
/// name -- it is proven per-provider by reading the adapter's own
/// response-parsing code.
///
/// Six providers write a **point-in-time prepaid balance** into `used`,
/// not period spend: `crossmodel`/`sub2api` hard-code `used = 0.0` and
/// put the real balance in `limit`; `devin`/`neuralwatt`/`opencodego`/
/// `zenmux` pass their balance field directly as `used`. Treating any of
/// these as "spend this period" would be wrong in the opposite direction
/// from the original summing bug: a balance can legitimately DECREASE as
/// money is spent, and combining it with a genuine period-spend number
/// (even without summing across time) conflates "money remaining" with
/// "money already spent".
///
/// `codex` is classified `Unknown` deliberately: its adapter has two
/// code paths with genuinely different semantics (a real spend-control
/// cumulative total, or -- when no spend-control limit exists -- a raw
/// credit balance), and nothing persisted in `history.db` today records
/// which path produced a given historical row. Guessing would violate
/// the "never guess" rule; `Unknown` is the honest answer until the
/// adapter itself records which path it took.
///
/// All other examined providers write a genuine period-cumulative spend
/// total into `used` (confirmed by reading each adapter's response
/// parsing, even though several also have real, separately-documented
/// account/org/team-scoping caveats noted in
/// PHASE4_DATA_ACCURACY_AUDIT.md that this function does not attempt to
/// resolve).
///
/// Phase 4A.1: superseded by [`classify_monetary_observation`], which adds
/// the orthogonal quantity dimension (Spend/Balance/Credits) and resolves
/// Codex correctly using the adapter's own `period` label instead of
/// guessing by provider ID alone. Kept only as the `measurement_kind`
/// half of that function, re-exposed for any existing caller.
pub fn provider_cost_measurement_kind(provider_cli_id: &str) -> CostMeasurementKind {
    classify_monetary_observation(provider_cli_id, "").1
}

/// Phase 4A.1: the second, orthogonal monetary dimension. `CostMeasurementKind`
/// answers "is this a running total, a delta, or a snapshot reading" --
/// it says nothing about WHAT the number represents. A providers that
/// reports a prepaid balance and a provider that reports period spend can
/// both be "PointInTime" or both be "Cumulative" in the temporal sense
/// while meaning completely different things financially; conflating them
/// is exactly the mistake owner Phase 4A.1 asks to close.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum MonetaryQuantityKind {
    /// Money actually spent/consumed against a billing period or credit
    /// allotment -- the only kind the Dashboard's "Spend" KPI may ever
    /// consume.
    Spend,
    /// A prepaid balance (cash-denominated) -- remaining funds, not spend.
    /// Can legitimately decrease as money is spent and increase on
    /// top-up. Never shown under the Spend label.
    Balance,
    /// A provider-defined, non-cash-equivalent unit (e.g. a ChatGPT
    /// account credit balance, a Command Code monthly credit allotment)
    /// -- distinct from a real-currency Balance because there is no
    /// proven 1:1 conversion to USD/EUR/etc. in this codebase. Never
    /// shown under the Spend label, never summed with real-currency
    /// figures.
    Credits,
    /// What the number represents could not be established (legacy row,
    /// or a provider/path not yet classified). Fails closed -- excluded
    /// from every KPI, including a future Balance/Credits display.
    Unknown,
}

impl MonetaryQuantityKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Spend => "spend",
            Self::Balance => "balance",
            Self::Credits => "credits",
            Self::Unknown => "unknown",
        }
    }

    fn parse(value: Option<&str>) -> Self {
        match value {
            Some("spend") => Self::Spend,
            Some("balance") => Self::Balance,
            Some("credits") => Self::Credits,
            _ => Self::Unknown,
        }
    }
}

/// Phase 4A.1 (docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md "Phase 4A.1"
/// section): classifies a monetary observation on BOTH orthogonal
/// dimensions at once, using whatever real evidence is available --
/// provider identity, and (for the one provider whose live adapter code
/// is genuinely ambiguous by ID alone) the exact `period` label the
/// adapter itself already produces, since that string is adapter-
/// authored evidence, not a guess layered on top of it.
///
/// **Codex, traced in full** (`rust/src/providers/codex/api.rs`): the
/// LIVE fetch path (`fetch_usage`/`fetch_usage_pat`, both used in
/// production) calls `build_result_from_json` -> `extract_credits`
/// exclusively, which ALWAYS constructs `CostSnapshot::new(balance,
/// "USD", "Credits")` -- i.e. `used` is always the raw ChatGPT-account
/// credit BALANCE (`period == "Credits"`), never spend. A second
/// function, `build_result`, DOES contain a spend-against-a-monthly-
/// limit branch (`SpendControlLimitSnapshot::to_cost_snapshot`, `period
/// == "Monthly credits"`) that would be genuine Spend -- but `build_result`
/// is called only from two unit tests (`UsageResponse` is never
/// constructed anywhere in the live fetch path); it is dead code today,
/// not a real, reachable second semantic. So Codex's real observed
/// `period` value at write time IS proof of which (theoretical) path
/// produced it, and today that is always `"Credits"` (Balance-shaped,
/// but denominated in account credits rather than cash -- classified
/// `Credits`, not `Balance`). If `build_result`'s branch is ever wired
/// into a live fetch path in the future, its distinct `"Monthly
/// credits"` period label will already correctly classify as
/// `Spend`/`Cumulative` by this same function -- no further guessing
/// required, because the adapter's own label carries the evidence.
pub fn classify_monetary_observation(
    provider_cli_id: &str,
    period_label: &str,
) -> (MonetaryQuantityKind, CostMeasurementKind) {
    match provider_cli_id {
        // Genuine prepaid CASH balances (USD/provider-currency), verified
        // 2026-09-08 against each adapter's real construction site:
        // crossmodel.rs:197, sub2api/mod.rs:519,573, devin/mod.rs:141,
        // neuralwatt/mod.rs:319, opencodego/mod.rs:539, zenmux/mod.rs:244.
        // (Note: crossmodel and sub2api literally pass `used = 0.0` and
        // put the real balance in `CostSnapshot.limit`, which
        // history_recorder.rs does not persist -- their `cost_used`
        // history rows are constant zero today. Still genuinely Balance-
        // shaped data, just not currently captured in history at a
        // useful value; flagged, not fixed, in this pass.)
        "crossmodel" | "sub2api" | "devin" | "neuralwatt" | "opencodego" | "zenmux" => (
            MonetaryQuantityKind::Balance,
            CostMeasurementKind::PointInTime,
        ),
        // Codex: see this function's doc comment above for the full
        // traced evidence. Classify by the adapter's own period label,
        // not by provider ID alone.
        "codex" => match period_label {
            "Monthly credits" => (
                MonetaryQuantityKind::Credits,
                CostMeasurementKind::Cumulative,
            ),
            "Credits" => (
                MonetaryQuantityKind::Credits,
                CostMeasurementKind::PointInTime,
            ),
            _ => (MonetaryQuantityKind::Unknown, CostMeasurementKind::Unknown),
        },
        // Command Code: `used = plan.monthly_credits_usd - monthly_credits`
        // -- consumption against a monthly CREDIT allotment (not raw
        // cash, despite `currency_code` being hard-coded "USD" in the
        // adapter -- a separate, pre-existing labeling nuance not fixed
        // in this pass). Re-verified `commandcode/mod.rs:356-366`.
        "commandcode" => (
            MonetaryQuantityKind::Credits,
            CostMeasurementKind::Cumulative,
        ),
        // Confirmed genuine, cash-denominated period-cumulative SPEND:
        // aiand, bedrock, claude, cursor, deepinfra, deepseek, fireworks,
        // litellm, llmproxy, minimax, mistral, openaiapi, openrouter, xai.
        "aiand" | "bedrock" | "claude" | "cursor" | "deepinfra" | "deepseek" | "fireworks"
        | "litellm" | "llmproxy" | "minimax" | "mistral" | "openaiapi" | "openrouter" | "xai" => {
            (MonetaryQuantityKind::Spend, CostMeasurementKind::Cumulative)
        }
        // Not yet examined by the Phase 4A provider-adapter audit -- fail
        // closed on both dimensions rather than assume either shape.
        _ => (MonetaryQuantityKind::Unknown, CostMeasurementKind::Unknown),
    }
}

/// Whether a trustworthy monetary total exists at all for the current
/// query, distinct from `DataAvailability::has_cost_data` (which only
/// says *some* cost-tagged row exists, not whether it can be safely
/// aggregated).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CostAvailability {
    /// At least one cost sample exists and carries enough metadata
    /// (currency) to be aggregated per this contract's rules.
    Available,
    /// Cost samples exist, but only pre-Phase-4A rows with no recorded
    /// currency -- real numeric data, but not safely aggregable/
    /// comparable. Surfaced honestly rather than dropped or guessed.
    LegacyAmbiguous,
    /// No cost sample exists for the requested scope.
    Unavailable,
}

/// Whether Quotalis's own pricing catalog needs to be (or has been)
/// verified for the figure being shown. `ProviderReported` cost never
/// touches the pricing catalog, so verification is not applicable to it
/// -- `NotRequired` exists specifically so the UI never implies a
/// provider-reported number came from Quotalis's own pricing data (owner
/// Phase 4A section 16).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PricingStatus {
    /// The shown figure is provider-reported; Quotalis pricing-catalog
    /// verification does not apply to it.
    NotRequired,
    /// A locally-estimated figure exists but its pricing record has not
    /// been verified against an official source. Not produced today.
    Unverified,
    /// A locally-estimated figure exists and its pricing record has been
    /// verified against an official source. Not produced today.
    Verified,
}

/// The complete, structured description of what `DashboardSnapshot`'s
/// cost fields actually mean for the current query -- see this module's
/// "Phase 4A: formal cost-measurement contract" section.
#[derive(Debug, Clone, PartialEq)]
pub struct CostContract {
    pub origin: CostOrigin,
    /// Phase 4A.1: WHAT the aggregated figure represents (see
    /// `MonetaryQuantityKind`). `Unknown` the moment more than one
    /// quantity kind (or an unclassified provider) appears in the
    /// relevant sample set -- a balance and a spend total are never
    /// combined into one figure, even if their temporal shape matches.
    pub quantity_kind: MonetaryQuantityKind,
    pub measurement_kind: CostMeasurementKind,
    /// ISO 4217 currency code, only when every aggregated sample shares
    /// one unambiguous currency. `None` when currencies differ or are
    /// unknown (legacy rows) -- a mixed/unknown currency set is never
    /// silently collapsed onto one code.
    pub currency_code: Option<String>,
    /// Human-readable period/scope ("Monthly", a provider-defined
    /// string, or "unknown" when the aggregated set mixes periods).
    pub period: String,
    pub availability: CostAvailability,
    pub pricing_status: PricingStatus,
}

impl CostContract {
    /// Derive the contract from the exact samples that produced a
    /// snapshot's `spend_trend` (the range-scoped cost samples) plus the
    /// unbounded cost samples (to detect legacy-ambiguous rows outside
    /// the current range, so `availability` reflects the account's real
    /// history, not just what fell inside today's display range).
    fn from_samples(
        ranged_cost_samples: &[&UsageSample],
        all_time_cost_samples: &[&UsageSample],
    ) -> Self {
        if all_time_cost_samples.is_empty() {
            return Self {
                origin: CostOrigin::Unavailable,
                quantity_kind: MonetaryQuantityKind::Unknown,
                measurement_kind: CostMeasurementKind::Unknown,
                currency_code: None,
                period: "unknown".to_string(),
                availability: CostAvailability::Unavailable,
                pricing_status: PricingStatus::NotRequired,
            };
        }

        // A pre-Phase-4A row has no recorded currency at all -- that is
        // the one signal this schema can use to tell "legacy, semantics
        // unknown" apart from "real, currency-tagged" data (see
        // history.rs's `cost_currency_code` doc comment).
        let has_legacy_untagged_row = all_time_cost_samples
            .iter()
            .any(|s| s.cost_currency_code.is_none());
        let has_tagged_row = all_time_cost_samples
            .iter()
            .any(|s| s.cost_currency_code.is_some());

        if !has_tagged_row {
            // Every cost row on record predates the currency column --
            // real numbers exist, but nothing here can prove what
            // currency/period/reset semantics they follow.
            return Self {
                origin: CostOrigin::Unavailable,
                quantity_kind: MonetaryQuantityKind::Unknown,
                measurement_kind: CostMeasurementKind::Unknown,
                currency_code: None,
                period: "unknown".to_string(),
                availability: CostAvailability::LegacyAmbiguous,
                pricing_status: PricingStatus::NotRequired,
            };
        }

        // From here on, at least one tagged (Phase-4A-or-later) sample
        // exists. Every tagged sample was written by `history_recorder.rs`
        // directly from `CostSnapshot::used`/`currency_code`/`period` plus
        // `provider_cost_measurement_kind(provider)` -- origin is always
        // ProviderReported (no code path writes any other origin), but
        // measurement KIND is proven per-provider, not assumed uniform
        // (see `provider_cost_measurement_kind`'s doc comment: six
        // providers write a point-in-time balance, not period spend, and
        // `codex` is deliberately `Unknown`).
        let relevant: &[&UsageSample] = if ranged_cost_samples.is_empty() {
            all_time_cost_samples
        } else {
            ranged_cost_samples
        };
        let tagged: Vec<&&UsageSample> = relevant
            .iter()
            .filter(|s| s.cost_currency_code.is_some())
            .collect();

        let currencies: std::collections::BTreeSet<&str> = tagged
            .iter()
            .filter_map(|s| s.cost_currency_code.as_deref())
            .collect();
        let currency_code = match currencies.len() {
            1 => currencies.into_iter().next().map(|c| c.to_string()),
            _ => None, // 0 (nothing tagged in the ranged subset) or >1 (mixed) -- never guess.
        };

        let periods: std::collections::BTreeSet<&str> = tagged
            .iter()
            .filter_map(|s| s.window_label.as_deref())
            .collect();
        let period = match periods.len() {
            1 => periods.into_iter().next().unwrap_or("unknown").to_string(),
            _ => "unknown".to_string(),
        };

        // Measurement kind must be uniform across every tagged sample in
        // scope to be trusted at all -- a mix of Cumulative (period
        // spend) and PointInTime (prepaid balance) providers is not one
        // quantity, so it collapses to `Unknown` (never aggregated as a
        // single combined figure) rather than picking either kind.
        let kinds: std::collections::BTreeSet<CostMeasurementKind> = tagged
            .iter()
            .map(|s| CostMeasurementKind::parse(s.cost_measurement_kind.as_deref()))
            .collect();
        let measurement_kind = match (kinds.len(), kinds.iter().next()) {
            (1, Some(&only)) => only,
            _ => CostMeasurementKind::Unknown,
        };

        // Phase 4A.1: quantity kind must ALSO be uniform across every
        // tagged sample -- a mix of Spend and Balance (or Credits) is not
        // one quantity even if measurement_kind happens to match.
        let quantities: std::collections::BTreeSet<MonetaryQuantityKind> = tagged
            .iter()
            .map(|s| MonetaryQuantityKind::parse(s.monetary_quantity_kind.as_deref()))
            .collect();
        let quantity_kind = match (quantities.len(), quantities.iter().next()) {
            (1, Some(&only)) => only,
            _ => MonetaryQuantityKind::Unknown,
        };

        // Both real tagged data and older untagged rows can coexist for
        // an account (a Phase-4A upgrade doesn't retag old history) --
        // the tagged data is still trustworthy on its own, so this stays
        // `Available` rather than being downgraded by the presence of
        // unrelated legacy rows. `has_legacy_untagged_row` is kept named
        // here (not `_`) as a reminder this branch was reached in spite
        // of legacy rows existing, should that ever need distinguishing.
        let _ = has_legacy_untagged_row;

        Self {
            origin: CostOrigin::ProviderReported,
            quantity_kind,
            measurement_kind,
            currency_code,
            period,
            availability: CostAvailability::Available,
            pricing_status: PricingStatus::NotRequired,
        }
    }
}

/// One bucket of a usage-percentage trend for one provider/account. The
/// value is the *last* sample captured inside the bucket (a "close" value,
/// matching how a point-in-time gauge like quota-used% is naturally read
/// on a timeline) rather than a sum, which would double-count a
/// cumulative-looking percentage.
#[derive(Debug, Clone, PartialEq)]
pub struct UsageDailyPoint {
    pub provider: String,
    pub account_id: String,
    pub bucket_start: i64,
    pub used_percent: f64,
    pub remaining_percent: f64,
    pub sample_count: u32,
}

/// Account evidence attached to a quota-history series. Only `Observed`
/// may participate in same-account comparison. `Unresolved` is an honest
/// provider-scoped observation; `Legacy` predates the identity contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum QuotaAccountScope {
    Observed,
    Unresolved,
    Legacy,
}

impl QuotaAccountScope {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Observed => "observed",
            Self::Unresolved => "unresolved",
            Self::Legacy => "legacy",
        }
    }

    fn from_sample(sample: &UsageSample) -> Self {
        match sample.account_scope.as_deref() {
            Some("observed") => Self::Observed,
            Some("unresolved") => Self::Unresolved,
            _ => Self::Legacy,
        }
    }
}

/// One trusted-or-explicitly-qualified quota observation bucket. Window
/// identity, duration, closing capture time, and reset endpoint stay in the
/// contract so comparison code can fail closed instead of guessing.
#[derive(Debug, Clone, PartialEq)]
pub struct QuotaHistoryPoint {
    pub provider: String,
    pub account_id: String,
    pub account_scope: QuotaAccountScope,
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

/// One bucket of a spend trend for one provider/account -- the last
/// `cost_used` value captured inside the bucket. Always explicitly an
/// *estimate*: it is whatever the provider reported as its own
/// dollar-usage figure, not a value QuotaArc computed from pricing
/// metadata (that distinction is what section 6 of the owner's spec asks
/// for; Phase 4's pricing-provenance work is what would let a caller also
/// show a QuotaArc-computed estimate, layered on top of this fact).
#[derive(Debug, Clone, PartialEq)]
pub struct SpendDailyPoint {
    pub provider: String,
    pub account_id: String,
    pub bucket_start: i64,
    pub cost_used: f64,
    /// ISO 4217 currency code, when the sample that produced this bucket
    /// carried one. `None` for a legacy (pre-Phase-4A) sample -- never
    /// guessed as USD.
    pub currency_code: Option<String>,
    /// This bucket's measurement kind (see `CostMeasurementKind`) --
    /// callers must not combine buckets/series of different kinds as if
    /// they were the same quantity (e.g. a period-cumulative spend total
    /// and a point-in-time prepaid balance).
    pub measurement_kind: CostMeasurementKind,
    /// Phase 4A.1: WHAT this bucket's number represents (see
    /// `MonetaryQuantityKind`) -- the orthogonal dimension to
    /// `measurement_kind`. The Dashboard Spend KPI may consume ONLY
    /// buckets where this is `Spend`.
    pub quantity_kind: MonetaryQuantityKind,
}

/// Current-state summary for one provider/account -- its most recently
/// captured "selected" sample, regardless of the requested display range
/// (the range affects the trend, not "what is my quota right now").
#[derive(Debug, Clone, PartialEq)]
pub struct ProviderSummary {
    pub provider: String,
    pub account_id: String,
    pub used_percent: f64,
    pub remaining_percent: f64,
    /// Authoritative reset instant (epoch seconds) -- presentation
    /// formatting belongs to the Reset Presentation system, not here.
    pub resets_at: Option<i64>,
    pub last_sample_at: i64,
}

fn bucket_start(captured_at: i64, tz: Tz, grain: Grain) -> i64 {
    let at = DateTime::<Utc>::from_timestamp(captured_at, 0).unwrap_or_else(Utc::now);
    match grain {
        Grain::Hourly => local_hour_start_epoch(at, tz),
        Grain::Daily => local_midnight_epoch(at.with_timezone(&tz).date_naive(), tz),
    }
}

/// Aggregate `selected`-window samples into per-provider/account daily (or
/// hourly, for `Today`) buckets, taking the last sample in each bucket.
/// Samples must already be in ascending `captured_at` order (as returned
/// by `HistoryStore::query`).
pub fn aggregate_usage(samples: &[UsageSample], tz: Tz, grain: Grain) -> Vec<UsageDailyPoint> {
    let mut buckets: HashMap<(String, String, i64), UsageDailyPoint> = HashMap::new();
    for sample in samples
        .iter()
        .filter(|s| s.window_id.as_deref() == Some(SELECTED_WINDOW_ID))
    {
        let start = bucket_start(sample.captured_at, tz, grain);
        let key = (sample.provider.clone(), sample.account_id.clone(), start);
        buckets
            .entry(key)
            .and_modify(|existing| {
                existing.used_percent = sample.used_percent;
                existing.remaining_percent = sample.remaining_percent;
                existing.sample_count = existing.sample_count.saturating_add(1);
            })
            .or_insert_with(|| UsageDailyPoint {
                provider: sample.provider.clone(),
                account_id: sample.account_id.clone(),
                bucket_start: start,
                used_percent: sample.used_percent,
                remaining_percent: sample.remaining_percent,
                sample_count: 1,
            });
    }
    let mut buckets: Vec<_> = buckets.into_values().collect();
    buckets.sort_by_key(|b| (b.bucket_start, b.provider.clone(), b.account_id.clone()));
    buckets
}

/// Aggregate `cost`-window samples the same way -- only ever produces
/// points for providers/accounts that actually reported cost data.
pub fn aggregate_spend(samples: &[UsageSample], tz: Tz, grain: Grain) -> Vec<SpendDailyPoint> {
    let mut buckets: HashMap<(String, String, i64), SpendDailyPoint> = HashMap::new();
    for sample in samples
        .iter()
        .filter(|s| s.window_id.as_deref() == Some(COST_WINDOW_ID) && s.cost_used.is_some())
    {
        let start = bucket_start(sample.captured_at, tz, grain);
        let key = (sample.provider.clone(), sample.account_id.clone(), start);
        buckets
            .entry(key)
            .and_modify(|existing| {
                existing.cost_used = sample.cost_used.unwrap_or(existing.cost_used);
                existing.currency_code = sample
                    .cost_currency_code
                    .clone()
                    .or_else(|| existing.currency_code.clone());
                existing.measurement_kind =
                    CostMeasurementKind::parse(sample.cost_measurement_kind.as_deref());
                existing.quantity_kind =
                    MonetaryQuantityKind::parse(sample.monetary_quantity_kind.as_deref());
            })
            .or_insert_with(|| SpendDailyPoint {
                provider: sample.provider.clone(),
                account_id: sample.account_id.clone(),
                bucket_start: start,
                cost_used: sample.cost_used.unwrap_or(0.0),
                currency_code: sample.cost_currency_code.clone(),
                measurement_kind: CostMeasurementKind::parse(
                    sample.cost_measurement_kind.as_deref(),
                ),
                quantity_kind: MonetaryQuantityKind::parse(
                    sample.monetary_quantity_kind.as_deref(),
                ),
            });
    }
    let mut buckets: Vec<_> = buckets.into_values().collect();
    buckets.sort_by_key(|b| (b.bucket_start, b.provider.clone(), b.account_id.clone()));
    buckets
}

/// Aggregate physical quota-window history while retaining the evidence
/// required by Product V2 comparison and velocity selectors. The reset
/// endpoint is part of the bucket key: two cycles observed in one display
/// bucket remain two records rather than being silently merged.
pub fn aggregate_quota_history(
    samples: &[UsageSample],
    tz: Tz,
    grain: Grain,
) -> Vec<QuotaHistoryPoint> {
    type Key = (
        String,
        String,
        QuotaAccountScope,
        String,
        Option<u32>,
        i64,
        Option<i64>,
    );

    let mut buckets: HashMap<Key, QuotaHistoryPoint> = HashMap::new();
    type SeriesKey = (
        String,
        String,
        QuotaAccountScope,
        String,
        Option<u32>,
        Option<i64>,
    );
    let mut previous: HashMap<SeriesKey, (i64, f64, f64)> = HashMap::new();
    let mut ordered: Vec<_> = samples.iter().collect();
    ordered.sort_by_key(|sample| sample.captured_at);
    for sample in ordered {
        if sample.cost_used.is_some()
            || sample.window_id.as_deref() == Some(COST_WINDOW_ID)
            || sample.window_id.as_deref() == Some(SELECTED_WINDOW_ID)
            || sample.window_key.as_deref() == Some(SELECTED_WINDOW_ID)
            || !sample.used_percent.is_finite()
            || !(0.0..=100.0).contains(&sample.used_percent)
            || !sample.remaining_percent.is_finite()
            || !(0.0..=100.0).contains(&sample.remaining_percent)
            || (sample.used_percent + sample.remaining_percent - 100.0).abs() > 0.1
        {
            continue;
        }

        let Some(window_key) = sample
            .window_key
            .as_deref()
            .or(sample.window_id.as_deref())
            .filter(|key| !key.is_empty())
        else {
            continue;
        };
        let account_scope = QuotaAccountScope::from_sample(sample);
        let series_key = (
            sample.provider.clone(),
            sample.account_id.clone(),
            account_scope,
            window_key.to_string(),
            sample.window_minutes,
            sample.resets_at,
        );
        let prior = previous.get(&series_key);
        let conflicting = prior.is_some_and(|(time, used, remaining)| {
            *time == sample.captured_at
                && (*used != sample.used_percent || *remaining != sample.remaining_percent)
        });
        let decreased = prior.is_some_and(|(time, used, _)| {
            *time < sample.captured_at && sample.used_percent < *used
        });
        // Exact duplicate observations are not additional coverage.
        if prior.is_some_and(|(time, used, remaining)| {
            *time == sample.captured_at
                && *used == sample.used_percent
                && *remaining == sample.remaining_percent
        }) {
            continue;
        }
        previous.insert(
            series_key,
            (
                sample.captured_at,
                sample.used_percent,
                sample.remaining_percent,
            ),
        );
        let start = bucket_start(sample.captured_at, tz, grain);
        let key = (
            sample.provider.clone(),
            sample.account_id.clone(),
            account_scope,
            window_key.to_string(),
            sample.window_minutes,
            start,
            sample.resets_at,
        );

        buckets
            .entry(key)
            .and_modify(|existing| {
                existing.has_conflicting_samples |= conflicting;
                existing.counter_decreased |= decreased;
                existing.sample_count = existing.sample_count.saturating_add(1);
                if sample.captured_at >= existing.observed_at {
                    existing.window_label = sample.window_label.clone();
                    existing.observed_at = sample.captured_at;
                    existing.used_percent = sample.used_percent;
                    existing.remaining_percent = sample.remaining_percent;
                }
            })
            .or_insert_with(|| QuotaHistoryPoint {
                provider: sample.provider.clone(),
                account_id: sample.account_id.clone(),
                account_scope,
                window_key: window_key.to_string(),
                window_label: sample.window_label.clone(),
                window_minutes: sample.window_minutes,
                bucket_start: start,
                observed_at: sample.captured_at,
                used_percent: sample.used_percent,
                remaining_percent: sample.remaining_percent,
                resets_at: sample.resets_at,
                sample_count: 1,
                has_conflicting_samples: conflicting,
                counter_decreased: decreased,
            });
    }

    let mut out: Vec<_> = buckets.into_values().collect();
    sort_quota_history(&mut out);
    out
}

fn sort_quota_history(points: &mut [QuotaHistoryPoint]) {
    points.sort_by(|a, b| {
        a.bucket_start
            .cmp(&b.bucket_start)
            .then(a.observed_at.cmp(&b.observed_at))
            .then(a.provider.cmp(&b.provider))
            .then(a.account_id.cmp(&b.account_id))
            .then(a.window_key.cmp(&b.window_key))
            .then(a.window_minutes.cmp(&b.window_minutes))
            .then(a.resets_at.cmp(&b.resets_at))
    });
}

/// Latest physical primary per observed provider/account. Legacy selected rows
/// are a fallback only for providers without physical recordings, never spliced
/// across the identity migration.
pub fn latest_provider_summaries(samples: &[UsageSample]) -> Vec<ProviderSummary> {
    let physical_providers: std::collections::HashSet<_> = samples
        .iter()
        .filter(|sample| sample.window_key.as_deref() == Some("primary"))
        .map(|sample| sample.provider.as_str())
        .collect();
    let mut latest: Vec<ProviderSummary> = Vec::new();
    for sample in samples.iter().filter(|s| {
        s.window_key.as_deref() == Some("primary")
            || (!physical_providers.contains(s.provider.as_str())
                && s.window_id.as_deref() == Some(SELECTED_WINDOW_ID))
    }) {
        if let Some(existing) = latest
            .iter_mut()
            .find(|p| p.provider == sample.provider && p.account_id == sample.account_id)
        {
            if sample.captured_at >= existing.last_sample_at {
                existing.used_percent = sample.used_percent;
                existing.remaining_percent = sample.remaining_percent;
                existing.resets_at = sample.resets_at;
                existing.last_sample_at = sample.captured_at;
            }
        } else {
            latest.push(ProviderSummary {
                provider: sample.provider.clone(),
                account_id: sample.account_id.clone(),
                used_percent: sample.used_percent,
                remaining_percent: sample.remaining_percent,
                resets_at: sample.resets_at,
                last_sample_at: sample.captured_at,
            });
        }
    }
    latest.sort_by(|a, b| {
        a.provider
            .cmp(&b.provider)
            .then(a.account_id.cmp(&b.account_id))
    });
    latest
}

/// The one normalized data contract every Dashboard widget consumes.
/// Built once per request from real history -- never per-widget queries.
#[derive(Debug, Clone, PartialEq)]
pub struct DashboardSnapshot {
    pub generated_at: i64,
    pub range: ResolvedRange,
    pub timezone: String,
    pub availability: DataAvailability,
    pub providers: Vec<ProviderSummary>,
    pub usage_trend: Vec<UsageDailyPoint>,
    pub spend_trend: Vec<SpendDailyPoint>,
    /// Requested plus immediately preceding equal-duration physical quota
    /// history. `range` still describes only the requested interval.
    pub quota_history: Vec<QuotaHistoryPoint>,
    /// Phase 4A: the formal, structured description of what `spend_trend`
    /// (and any KPI/total derived from it) actually means -- origin,
    /// measurement kind, currency, period, availability, pricing status.
    /// See this module's "Phase 4A: formal cost-measurement contract".
    pub cost_contract: CostContract,
}

/// Build a `DashboardSnapshot` for `range` in `timezone`, optionally scoped
/// to specific providers/accounts (empty = all). Every field is derived
/// from real `HistoryStore` samples; nothing is fabricated when history is
/// thin or empty -- `providers`/`usage_trend`/`spend_trend` are simply
/// empty and `availability` reports zero/`None`.
pub fn build_dashboard_snapshot(
    store: &HistoryStore,
    range: ResolvedRange,
    timezone_name: &str,
    providers: &[String],
    account_ids: &[String],
) -> Result<DashboardSnapshot, String> {
    let tz = resolve_timezone(timezone_name);
    let now = Utc::now();

    // Query the requested interval and its immediately preceding
    // equal-duration interval together. The public range remains the
    // requested interval; consumers partition by observed_at using
    // [range.since, range.until) and the adjacent preceding span.
    let duration = range.until.saturating_sub(range.since);
    let comparison_since = range.since.saturating_sub(duration);
    let comparison = store.query(&HistoryQuery {
        account_ids: account_ids.to_vec(),
        providers: providers.to_vec(),
        since: Some(comparison_since),
        until: Some(range.until),
    })?;
    // HistoryQuery is inclusive for compatibility. Dashboard range
    // semantics are half-open, so an observation exactly at `until` must
    // not leak into either requested or comparison calculations.
    let comparison: Vec<_> = comparison
        .into_iter()
        .filter(|sample| sample.captured_at < range.until)
        .collect();
    let ranged: Vec<_> = comparison
        .iter()
        .filter(|sample| sample.captured_at >= range.since)
        .cloned()
        .collect();
    let previous: Vec<_> = comparison
        .iter()
        .filter(|sample| sample.captured_at < range.since)
        .cloned()
        .collect();
    // Aggregate the adjacent periods independently so a non-bucket-aligned
    // range boundary cannot collapse the previous closing capture into the
    // requested period's first bucket.
    let mut quota_history = aggregate_quota_history(&previous, tz, range.grain);
    quota_history.extend(aggregate_quota_history(&ranged, tz, range.grain));
    sort_quota_history(&mut quota_history);

    // Unbounded-by-range samples power "what is my quota right now" --
    // deliberately independent of the display range (see
    // `ProviderSummary`'s doc comment).
    let all_time = store.query(&HistoryQuery {
        account_ids: account_ids.to_vec(),
        providers: providers.to_vec(),
        since: None,
        until: Some(now.timestamp()),
    })?;

    let ranged_cost_samples: Vec<&UsageSample> = ranged
        .iter()
        .filter(|s| s.window_id.as_deref() == Some(COST_WINDOW_ID) && s.cost_used.is_some())
        .collect();
    let all_time_cost_samples: Vec<&UsageSample> = all_time
        .iter()
        .filter(|s| s.window_id.as_deref() == Some(COST_WINDOW_ID) && s.cost_used.is_some())
        .collect();

    Ok(DashboardSnapshot {
        generated_at: now.timestamp(),
        range,
        timezone: timezone_name.to_string(),
        availability: DataAvailability::from_samples(&all_time),
        providers: latest_provider_summaries(&all_time),
        usage_trend: aggregate_usage(&ranged, tz, range.grain),
        spend_trend: aggregate_spend(&ranged, tz, range.grain),
        quota_history,
        cost_contract: CostContract::from_samples(&ranged_cost_samples, &all_time_cost_samples),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dt(y: i32, m: u32, d: u32, h: u32, mi: u32, s: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(y, m, d, h, mi, s).unwrap()
    }

    // ---- timezone-aware range boundaries ----

    #[test]
    fn today_boundary_riyadh_utc_plus_3_no_dst() {
        // 2026-09-07 22:00 UTC = 2026-09-08 01:00 in Asia/Riyadh (UTC+3,
        // no DST) -- "today" in Riyadh is already the 8th.
        let now = dt(2026, 9, 7, 22, 0, 0);
        let tz = resolve_timezone("Asia/Riyadh");
        let range = resolve_range(DashboardRangeKind::Today, tz, now);
        let expected_midnight = dt(2026, 9, 7, 21, 0, 0).timestamp(); // 2026-09-08T00:00 +03:00
        assert_eq!(range.since, expected_midnight);
        assert_eq!(range.grain, Grain::Hourly);
    }

    #[test]
    fn today_boundary_new_york_lags_utc_day() {
        // Same instant, but America/New_York (UTC-4 in September, EDT) is
        // still on 2026-09-07 at 18:00 local -- "today" there starts
        // earlier in UTC terms than Riyadh's.
        let now = dt(2026, 9, 7, 22, 0, 0);
        let tz = resolve_timezone("America/New_York");
        let range = resolve_range(DashboardRangeKind::Today, tz, now);
        let expected_midnight = dt(2026, 9, 7, 4, 0, 0).timestamp(); // 2026-09-07T00:00 -04:00
        assert_eq!(range.since, expected_midnight);
    }

    #[test]
    fn same_instant_different_zones_produce_different_local_days() {
        let now = dt(2026, 1, 1, 0, 30, 0); // 00:30 UTC on New Year's Day
        let riyadh = resolve_range(
            DashboardRangeKind::Today,
            resolve_timezone("Asia/Riyadh"),
            now,
        );
        let new_york = resolve_range(
            DashboardRangeKind::Today,
            resolve_timezone("America/New_York"),
            now,
        );
        // Riyadh (UTC+3): already Jan 1 03:30 local -> today started at Jan 1 00:00 +03:00.
        assert_eq!(riyadh.since, dt(2025, 12, 31, 21, 0, 0).timestamp());
        // New York (UTC-5 in January, EST): still Dec 31 19:30 local -> today started Dec 31 00:00 -05:00.
        assert_eq!(new_york.since, dt(2025, 12, 31, 5, 0, 0).timestamp());
    }

    #[test]
    fn european_dst_spring_forward_gap_resolves_to_a_valid_instant() {
        // Europe/London: clocks spring forward 01:00 -> 02:00 on 2026-03-29.
        // Local midnight itself is unaffected by a 01:00 gap, so this just
        // proves the resolver produces a real, single instant rather than
        // panicking near a DST boundary.
        let now = dt(2026, 3, 30, 12, 0, 0);
        let tz = resolve_timezone("Europe/London");
        let range = resolve_range(DashboardRangeKind::Today, tz, now);
        assert!(range.since > 0);
        assert!(range.since < range.until);
    }

    #[test]
    fn european_dst_fall_back_ambiguous_local_time_resolves_to_earliest() {
        // Europe/London falls back 02:00 -> 01:00 on 2026-10-25. Querying
        // "Today" from just after the fall-back must still resolve local
        // midnight (unambiguous, since midnight isn't inside the repeated
        // hour) to a single valid instant.
        let now = dt(2026, 10, 25, 12, 0, 0);
        let tz = resolve_timezone("Europe/London");
        let range = resolve_range(DashboardRangeKind::Today, tz, now);
        assert!(range.since > 0);
    }

    #[test]
    fn last_7_days_spans_seven_local_calendar_days_inclusive() {
        let now = dt(2026, 9, 7, 12, 0, 0);
        let tz = resolve_timezone("UTC");
        let range = resolve_range(DashboardRangeKind::Last7Days, tz, now);
        assert_eq!(range.since, dt(2026, 9, 1, 0, 0, 0).timestamp());
        assert_eq!(range.grain, Grain::Daily);
    }

    #[test]
    fn this_month_starts_on_the_first() {
        let now = dt(2026, 9, 15, 8, 0, 0);
        let range = resolve_range(DashboardRangeKind::ThisMonth, resolve_timezone("UTC"), now);
        assert_eq!(range.since, dt(2026, 9, 1, 0, 0, 0).timestamp());
    }

    #[test]
    fn last_3_months_crosses_a_year_boundary() {
        let now = dt(2026, 1, 15, 8, 0, 0);
        let range = resolve_range(
            DashboardRangeKind::Last3Months,
            resolve_timezone("UTC"),
            now,
        );
        assert_eq!(range.since, dt(2025, 11, 1, 0, 0, 0).timestamp());
    }

    #[test]
    fn this_year_starts_january_first() {
        let now = dt(2026, 9, 7, 8, 0, 0);
        let range = resolve_range(DashboardRangeKind::ThisYear, resolve_timezone("UTC"), now);
        assert_eq!(range.since, dt(2026, 1, 1, 0, 0, 0).timestamp());
    }

    // ---- aggregation ----

    fn sample(
        provider: &str,
        account: &str,
        window: &str,
        used: f64,
        cost: Option<f64>,
        at: i64,
    ) -> UsageSample {
        UsageSample {
            account_id: account.to_string(),
            account_scope: None,
            provider: provider.to_string(),
            window_id: Some(window.to_string()),
            window_key: None,
            window_label: None,
            window_minutes: None,
            used_percent: used,
            remaining_percent: 100.0 - used,
            cost_used: cost,
            // Real (Phase-4A-era) samples always carry a currency -- see
            // history_recorder.rs. Legacy-row tests construct their own
            // `UsageSample { cost_currency_code: None, .. }` explicitly.
            cost_currency_code: cost.map(|_| "USD".to_string()),
            // Mirrors history_recorder.rs's real write-time behavior:
            // stamp whatever this provider was proven to write.
            cost_measurement_kind: cost.map(|_| {
                classify_monetary_observation(provider, "")
                    .1
                    .as_str()
                    .to_string()
            }),
            monetary_quantity_kind: cost.map(|_| {
                classify_monetary_observation(provider, "")
                    .0
                    .as_str()
                    .to_string()
            }),
            resets_at: None,
            captured_at: at,
        }
    }

    #[test]
    fn aggregate_usage_takes_the_last_sample_per_bucket() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let samples = vec![
            sample("claude", "a1", "selected", 10.0, None, day0 + 3600),
            sample("claude", "a1", "selected", 25.0, None, day0 + 7200), // same day, later -> wins
        ];
        let points = aggregate_usage(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(points.len(), 1);
        assert_eq!(points[0].used_percent, 25.0);
        assert_eq!(points[0].sample_count, 2);
    }

    #[test]
    fn aggregate_usage_never_mixes_providers_or_accounts() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let samples = vec![
            sample("claude", "a1", "selected", 10.0, None, day0),
            sample("codex", "a1", "selected", 50.0, None, day0),
            sample("claude", "a2", "selected", 90.0, None, day0),
        ];
        let points = aggregate_usage(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(points.len(), 3);
    }

    fn quota_sample(
        account_scope: Option<&str>,
        window_id: &str,
        window_key: Option<&str>,
        window_minutes: Option<u32>,
        used: f64,
        resets_at: Option<i64>,
        at: i64,
    ) -> UsageSample {
        UsageSample {
            account_id: "account".to_string(),
            account_scope: account_scope.map(str::to_string),
            provider: "codex".to_string(),
            window_id: Some(window_id.to_string()),
            window_key: window_key.map(str::to_string),
            window_label: Some("Display label".to_string()),
            window_minutes,
            used_percent: used,
            remaining_percent: 100.0 - used,
            cost_used: None,
            cost_currency_code: None,
            cost_measurement_kind: None,
            monetary_quantity_kind: None,
            resets_at,
            captured_at: at,
        }
    }

    #[test]
    fn quota_history_excludes_legacy_selected_but_labels_legacy_physical_rows() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let samples = vec![
            quota_sample(None, "selected", None, None, 10.0, None, day + 1),
            quota_sample(None, "primary", None, Some(300), 20.0, None, day + 2),
        ];

        let points = aggregate_quota_history(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(points.len(), 1);
        assert_eq!(points[0].window_key, "primary");
        assert_eq!(points[0].account_scope, QuotaAccountScope::Legacy);
    }

    #[test]
    fn quota_history_rejects_inconsistent_percentage_totals() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let mut inconsistent = quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(300),
            50.0,
            None,
            day,
        );
        inconsistent.remaining_percent = 40.0;
        assert!(
            aggregate_quota_history(&[inconsistent], resolve_timezone("UTC"), Grain::Daily)
                .is_empty()
        );
    }

    #[test]
    fn quota_history_keeps_reset_cycles_separate_inside_one_display_bucket() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let samples = vec![
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(300),
                40.0,
                Some(day + 3_600),
                day + 10,
            ),
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(300),
                5.0,
                Some(day + 7_200),
                day + 20,
            ),
        ];

        let points = aggregate_quota_history(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(points.len(), 2);
        assert_eq!(points[0].resets_at, Some(day + 3_600));
        assert_eq!(points[1].resets_at, Some(day + 7_200));
    }

    #[test]
    fn quota_history_uses_the_closing_capture_and_counts_bucket_samples() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let samples = vec![
            quota_sample(
                Some("unresolved"),
                "primary",
                Some("primary"),
                Some(300),
                10.0,
                Some(day + 7_200),
                day + 10,
            ),
            quota_sample(
                Some("unresolved"),
                "primary",
                Some("primary"),
                Some(300),
                30.0,
                Some(day + 7_200),
                day + 20,
            ),
        ];

        let points = aggregate_quota_history(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(points.len(), 1);
        assert_eq!(points[0].account_scope, QuotaAccountScope::Unresolved);
        assert_eq!(points[0].observed_at, day + 20);
        assert_eq!(points[0].used_percent, 30.0);
        assert_eq!(points[0].sample_count, 2);
    }

    #[test]
    fn quota_bucket_retains_conflicts_and_hidden_counter_decreases() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let make = |offset, used| {
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(10080),
                used,
                Some(day + 604800),
                day + offset,
            )
        };
        let conflicts = aggregate_quota_history(
            &[make(10, 20.0), make(10, 80.0), make(20, 90.0)],
            resolve_timezone("UTC"),
            Grain::Hourly,
        );
        assert!(conflicts[0].has_conflicting_samples);
        assert_eq!(conflicts[0].used_percent, 90.0);
        let drops = aggregate_quota_history(
            &[
                make(3601, 90.0),
                make(3610, 30.0),
                make(3620, 95.0),
                make(10, 20.0),
            ],
            resolve_timezone("UTC"),
            Grain::Hourly,
        );
        assert!(drops[1].counter_decreased);
        assert!(!drops[1].has_conflicting_samples);
        let duplicate = aggregate_quota_history(
            &[make(10, 20.0), make(10, 20.0)],
            resolve_timezone("UTC"),
            Grain::Hourly,
        );
        assert_eq!(duplicate[0].sample_count, 1);
    }

    // ---- Claude continuation wave: adversarial corpus for defensive paths
    // that were already implemented (the `.is_finite()`/range/sum checks a
    // few lines above `aggregate_quota_history`'s loop body) but had no
    // dedicated regression test proving they actually reject what they
    // claim to. Real gap, not re-covering already-tested ground. ----

    #[test]
    fn nan_used_percent_is_rejected_not_silently_aggregated() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let samples = vec![quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(10080),
            f64::NAN,
            Some(day + 604_800),
            day + 10,
        )];
        let points = aggregate_quota_history(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert!(
            points.is_empty(),
            "a NaN reading must never produce a bucket"
        );
    }

    #[test]
    fn infinite_used_percent_is_rejected_not_silently_aggregated() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let samples = vec![quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(10080),
            f64::INFINITY,
            Some(day + 604_800),
            day + 10,
        )];
        let points = aggregate_quota_history(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert!(
            points.is_empty(),
            "an infinite reading must never produce a bucket"
        );
    }

    #[test]
    fn used_percent_over_100_is_rejected() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        // 150% used, remaining left at a value that would sum close to 100
        // with it -- the >100 range check must reject this on its own,
        // independent of the used+remaining consistency check.
        let mut sample = quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(10080),
            150.0,
            Some(day + 604_800),
            day + 10,
        );
        sample.remaining_percent = -50.0;
        let points = aggregate_quota_history(&[sample], resolve_timezone("UTC"), Grain::Daily);
        assert!(points.is_empty(), ">100% used must never produce a bucket");
    }

    #[test]
    fn negative_used_percent_is_rejected() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let sample = quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(10080),
            -5.0,
            Some(day + 604_800),
            day + 10,
        );
        let points = aggregate_quota_history(&[sample], resolve_timezone("UTC"), Grain::Daily);
        assert!(
            points.is_empty(),
            "negative used% must never produce a bucket"
        );
    }

    #[test]
    fn used_and_remaining_percent_inconsistency_is_rejected() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        // used=40, remaining=40 -- both individually in [0,100], but they
        // don't sum to ~100, which the sum-consistency guard must catch
        // even though neither value alone looks invalid.
        let mut sample = quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(10080),
            40.0,
            Some(day + 604_800),
            day + 10,
        );
        sample.remaining_percent = 40.0;
        let points = aggregate_quota_history(&[sample], resolve_timezone("UTC"), Grain::Daily);
        assert!(
            points.is_empty(),
            "used+remaining far from 100 must never produce a bucket"
        );
    }

    #[test]
    fn out_of_order_captured_at_still_resolves_to_the_true_latest_reading() {
        // Samples arrive in reverse-chronological order (as real
        // multi-source observation could plausibly do) -- the aggregator
        // sorts by captured_at internally, so the bucket's final reading
        // must be the truly-latest one by time, not the last one in the
        // input slice.
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let make = |offset, used| {
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(10080),
                used,
                Some(day + 604_800),
                day + offset,
            )
        };
        let reverse_order = vec![make(30, 90.0), make(20, 50.0), make(10, 10.0)];
        let points = aggregate_quota_history(&reverse_order, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(points.len(), 1);
        assert_eq!(
            points[0].used_percent, 90.0,
            "the reading at offset 30 (latest by time) must win, regardless of input order"
        );
        assert_eq!(points[0].observed_at, day + 30);
    }

    #[test]
    fn missing_window_identity_never_fabricates_a_bucket() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let mut sample = quota_sample(
            Some("observed"),
            "primary",
            None,
            Some(10080),
            50.0,
            Some(day + 604_800),
            day + 10,
        );
        sample.window_id = None;
        let points = aggregate_quota_history(&[sample], resolve_timezone("UTC"), Grain::Daily);
        assert!(
            points.is_empty(),
            "a sample with no window_key AND no window_id must never produce a bucket"
        );
    }

    // ---- Claude continuation wave 2: DST bucketing, exact window
    // boundaries, gaps, account/window switches mid-series, staleness, and
    // the usedPercent extremes (0%, 100%, and the exact >100% bound). ----

    #[test]
    fn quota_history_hourly_bucket_survives_dst_spring_forward_without_panicking() {
        // Europe/London springs forward 01:00 -> 02:00 on 2026-03-29. A
        // reading just before the transition and one just after must both
        // resolve to real, non-panicking hourly buckets, in the correct
        // relative order.
        let tz = resolve_timezone("Europe/London");
        let before = dt(2026, 3, 29, 0, 30, 0).timestamp(); // 00:30 GMT local (UTC+0)
        let after = dt(2026, 3, 29, 1, 30, 0).timestamp(); // 02:30 BST local (UTC+1)
        let samples = vec![
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(60),
                10.0,
                Some(before + 3_600),
                before,
            ),
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(60),
                20.0,
                Some(after + 3_600),
                after,
            ),
        ];
        let points = aggregate_quota_history(&samples, tz, Grain::Hourly);
        assert_eq!(
            points.len(),
            2,
            "distinct resets_at keep the two readings as separate buckets"
        );
        assert!(points[0].bucket_start < points[1].bucket_start);
    }

    #[test]
    fn quota_history_hourly_bucket_fall_back_ambiguous_hour_merges_to_earliest() {
        // Europe/London falls back 02:00 BST -> 01:00 GMT on 2026-10-25.
        // Local wall-clock 01:30 occurs twice (first at BST, then at
        // GMT). Documented policy (`local_hour_start_epoch`'s Ambiguous
        // branch) resolves both occurrences to the SAME earliest-instant
        // bucket -- proven here by keeping resets_at distinct so the two
        // points survive as separate records while their bucket_start
        // collapses to one value, isolating exactly the DST behavior
        // under test.
        let tz = resolve_timezone("Europe/London");
        let first_occurrence = dt(2026, 10, 25, 0, 30, 0).timestamp(); // 01:30 BST (UTC+1)
        let second_occurrence = dt(2026, 10, 25, 1, 30, 0).timestamp(); // 01:30 GMT (UTC+0)
        let samples = vec![
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(60),
                10.0,
                Some(first_occurrence + 3_600),
                first_occurrence,
            ),
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(60),
                20.0,
                Some(second_occurrence + 3_600),
                second_occurrence,
            ),
        ];
        let points = aggregate_quota_history(&samples, tz, Grain::Hourly);
        assert_eq!(points.len(), 2);
        assert_eq!(
            points[0].bucket_start, points[1].bucket_start,
            "both occurrences of the ambiguous local hour must collapse to the earliest instant"
        );
    }

    #[test]
    fn quota_history_sample_exactly_at_local_midnight_buckets_into_that_day_not_the_previous() {
        let tz = resolve_timezone("UTC");
        let midnight = dt(2026, 9, 2, 0, 0, 0).timestamp();
        let sample = quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(1_440),
            15.0,
            Some(midnight + 86_400),
            midnight,
        );
        let points = aggregate_quota_history(&[sample], tz, Grain::Daily);
        assert_eq!(points.len(), 1);
        assert_eq!(
            points[0].bucket_start, midnight,
            "a reading exactly at local midnight belongs to that day's bucket, not the prior day"
        );
    }

    #[test]
    fn quota_history_missing_days_leave_a_real_gap_not_a_fabricated_bucket() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let day3 = dt(2026, 9, 4, 6, 0, 0).timestamp(); // days 2 and 3 have no samples
        let samples = vec![
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(1_440),
                10.0,
                Some(day0 + 86_400),
                day0,
            ),
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(1_440),
                40.0,
                Some(day3 + 86_400),
                day3,
            ),
        ];
        let points = aggregate_quota_history(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(
            points.len(),
            2,
            "no bucket is fabricated for the missing middle days"
        );
    }

    #[test]
    fn quota_history_account_scope_switch_mid_series_stays_split_and_never_flags_a_false_decrease()
    {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let samples = vec![
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(1_440),
                80.0,
                Some(day0 + 604_800),
                day0,
            ),
            // Same provider/account/window/resets_at but a DIFFERENT
            // account_scope -- a legitimate identity-resolution change,
            // not a counter decrease on a continuing series.
            quota_sample(
                Some("unresolved"),
                "primary",
                Some("primary"),
                Some(1_440),
                10.0,
                Some(day0 + 604_800),
                day0 + 60,
            ),
        ];
        let points = aggregate_quota_history(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(
            points.len(),
            2,
            "different account_scope must produce a distinct series, never merge into one bucket"
        );
        assert!(
            points.iter().all(|p| !p.counter_decreased),
            "an account_scope switch must never be misread as a counter decrease"
        );
    }

    #[test]
    fn quota_history_window_switch_mid_series_stays_split_and_never_flags_a_false_decrease() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let samples = vec![
            quota_sample(
                Some("observed"),
                "primary",
                Some("primary"),
                Some(1_440),
                90.0,
                Some(day0 + 604_800),
                day0,
            ),
            // Same account, different physical window_key -- a genuinely
            // different quota, not a continuation of the "primary" series.
            quota_sample(
                Some("observed"),
                "secondary",
                Some("secondary"),
                Some(1_440),
                5.0,
                Some(day0 + 604_800),
                day0 + 60,
            ),
        ];
        let points = aggregate_quota_history(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(points.len(), 2);
        assert!(
            points.iter().all(|p| !p.counter_decreased),
            "a physical-window switch must never be misread as a counter decrease"
        );
        let window_keys: std::collections::HashSet<_> =
            points.iter().map(|p| p.window_key.as_str()).collect();
        assert_eq!(
            window_keys,
            std::collections::HashSet::from(["primary", "secondary"])
        );
    }

    #[test]
    fn quota_history_includes_a_stale_reading_whose_reset_already_passed_rather_than_excluding_it()
    {
        // A "stale" observation: resets_at is in the past relative to
        // captured_at (the window had already rolled over by the time
        // this was captured) -- this must still be reported as real
        // history, never silently dropped by an implicit staleness
        // filter. Only the explicit finite/range/consistency checks may
        // exclude a sample.
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let sample = quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(1_440),
            42.0,
            Some(day - 3_600),
            day,
        );
        let points = aggregate_quota_history(&[sample], resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(
            points.len(),
            1,
            "a stale (already-passed reset) reading must still be reported, not excluded"
        );
        assert_eq!(points[0].used_percent, 42.0);
    }

    #[test]
    fn used_percent_exactly_zero_is_accepted() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let sample = quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(10_080),
            0.0,
            Some(day + 604_800),
            day + 10,
        );
        let points = aggregate_quota_history(&[sample], resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(points.len(), 1);
        assert_eq!(points[0].used_percent, 0.0);
    }

    #[test]
    fn used_percent_exactly_one_hundred_is_accepted() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let sample = quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(10_080),
            100.0,
            Some(day + 604_800),
            day + 10,
        );
        let points = aggregate_quota_history(&[sample], resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(points.len(), 1);
        assert_eq!(points[0].used_percent, 100.0);
    }

    #[test]
    fn used_percent_just_over_one_hundred_is_rejected_by_the_range_check_alone() {
        let day = dt(2026, 9, 1, 0, 0, 0).timestamp();
        // 100.1 / -0.1 sums to exactly 100 -- isolates the >100 range
        // check from the separate sum-consistency check, proving the
        // rejection fires the instant used% exceeds 100 even by a
        // fraction, not just at the round 150.0 the existing test used.
        let sample = quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(10_080),
            100.1,
            Some(day + 604_800),
            day + 10,
        );
        let points = aggregate_quota_history(&[sample], resolve_timezone("UTC"), Grain::Daily);
        assert!(
            points.is_empty(),
            "used% must be rejected the instant it exceeds 100, even by a fraction"
        );
    }

    #[test]
    fn summaries_follow_physical_primary_without_retaining_old_account_aliases() {
        let legacy = sample("codex", "old-profile", "selected", 80.0, None, 100);
        let mut physical = quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(300),
            25.0,
            None,
            200,
        );
        physical.provider = "codex".into();
        physical.account_id = "observed:new".into();
        let fresh = latest_provider_summaries(std::slice::from_ref(&physical));
        let migrated = latest_provider_summaries(&[legacy, physical]);
        assert_eq!(fresh, migrated);
        assert_eq!(fresh.len(), 1);
        assert_eq!(fresh[0].used_percent, 25.0);
        assert_eq!(fresh[0].last_sample_at, 200);
    }

    #[test]
    fn aggregate_spend_ignores_percentage_windows() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let samples = vec![
            sample("claude", "a1", "selected", 10.0, None, day0),
            sample("claude", "a1", "cost", 0.0, Some(4.5), day0),
        ];
        let spend = aggregate_spend(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(spend.len(), 1);
        assert_eq!(spend[0].cost_used, 4.5);
    }

    #[test]
    fn aggregate_spend_produces_nothing_when_no_cost_data_exists() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let samples = vec![sample("claude", "a1", "selected", 10.0, None, day0)];
        assert!(aggregate_spend(&samples, resolve_timezone("UTC"), Grain::Daily).is_empty());
    }

    // ── Phase 4A: monetary-semantics regression corpus ──────────────────
    // docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md "Phase 4A" section.
    // Makes the original "sum every cumulative bucket" bug structurally
    // impossible to reintroduce, and proves the new mixed-measurement-
    // kind/multi-currency/multi-account/legacy-row handling.

    fn cost_sample(
        provider: &str,
        account: &str,
        cost: f64,
        currency: Option<&str>,
        kind: Option<CostMeasurementKind>,
        at: i64,
    ) -> UsageSample {
        UsageSample {
            account_id: account.to_string(),
            account_scope: None,
            provider: provider.to_string(),
            window_id: Some(COST_WINDOW_ID.to_string()),
            window_key: None,
            window_label: Some("Monthly".to_string()),
            window_minutes: None,
            used_percent: 0.0,
            remaining_percent: 0.0,
            cost_used: Some(cost),
            cost_currency_code: currency.map(|c| c.to_string()),
            cost_measurement_kind: kind.map(|k| k.as_str().to_string()),
            // These pre-existing (measurement-kind-focused) fixtures don't
            // exercise the quantity dimension explicitly -- default to the
            // quantity kind that pairs naturally with the given
            // measurement kind (Cumulative -> Spend, PointInTime ->
            // Balance) so they keep testing exactly what they said they
            // were testing. Dedicated quantity-kind tests below use
            // `cost_sample_q` instead.
            monetary_quantity_kind: kind.map(|k| match k {
                CostMeasurementKind::PointInTime => {
                    MonetaryQuantityKind::Balance.as_str().to_string()
                }
                _ => MonetaryQuantityKind::Spend.as_str().to_string(),
            }),
            resets_at: None,
            captured_at: at,
        }
    }

    /// Like `cost_sample`, but lets a test set BOTH orthogonal dimensions
    /// explicitly -- for the quantity-kind-specific regression corpus
    /// (owner Phase 4A.1 section 21).
    #[allow(
        clippy::too_many_arguments,
        reason = "test fixture constructor, mirrors UsageSample's real field count"
    )]
    fn cost_sample_q(
        provider: &str,
        account: &str,
        cost: f64,
        currency: Option<&str>,
        quantity: Option<MonetaryQuantityKind>,
        kind: Option<CostMeasurementKind>,
        at: i64,
    ) -> UsageSample {
        UsageSample {
            account_id: account.to_string(),
            account_scope: None,
            provider: provider.to_string(),
            window_id: Some(COST_WINDOW_ID.to_string()),
            window_key: None,
            window_label: Some("Monthly".to_string()),
            window_minutes: None,
            used_percent: 0.0,
            remaining_percent: 0.0,
            cost_used: Some(cost),
            cost_currency_code: currency.map(|c| c.to_string()),
            cost_measurement_kind: kind.map(|k| k.as_str().to_string()),
            monetary_quantity_kind: quantity.map(|q| q.as_str().to_string()),
            resets_at: None,
            captured_at: at,
        }
    }

    #[test]
    fn cost_contract_unavailable_when_no_cost_samples_exist_at_all() {
        let contract = CostContract::from_samples(&[], &[]);
        assert_eq!(contract.origin, CostOrigin::Unavailable);
        assert_eq!(contract.measurement_kind, CostMeasurementKind::Unknown);
        assert_eq!(contract.availability, CostAvailability::Unavailable);
        assert_eq!(contract.currency_code, None);
    }

    #[test]
    fn cost_contract_legacy_ambiguous_when_only_pre_phase4a_rows_exist() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        // No currency/kind tag at all -- exactly what a row written before
        // this migration reads back as.
        let legacy = cost_sample("claude", "a1", 5.0, None, None, day0);
        let all: Vec<&UsageSample> = vec![&legacy];
        let contract = CostContract::from_samples(&[], &all);
        assert_eq!(contract.origin, CostOrigin::Unavailable);
        assert_eq!(contract.measurement_kind, CostMeasurementKind::Unknown);
        assert_eq!(contract.availability, CostAvailability::LegacyAmbiguous);
    }

    #[test]
    fn cost_contract_available_and_cumulative_for_a_known_cumulative_provider() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let s = cost_sample(
            "claude",
            "a1",
            12.0,
            Some("USD"),
            Some(CostMeasurementKind::Cumulative),
            day0,
        );
        let all: Vec<&UsageSample> = vec![&s];
        let contract = CostContract::from_samples(&all, &all);
        assert_eq!(contract.origin, CostOrigin::ProviderReported);
        assert_eq!(contract.measurement_kind, CostMeasurementKind::Cumulative);
        assert_eq!(contract.currency_code, Some("USD".to_string()));
        assert_eq!(contract.availability, CostAvailability::Available);
        assert_eq!(contract.pricing_status, PricingStatus::NotRequired);
    }

    #[test]
    fn cost_contract_point_in_time_for_a_known_balance_provider() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        // zenmux writes a prepaid PAYG balance into `used`, not spend.
        let s = cost_sample(
            "zenmux",
            "a1",
            30.0,
            Some("USD"),
            Some(CostMeasurementKind::PointInTime),
            day0,
        );
        let all: Vec<&UsageSample> = vec![&s];
        let contract = CostContract::from_samples(&all, &all);
        assert_eq!(contract.measurement_kind, CostMeasurementKind::PointInTime);
    }

    #[test]
    fn cost_contract_collapses_to_unknown_when_measurement_kinds_are_mixed() {
        // Claude (Cumulative period spend) and ZenMux (PointInTime prepaid
        // balance) are NOT the same quantity -- combining them must never
        // silently pick one kind.
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let claude = cost_sample(
            "claude",
            "a1",
            12.0,
            Some("USD"),
            Some(CostMeasurementKind::Cumulative),
            day0,
        );
        let zenmux = cost_sample(
            "zenmux",
            "a2",
            30.0,
            Some("USD"),
            Some(CostMeasurementKind::PointInTime),
            day0,
        );
        let all: Vec<&UsageSample> = vec![&claude, &zenmux];
        let contract = CostContract::from_samples(&all, &all);
        assert_eq!(contract.measurement_kind, CostMeasurementKind::Unknown);
    }

    #[test]
    fn cost_contract_codex_dual_path_provider_is_unknown_not_guessed() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let s = cost_sample(
            "codex",
            "a1",
            5.0,
            Some("USD"),
            Some(provider_cost_measurement_kind("codex")),
            day0,
        );
        let all: Vec<&UsageSample> = vec![&s];
        let contract = CostContract::from_samples(&all, &all);
        assert_eq!(contract.measurement_kind, CostMeasurementKind::Unknown);
    }

    #[test]
    fn cost_contract_currency_is_none_when_currencies_differ() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let usd = cost_sample(
            "claude",
            "a1",
            12.0,
            Some("USD"),
            Some(CostMeasurementKind::Cumulative),
            day0,
        );
        let eur = cost_sample(
            "mistral",
            "a2",
            9.0,
            Some("EUR"),
            Some(CostMeasurementKind::Cumulative),
            day0,
        );
        let all: Vec<&UsageSample> = vec![&usd, &eur];
        let contract = CostContract::from_samples(&all, &all);
        // Never silently pick one currency (or sum across them) -- see
        // owner Phase 4A section 13.
        assert_eq!(contract.currency_code, None);
        // Same-kind Cumulative readings, so the kind itself is still
        // known even though currency isn't -- these are separate facts.
        assert_eq!(contract.measurement_kind, CostMeasurementKind::Cumulative);
    }

    #[test]
    fn cost_contract_same_currency_across_two_accounts_is_available() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let a1 = cost_sample(
            "claude",
            "a1",
            12.0,
            Some("USD"),
            Some(CostMeasurementKind::Cumulative),
            day0,
        );
        let a2 = cost_sample(
            "claude",
            "a2",
            8.0,
            Some("USD"),
            Some(CostMeasurementKind::Cumulative),
            day0,
        );
        let all: Vec<&UsageSample> = vec![&a1, &a2];
        let contract = CostContract::from_samples(&all, &all);
        assert_eq!(contract.currency_code, Some("USD".to_string()));
        assert_eq!(contract.availability, CostAvailability::Available);
    }

    /// The core anti-regression proof: a cumulative-period series of
    /// 1 -> 2 -> 3 -> 4 (each reading is a running total for the SAME
    /// billing period, not a delta) must aggregate to the LATEST reading
    /// (4), never the sum (10) -- reproduces, in miniature, the exact
    /// shape of the original `estimatedSpendTotal` bug.
    #[test]
    fn latest_value_per_bucket_never_sums_a_cumulative_series() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let samples = vec![
            cost_sample(
                "claude",
                "a1",
                1.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0,
            ),
            cost_sample(
                "claude",
                "a1",
                2.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0 + 60,
            ),
            cost_sample(
                "claude",
                "a1",
                3.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0 + 120,
            ),
            cost_sample(
                "claude",
                "a1",
                4.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0 + 180,
            ),
        ];
        let spend = aggregate_spend(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(
            spend.len(),
            1,
            "all four readings fall in the same day bucket"
        );
        assert_eq!(
            spend[0].cost_used, 4.0,
            "must be the LATEST reading, not 1+2+3+4=10"
        );
    }

    /// Billing-period reset boundary: 8 -> 10 -> 0.5 (a genuine reset --
    /// the provider's period rolled over and the counter restarted low).
    /// The latest-value rule must report 0.5 honestly, never treat the
    /// drop as a negative delta or clamp/interpolate it.
    #[test]
    fn cumulative_reset_boundary_reports_the_latest_reading_as_is() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let samples = vec![
            cost_sample(
                "claude",
                "a1",
                8.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0,
            ),
            cost_sample(
                "claude",
                "a1",
                10.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0 + 60,
            ),
            cost_sample(
                "claude",
                "a1",
                0.5,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0 + 120,
            ),
        ];
        let spend = aggregate_spend(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(spend.len(), 1);
        assert_eq!(spend[0].cost_used, 0.5);
    }

    /// Ambiguous counter decrease (10 -> 9, no obvious reset): the same
    /// latest-value rule applies -- report what the provider most
    /// recently said, never invent a delta or reject the reading.
    #[test]
    fn counter_decrease_without_a_clear_reset_still_reports_latest_reading() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let samples = vec![
            cost_sample(
                "claude",
                "a1",
                10.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0,
            ),
            cost_sample(
                "claude",
                "a1",
                9.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0 + 60,
            ),
        ];
        let spend = aggregate_spend(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(spend.len(), 1);
        assert_eq!(spend[0].cost_used, 9.0);
    }

    /// Duplicate readings (identical value, two captures) must not double
    /// the bucket's total -- "latest wins" is naturally idempotent here.
    #[test]
    fn duplicate_readings_in_the_same_bucket_do_not_inflate_the_total() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let samples = vec![
            cost_sample(
                "claude",
                "a1",
                5.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0,
            ),
            cost_sample(
                "claude",
                "a1",
                5.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0 + 30,
            ),
        ];
        let spend = aggregate_spend(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(spend.len(), 1);
        assert_eq!(spend[0].cost_used, 5.0);
    }

    /// Multi-account: two DIFFERENT accounts of the same provider must
    /// remain two independent series, never merged into one counter.
    #[test]
    fn multi_account_cost_series_stay_independent_never_merged() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let samples = vec![
            cost_sample(
                "claude",
                "a1",
                10.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0,
            ),
            cost_sample(
                "claude",
                "a2",
                25.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0,
            ),
        ];
        let spend = aggregate_spend(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(
            spend.len(),
            2,
            "two accounts must stay as two separate buckets"
        );
        let a1 = spend.iter().find(|p| p.account_id == "a1").unwrap();
        let a2 = spend.iter().find(|p| p.account_id == "a2").unwrap();
        assert_eq!(a1.cost_used, 10.0);
        assert_eq!(a2.cost_used, 25.0);
    }

    /// Multi-currency: two series in different currencies must stay
    /// tagged with their own currency, never coerced to one.
    #[test]
    fn multi_currency_series_keep_their_own_currency_tag() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let samples = vec![
            cost_sample(
                "claude",
                "a1",
                10.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0,
            ),
            cost_sample(
                "mistral",
                "a2",
                9.0,
                Some("EUR"),
                Some(CostMeasurementKind::Cumulative),
                day0,
            ),
        ];
        let spend = aggregate_spend(&samples, resolve_timezone("UTC"), Grain::Daily);
        let usd = spend.iter().find(|p| p.provider == "claude").unwrap();
        let eur = spend.iter().find(|p| p.provider == "mistral").unwrap();
        assert_eq!(usd.currency_code, Some("USD".to_string()));
        assert_eq!(eur.currency_code, Some("EUR".to_string()));
    }

    /// Missing samples (a gap in captures) must simply produce fewer
    /// buckets, never an interpolated/fabricated value for the gap.
    #[test]
    fn missing_samples_leave_a_real_gap_not_a_fabricated_bucket() {
        let day0 = dt(2026, 9, 1, 6, 0, 0).timestamp();
        let day2 = dt(2026, 9, 3, 6, 0, 0).timestamp(); // day 2 (Sep 2) has no sample at all
        let samples = vec![
            cost_sample(
                "claude",
                "a1",
                5.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0,
            ),
            cost_sample(
                "claude",
                "a1",
                7.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day2,
            ),
        ];
        let spend = aggregate_spend(&samples, resolve_timezone("UTC"), Grain::Daily);
        assert_eq!(
            spend.len(),
            2,
            "no bucket is fabricated for the missing middle day"
        );
    }

    /// Bucket-granularity invariant (owner Phase 4A section 11): the same
    /// underlying cumulative-period history queried at a finer grain
    /// (more buckets) must not change the LATEST reading -- changing
    /// chart granularity must never multiply or shrink the true total.
    #[test]
    fn changing_bucket_grain_does_not_change_the_latest_cumulative_reading() {
        let day0 = dt(2026, 9, 1, 1, 0, 0).timestamp();
        let samples = vec![
            cost_sample(
                "claude",
                "a1",
                3.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0,
            ),
            cost_sample(
                "claude",
                "a1",
                6.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0 + 3600,
            ),
            cost_sample(
                "claude",
                "a1",
                9.0,
                Some("USD"),
                Some(CostMeasurementKind::Cumulative),
                day0 + 7200,
            ),
        ];
        let tz = resolve_timezone("UTC");
        let hourly = aggregate_spend(&samples, tz, Grain::Hourly);
        let daily = aggregate_spend(&samples, tz, Grain::Daily);

        let hourly_latest: f64 = hourly
            .iter()
            .map(|p| p.bucket_start)
            .max()
            .map(|max_bucket| {
                hourly
                    .iter()
                    .filter(|p| p.bucket_start == max_bucket)
                    .map(|p| p.cost_used)
                    .fold(0.0, f64::max)
            })
            .unwrap_or(0.0);
        let daily_latest: f64 = daily.iter().map(|p| p.cost_used).fold(0.0, f64::max);

        // Hourly grain produces 3 distinct buckets (3.0, 6.0, 9.0); daily
        // grain collapses them to one bucket holding the latest (9.0).
        // Either way the TRUE current total ("what is my spend right
        // now") is 9.0, not 3.0+6.0+9.0=18.0 from summing hourly buckets.
        assert_eq!(hourly.len(), 3);
        assert_eq!(daily.len(), 1);
        assert_eq!(hourly_latest, 9.0);
        assert_eq!(daily_latest, 9.0);
    }

    // ---- data availability ----

    #[test]
    fn availability_reflects_real_samples_only() {
        let samples = vec![
            sample("claude", "a1", "selected", 10.0, None, 1000),
            sample("claude", "a1", "cost", 0.0, Some(1.0), 2000),
        ];
        let availability = DataAvailability::from_samples(&samples);
        assert_eq!(availability.first_sample_at, Some(1000));
        assert_eq!(availability.last_sample_at, Some(2000));
        assert_eq!(availability.sample_count, 2);
        assert!(availability.has_cost_data);
        assert!(!availability.has_token_data);
        assert!(!availability.has_request_data);
        assert!(!availability.has_model_data);
    }

    #[test]
    fn availability_of_empty_history_is_honestly_empty() {
        let availability = DataAvailability::from_samples(&[]);
        assert_eq!(availability.first_sample_at, None);
        assert_eq!(availability.sample_count, 0);
        assert!(!availability.has_cost_data);
    }

    // ---- provider summaries ----

    #[test]
    fn latest_provider_summary_ignores_display_range() {
        let samples = vec![
            sample("claude", "a1", "selected", 10.0, None, 1000),
            sample("claude", "a1", "selected", 40.0, None, 5000),
        ];
        let latest = latest_provider_summaries(&samples);
        assert_eq!(latest.len(), 1);
        assert_eq!(latest[0].used_percent, 40.0);
        assert_eq!(latest[0].last_sample_at, 5000);
    }

    // ---- end-to-end snapshot, against the real store ----

    fn store() -> HistoryStore {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("history.db");
        std::mem::forget(dir);
        HistoryStore::open_at(path)
    }

    #[test]
    fn snapshot_over_empty_history_reports_unavailable_not_fabricated() {
        let store = store();
        let now = Utc::now();
        let range = resolve_range(DashboardRangeKind::Today, resolve_timezone("UTC"), now);
        let snapshot = build_dashboard_snapshot(&store, range, "UTC", &[], &[]).unwrap();
        assert_eq!(snapshot.availability.sample_count, 0);
        assert!(snapshot.providers.is_empty());
        assert!(snapshot.usage_trend.is_empty());
        assert!(snapshot.spend_trend.is_empty());
    }

    #[test]
    fn snapshot_reflects_real_recorded_history() {
        let store = store();
        let now = Utc::now();
        store
            .record_samples(&[
                sample(
                    "claude",
                    "a1",
                    "selected",
                    30.0,
                    None,
                    now.timestamp() - 3600,
                ),
                sample(
                    "claude",
                    "a1",
                    "cost",
                    0.0,
                    Some(2.5),
                    now.timestamp() - 3600,
                ),
            ])
            .unwrap();
        // Last7Days rather than Today: a sample from "1 hour ago" can fall
        // on the previous UTC calendar day depending on wall-clock time
        // when the suite runs, which flaked this test right at UTC
        // midnight. Last7Days comfortably contains "1 hour ago" regardless
        // of day boundary while still exercising the same real-recorded-
        // history path.
        let range = resolve_range(DashboardRangeKind::Last7Days, resolve_timezone("UTC"), now);
        let snapshot = build_dashboard_snapshot(&store, range, "UTC", &[], &[]).unwrap();
        assert_eq!(snapshot.providers.len(), 1);
        assert_eq!(snapshot.providers[0].used_percent, 30.0);
        assert!(snapshot.availability.has_cost_data);
        assert!(!snapshot.spend_trend.is_empty());
    }

    #[test]
    fn snapshot_quota_history_contains_requested_and_immediately_previous_ranges_only() {
        let store = store();
        let now = Utc::now().timestamp();
        let range = ResolvedRange {
            since: now - 100,
            until: now,
            grain: Grain::Hourly,
        };
        let mut before_previous = quota_sample(
            Some("observed"),
            "primary",
            Some("primary"),
            Some(300),
            1.0,
            Some(now + 300),
            now - 201,
        );
        before_previous.account_id = "observed:abc".to_string();
        let mut previous = before_previous.clone();
        previous.used_percent = 10.0;
        previous.remaining_percent = 90.0;
        previous.captured_at = now - 150;
        let mut requested = previous.clone();
        requested.used_percent = 20.0;
        requested.remaining_percent = 80.0;
        requested.captured_at = now - 50;
        let mut at_until = requested.clone();
        at_until.used_percent = 30.0;
        at_until.remaining_percent = 70.0;
        at_until.captured_at = now;
        store
            .record_samples(&[before_previous, previous, requested, at_until])
            .unwrap();

        let snapshot = build_dashboard_snapshot(&store, range, "UTC", &[], &[]).unwrap();
        let observed: Vec<_> = snapshot
            .quota_history
            .iter()
            .map(|point| point.observed_at)
            .collect();
        assert_eq!(observed, vec![now - 150, now - 50]);
        assert_eq!(snapshot.range, range);
    }

    // ---- Quotalis rebrand: legacy QuotaArc history.db compatibility ----
    //
    // The Quotalis rebrand (docs/validation/QUOTALIS_WINDOWS_IDENTITY_MIGRATION.md,
    // Option A) never changed the history.db schema, table names, or query
    // logic -- only the crate name (codexbar -> quotalis_core) and product
    // branding. This test proves that claim executably rather than by
    // construction: it builds a fixture history.db exactly the way any real
    // install (legacy QuotaArc or current Quotalis; the on-disk format is
    // identical either way) would have via `HistoryStore::record_samples`,
    // closes that handle, reopens the SAME file with a fresh `HistoryStore`
    // (simulating a new process -- Quotalis -- opening a database an older
    // process wrote), and verifies every field the owner's spec calls out
    // (row count, first/last timestamp, provider/account counts) survives,
    // plus that `build_dashboard_snapshot` can query it. No Personal data
    // is read or written; this uses a synthetic tempdir fixture only.
    #[test]
    fn legacy_history_db_is_fully_readable_after_reopening_with_a_fresh_store() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("history.db");

        let first_sample_at;
        let last_sample_at;
        {
            // "Legacy" writer: a HistoryStore instance representing whatever
            // process (QuotaArc or Quotalis -- the format is unchanged)
            // originally created this file.
            let legacy_writer = HistoryStore::open_at(path.clone());
            let now = Utc::now().timestamp();
            first_sample_at = now - 4 * 86_400; // 4 days of history
            last_sample_at = now;
            legacy_writer
                .record_samples(&[
                    sample("claude", "acct-a", "selected", 20.0, None, first_sample_at),
                    sample("claude", "acct-a", "selected", 55.0, None, now - 2 * 86_400),
                    sample("codex", "acct-b", "selected", 80.0, None, last_sample_at),
                    sample("codex", "acct-b", "cost", 0.0, Some(4.25), last_sample_at),
                ])
                .unwrap();
            assert_eq!(legacy_writer.row_count().unwrap(), 4);
        } // legacy_writer dropped here -- its connection is closed.

        // Fresh "Quotalis" reader: a brand-new HistoryStore over the exact
        // same on-disk file, as if a different (renamed) process opened it.
        let quotalis_reader = HistoryStore::open_at(path);
        assert_eq!(
            quotalis_reader.row_count().unwrap(),
            4,
            "row count must survive being reopened by a fresh store handle"
        );

        let now = Utc::now();
        let range = resolve_range(DashboardRangeKind::Last7Days, resolve_timezone("UTC"), now);
        let snapshot = build_dashboard_snapshot(&quotalis_reader, range, "UTC", &[], &[]).unwrap();

        assert_eq!(
            snapshot.availability.sample_count, 4,
            "DataAvailability must report the real row count from the reopened db"
        );
        assert_eq!(
            snapshot.availability.first_sample_at,
            Some(first_sample_at),
            "first sample timestamp must be preserved exactly, not truncated"
        );
        assert_eq!(
            snapshot.availability.last_sample_at,
            Some(last_sample_at),
            "last sample timestamp must be preserved exactly, not truncated"
        );
        assert!(
            snapshot.availability.has_cost_data,
            "cost data recorded before reopening must still be visible after"
        );

        let providers: std::collections::HashSet<_> = snapshot
            .providers
            .iter()
            .map(|p| (p.provider.as_str(), p.account_id.as_str()))
            .collect();
        assert_eq!(
            providers,
            std::collections::HashSet::from([("claude", "acct-a"), ("codex", "acct-b")]),
            "both provider/account pairs recorded before reopening must survive"
        );

        // No migration/truncation event: the reopened store is queried with
        // the exact same public API a brand-new process would use -- there
        // is no separate "legacy import" code path to invoke.
    }

    // ── Phase 4A.1: monetary quantity-kind regression corpus ────────────
    // docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md "Phase 4A.1" section,
    // owner section 21. `CostMeasurementKind` alone was proven
    // insufficient -- these tests exercise the orthogonal quantity
    // dimension explicitly, using real provider-shaped classifications
    // where a real provider supports them, and a synthetic same-model
    // case only where the TYPE itself needs validating (never a faked
    // provider capability).

    #[test]
    fn classify_crossmodel_is_balance_point_in_time_real_provider() {
        let (quantity, kind) = classify_monetary_observation("crossmodel", "balance");
        assert_eq!(quantity, MonetaryQuantityKind::Balance);
        assert_eq!(kind, CostMeasurementKind::PointInTime);
    }

    #[test]
    fn classify_zenmux_is_balance_point_in_time_real_provider() {
        let (quantity, kind) = classify_monetary_observation("zenmux", "ZenMux PAYG balance");
        assert_eq!(quantity, MonetaryQuantityKind::Balance);
        assert_eq!(kind, CostMeasurementKind::PointInTime);
    }

    #[test]
    fn classify_claude_is_spend_cumulative_real_provider() {
        let (quantity, kind) = classify_monetary_observation("claude", "Monthly");
        assert_eq!(quantity, MonetaryQuantityKind::Spend);
        assert_eq!(kind, CostMeasurementKind::Cumulative);
    }

    #[test]
    fn classify_commandcode_is_credits_cumulative_real_provider() {
        let (quantity, kind) = classify_monetary_observation("commandcode", "monthly credits");
        assert_eq!(quantity, MonetaryQuantityKind::Credits);
        assert_eq!(kind, CostMeasurementKind::Cumulative);
    }

    /// Codex's live fetch path (`fetch_usage`/`fetch_usage_pat` ->
    /// `build_result_from_json` -> `extract_credits`) always produces
    /// `period == "Credits"` -- a raw account-credit BALANCE, never
    /// spend. See `classify_monetary_observation`'s doc comment for the
    /// full traced evidence (the "Monthly credits" spend branch exists in
    /// `build_result` but is unreachable from any live fetch today).
    #[test]
    fn classify_codex_live_path_is_credits_point_in_time() {
        let (quantity, kind) = classify_monetary_observation("codex", "Credits");
        assert_eq!(quantity, MonetaryQuantityKind::Credits);
        assert_eq!(kind, CostMeasurementKind::PointInTime);
    }

    /// If Codex's (currently dead) spend-control-limit path is ever wired
    /// into a live fetch, its distinct "Monthly credits" period label
    /// already classifies correctly as Cumulative Credits spend -- no
    /// code change required, because the adapter's own label carries the
    /// evidence. This test protects that forward-compatibility property
    /// (a synthetic period string, since this path is not live today).
    #[test]
    fn classify_codex_would_resolve_monthly_credits_path_correctly_if_ever_live() {
        let (quantity, kind) = classify_monetary_observation("codex", "Monthly credits");
        assert_eq!(quantity, MonetaryQuantityKind::Credits);
        assert_eq!(kind, CostMeasurementKind::Cumulative);
    }

    #[test]
    fn classify_codex_unrecognized_period_fails_closed_to_unknown() {
        let (quantity, kind) = classify_monetary_observation("codex", "some-other-shape");
        assert_eq!(quantity, MonetaryQuantityKind::Unknown);
        assert_eq!(kind, CostMeasurementKind::Unknown);
    }

    #[test]
    fn classify_unclassified_provider_fails_closed_on_both_dimensions() {
        let (quantity, kind) = classify_monetary_observation("some-future-provider", "whatever");
        assert_eq!(quantity, MonetaryQuantityKind::Unknown);
        assert_eq!(kind, CostMeasurementKind::Unknown);
    }

    #[test]
    fn cost_contract_quantity_kind_spend_for_a_known_spend_provider() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let s = cost_sample_q(
            "claude",
            "a1",
            12.0,
            Some("USD"),
            Some(MonetaryQuantityKind::Spend),
            Some(CostMeasurementKind::Cumulative),
            day0,
        );
        let all: Vec<&UsageSample> = vec![&s];
        let contract = CostContract::from_samples(&all, &all);
        assert_eq!(contract.quantity_kind, MonetaryQuantityKind::Spend);
    }

    #[test]
    fn cost_contract_quantity_kind_balance_for_a_known_balance_provider() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let s = cost_sample_q(
            "zenmux",
            "a1",
            30.0,
            Some("USD"),
            Some(MonetaryQuantityKind::Balance),
            Some(CostMeasurementKind::PointInTime),
            day0,
        );
        let all: Vec<&UsageSample> = vec![&s];
        let contract = CostContract::from_samples(&all, &all);
        assert_eq!(contract.quantity_kind, MonetaryQuantityKind::Balance);
    }

    #[test]
    fn cost_contract_quantity_kind_credits_for_codex() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let s = cost_sample_q(
            "codex",
            "a1",
            5.0,
            Some("USD"),
            Some(MonetaryQuantityKind::Credits),
            Some(CostMeasurementKind::PointInTime),
            day0,
        );
        let all: Vec<&UsageSample> = vec![&s];
        let contract = CostContract::from_samples(&all, &all);
        assert_eq!(contract.quantity_kind, MonetaryQuantityKind::Credits);
    }

    /// Same numeric value/currency/measurement-kind, but genuinely
    /// different quantity kinds (Spend vs Balance) -- must collapse to
    /// Unknown, never silently pick one, and must never feed a combined
    /// KPI (owner Phase 4A.1 hard rule: balances never enter Spend).
    #[test]
    fn cost_contract_quantity_kind_unknown_when_spend_and_balance_are_mixed() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let spend = cost_sample_q(
            "claude",
            "a1",
            5.0,
            Some("USD"),
            Some(MonetaryQuantityKind::Spend),
            Some(CostMeasurementKind::Cumulative),
            day0,
        );
        let balance = cost_sample_q(
            "zenmux",
            "a2",
            5.0,
            Some("USD"),
            Some(MonetaryQuantityKind::Balance),
            Some(CostMeasurementKind::Cumulative), // even with matching temporal shape...
            day0,
        );
        let all: Vec<&UsageSample> = vec![&spend, &balance];
        let contract = CostContract::from_samples(&all, &all);
        // ...the quantity kind still collapses to Unknown -- proving the
        // two dimensions are checked independently, not conflated.
        assert_eq!(contract.quantity_kind, MonetaryQuantityKind::Unknown);
        assert_eq!(contract.measurement_kind, CostMeasurementKind::Cumulative);
    }

    /// Legacy rows (no recorded quantity kind at all) must remain
    /// ambiguous -- never inferred as Spend just because the historical
    /// column happens to be named `cost_used`. Column names are not proof.
    #[test]
    fn cost_contract_legacy_row_never_inferred_as_spend_from_column_name() {
        let day0 = dt(2026, 9, 1, 0, 0, 0).timestamp();
        let legacy = UsageSample {
            account_id: "a1".to_string(),
            account_scope: None,
            provider: "claude".to_string(),
            window_id: Some(COST_WINDOW_ID.to_string()),
            window_key: None,
            window_label: Some("Monthly".to_string()),
            window_minutes: None,
            used_percent: 0.0,
            remaining_percent: 0.0,
            cost_used: Some(9.99),
            cost_currency_code: None,
            cost_measurement_kind: None,
            monetary_quantity_kind: None,
            resets_at: None,
            captured_at: day0,
        };
        let all: Vec<&UsageSample> = vec![&legacy];
        let contract = CostContract::from_samples(&all, &all);
        assert_eq!(contract.quantity_kind, MonetaryQuantityKind::Unknown);
        assert_eq!(contract.availability, CostAvailability::LegacyAmbiguous);
    }
}
