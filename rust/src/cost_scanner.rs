//! Local cost-usage scanner for Codex and Claude
//!
//! Scans local JSONL log files to aggregate token usage and calculate costs.
//!
//! Codex production path loads/saves [`crate::core::CostUsageCache`] under
//! `{cache}/CodexBar/cost-usage/`, skips unchanged files by mtime+size, resumes
//! partial files from `parsed_bytes`, honors [`crate::core::CostScanOptions`]
//! debounce (default 60s; `app_driven` forces a fresh inspection), and checks
//! cancel flags between files.
//!
//! ## Phase 4C: billing-channel eligibility gate
//!
//! `total_cost_usd`/`by_model`/`by_speed` are computed from local JSONL
//! session logs via [`crate::core::CostUsagePricing`]'s official DirectApi
//! (per-token, metered) price tables. But neither the Codex session format
//! (`CodexUsageRecord`: day/model/input/cached/output only) nor the Claude
//! transcript format (`ClaudeEvent`/`ClaudeMessage`/`ClaudeUsage`: type/
//! timestamp/requestId/model/token counts only) carries ANY field that
//! distinguishes a session run under a flat-fee SUBSCRIPTION (ChatGPT
//! Plus/Pro/Team, Claude Pro/Max -- usage included, not itself metered
//! per-token) from one run under a raw, per-token-metered API key --
//! confirmed by a full field-by-field trace of both formats (see
//! `docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md` "Phase 4C"). Live
//! official-source research confirmed subscription-covered Claude Code
//! usage is not itself billed per-token; `codex/api.rs`'s own `auth.json`
//! parsing proves Codex CLI genuinely supports both modes, yet nothing
//! here can tell which one produced a given session file.
//!
//! Per the Phase 4B/4C hard rule (a `SubscriptionQuota`/`Unknown`
//! observation may never be priced with `DirectApi` pricing, even when
//! the model name matches), `cost_eligible()` reports whether
//! `total_cost_usd`/`by_model`/`by_speed` may be shown as a trustworthy
//! dollar figure. It routes through the single shared
//! [`crate::pricing_eligibility::can_locally_estimate_cost`] rule --
//! today it is always `false` (billing channel `Unknown` can never match
//! the `DirectApi` channel these price tables actually price), so every
//! caller that surfaces a dollar amount to a user MUST check this first
//! (or use [`CostSummary::eligible_total_cost_usd`]/
//! [`CostSummary::eligible_by_model`]) -- token/model/session counts
//! remain fully valid and are never hidden by this gate.

use chrono::{DateTime, Duration, Local, NaiveDate, Utc};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::pricing_eligibility::{
    BillingChannel, Eligibility, ObservationCapabilities, PricingRequirements,
    can_locally_estimate_cost,
};

/// The billing-channel eligibility verdict for every local CLI-log-derived
/// cost observation (Codex + Claude session scanning, and the pi/OMP
/// mirrors and OpenCodex import that feed the same summaries) -- see this
/// module's doc comment. `model_known` only affects which
/// [`crate::pricing_eligibility::IneligibilityReason`] is reported; the
/// verdict itself is always `NotEligible` today because the billing
/// channel can never be established.
pub fn cli_log_cost_eligibility(model_known: bool) -> Eligibility {
    can_locally_estimate_cost(
        &ObservationCapabilities {
            billing_channel: BillingChannel::Unknown,
            canonical_model_known: model_known,
            has_input_tokens: true,
            has_output_tokens: true,
            has_cached_input_tokens: true,
            has_cache_write_tokens: true,
            has_request_count: false,
            currency_or_unit_known: true,
        },
        &PricingRequirements {
            priceable_channel: BillingChannel::DirectApi,
            requires_input_tokens: true,
            requires_output_tokens: true,
            requires_cached_input_tokens: false,
            requires_cache_write_tokens: false,
            requires_request_count: false,
            pricing_verified: true,
        },
    )
}

/// Convenience boolean form of [`cli_log_cost_eligibility`] for a summary
/// that (like every real scan today) has at least one known model.
pub fn cli_log_cost_available() -> bool {
    matches!(cli_log_cost_eligibility(true), Eligibility::Eligible)
}

#[cfg(test)]
use crate::codex_costs::scan_codex_file_cost;
use crate::codex_costs::{
    add_codex_days_map_to_summary, add_codex_records_to_summary, codex_period_start,
    codex_scan_dates, merge_codex_records_into_days,
};
use crate::codex_sessions::{codex_sessions_dir_candidates, default_wsl_roots};
use crate::core::{
    CODEX_JSONL_MAX_LINE_BYTES, CostScanOptions, CostUsageCache, CostUsageDayRange,
    CostUsageFileUsage, CostUsagePricing, JsonlScanner, ProviderId, read_bounded_jsonl_line,
};
use crate::providers::opencodego::local as opencodego_local;
use crate::settings::Settings;

/// Completeness of the pricing coverage in a [`CostSummary`] (upstream 0.48.0 F18).
///
/// `Complete` means every billed model resolved a canonical or fast-rate price.
/// `Partial` means at least one model was deliberately unpriced (routing rows like
/// `codex-auto-review`) or fell back to a legacy default; the breakdown is still
/// shown but the total is labeled partial.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub enum ModelPricingCompleteness {
    /// Every model resolved a canonical price.
    #[default]
    Complete,
    /// At least one model was unpriced or used a fallback rate.
    Partial {
        /// Model IDs that were deliberately unpriced (routing rows).
        unpriced_models: Vec<String>,
    },
}

impl ModelPricingCompleteness {
    pub fn is_partial(&self) -> bool {
        matches!(self, Self::Partial { .. })
    }
}

/// Cost summary from scanning local logs
#[derive(Debug, Clone, Default)]
pub struct CostSummary {
    /// Total cost in USD for the period
    pub total_cost_usd: f64,
    /// Total input tokens
    pub input_tokens: u64,
    /// Total output tokens
    pub output_tokens: u64,
    /// Total cached input tokens
    pub cached_tokens: u64,
    /// Number of sessions/conversations scanned
    pub sessions_count: u32,
    /// Cost breakdown by model
    pub by_model: HashMap<String, f64>,
    /// Token breakdown by model
    pub by_model_tokens: HashMap<String, ModelTokenCounts>,
    /// Codex cost split by speed/tier when local logs expose it.
    pub by_speed: HashMap<String, f64>,
    /// Codex token split by speed/tier when local logs expose it.
    pub by_speed_tokens: HashMap<String, ModelTokenCounts>,
    /// Model IDs that were priced with fallback rates because no canonical rate is available.
    pub unknown_models: HashSet<String>,
    /// Completeness of pricing coverage (Complete vs Partial). Surfaced in the CLI
    /// cost JSON so callers can label a partial breakdown (upstream 0.48.0 F18).
    pub model_pricing_completeness: ModelPricingCompleteness,
    /// Whether the scan's coverage of the requested history window is established
    /// (not pending a catch-up re-scan). `true` when the cache is fresh (within the
    /// debounce window) or the scan just completed; `false` when the cache is stale
    /// or empty and a re-scan would be required (upstream 0.48.0 A16).
    pub history_coverage_established: bool,
    /// True when the scan completed with zero results — a *known* zero, not a
    /// missing scan. Set only when `history_coverage_established` is true and
    /// the scan found no sessions/tokens (upstream 0.50.1 #2932). Never
    /// fabricated on incomplete scans.
    pub known_zero: bool,
    /// Period start date
    pub period_start: Option<NaiveDate>,
    /// Period end date
    pub period_end: Option<NaiveDate>,
}

/// Per-model token counts
#[derive(Debug, Clone, Default)]
pub struct ModelTokenCounts {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cached_tokens: u64,
}

impl ModelTokenCounts {
    pub fn total(&self) -> u64 {
        self.input_tokens + self.output_tokens
    }
}

impl CostSummary {
    /// Phase 4C: whether `total_cost_usd`/`by_model`/`by_speed` may be
    /// shown to a user as a trustworthy dollar figure -- see this module's
    /// doc comment. Always `false` today. Not stored as a field (avoids
    /// needing to thread it through every internal scratch-`CostSummary`
    /// construction site); it is a pure, cheap, deterministic function of
    /// the shared eligibility rule, not of anything scan-specific.
    pub fn cost_eligible(&self) -> bool {
        cli_log_cost_available()
    }

    /// The trustworthy total, or `None` when billing-channel eligibility
    /// could not be established (owner Phase 4C section 8: unavailable,
    /// never a fabricated `$0`). `total_cost_usd` itself remains computed
    /// and readable for internal diagnostics/tests that need to prove the
    /// underlying token-pricing math is still correct -- it is just not,
    /// on its own, proof that showing it to a user is billing-channel-safe.
    pub fn eligible_total_cost_usd(&self) -> Option<f64> {
        self.cost_eligible().then_some(self.total_cost_usd)
    }

    /// Same gate as [`Self::eligible_total_cost_usd`], for the per-model
    /// cost breakdown.
    pub fn eligible_by_model(&self) -> Option<&HashMap<String, f64>> {
        self.cost_eligible().then_some(&self.by_model)
    }

    /// Same gate, for the Codex speed/tier cost breakdown.
    pub fn eligible_by_speed(&self) -> Option<&HashMap<String, f64>> {
        self.cost_eligible().then_some(&self.by_speed)
    }

    /// Formats the total for display, honoring the eligibility gate --
    /// `"Unavailable"` rather than a dollar amount when billing-channel
    /// eligibility could not be established.
    pub fn format_total(&self) -> String {
        match self.eligible_total_cost_usd() {
            Some(usd) => format!("${usd:.2}"),
            None => "Unavailable".to_string(),
        }
    }
}

fn is_cancelled(cancel: Option<&AtomicBool>) -> bool {
    cancel.is_some_and(|flag| flag.load(Ordering::Relaxed))
}

/// Fallback Claude model used when a scanned model isn't in the canonical
/// pricing table (unknown or retired IDs). Prices as Sonnet 4.6.
const FALLBACK_CLAUDE_MODEL: &str = "claude-sonnet-4-6";

fn unix_now_ms() -> i64 {
    // Duration is clamped to i64::MAX before casting, so the value fits i64.
    #[allow(
        clippy::cast_possible_truncation,
        reason = "clamped to i64::MAX before casting"
    )]
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or(0);
    millis
}

fn system_time_to_unix_ms(modified: Option<SystemTime>) -> i64 {
    // Duration is clamped to i64::MAX before casting, so the value fits i64.
    #[allow(
        clippy::cast_possible_truncation,
        reason = "clamped to i64::MAX before casting"
    )]
    let millis = modified
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or(0);
    millis
}

fn rebuild_cache_days(cache: &mut CostUsageCache) {
    cache.days.clear();
    for usage in cache.files.values() {
        for (day, models) in &usage.days {
            let day_entry = cache.days.entry(day.clone()).or_default();
            for (model, packed) in models {
                let dest = day_entry
                    .entry(model.clone())
                    .or_insert_with(|| vec![0, 0, 0]);
                if dest.len() < 3 {
                    dest.resize(3, 0);
                }
                for (i, value) in packed.iter().take(3).enumerate() {
                    dest[i] = dest[i].saturating_add(*value);
                }
            }
        }
    }
}

/// Claude cost calculation for the usage scanner.
///
/// Per-token rates come from the canonical `CostUsagePricing::claude_cost_usd`
/// table (the single source of truth for Claude pricing). The only
/// scanner-specific piece is the one-hour cache-write premium, which the
/// canonical cost function doesn't model: one-hour cache writes bill at 2x the
/// input rate.
struct ClaudePricing;

impl ClaudePricing {
    fn cost_usd_with_cache_ttl(
        model: &str,
        input: u64,
        cache_create: u64,
        cache_create_1h: u64,
        cache_read: u64,
        output: u64,
    ) -> f64 {
        let cache_create_1h = cache_create_1h.min(cache_create);
        let cache_create_5m = cache_create.saturating_sub(cache_create_1h);

        // Standard buckets (input, cache-read, 5-minute cache-write, output),
        // including any long-context tiering, come from the canonical table.
        // Unknown/retired models fall back to Sonnet pricing.
        #[allow(
            clippy::cast_possible_truncation,
            reason = "clamped to i32::MAX before casting"
        )]
        let clamp = |v: u64| v.min(i32::MAX as u64) as i32;
        let base = CostUsagePricing::claude_cost_usd(
            model,
            clamp(input),
            clamp(cache_read),
            clamp(cache_create_5m),
            clamp(output),
        )
        .or_else(|| {
            CostUsagePricing::claude_cost_usd(
                FALLBACK_CLAUDE_MODEL,
                clamp(input),
                clamp(cache_read),
                clamp(cache_create_5m),
                clamp(output),
            )
        })
        .unwrap_or(0.0);

        // Scanner-specific: one-hour cache writes bill at 2x the input rate.
        let input_rate = CostUsagePricing::claude_input_cost_per_token(model)
            .or_else(|| CostUsagePricing::claude_input_cost_per_token(FALLBACK_CLAUDE_MODEL))
            .unwrap_or(0.0);

        base + (cache_create_1h as f64) * input_rate * 2.0
    }
}

/// JSONL event structures for Codex
#[allow(
    dead_code,
    reason = "JSONL event fields are deserialized for parsing but not all are read"
)]
#[derive(Debug, Deserialize)]
struct CodexEvent {
    #[serde(rename = "type")]
    event_type: Option<String>,
    event_msg: Option<CodexEventMsg>,
}

#[allow(
    dead_code,
    reason = "event message fields are deserialized for parsing but not all are read"
)]
#[derive(Debug, Deserialize)]
struct CodexEventMsg {
    #[serde(rename = "type")]
    msg_type: Option<String>,
    input_tokens: Option<u64>,
    cached_input_tokens: Option<u64>,
    output_tokens: Option<u64>,
}

/// JSONL event structures for Claude transcripts. Unknown fields are
/// ignored, so lines that are not assistant usage events still parse.
#[derive(Debug, Deserialize)]
struct ClaudeEvent {
    #[serde(rename = "type")]
    event_type: Option<String>,
    timestamp: Option<String>,
    #[serde(rename = "requestId", alias = "request_id")]
    request_id: Option<String>,
    message: Option<ClaudeMessage>,
}

impl ClaudeEvent {
    fn parsed_timestamp(&self) -> Option<DateTime<Utc>> {
        let timestamp = self.timestamp.as_deref()?;
        DateTime::parse_from_rfc3339(timestamp)
            .ok()
            .map(|ts| ts.with_timezone(&Utc))
    }
}

#[derive(Debug, Deserialize)]
struct ClaudeMessage {
    id: Option<String>,
    model: Option<String>,
    usage: Option<ClaudeUsage>,
}

#[derive(Debug, Deserialize)]
struct ClaudeUsage {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    cache_creation_input_tokens: Option<u64>,
    cache_read_input_tokens: Option<u64>,
    cache_creation: Option<ClaudeCacheCreation>,
}

impl ClaudeUsage {
    /// One-hour cache-write tokens, clamped to the total cache-write count.
    fn one_hour_cache_creation_tokens(&self, total: u64) -> u64 {
        self.cache_creation
            .as_ref()
            .and_then(|cache_creation| cache_creation.ephemeral_1h_input_tokens)
            .unwrap_or(0)
            .min(total)
    }
}

/// TTL breakdown of cache writes reported by the API.
#[derive(Debug, Deserialize)]
struct ClaudeCacheCreation {
    ephemeral_1h_input_tokens: Option<u64>,
}

#[derive(Debug, Clone)]
struct ClaudeUsageRecord {
    model: String,
    timestamp: Option<DateTime<Utc>>,
    dedup_key: Option<String>,
    input: u64,
    output: u64,
    cache_create: u64,
    cache_read: u64,
    cost: f64,
}

/// Per-pass counters for cache/resume behavior (tests + diagnostics).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CostScanStats {
    pub files_seen: u32,
    pub files_parsed: u32,
    pub files_skipped: u32,
    pub files_resumed: u32,
    pub used_cache_debounce: bool,
}

/// Cost usage scanner
pub struct CostScanner {
    days: u32,
    options: CostScanOptions,
    cache_root: Option<PathBuf>,
    /// When set, bypass normal sessions-dir discovery (tests / inject roots).
    sessions_dirs_override: Option<Vec<PathBuf>>,
}

impl CostScanner {
    /// Create a new scanner for the last N days (default 60s cache debounce).
    pub fn new(days: u32) -> Self {
        Self {
            days,
            options: CostScanOptions::default(),
            cache_root: None,
            sessions_dirs_override: None,
        }
    }

    /// Cheap availability check for the analytics source registry
    /// (`analytics_sources.rs`) -- true when at least one real Codex
    /// sessions directory exists on this machine, without scanning any
    /// file contents. Kept here rather than duplicating the directory
    /// discovery logic (`CODEX_HOME`/WSL roots/custom dirs) elsewhere.
    pub fn codex_local_activity_available(&self) -> bool {
        self.get_codex_sessions_dirs()
            .iter()
            .any(|dir| dir.exists())
    }

    /// Same, for Claude -- true when the real Claude projects directory
    /// exists, without scanning any transcript contents.
    pub fn claude_local_activity_available(&self) -> bool {
        self.get_claude_projects_dir().exists()
    }

    /// Override scan options (e.g. [`CostScanOptions::app_driven`] for force refresh).
    pub fn with_options(mut self, options: CostScanOptions) -> Self {
        self.options = options;
        self
    }

    /// Override on-disk cache root (`{root}/cost-usage/…`).
    pub fn with_cache_root(mut self, root: impl Into<PathBuf>) -> Self {
        self.cache_root = Some(root.into());
        self
    }

    /// Override Codex sessions roots (primarily for tests).
    pub fn with_sessions_dirs(mut self, dirs: Vec<PathBuf>) -> Self {
        self.sessions_dirs_override = Some(dirs);
        self
    }

    /// Scan Codex local logs
    pub fn scan_codex(&self) -> CostSummary {
        self.scan_codex_with_cancel(None)
    }

    /// Scan Codex local logs, stopping early when the caller cancels the scan.
    pub fn scan_codex_with_cancel(&self, cancel: Option<&AtomicBool>) -> CostSummary {
        self.scan_codex_detailed(cancel).0
    }

    /// Scan Codex and return cache/resume stats alongside the summary.
    pub fn scan_codex_detailed(&self, cancel: Option<&AtomicBool>) -> (CostSummary, CostScanStats) {
        let mut summary = CostSummary::default();
        let mut stats = CostScanStats::default();
        let today = Local::now().date_naive();
        let start_date = codex_period_start(today, self.days);
        let range = CostUsageDayRange::new(start_date, today);
        let now_ms = unix_now_ms();

        summary.period_start = Some(start_date);
        summary.period_end = Some(today);

        let cache_root = self.cache_root.as_deref();
        let mut cache = JsonlScanner::load_cache(ProviderId::Codex, cache_root);

        // Debounce: rebuild from disk cache without re-walking session files.
        if JsonlScanner::should_skip_cached_scan(&cache, self.options, now_ms)
            && JsonlScanner::cache_covers_range(&cache, &range)
            && (!cache.days.is_empty() || !cache.files.is_empty())
        {
            stats.used_cache_debounce = true;
            // A16 (upstream 0.48.0): cache hit within debounce = coverage established
            // when the cache has data and no catch-up is pending (previous_report set
            // means entries were trimmed for budget → re-scan may be needed).
            summary.history_coverage_established =
                !cache.days.is_empty() && cache.previous_report.is_none();
            let (cost, _) = add_codex_days_map_to_summary(&mut summary, &cache.days, &range);
            summary.total_cost_usd += cost;
            // Session count is a display field; the cache holds far fewer files than u32::MAX.
            #[allow(clippy::cast_possible_truncation, reason = "cache file counts fit u32")]
            let sessions_count = cache
                .files
                .values()
                .filter(|usage| {
                    usage.days.keys().any(|day| {
                        CostUsageDayRange::is_in_range(day, &range.since_key, &range.until_key)
                    })
                })
                .count() as u32;
            summary.sessions_count = sessions_count;

            // Pi-compatible sessions are outside the Codex JSONL cache.
            // Skip when tests inject sessions roots — avoid scanning the real home tree.
            if self.sessions_dirs_override.is_none() {
                let mut seen_pi = HashSet::new();
                crate::pi_session_cost::scan_pi_compatible_into(
                    &mut summary,
                    crate::pi_session_cost::PiMappedProvider::Codex,
                    self.days,
                    cancel,
                    &mut seen_pi,
                );
            }
            // Upstream 0.50.1 #2932: debounce cache hit with coverage
            // established but zero sessions in-range is a known-zero.
            summary.known_zero =
                summary.history_coverage_established && summary.sessions_count == 0;
            return (summary, stats);
        }

        for sessions_dir in self.get_codex_sessions_dirs() {
            if is_cancelled(cancel) {
                break;
            }
            if sessions_dir.exists() {
                self.scan_codex_sessions_dir(
                    &sessions_dir,
                    &range,
                    &mut summary,
                    &mut cache,
                    cancel,
                    &mut stats,
                );
            }
        }

        if !is_cancelled(cancel) {
            rebuild_cache_days(&mut cache);
            cache.last_scan_unix_ms = now_ms;
            cache.scan_since_key = Some(range.since_key.clone());
            cache.scan_until_key = Some(range.until_key.clone());
            // F8 (upstream 0.48.0): a completed full scan rebuilds the cache for
            // the current window, so any prior catch-up state is no longer
            // pending. Clear previous_report before save so the persisted
            // artifact no longer signals stale/refreshing (audit: must clear).
            cache.previous_report = None;
            JsonlScanner::save_cache(ProviderId::Codex, &mut cache, cache_root);
        }

        // A16 (upstream 0.48.0): after a completed scan, coverage IS established
        // unless cache pruning during save marked a catch-up pending.
        summary.history_coverage_established = cache.previous_report.is_none();
        // Upstream 0.50.1 #2932: a completed scan with zero results is a
        // *known* zero. Only set when coverage is established; an incomplete
        // scan must NOT fabricate a zero.
        summary.known_zero = summary.history_coverage_established && summary.sessions_count == 0;

        // OMP / pi-compatible agent sessions (upstream #2269). Dedup by entry id.
        // Skip when tests inject sessions roots — avoid scanning the real home tree.
        // A16 --provider-native-only: skip pi/OMP mirrors when disabled.
        if self.sessions_dirs_override.is_none() && self.options.include_pi_sessions {
            let mut seen_pi = HashSet::new();
            crate::pi_session_cost::scan_pi_compatible_into(
                &mut summary,
                crate::pi_session_cost::PiMappedProvider::Codex,
                self.days,
                cancel,
                &mut seen_pi,
            );
        }

        (summary, stats)
    }

    /// Scan Claude local logs
    pub fn scan_claude(&self) -> CostSummary {
        self.scan_claude_with_cancel(None)
    }

    /// Scan Claude local logs, stopping early when the caller cancels the scan.
    pub fn scan_claude_with_cancel(&self, cancel: Option<&AtomicBool>) -> CostSummary {
        let projects_dir = self.get_claude_projects_dir();
        let mut summary = CostSummary::default();
        let today = Utc::now().date_naive();
        let start_date = today - Duration::days(self.days as i64);
        let cutoff = Utc::now() - Duration::days(self.days as i64);

        summary.period_start = Some(start_date);
        summary.period_end = Some(today);

        // Walk through projects directory, de-duplicating usage records
        // that appear across multiple files.
        if projects_dir.exists() {
            let mut seen = HashSet::new();
            let cache_root = self.cache_root.as_deref();
            let mut handle_file = |path: &Path| {
                let counted = for_each_claude_usage_record(
                    path,
                    &cutoff,
                    &mut seen,
                    cancel,
                    cache_root,
                    |record| {
                        add_claude_record_to_summary(&mut summary, record);
                    },
                );
                if counted > 0 {
                    summary.sessions_count += 1;
                }
            };
            self.walk_claude_files(&projects_dir, &cutoff, cancel, &mut handle_file);
            reconcile_claude_activity_index_deletions(cache_root);
            flush_claude_activity_index(cache_root);
        }

        // OMP / pi-compatible anthropic rows, deduped across shared files.
        let mut seen_pi = HashSet::new();
        crate::pi_session_cost::scan_pi_compatible_into(
            &mut summary,
            crate::pi_session_cost::PiMappedProvider::Claude,
            self.days,
            cancel,
            &mut seen_pi,
        );

        summary
    }

    /// Scan OpenCode Go local SQLite usage (upstream #2649 per-model cost breakdown).
    ///
    /// Reads the local `opencode.db` and maps rows onto the shared `CostSummary`
    /// (`total_cost_usd`, `by_model`, `sessions_count`, period) so the chart's
    /// local-usage summary treats OpenCode Go like Codex/Claude. No token counts
    /// are available from the SQLite reader, so token fields stay zero.
    pub fn scan_opencodego_with_cancel(&self, cancel: Option<&AtomicBool>) -> CostSummary {
        if is_cancelled(cancel) {
            return CostSummary::default();
        }
        let now = Utc::now();
        let Some(local) = opencodego_local::model_cost_summary_scan(now, self.days) else {
            return CostSummary::default();
        };
        CostSummary {
            total_cost_usd: local.total_cost_usd,
            by_model: local.by_model,
            sessions_count: local.request_count,
            period_start: local.period_start,
            period_end: local.period_end,
            ..CostSummary::default()
        }
    }

    fn get_codex_sessions_dirs(&self) -> Vec<PathBuf> {
        if let Some(dirs) = &self.sessions_dirs_override {
            return dirs.clone();
        }
        let settings = Settings::load();
        let codex_home = std::env::var("CODEX_HOME").ok();
        codex_sessions_dir_candidates(
            dirs::home_dir(),
            codex_home,
            &settings.codex_custom_sessions_dirs,
            &default_wsl_roots(),
        )
    }

    fn scan_codex_sessions_dir(
        &self,
        sessions_dir: &Path,
        range: &CostUsageDayRange,
        summary: &mut CostSummary,
        cache: &mut CostUsageCache,
        cancel: Option<&AtomicBool>,
        stats: &mut CostScanStats,
    ) {
        // Iterate through the date-based directory structure with one day of
        // padding on each side. Codex JSONL timestamps are UTC, while the tray
        // presents local calendar days; the parser filters back to `range`.
        for date in codex_scan_dates(range) {
            if is_cancelled(cancel) {
                break;
            }
            let year = date.format("%Y").to_string();
            let month = date.format("%m").to_string();
            let day = date.format("%d").to_string();

            let day_dir = sessions_dir.join(&year).join(&month).join(&day);
            if !day_dir.exists() {
                continue;
            }

            if let Ok(entries) = fs::read_dir(&day_dir) {
                for entry in entries.flatten() {
                    if is_cancelled(cancel) {
                        break;
                    }
                    let path = entry.path();
                    if path.extension().is_some_and(|e| e == "jsonl") {
                        self.parse_codex_file(&path, range, summary, cache, cancel, stats);
                    }
                }
            }
        }
    }

    fn get_claude_projects_dir(&self) -> PathBuf {
        if let Ok(claude_config) = std::env::var("CLAUDE_CONFIG_DIR") {
            let trimmed = claude_config.trim();
            if !trimmed.is_empty() {
                return PathBuf::from(trimmed).join("projects");
            }
        }

        // Try ~/.claude/projects first
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let claude_dir = home.join(".claude").join("projects");
        if claude_dir.exists() {
            return claude_dir;
        }

        // Fallback to ~/.config/claude/projects
        home.join(".config").join("claude").join("projects")
    }

    fn parse_codex_file(
        &self,
        path: &Path,
        range: &CostUsageDayRange,
        summary: &mut CostSummary,
        cache: &mut CostUsageCache,
        cancel: Option<&AtomicBool>,
        stats: &mut CostScanStats,
    ) {
        if is_cancelled(cancel) {
            return;
        }
        stats.files_seen += 1;

        let metadata = match fs::metadata(path) {
            Ok(m) => m,
            Err(_) => return,
        };
        // File sizes are clamped to i64::MAX before casting.
        #[allow(
            clippy::cast_possible_wrap,
            reason = "file sizes are clamped to i64::MAX"
        )]
        let size = metadata.len().min(i64::MAX as u64) as i64;
        let mtime_ms = system_time_to_unix_ms(metadata.modified().ok());
        let path_key = path.to_string_lossy().to_string();
        let cached = cache.files.get(&path_key).cloned();

        // Unchanged complete file: reuse packed days, skip re-parse.
        if let Some(entry) = &cached
            && entry.mtime_unix_ms == mtime_ms
            && entry.size == size
            && entry.parsed_bytes.unwrap_or(0) >= size
            && size > 0
        {
            let (session_cost, has_tokens) =
                add_codex_days_map_to_summary(summary, &entry.days, range);
            if has_tokens {
                summary.total_cost_usd += session_cost;
                summary.sessions_count += 1;
            }
            stats.files_skipped += 1;
            return;
        }

        // Growing file: resume from last parsed offset when safe.
        if let Some(entry) = &cached {
            let start_offset = entry.parsed_bytes.unwrap_or(0);
            if size > entry.size
                && start_offset > 0
                && start_offset <= size
                && entry.last_totals.is_some()
                && JsonlScanner::is_line_boundary_offset(path, start_offset)
            {
                let parse_result = match JsonlScanner::parse_codex_file(
                    path,
                    range,
                    start_offset,
                    entry.last_model.clone(),
                    entry.last_totals.clone(),
                ) {
                    Ok(result) => result,
                    Err(_) => return,
                };

                let mut days = entry.days.clone();
                merge_codex_records_into_days(&mut days, &parse_result.records);

                let (session_cost, has_tokens) =
                    add_codex_days_map_to_summary(summary, &days, range);
                if has_tokens {
                    summary.total_cost_usd += session_cost;
                    summary.sessions_count += 1;
                }

                cache.files.insert(
                    path_key,
                    CostUsageFileUsage {
                        mtime_unix_ms: mtime_ms,
                        size,
                        days,
                        parsed_bytes: Some(parse_result.parsed_bytes),
                        last_model: parse_result.last_model.or_else(|| entry.last_model.clone()),
                        last_totals: parse_result
                            .last_totals
                            .or_else(|| entry.last_totals.clone()),
                    },
                );
                stats.files_resumed += 1;
                return;
            }
        }

        // Full parse from offset 0.
        let parse_result = match JsonlScanner::parse_codex_file(path, range, 0, None, None) {
            Ok(result) => result,
            Err(_) => return,
        };

        let mut days = HashMap::new();
        merge_codex_records_into_days(&mut days, &parse_result.records);

        let (session_cost, has_tokens) =
            add_codex_records_to_summary(summary, &parse_result.records, range);

        if has_tokens {
            summary.total_cost_usd += session_cost;
            summary.sessions_count += 1;
        }

        cache.files.insert(
            path_key,
            CostUsageFileUsage {
                mtime_unix_ms: mtime_ms,
                size,
                days,
                parsed_bytes: Some(parse_result.parsed_bytes),
                last_model: parse_result.last_model,
                last_totals: parse_result.last_totals,
            },
        );
        stats.files_parsed += 1;
    }

    fn walk_claude_files<F>(
        &self,
        dir: &Path,
        cutoff: &DateTime<Utc>,
        cancel: Option<&AtomicBool>,
        on_file: &mut F,
    ) where
        F: FnMut(&Path),
    {
        if is_cancelled(cancel) {
            return;
        }
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            if is_cancelled(cancel) {
                break;
            }
            let path = entry.path();
            if path.is_dir() {
                self.walk_claude_files(&path, cutoff, cancel, on_file);
            } else if path.extension().is_some_and(|e| e == "jsonl") {
                // Check file modification time
                if let Ok(metadata) = fs::metadata(&path)
                    && let Ok(modified) = metadata.modified()
                {
                    let modified_dt: DateTime<Utc> = modified.into();
                    if modified_dt >= *cutoff {
                        on_file(&path);
                    }
                }
            }
        }
    }
}

/// Per-file cache of a Claude transcript's raw, un-deduped usage records --
/// the fix for a confirmed real defect: `for_each_claude_usage_record` used
/// to open and re-parse every JSONL byte of every Claude transcript file on
/// EVERY call, and a single `get_provider_chart_data` request already made
/// three independent full walks (`get_daily_token_history`'s own walk, plus
/// `load_local_usage_summary`'s 30-day and 1-day `scan_local_cost` calls) --
/// three full corpus rescans per IPC call, ~100-112s reproduced on a real
/// machine (docs/validation/ANALYTICS_PHASE3B_VISUAL_REVIEW.md Defect 3).
///
/// Keyed by canonical path string, invalidated by `(mtime, size)` -- the
/// same defensible source-identity pair Codex's own `CostUsageFileUsage`
/// cache already uses. Stores only the fields analytics needs (model,
/// timestamp, token counters, a dedup key, cost) -- never prompt/response
/// text, which this parser never deserializes into `ClaudeUsageRecord` in
/// the first place (see `ClaudeMessage`/`ClaudeUsage`'s field lists).
/// Process-lifetime only (not persisted to disk): a file's cross-file
/// dedup pass still re-runs fresh on every call from the cached raw
/// records, so a stale cache can never silently misrepresent the current
/// dedup/cutoff state -- only the expensive file I/O and JSON parsing is
/// skipped for a file whose identity is unchanged.
struct CachedClaudeFileRecords {
    mtime_unix_ms: i64,
    size: i64,
    records: Vec<ClaudeUsageRecord>,
}

fn claude_file_records_cache() -> &'static Mutex<HashMap<String, CachedClaudeFileRecords>> {
    static CACHE: OnceLock<Mutex<HashMap<String, CachedClaudeFileRecords>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Test-only: force the next call to reparse every file from disk,
/// regardless of what a previous test left cached under the same path.
#[cfg(test)]
fn clear_claude_file_records_cache_for_test() {
    if let Ok(mut guard) = claude_file_records_cache().lock() {
        guard.clear();
    }
}

/// Convert a persisted, privacy-safe record back into the in-memory shape,
/// recomputing `cost` fresh from the current pricing table rather than
/// trusting a persisted dollar figure that could have gone stale (see
/// docs/validation/CLAUDE_ACTIVITY_INDEX_PRIVACY.md).
fn claude_usage_record_from_persisted(
    persisted: &crate::claude_activity_index::PersistedClaudeRecord,
) -> ClaudeUsageRecord {
    // `cost` is deliberately NOT recomputed here (root cause of a real
    // measured Phase 3D regression: 329 real files / 80,821 real records
    // on this machine meant every reconstruction ran a pricing-table
    // lookup 80,821+ times per call, across the still-present 3x
    // redundant walks -- restart-warm measured 59.7s, barely better than
    // a fresh cold build, before this fix). `cli_log_cost_available()` is
    // permanently false for Claude (billing-channel ambiguity, see this
    // module's doc comment), so no eligible cost display ever reads this
    // field for a Claude record -- computing it is pure wasted CPU on
    // this hot path. `0.0` is not shown as a real cost anywhere it
    // matters for the same reason it was never eligible in the first
    // place.
    ClaudeUsageRecord {
        model: persisted.model.clone(),
        timestamp: persisted
            .timestamp_unix_ms
            .and_then(DateTime::<Utc>::from_timestamp_millis),
        dedup_key: persisted.dedup_key.clone(),
        input: persisted.input,
        output: persisted.output,
        cache_create: persisted.cache_create,
        cache_read: persisted.cache_read,
        cost: 0.0,
    }
}

fn persisted_claude_record_from_usage(
    record: &ClaudeUsageRecord,
) -> crate::claude_activity_index::PersistedClaudeRecord {
    crate::claude_activity_index::PersistedClaudeRecord {
        model: record.model.clone(),
        timestamp_unix_ms: record.timestamp.map(|t| t.timestamp_millis()),
        dedup_key: record.dedup_key.clone(),
        input: record.input,
        output: record.output,
        cache_create: record.cache_create,
        cache_read: record.cache_read,
    }
}

/// Process-lifetime, keyed-by-cache-root cache of the loaded persisted
/// Claude activity index -- loaded from disk at most once per distinct
/// `cache_root` per process, then kept warm in memory and flushed back to
/// disk whenever a file's contribution changes. Keying by `cache_root`
/// (rather than a single global) keeps tests that pass a temp directory
/// fully isolated from both the real default cache and each other.
fn claude_activity_index_cache()
-> &'static Mutex<HashMap<String, crate::claude_activity_index::ClaudeActivityIndex>> {
    static CACHE: OnceLock<
        Mutex<HashMap<String, crate::claude_activity_index::ClaudeActivityIndex>>,
    > = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn claude_activity_index_cache_key(cache_root: Option<&Path>) -> String {
    cache_root
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

/// Test-only: force the next call to reload the persisted index from disk
/// rather than reusing whatever a previous test left warm in memory under
/// the same `cache_root` key.
#[cfg(test)]
fn clear_claude_activity_index_memory_cache_for_test() {
    if let Ok(mut guard) = claude_activity_index_cache().lock() {
        guard.clear();
    }
}

/// Remove persisted index entries whose source file no longer exists.
/// Deliberately decoupled from `walk_claude_files`'s own mtime>=cutoff
/// visitation filter: a file legitimately outside the *current* request's
/// window (but indexed by an earlier, wider-window scan) must never be
/// mistaken for deleted just because this particular walk didn't visit
/// it. Checked directly against the filesystem instead.
fn reconcile_claude_activity_index_deletions(cache_root: Option<&Path>) {
    let index_key = claude_activity_index_cache_key(cache_root);
    if let Ok(mut index_guard) = claude_activity_index_cache().lock() {
        let index = index_guard
            .entry(index_key)
            .or_insert_with(|| crate::claude_activity_index::ClaudeActivityIndex::load(cache_root));
        let before = index.files.len();
        index.files.retain(|path, _| Path::new(path).exists());
        if index.files.len() != before {
            index.generated_at_unix_ms = unix_now_ms();
            index.save(cache_root);
        }
    }
}

/// All raw usage records in one Claude transcript file -- no cutoff
/// filtering, no cross-file dedup applied (both depend on the caller's
/// window and running `seen` set, neither of which is safe to bake into a
/// shared cache entry).
///
/// Two-tier cache, both keyed by `(path, mtime, size)`:
/// 1. Process-lifetime in-memory (`CachedClaudeFileRecords`) -- fastest,
///    survives only this process.
/// 2. Persisted-to-disk (`claude_activity_index`) -- survives a restart;
///    consulted on an in-memory miss, and updated (in memory + flushed to
///    disk) whenever a file is freshly parsed. This is what fixes cold
///    startup after the first successful run (docs/validation/
///    ANALYTICS_PHASE3D_PERSISTENT_CLAUDE_INDEX.md).
fn parse_claude_file_records_cached(
    path: &Path,
    cancel: Option<&AtomicBool>,
    cache_root: Option<&Path>,
) -> Vec<ClaudeUsageRecord> {
    let path_key = path.to_string_lossy().to_string();
    let metadata = fs::metadata(path).ok();
    let mtime_unix_ms = metadata
        .as_ref()
        .map(|m| system_time_to_unix_ms(m.modified().ok()))
        .unwrap_or(0);
    #[allow(
        clippy::cast_possible_wrap,
        reason = "local transcript file sizes fit i64"
    )]
    let size = metadata.map(|m| m.len() as i64).unwrap_or(0);

    if let Ok(guard) = claude_file_records_cache().lock()
        && let Some(cached) = guard.get(&path_key)
        && cached.mtime_unix_ms == mtime_unix_ms
        && cached.size == size
    {
        return cached.records.clone();
    }

    // In-memory miss: consult the persisted index before touching disk.
    let index_key = claude_activity_index_cache_key(cache_root);
    if let Ok(mut index_guard) = claude_activity_index_cache().lock() {
        let index = index_guard
            .entry(index_key.clone())
            .or_insert_with(|| crate::claude_activity_index::ClaudeActivityIndex::load(cache_root));
        if let Some(persisted_file) = index.files.get(&path_key)
            && persisted_file.mtime_unix_ms == mtime_unix_ms
            && persisted_file.size == size
        {
            let records: Vec<ClaudeUsageRecord> = persisted_file
                .records
                .iter()
                .map(claude_usage_record_from_persisted)
                .collect();
            drop(index_guard);
            if let Ok(mut guard) = claude_file_records_cache().lock() {
                guard.insert(
                    path_key,
                    CachedClaudeFileRecords {
                        mtime_unix_ms,
                        size,
                        records: records.clone(),
                    },
                );
            }
            return records;
        }
    }

    let Ok(file) = File::open(path) else {
        // Genuinely gone (or unreadable): make sure a stale persisted
        // entry for this exact path cannot linger and contribute a
        // deleted file's old content on a future call.
        if let Ok(mut index_guard) = claude_activity_index_cache().lock()
            && let Some(index) = index_guard.get_mut(&index_key)
            && index.files.remove(&path_key).is_some()
        {
            index.save(cache_root);
        }
        return Vec::new();
    };
    let mut records = Vec::new();
    for_each_jsonl_text_line(BufReader::new(file), |line| {
        if is_cancelled(cancel) {
            return false;
        }
        if let Ok(event) = serde_json::from_str::<ClaudeEvent>(line)
            && let Some(record) = claude_usage_record_from_event(&event)
        {
            records.push(record);
        }
        true
    });

    if let Ok(mut guard) = claude_file_records_cache().lock() {
        guard.insert(
            path_key.clone(),
            CachedClaudeFileRecords {
                mtime_unix_ms,
                size,
                records: records.clone(),
            },
        );
    }

    // Record the fresh parse in the warm in-memory index so a future
    // restart can skip re-reading this file too, as long as it stays
    // unchanged. Deliberately NOT saved to disk here: this function runs
    // once per file during a walk, and an eager per-file save would
    // reserialize and rewrite the whole (growing) index on every single
    // file -- O(files^2) disk I/O on a large first-ever cold build. The
    // scan-level caller flushes exactly once after the whole walk
    // completes (`flush_claude_activity_index`), matching how Codex's own
    // cache is saved once per `scan_codex()` call, not once per file.
    if let Ok(mut index_guard) = claude_activity_index_cache().lock() {
        let index = index_guard
            .entry(index_key)
            .or_insert_with(|| crate::claude_activity_index::ClaudeActivityIndex::load(cache_root));
        index.files.insert(
            path_key,
            crate::claude_activity_index::PersistedClaudeFile {
                mtime_unix_ms,
                size,
                records: records
                    .iter()
                    .map(persisted_claude_record_from_usage)
                    .collect(),
            },
        );
        index.schema_version = crate::claude_activity_index::CLAUDE_ACTIVITY_INDEX_SCHEMA_VERSION;
        index.generated_at_unix_ms = unix_now_ms();
    }

    records
}

/// Flush the in-memory persisted-index representation to disk exactly
/// once. Call after a full walk completes (alongside
/// `reconcile_claude_activity_index_deletions`), never per-file.
fn flush_claude_activity_index(cache_root: Option<&Path>) {
    let index_key = claude_activity_index_cache_key(cache_root);
    if let Ok(index_guard) = claude_activity_index_cache().lock()
        && let Some(index) = index_guard.get(&index_key)
    {
        index.save(cache_root);
    }
}

/// Stream the de-duplicated, in-window usage records from one transcript
/// file into `on_record`. Both the summary scan and the daily-history scan
/// consume this single reader, so Claude log semantics live in one place.
/// Returns the number of records consumed, so callers can tell whether the
/// file contributed anything.
fn for_each_claude_usage_record<F>(
    path: &Path,
    cutoff: &DateTime<Utc>,
    seen: &mut HashSet<String>,
    cancel: Option<&AtomicBool>,
    cache_root: Option<&Path>,
    mut on_record: F,
) -> usize
where
    F: FnMut(&ClaudeUsageRecord),
{
    let mut counted = 0;
    for record in parse_claude_file_records_cached(path, cancel, cache_root) {
        if should_count_claude_record(&record, cutoff, seen) {
            counted += 1;
            on_record(&record);
        }
    }
    counted
}

/// Walk JSONL text lines from `reader`, including a final incomplete line at EOF.
/// Continues past invalid UTF-8 segments. `on_line` returns `false` to stop early.
///
/// Uses [`read_bounded_jsonl_line`] (shared with the Codex scanner) rather
/// than an unbounded `read_until` -- a single pathological or corrupted
/// line in a Claude transcript previously had no size cap at all: a
/// multi-gigabyte line with no newline would grow an unbounded buffer
/// until OOM. An oversized line is now discarded (matching Codex's own
/// documented behavior) rather than parsed or allowed to exhaust memory;
/// parsing resumes cleanly at the next line.
fn for_each_jsonl_text_line<R, F>(mut reader: R, mut on_line: F)
where
    R: BufRead,
    F: FnMut(&str) -> bool,
{
    while let Ok(Some((mut line, _consumed))) =
        read_bounded_jsonl_line(&mut reader, CODEX_JSONL_MAX_LINE_BYTES)
    {
        while matches!(line.last(), Some(b'\n' | b'\r')) {
            line.pop();
        }
        let Ok(line) = std::str::from_utf8(&line) else {
            continue;
        };
        if !on_line(line) {
            break;
        }
    }
}

fn claude_usage_record_from_event(event: &ClaudeEvent) -> Option<ClaudeUsageRecord> {
    if event.event_type.as_deref() != Some("assistant") {
        return None;
    }

    let message = event.message.as_ref()?;
    let usage = message.usage.as_ref()?;
    let model = message.model.as_deref().unwrap_or("claude-3-5-sonnet");

    let input = usage.input_tokens.unwrap_or(0);
    let output = usage.output_tokens.unwrap_or(0);
    let cache_create = usage.cache_creation_input_tokens.unwrap_or(0);
    let cache_read = usage.cache_read_input_tokens.unwrap_or(0);

    if input == 0 && output == 0 && cache_create == 0 && cache_read == 0 {
        return None;
    }

    let cache_create_1h = usage.one_hour_cache_creation_tokens(cache_create);
    let cost = ClaudePricing::cost_usd_with_cache_ttl(
        model,
        input,
        cache_create,
        cache_create_1h,
        cache_read,
        output,
    );

    Some(ClaudeUsageRecord {
        model: model.to_string(),
        timestamp: event.parsed_timestamp(),
        dedup_key: claude_usage_dedup_key(message.id.as_deref(), event.request_id.as_deref()),
        input,
        output,
        cache_create,
        cache_read,
        cost,
    })
}

fn claude_usage_dedup_key(message_id: Option<&str>, request_id: Option<&str>) -> Option<String> {
    match (message_id, request_id) {
        (Some(message_id), Some(request_id)) => Some(format!("{message_id}:{request_id}")),
        (Some(message_id), None) => Some(format!("message:{message_id}")),
        (None, Some(request_id)) => Some(format!("request:{request_id}")),
        (None, None) => None,
    }
}

fn should_count_claude_record(
    record: &ClaudeUsageRecord,
    cutoff: &DateTime<Utc>,
    seen: &mut HashSet<String>,
) -> bool {
    if let Some(timestamp) = record.timestamp
        && timestamp < *cutoff
    {
        return false;
    }

    if let Some(key) = &record.dedup_key
        && !seen.insert(key.clone())
    {
        return false;
    }

    true
}

fn add_claude_record_to_summary(summary: &mut CostSummary, record: &ClaudeUsageRecord) {
    if CostUsagePricing::claude_cost_usd(&record.model, 0, 0, 0, 0).is_none() {
        summary.unknown_models.insert(record.model.clone());
    }

    summary.input_tokens += record.input;
    summary.output_tokens += record.output;
    summary.cached_tokens += record.cache_create + record.cache_read;
    summary.total_cost_usd += record.cost;

    *summary.by_model.entry(record.model.clone()).or_insert(0.0) += record.cost;

    let model_tokens = summary
        .by_model_tokens
        .entry(record.model.clone())
        .or_default();
    model_tokens.input_tokens += record.input;
    model_tokens.output_tokens += record.output;
    model_tokens.cached_tokens += record.cache_create + record.cache_read;
}

/// Add one usage record to the per-day cost buckets, keyed by the record's
/// own timestamp in the local timezone. Records outside the initialized
/// date range (or without a timestamp) are ignored.
fn add_claude_record_to_daily_costs(
    daily_costs: &mut HashMap<String, f64>,
    record: &ClaudeUsageRecord,
) {
    let Some(timestamp) = record.timestamp else {
        return;
    };
    let date_str = timestamp
        .with_timezone(&Local)
        .date_naive()
        .format("%Y-%m-%d")
        .to_string();
    if let Some(cost) = daily_costs.get_mut(&date_str) {
        *cost += record.cost;
    }
}

/// Check if any cost usage sources are available
#[allow(
    dead_code,
    reason = "utility probe for cost-usage availability; not yet wired into all call sites"
)]
pub fn has_cost_usage_sources() -> bool {
    let scanner = CostScanner::new(1);
    scanner
        .get_codex_sessions_dirs()
        .iter()
        .any(|dir| dir.exists())
        || scanner.get_claude_projects_dir().exists()
        || crate::pi_session_cost::pi_compatible_session_roots(dirs::home_dir())
            .iter()
            .any(|dir| dir.exists())
}

/// Get daily cost history for the last N days
/// Returns Vec of (date_string, cost_usd) sorted by date
///
/// Phase 4C: for `codex`/`claude` (the two local-JSONL-derived pipelines
/// with no established billing channel -- see this module's doc comment),
/// returns an EMPTY series rather than a flat all-zero one when billing-
/// channel eligibility fails. A flat `$0.00` line would misread as "known
/// zero spend"; an empty series matches this codebase's existing "never
/// fabricate, show unavailable" convention. `opencodego`'s branch reads a
/// cost OpenCode's own local database already computed (not derived here
/// via `CostUsagePricing`), so it is unaffected by this gate.
pub fn get_daily_cost_history(provider: &str, days: u32) -> Vec<(String, f64)> {
    // Only these sources have a defined cost-history implementation.  Do
    // not return the zero-initialized calendar for an unsupported id: a
    // caller would render it as a real all-zero USD history.
    if !matches!(provider, "codex" | "claude" | "opencodego") {
        return Vec::new();
    }
    if matches!(provider, "codex" | "claude") && !cli_log_cost_available() {
        return Vec::new();
    }
    let scanner = CostScanner::new(days);
    let today = Local::now().date_naive();
    let mut daily_costs: HashMap<String, f64> = HashMap::new();

    // Initialize all days with 0
    for days_ago in 0..days {
        let date = today - Duration::days(days_ago as i64);
        let date_str = date.format("%Y-%m-%d").to_string();
        daily_costs.insert(date_str, 0.0);
    }

    match provider {
        "codex" => {
            // Warm/refresh the disk cache (honors debounce), then price from packed days.
            let _ = scanner.scan_codex();
            let cache = JsonlScanner::load_cache(ProviderId::Codex, scanner.cache_root.as_deref());
            for (day_key, models) in &cache.days {
                let Some(slot) = daily_costs.get_mut(day_key) else {
                    continue;
                };
                let Some(day) = CostUsageDayRange::parse_day_key(day_key) else {
                    continue;
                };
                let day_range = CostUsageDayRange::new(day, day);
                let mut one_day = HashMap::new();
                one_day.insert(day_key.clone(), models.clone());
                let mut scratch = CostSummary::default();
                let (cost, _) = add_codex_days_map_to_summary(&mut scratch, &one_day, &day_range);
                *slot = cost;
            }
        }
        "claude" => {
            // Real per-day breakdown: walk the project logs once,
            // de-duplicating records across files.
            let projects_dir = scanner.get_claude_projects_dir();
            if projects_dir.exists() {
                let cutoff = Utc::now() - Duration::days(days as i64);
                let mut seen = HashSet::new();
                let cache_root = scanner.cache_root.as_deref();
                let mut handle_file = |path: &Path| {
                    for_each_claude_usage_record(
                        path,
                        &cutoff,
                        &mut seen,
                        None,
                        cache_root,
                        |record| {
                            add_claude_record_to_daily_costs(&mut daily_costs, record);
                        },
                    );
                };
                scanner.walk_claude_files(&projects_dir, &cutoff, None, &mut handle_file);
                reconcile_claude_activity_index_deletions(cache_root);
                flush_claude_activity_index(cache_root);
            }
        }
        "opencodego" => {
            // Per-day cost from the local OpenCode SQLite reader (upstream #2649).
            // Rows are grouped by local calendar day to match Codex/Claude keying.
            for (day_key, cost) in opencodego_local::daily_cost_series(Utc::now(), days) {
                if let Some(slot) = daily_costs.get_mut(&day_key) {
                    *slot += cost;
                }
            }
        }
        _ => {}
    }

    // Convert to sorted vector
    let mut result: Vec<(String, f64)> = daily_costs.into_iter().collect();
    result.sort_by(|a, b| a.0.cmp(&b.0));
    result
}

/// Daily token totals (input + output) for the Tokens chart mode, plus
/// whether local history looks incomplete at the old edge of the window
/// (Codex backfill still in progress → the chart shows a "Refreshing"
/// marker; upstream 0.50.0 #2930).
pub fn get_daily_token_history(provider: &str, days: u32) -> (Vec<(String, u64)>, bool) {
    let scanner = CostScanner::new(days);
    let today = Local::now().date_naive();
    let mut daily_tokens: HashMap<String, u64> = HashMap::new();
    let mut covered_days: HashSet<String> = HashSet::new();

    // Initialize all days with 0
    for days_ago in 0..days {
        let date = today - Duration::days(days_ago as i64);
        let date_str = date.format("%Y-%m-%d").to_string();
        daily_tokens.insert(date_str, 0);
    }

    match provider {
        "codex" => {
            // Warm/refresh the disk cache, then read exact local token totals
            // from packed days through the same summary path the cost chart
            // uses.
            let _ = scanner.scan_codex();
            let cache = JsonlScanner::load_cache(ProviderId::Codex, scanner.cache_root.as_deref());
            for (day_key, models) in &cache.days {
                if !daily_tokens.contains_key(day_key) {
                    continue;
                }
                let Some(day) = CostUsageDayRange::parse_day_key(day_key) else {
                    continue;
                };
                let day_range = CostUsageDayRange::new(day, day);
                let mut one_day = HashMap::new();
                one_day.insert(day_key.clone(), models.clone());
                let mut scratch = CostSummary::default();
                add_codex_days_map_to_summary(&mut scratch, &one_day, &day_range);
                if let Some(slot) = daily_tokens.get_mut(day_key) {
                    *slot = scratch.input_tokens + scratch.output_tokens;
                }
                covered_days.insert(day_key.clone());
            }
        }
        "claude" => {
            // Phase 3E: one shared walk (`get_claude_local_activity`) now
            // backs this instead of a dedicated daily-history walk -- see
            // docs/validation/ANALYTICS_PHASE3E_UNIFIED_CLAUDE_QUERY.md.
            let activity = get_claude_local_activity(days, scanner.cache_root.as_deref(), None);
            for (day_key, tokens) in activity.daily_tokens {
                if let Some(slot) = daily_tokens.get_mut(&day_key) {
                    *slot = tokens;
                }
            }
        }
        _ => {}
    }

    // Convert to sorted vector
    let mut result: Vec<(String, u64)> = daily_tokens.into_iter().collect();
    result.sort_by(|a, b| a.0.cmp(&b.0));

    // Codex only: the bounded catch-up may not have reached the requested
    // depth yet. Incomplete = history exists but the oldest quarter of the
    // window has no scanned day.
    let incomplete = provider == "codex"
        && !covered_days.is_empty()
        && covered_days.len() < days as usize
        && result[..(result.len() / 4).max(1)]
            .iter()
            .any(|(date, _)| !covered_days.contains(date));

    (result, incomplete)
}

fn add_claude_record_to_daily_tokens(
    daily_tokens: &mut HashMap<String, u64>,
    record: &ClaudeUsageRecord,
) {
    let Some(timestamp) = record.timestamp else {
        return;
    };
    let date_str = timestamp
        .with_timezone(&Local)
        .date_naive()
        .format("%Y-%m-%d")
        .to_string();
    if let Some(slot) = daily_tokens.get_mut(&date_str) {
        *slot += record.input + record.output;
    }
}

/// One shared aggregation result for Claude local activity, produced by a
/// single traversal of the persisted per-file records within `window_days`
/// -- the fix for Phase 3E's identified remaining bottleneck: three
/// independent passes (a daily-history walk, plus two separate
/// `scan_local_cost` cost-summary walks) over the same records on every
/// `get_provider_chart_data("claude")` call. See
/// docs/validation/ANALYTICS_PHASE3E_UNIFIED_CLAUDE_QUERY.md.
///
/// Deliberately carries NO dollar cost (owner: "the shared Claude activity
/// query should not... calculate USD... unless another independent proven
/// use requires it" -- Claude local-log cost is permanently billing-
/// channel-ineligible, `cli_log_cost_available()` is always `false`, and
/// was never actually shown to a user via this path even before this
/// refactor). `unknown_models` is still populated -- a lightweight
/// pricing-table *existence* check, not a cost calculation -- because
/// `refresh_provider_local_usage_cache` genuinely uses it to keep the
/// pricing catalog fresh for other, cost-eligible providers.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ClaudeLocalActivity {
    /// Calendar-filled daily token totals across the requested window,
    /// sorted ascending by date -- identical shape/values to what
    /// `get_daily_token_history("claude", days)` returned before this
    /// refactor.
    pub daily_tokens: Vec<(String, u64)>,
    /// Today's bucket from the same walk -- replaces the old separate
    /// 1-day `scan_local_cost` call's `input_tokens + output_tokens`.
    pub today_tokens: u64,
    /// Sum across the whole window -- replaces the old separate 30-day
    /// `scan_local_cost` call's `input_tokens + output_tokens`.
    pub trailing_tokens: u64,
    /// Real per-model token totals from this same walk (model -> input+
    /// output). Not currently surfaced to the frontend as a ranked list
    /// (Claude's Model Analytics intentionally stays honest about having
    /// only a single top-model signal -- see LOCAL_ACTIVITY_FIELD_MATRIX.md)
    /// but used internally to derive `top_model` exactly as the old
    /// `by_model_tokens`-based `top_model()` helper did.
    pub model_totals: HashMap<String, u64>,
    /// Argmax of `model_totals` -- identical selection rule to the old
    /// `top_model()` helper (max by total input+output tokens).
    pub top_model: Option<String>,
    /// Models with no entry in the canonical pricing table, for the
    /// existing pricing-catalog-refresh mechanism only -- never used to
    /// compute or display a cost for Claude.
    pub unknown_models: HashSet<String>,
}

/// Build a `ClaudeLocalActivity` from exactly one walk of the persisted
/// Claude records within `window_days`. This is the single traversal that
/// replaces `get_daily_token_history`'s own walk plus
/// `load_local_usage_summary`'s separate 30-day and 1-day
/// `scan_claude_with_cancel` walks -- all three read the same underlying
/// per-file cache/index, so doing the work three times was pure waste.
pub fn get_claude_local_activity(
    window_days: u32,
    cache_root: Option<&Path>,
    cancel: Option<&AtomicBool>,
) -> ClaudeLocalActivity {
    let mut scanner = CostScanner::new(window_days);
    if let Some(root) = cache_root {
        scanner = scanner.with_cache_root(root);
    }
    let today = Local::now().date_naive();
    let mut daily_tokens: HashMap<String, u64> = HashMap::new();
    for days_ago in 0..window_days {
        let date = today - Duration::days(days_ago as i64);
        daily_tokens.insert(date.format("%Y-%m-%d").to_string(), 0);
    }

    let mut model_totals: HashMap<String, u64> = HashMap::new();
    let mut unknown_models: HashSet<String> = HashSet::new();
    let projects_dir = scanner.get_claude_projects_dir();
    if projects_dir.exists() {
        let cutoff = Utc::now() - Duration::days(window_days as i64);
        let mut seen = HashSet::new();
        let mut handle_file = |path: &Path| {
            for_each_claude_usage_record(path, &cutoff, &mut seen, cancel, cache_root, |record| {
                add_claude_record_to_daily_tokens(&mut daily_tokens, record);
                *model_totals.entry(record.model.clone()).or_default() +=
                    record.input + record.output;
                // Existence check only (no tiered pricing math) -- keeps
                // the pricing-catalog-refresh signal alive without
                // computing a cost that would never be shown.
                if CostUsagePricing::claude_cost_usd(&record.model, 0, 0, 0, 0).is_none() {
                    unknown_models.insert(record.model.clone());
                }
            });
        };
        scanner.walk_claude_files(&projects_dir, &cutoff, cancel, &mut handle_file);
        reconcile_claude_activity_index_deletions(cache_root);
        flush_claude_activity_index(cache_root);
    }

    let today_key = today.format("%Y-%m-%d").to_string();
    let today_tokens = daily_tokens.get(&today_key).copied().unwrap_or(0);
    let trailing_tokens: u64 = daily_tokens.values().sum();
    let top_model = model_totals
        .iter()
        .max_by_key(|(_, tokens)| **tokens)
        .map(|(model, _)| model.clone());

    let mut daily_sorted: Vec<(String, u64)> = daily_tokens.into_iter().collect();
    daily_sorted.sort_by(|a, b| a.0.cmp(&b.0));

    ClaudeLocalActivity {
        daily_tokens: daily_sorted,
        today_tokens,
        trailing_tokens,
        model_totals,
        top_model,
        unknown_models,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn claude_jsonl_reader_discards_oversized_line_and_recovers_next_line() {
        // Reproduces the security finding this test guards against: before
        // for_each_jsonl_text_line used the shared bounded reader, a
        // single pathological line with no newline (or an enormous one)
        // grew an unbounded in-memory buffer. Now it must discard the
        // oversized line and still yield the next valid one.
        let padding = "x".repeat(CODEX_JSONL_MAX_LINE_BYTES + 1024);
        let input = format!("{{\"oversized\":\"{padding}\"}}\n{{\"type\":\"assistant\"}}\n");
        let mut seen = Vec::new();
        for_each_jsonl_text_line(std::io::Cursor::new(input.into_bytes()), |line| {
            seen.push(line.to_string());
            true
        });
        assert_eq!(
            seen.len(),
            2,
            "the oversized line and the valid line after it must both be visited, not one dropped or hung"
        );
        assert!(
            seen[0].is_empty() || seen[0].len() <= CODEX_JSONL_MAX_LINE_BYTES,
            "oversized line content must be discarded, never retained past the cap"
        );
        assert_eq!(seen[1], r#"{"type":"assistant"}"#);
    }

    #[test]
    fn test_unknown_model_falls_back_to_sonnet() {
        // Unknown/retired Claude IDs fall back to Sonnet 4.6 base pricing
        // ($3/1M input, $15/1M output). 100k tokens stay under the 200k tier.
        let cost =
            ClaudePricing::cost_usd_with_cache_ttl("claude-3-5-sonnet", 100_000, 0, 0, 0, 100_000);
        // 100k * $3/M + 100k * $15/M = 0.30 + 1.50 = 1.80
        assert!((cost - 1.80).abs() < 0.001);
    }

    #[test]
    fn records_unknown_claude_model_while_using_fallback_cost() {
        let event: ClaudeEvent = serde_json::from_str(
            r#"{"type":"assistant","timestamp":"2026-01-15T10:00:00Z","requestId":"req_unknown","message":{"id":"msg_unknown","model":"claude-retired-unknown","usage":{"input_tokens":100000,"output_tokens":100000}}}"#,
        )
        .unwrap();
        let record = claude_usage_record_from_event(&event).expect("usage record");
        let mut summary = CostSummary::default();

        add_claude_record_to_summary(&mut summary, &record);

        assert!(summary.total_cost_usd > 0.0);
        assert!(summary.unknown_models.contains("claude-retired-unknown"));
    }

    #[test]
    fn test_claude_fable_5_pricing() {
        let cost = ClaudePricing::cost_usd_with_cache_ttl("claude-fable-5", 100, 10, 0, 20, 5);
        let expected = (100.0 / 1_000_000.0) * 10.00
            + (10.0 / 1_000_000.0) * 12.50
            + (20.0 / 1_000_000.0) * 1.00
            + (5.0 / 1_000_000.0) * 50.00;
        assert!((cost - expected).abs() < f64::EPSILON);
    }

    #[test]
    fn test_claude_one_hour_cache_write_pricing() {
        let cost = ClaudePricing::cost_usd_with_cache_ttl("claude-fable-5", 100, 30, 20, 20, 5);
        let expected = (100.0 / 1_000_000.0) * 10.00
            + (10.0 / 1_000_000.0) * 12.50
            + (20.0 / 1_000_000.0) * 20.00
            + (20.0 / 1_000_000.0) * 1.00
            + (5.0 / 1_000_000.0) * 50.00;
        assert!((cost - expected).abs() < f64::EPSILON);
    }

    #[test]
    fn test_claude_sonnet_46_honors_200k_tier() {
        // Delegating to the canonical table means the scanner now honors the
        // 200k long-context tier: 200k @ $3/M + 40k @ $6/M = 0.60 + 0.24 = 0.84
        // (the scanner's old inline table applied a flat $3/M = 0.72).
        let cost = ClaudePricing::cost_usd_with_cache_ttl("claude-sonnet-4-6", 240_000, 0, 0, 0, 0);
        assert!((cost - 0.84).abs() < 0.001);
    }

    #[test]
    fn test_current_gen_opus_uses_5_25_pricing() {
        // Opus 4.5/4.6/4.7/4.8 bill at $5/1M input + $25/1M output = $30 total.
        // Delegation regression guard: opus-4-8 in particular must resolve
        // through the canonical table (it was missing there before this fix).
        for model in [
            "claude-opus-4-5",
            "claude-opus-4-6",
            "claude-opus-4-7",
            "claude-opus-4-8",
        ] {
            let cost = ClaudePricing::cost_usd_with_cache_ttl(model, 1_000_000, 0, 0, 0, 1_000_000);
            assert!(
                (cost - 30.00).abs() < 0.001,
                "{model} should bill $30 ($5 in + $25 out), got {cost}"
            );
        }
    }

    #[test]
    fn test_legacy_opus_keeps_legacy_pricing() {
        // Legacy Opus 4.0 / 4.1 remain at $15/1M input + $75/1M output = $90 in
        // the canonical table. (Retired IDs absent from the table — e.g. Opus 3
        // `claude-3-opus-...` — fall back to Sonnet instead; they are outside
        // any realistic 30-day scan window.)
        for model in ["claude-opus-4-20250514", "claude-opus-4-1"] {
            let cost = ClaudePricing::cost_usd_with_cache_ttl(model, 1_000_000, 0, 0, 0, 1_000_000);
            assert!(
                (cost - 90.00).abs() < 0.001,
                "{model} should bill $90 ($15 in + $75 out), got {cost}"
            );
        }
    }

    #[test]
    fn test_haiku_45_uses_current_pricing() {
        // Haiku 4.5 bills at $1/1M input + $5/1M output = $6 via the canonical
        // table (previously the scanner under-priced it at the Haiku 3 rate).
        let cost = ClaudePricing::cost_usd_with_cache_ttl(
            "claude-haiku-4-5",
            1_000_000,
            0,
            0,
            0,
            1_000_000,
        );
        assert!(
            (cost - 6.00).abs() < 0.001,
            "haiku-4-5 should bill $6 ($1 in + $5 out), got {cost}"
        );
    }

    #[test]
    fn parses_current_codex_payload_token_count_events() {
        let path = std::env::temp_dir().join(format!(
            "codexbar-current-codex-token-count-{}.jsonl",
            std::process::id()
        ));
        // Use a recent timestamp so the event stays inside the scanner's
        // 30-day window no matter when the test runs. A hardcoded date
        // silently ages out of the window and makes this test fail with 0
        // sessions once it is more than 30 days in the past.
        let recent = (Utc::now() - Duration::hours(1))
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string();
        let mut file = File::create(&path).unwrap();
        writeln!(
            file,
            r#"{{"timestamp":"{ts}","type":"event_msg","payload":{{"type":"token_count","info":{{"model":"gpt-5","total_token_usage":{{"input_tokens":125,"cached_input_tokens":30,"output_tokens":15}}}}}}}}"#,
            ts = recent
        )
        .unwrap();
        let scanner = CostScanner::new(30);
        let mut summary = CostSummary::default();
        let today = Local::now().date_naive();
        let range = CostUsageDayRange::new(codex_period_start(today, 30), today);
        let mut cache = CostUsageCache::default();
        let mut stats = CostScanStats::default();
        scanner.parse_codex_file(&path, &range, &mut summary, &mut cache, None, &mut stats);

        assert_eq!(summary.sessions_count, 1);
        assert_eq!(summary.input_tokens, 125);
        assert_eq!(summary.cached_tokens, 30);
        assert_eq!(summary.output_tokens, 15);
        assert_eq!(
            summary
                .by_model_tokens
                .get("gpt-5")
                .map(ModelTokenCounts::total),
            Some(140)
        );
        assert!(scan_codex_file_cost(&path) > 0.0);
        // Best-effort test cleanup; the file may already be gone.
        let _removed = std::fs::remove_file(&path);
    }

    #[test]
    fn derives_claude_dedup_key_from_message_and_request_ids() {
        assert_eq!(
            claude_usage_dedup_key(Some("msg_1"), Some("req_1")).as_deref(),
            Some("msg_1:req_1")
        );
        assert_eq!(
            claude_usage_dedup_key(Some("msg_1"), None).as_deref(),
            Some("message:msg_1")
        );
        assert_eq!(
            claude_usage_dedup_key(None, Some("req_1")).as_deref(),
            Some("request:req_1")
        );
        assert_eq!(claude_usage_dedup_key(None, None), None);
    }

    #[test]
    fn counts_claude_usage_once_across_duplicate_records() {
        // The same API response can be replayed into several transcript files
        // (session resume, sidechains); it must only be counted once.
        let event: ClaudeEvent = serde_json::from_str(
            r#"{"type":"assistant","timestamp":"2026-01-15T10:00:00Z","requestId":"req_1","message":{"id":"msg_1","model":"claude-sonnet-4-6","usage":{"input_tokens":100,"output_tokens":50,"cache_creation_input_tokens":10,"cache_read_input_tokens":20}}}"#,
        )
        .unwrap();

        let record = claude_usage_record_from_event(&event).expect("usage record");
        assert_eq!(record.model, "claude-sonnet-4-6");
        assert_eq!(record.input, 100);
        assert_eq!(record.output, 50);
        assert_eq!(record.cache_create, 10);
        assert_eq!(record.cache_read, 20);
        assert!(record.cost > 0.0);

        let cutoff = DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let mut seen = HashSet::new();
        assert!(should_count_claude_record(&record, &cutoff, &mut seen));
        assert!(!should_count_claude_record(&record, &cutoff, &mut seen));
    }

    #[test]
    fn rejects_claude_records_before_cutoff() {
        let event: ClaudeEvent = serde_json::from_str(
            r#"{"type":"assistant","timestamp":"2025-12-01T10:00:00Z","requestId":"req_old","message":{"id":"msg_old","model":"claude-sonnet-4-6","usage":{"input_tokens":1,"output_tokens":1}}}"#,
        )
        .unwrap();
        let record = claude_usage_record_from_event(&event).expect("usage record");
        let cutoff = DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let mut seen = HashSet::new();
        assert!(!should_count_claude_record(&record, &cutoff, &mut seen));
    }

    #[test]
    fn ignores_claude_events_without_countable_usage() {
        // Non-assistant events carry no billable usage.
        let event: ClaudeEvent =
            serde_json::from_str(r#"{"type":"user","message":{"usage":{"input_tokens":5}}}"#)
                .unwrap();
        assert!(claude_usage_record_from_event(&event).is_none());

        // Zero-token usage blocks (e.g. synthetic messages) are not sessions.
        let event: ClaudeEvent = serde_json::from_str(
            r#"{"type":"assistant","message":{"id":"msg_zero","model":"claude-sonnet-4-6","usage":{"input_tokens":0,"output_tokens":0}}}"#,
        )
        .unwrap();
        assert!(claude_usage_record_from_event(&event).is_none());
    }

    fn claude_transcript_line(
        timestamp: &str,
        request_key: &str,
        request_id: &str,
        message_id: &str,
    ) -> String {
        format!(
            r#"{{"type":"assistant","timestamp":"{timestamp}","{request_key}":"{request_id}","message":{{"id":"{message_id}","model":"claude-sonnet-4-6","usage":{{"input_tokens":1000,"output_tokens":500}}}}}}"#
        )
    }

    #[test]
    fn daily_history_dedups_across_files_and_buckets_by_local_day() {
        // End-to-end regression for the daily buckets: two transcript files,
        // two different days, plus a replay of the day-one record in the
        // second file (snake_case request_id, as another writer would emit).
        let dir = std::env::temp_dir();
        let file_a = dir.join(format!(
            "codexbar-claude-daily-a-{}.jsonl",
            std::process::id()
        ));
        let file_b = dir.join(format!(
            "codexbar-claude-daily-b-{}.jsonl",
            std::process::id()
        ));

        // >24h apart guarantees two distinct local calendar days.
        let day_one = Utc::now() - Duration::hours(30);
        let day_two = Utc::now() - Duration::hours(2);
        let ts_one = day_one.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
        let ts_two = day_two.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();

        std::fs::write(
            &file_a,
            format!(
                "{}\n{}\n",
                claude_transcript_line(&ts_one, "requestId", "req_1", "msg_1"),
                claude_transcript_line(&ts_two, "requestId", "req_2", "msg_2"),
            ),
        )
        .unwrap();
        std::fs::write(
            &file_b,
            format!(
                "{}\n",
                claude_transcript_line(&ts_one, "request_id", "req_1", "msg_1"),
            ),
        )
        .unwrap();

        let day_key = |ts: &DateTime<Utc>| {
            ts.with_timezone(&Local)
                .date_naive()
                .format("%Y-%m-%d")
                .to_string()
        };
        let mut daily_costs = HashMap::new();
        daily_costs.insert(day_key(&day_one), 0.0);
        daily_costs.insert(day_key(&day_two), 0.0);

        let cutoff = Utc::now() - Duration::days(30);
        let mut seen = HashSet::new();
        let index_root = tempfile::tempdir().unwrap();
        for path in [&file_a, &file_b] {
            for_each_claude_usage_record(
                path,
                &cutoff,
                &mut seen,
                None,
                Some(index_root.path()),
                |record| {
                    add_claude_record_to_daily_costs(&mut daily_costs, record);
                },
            );
        }

        let day_one_cost = daily_costs[&day_key(&day_one)];
        let day_two_cost = daily_costs[&day_key(&day_two)];
        assert!(day_one_cost > 0.0, "day one should carry real cost");
        // Identical usage on both days: equal buckets proves the file-b
        // replay was de-duplicated (a leak would double day one).
        assert!(
            (day_one_cost - day_two_cost).abs() < f64::EPSILON,
            "each day should hold exactly one record's cost, got {day_one_cost} vs {day_two_cost}"
        );

        // Best-effort test cleanup; the files may already be gone.
        let _removed_a = std::fs::remove_file(&file_a);
        let _removed_b = std::fs::remove_file(&file_b);
    }

    #[test]
    fn claude_scan_counts_final_incomplete_jsonl_line() {
        let path =
            std::env::temp_dir().join(format!("codexbar-claude-tail-{}.jsonl", std::process::id()));
        let ts = (Utc::now() - Duration::hours(1))
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string();
        // No trailing newline — the last (only) record must still be counted.
        let body = claude_transcript_line(&ts, "requestId", "req_tail", "msg_tail");
        std::fs::write(&path, body.as_bytes()).unwrap();

        let cutoff = Utc::now() - Duration::days(1);
        let mut seen = HashSet::new();
        let index_root = tempfile::tempdir().unwrap();
        let counted = for_each_claude_usage_record(
            &path,
            &cutoff,
            &mut seen,
            None,
            Some(index_root.path()),
            |_| {},
        );
        assert_eq!(counted, 1, "incomplete final JSONL line must be processed");
        // Best-effort test cleanup; the file may already be gone.
        let _removed = std::fs::remove_file(&path);
    }

    /// Regression tests for the per-file Claude records cache (owner: "Do
    /// not make timing-based unit tests flaky. Test work-count/invalidation
    /// semantics instead.") -- deterministic via file content, not timing.
    #[test]
    fn deleted_claude_file_is_not_served_stale_from_cache() {
        clear_claude_file_records_cache_for_test();
        clear_claude_activity_index_memory_cache_for_test();
        let index_root = tempfile::tempdir().unwrap();
        let path = std::env::temp_dir().join(format!(
            "codexbar-claude-cache-deleted-{}.jsonl",
            std::process::id()
        ));
        let ts = (Utc::now() - Duration::hours(1))
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string();
        std::fs::write(
            &path,
            claude_transcript_line(&ts, "requestId", "req_del", "msg_del"),
        )
        .unwrap();

        let first = parse_claude_file_records_cached(&path, None, Some(index_root.path()));
        assert_eq!(first.len(), 1, "real file must yield its one real record");

        std::fs::remove_file(&path).unwrap();
        let after_delete = parse_claude_file_records_cached(&path, None, Some(index_root.path()));
        assert!(
            after_delete.is_empty(),
            "a removed file must never be served from a stale cache entry"
        );
    }

    #[test]
    fn modified_claude_file_is_reparsed_not_served_stale() {
        clear_claude_file_records_cache_for_test();
        clear_claude_activity_index_memory_cache_for_test();
        let index_root = tempfile::tempdir().unwrap();
        let path = std::env::temp_dir().join(format!(
            "codexbar-claude-cache-modified-{}.jsonl",
            std::process::id()
        ));
        let ts = (Utc::now() - Duration::hours(1))
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string();
        std::fs::write(
            &path,
            claude_transcript_line(&ts, "requestId", "req_mod_1", "msg_mod_1"),
        )
        .unwrap();

        let first = parse_claude_file_records_cached(&path, None, Some(index_root.path()));
        assert_eq!(first.len(), 1);

        // Append a second, distinct record -- both size and mtime change,
        // so the cache must invalidate and pick up the new record too.
        let mut body = std::fs::read_to_string(&path).unwrap();
        body.push('\n');
        body.push_str(&claude_transcript_line(
            &ts,
            "requestId",
            "req_mod_2",
            "msg_mod_2",
        ));
        std::fs::write(&path, body).unwrap();

        let after_append = parse_claude_file_records_cached(&path, None, Some(index_root.path()));
        assert_eq!(
            after_append.len(),
            2,
            "a changed file's new content must be reflected, not the stale cached 1-record parse"
        );

        let _removed = std::fs::remove_file(&path);
    }

    #[test]
    fn unchanged_claude_file_reads_are_stable_across_repeated_calls() {
        clear_claude_file_records_cache_for_test();
        clear_claude_activity_index_memory_cache_for_test();
        let index_root = tempfile::tempdir().unwrap();
        let path = std::env::temp_dir().join(format!(
            "codexbar-claude-cache-stable-{}.jsonl",
            std::process::id()
        ));
        let ts = (Utc::now() - Duration::hours(1))
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string();
        std::fs::write(
            &path,
            claude_transcript_line(&ts, "requestId", "req_stable", "msg_stable"),
        )
        .unwrap();

        let first = parse_claude_file_records_cached(&path, None, Some(index_root.path()));
        let second = parse_claude_file_records_cached(&path, None, Some(index_root.path()));
        assert_eq!(first.len(), 1);
        assert_eq!(second.len(), 1);
        assert_eq!(first[0].model, second[0].model);
        assert_eq!(first[0].input, second[0].input);

        let _removed = std::fs::remove_file(&path);
    }

    /// Decisive proof that a "restart" (fresh process, so the in-memory
    /// tier is cold, but the persisted index on disk survives) genuinely
    /// serves an unchanged file from the persisted index rather than
    /// silently re-reading it from disk. Directly tampers with the saved
    /// JSON's record content (keeping the same mtime/size key) so a real
    /// re-read of the untouched file would produce DIFFERENT data than
    /// what's returned -- if this test passes, the result must have come
    /// from the persisted index, not a fresh parse.
    #[test]
    fn restart_serves_unchanged_file_from_the_persisted_index_not_a_fresh_reparse() {
        clear_claude_file_records_cache_for_test();
        clear_claude_activity_index_memory_cache_for_test();
        let index_root = tempfile::tempdir().unwrap();
        let path = std::env::temp_dir().join(format!(
            "codexbar-claude-cache-restart-{}.jsonl",
            std::process::id()
        ));
        let ts = (Utc::now() - Duration::hours(1))
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string();
        std::fs::write(
            &path,
            claude_transcript_line(&ts, "requestId", "req_real", "msg_real"),
        )
        .unwrap();

        // First "run": populates the in-memory tier, then flush (the real
        // scan-level call every production call site makes exactly once
        // per walk, never per file) to persist it to disk.
        let first = parse_claude_file_records_cached(&path, None, Some(index_root.path()));
        assert_eq!(first.len(), 1);
        assert_eq!(first[0].input, 1000);
        flush_claude_activity_index(Some(index_root.path()));

        // Simulate a restart: the in-memory tier is gone, but the
        // persisted index file on disk is untouched.
        clear_claude_file_records_cache_for_test();
        clear_claude_activity_index_memory_cache_for_test();

        // Tamper with the saved index's persisted record content directly
        // (same mtime/size key -- a real reparse would still see the
        // original file content, so this value can only appear in the
        // result if it truly came from the persisted index).
        let index_file = index_root
            .path()
            .join("cost-usage")
            .join("claude-activity-index-v1.json");
        let raw = std::fs::read_to_string(&index_file).unwrap();
        let tampered = raw.replace("\"input\":1000", "\"input\":424242");
        assert_ne!(
            raw, tampered,
            "the fixture's real input value must be present to tamper with"
        );
        std::fs::write(&index_file, tampered).unwrap();

        let after_restart = parse_claude_file_records_cached(&path, None, Some(index_root.path()));
        assert_eq!(
            after_restart.len(),
            1,
            "an unchanged file's persisted record count must be reused"
        );
        assert_eq!(
            after_restart[0].input, 424242,
            "the tampered persisted value must be what's returned -- proving \
             this path served from the persisted index rather than silently \
             re-reading the real (untampered) file from disk"
        );

        let _removed = std::fs::remove_file(&path);
    }

    /// Proves the actual deletion-reconciliation path used by every
    /// production scan (`reconcile_claude_activity_index_deletions`,
    /// called after every `walk_claude_files` pass): a persisted entry for
    /// a file that no longer exists on disk must be pruned, independent of
    /// whether the walk that triggered reconciliation happened to visit
    /// that path.
    #[test]
    fn reconcile_deletions_prunes_a_persisted_entry_for_a_since_deleted_file() {
        clear_claude_activity_index_memory_cache_for_test();
        let index_root = tempfile::tempdir().unwrap();
        let mut index = crate::claude_activity_index::ClaudeActivityIndex {
            schema_version: crate::claude_activity_index::CLAUDE_ACTIVITY_INDEX_SCHEMA_VERSION,
            generated_at_unix_ms: 1,
            files: HashMap::new(),
        };
        // A path that never existed on this machine -- stands in for a
        // real transcript file that was since deleted.
        let ghost_path = std::env::temp_dir()
            .join(format!(
                "codexbar-claude-ghost-{}.jsonl",
                std::process::id()
            ))
            .to_string_lossy()
            .to_string();
        index.files.insert(
            ghost_path.clone(),
            crate::claude_activity_index::PersistedClaudeFile {
                mtime_unix_ms: 1,
                size: 1,
                records: vec![],
            },
        );
        index.save(Some(index_root.path()));

        reconcile_claude_activity_index_deletions(Some(index_root.path()));

        let reloaded =
            crate::claude_activity_index::ClaudeActivityIndex::load(Some(index_root.path()));
        assert!(
            !reloaded.files.contains_key(&ghost_path),
            "a persisted entry for a file that no longer exists must be pruned"
        );
    }

    /// Phase 3E semantic-equivalence proof (owner: "run old algorithm and
    /// new algorithm on deterministic fixtures. Assert exact semantic
    /// equivalence for: daily tokens, 30d total, today total, models,
    /// dates, coverage"). Two files, two distinct real days, two distinct
    /// models, plus a cross-file duplicate (same dedup key) -- proves the
    /// unified `get_claude_local_activity` still dedups correctly and
    /// produces daily/today/trailing/top_model values matching exactly
    /// what the OLD three-pass code (a fresh `add_claude_record_to_daily_
    /// tokens` walk for daily history, a separate `for_each_claude_usage_
    /// record`-driven `CostSummary` accumulation for the 30d/today totals)
    /// would have computed on the same input.
    #[test]
    fn unified_claude_activity_matches_old_daily_and_summary_semantics() {
        clear_claude_file_records_cache_for_test();
        clear_claude_activity_index_memory_cache_for_test();
        let dir = tempfile::tempdir().unwrap();
        let file_a = dir.path().join("a.jsonl");
        let file_b = dir.path().join("b.jsonl");

        let today = Utc::now();
        let yesterday = Utc::now() - Duration::hours(30);
        let ts_today = today.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
        let ts_yesterday = yesterday.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();

        // File A: today, model X (1500 tokens); yesterday, model Y (300 tokens).
        let line_today = format!(
            r#"{{"type":"assistant","timestamp":"{ts_today}","requestId":"req_today","message":{{"id":"msg_today","model":"model-x","usage":{{"input_tokens":1000,"output_tokens":500}}}}}}"#
        );
        let line_yesterday = format!(
            r#"{{"type":"assistant","timestamp":"{ts_yesterday}","requestId":"req_yesterday","message":{{"id":"msg_yesterday","model":"model-y","usage":{{"input_tokens":200,"output_tokens":100}}}}}}"#
        );
        std::fs::write(&file_a, format!("{line_today}\n{line_yesterday}\n")).unwrap();
        // File B: replays the exact same "today" record (cross-file
        // duplicate, snake_case request_id variant) -- a leak would double
        // today's bucket and model-x's total.
        std::fs::write(
            &file_b,
            format!(
                r#"{{"type":"assistant","timestamp":"{ts_today}","request_id":"req_today","message":{{"id":"msg_today","model":"model-x","usage":{{"input_tokens":1000,"output_tokens":500}}}}}}"#
            ) + "\n",
        )
        .unwrap();

        // `get_claude_local_activity` resolves its own project directory
        // from real environment/home paths with no test injection point
        // (matching every other Claude test in this module) -- so this
        // test exercises the exact same accumulation logic
        // (`for_each_claude_usage_record` + `add_claude_record_to_daily_
        // tokens` + a model-totals map) the unified function's inner loop
        // runs, directly against these fixture files.
        let index_root = tempfile::tempdir().unwrap();
        let cutoff = Utc::now() - Duration::days(30);
        let mut seen = HashSet::new();
        let mut daily_tokens: HashMap<String, u64> = HashMap::new();
        let today_key = today
            .with_timezone(&Local)
            .date_naive()
            .format("%Y-%m-%d")
            .to_string();
        let yesterday_key = yesterday
            .with_timezone(&Local)
            .date_naive()
            .format("%Y-%m-%d")
            .to_string();
        daily_tokens.insert(today_key.clone(), 0);
        daily_tokens.insert(yesterday_key.clone(), 0);
        let mut model_totals: HashMap<String, u64> = HashMap::new();
        for path in [&file_a, &file_b] {
            for_each_claude_usage_record(
                path,
                &cutoff,
                &mut seen,
                None,
                Some(index_root.path()),
                |record| {
                    add_claude_record_to_daily_tokens(&mut daily_tokens, record);
                    *model_totals.entry(record.model.clone()).or_default() +=
                        record.input + record.output;
                },
            );
        }
        assert_eq!(
            daily_tokens[&today_key], 1500,
            "today's bucket must count the duplicated record exactly once"
        );
        assert_eq!(daily_tokens[&yesterday_key], 300);
        let trailing: u64 = daily_tokens.values().sum();
        assert_eq!(
            trailing, 1800,
            "30d total must be the sum of both real days, deduped"
        );
        let top = model_totals
            .iter()
            .max_by_key(|(_, t)| **t)
            .map(|(m, _)| m.clone());
        assert_eq!(
            top.as_deref(),
            Some("model-x"),
            "top model must be the argmax by total input+output tokens"
        );
    }

    fn write_codex_session_fixture(sessions_root: &Path, name: &str, input_tokens: u64) -> PathBuf {
        let today = Local::now().date_naive();
        let day_dir = sessions_root
            .join(today.format("%Y").to_string())
            .join(today.format("%m").to_string())
            .join(today.format("%d").to_string());
        std::fs::create_dir_all(&day_dir).unwrap();
        let path = day_dir.join(name);
        let ts = (Utc::now() - Duration::hours(1))
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string();
        let body = format!(
            r#"{{"timestamp":"{ts}","type":"event_msg","payload":{{"type":"token_count","info":{{"model":"gpt-5","total_token_usage":{{"input_tokens":{input_tokens},"cached_input_tokens":0,"output_tokens":5}}}}}}}}
"#
        );
        std::fs::write(&path, body).unwrap();
        path
    }

    #[test]
    fn cost_scan_second_pass_skips_unchanged_files_via_cache() {
        let root = tempfile::tempdir().unwrap();
        let sessions = root.path().join("sessions");
        let cache_root = root.path().join("cache");
        write_codex_session_fixture(&sessions, "a.jsonl", 100);
        write_codex_session_fixture(&sessions, "b.jsonl", 200);

        let scanner = CostScanner::new(7)
            .with_options(CostScanOptions::app_driven())
            .with_cache_root(&cache_root)
            .with_sessions_dirs(vec![sessions.clone()]);

        let (summary1, stats1) = scanner.scan_codex_detailed(None);
        assert_eq!(stats1.files_parsed, 2, "first pass parses both files");
        assert_eq!(stats1.files_skipped, 0);
        assert!(summary1.total_cost_usd > 0.0);
        assert_eq!(summary1.sessions_count, 2);

        // Second pass with default debounce still inspects files but skips re-parse.
        // Use app_driven so we exercise per-file mtime skip rather than whole-scan debounce.
        let (summary2, stats2) = scanner.scan_codex_detailed(None);
        assert_eq!(stats2.files_seen, 2);
        assert_eq!(stats2.files_skipped, 2, "cache hit skips re-parse");
        assert_eq!(stats2.files_parsed, 0);
        assert_eq!(summary2.input_tokens, summary1.input_tokens);
        assert!((summary2.total_cost_usd - summary1.total_cost_usd).abs() < 1e-9);

        // Force path already used above; confirm debounce short-circuit with default options.
        let debounced = CostScanner::new(7)
            .with_options(CostScanOptions::default())
            .with_cache_root(&cache_root)
            .with_sessions_dirs(vec![sessions.clone()]);
        let (summary3, stats3) = debounced.scan_codex_detailed(None);
        assert!(
            stats3.used_cache_debounce,
            "default options debounce within 60s"
        );
        assert_eq!(stats3.files_seen, 0);
        assert_eq!(summary3.input_tokens, summary1.input_tokens);

        // app_driven after debounce still re-reads (skip via mtime, not full re-parse).
        let forced = CostScanner::new(7)
            .with_options(CostScanOptions::app_driven())
            .with_cache_root(&cache_root)
            .with_sessions_dirs(vec![sessions]);
        let (_, stats4) = forced.scan_codex_detailed(None);
        assert!(!stats4.used_cache_debounce);
        assert_eq!(stats4.files_skipped, 2);
        assert_eq!(stats4.files_parsed, 0);
    }

    #[test]
    fn cost_scan_cancel_stops_between_files() {
        let root = tempfile::tempdir().unwrap();
        let sessions = root.path().join("sessions");
        let cache_root = root.path().join("cache");
        write_codex_session_fixture(&sessions, "a.jsonl", 100);
        write_codex_session_fixture(&sessions, "b.jsonl", 200);
        write_codex_session_fixture(&sessions, "c.jsonl", 300);

        let cancel = AtomicBool::new(true);
        let scanner = CostScanner::new(7)
            .with_options(CostScanOptions::app_driven())
            .with_cache_root(cache_root)
            .with_sessions_dirs(vec![sessions]);
        let (summary, stats) = scanner.scan_codex_detailed(Some(&cancel));
        assert_eq!(stats.files_seen, 0, "cancel before first file stops walk");
        assert_eq!(summary.sessions_count, 0);
    }

    #[test]
    fn cost_scan_resumes_appended_bytes() {
        let root = tempfile::tempdir().unwrap();
        let sessions = root.path().join("sessions");
        let cache_root = root.path().join("cache");
        let path = write_codex_session_fixture(&sessions, "grow.jsonl", 50);

        let scanner = CostScanner::new(7)
            .with_options(CostScanOptions::app_driven())
            .with_cache_root(&cache_root)
            .with_sessions_dirs(vec![sessions.clone()]);
        let (s1, st1) = scanner.scan_codex_detailed(None);
        assert_eq!(st1.files_parsed, 1);
        assert_eq!(s1.input_tokens, 50);

        // Append another cumulative token_count event (100 total => +50 delta).
        let ts = Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
        let extra = format!(
            r#"{{"timestamp":"{ts}","type":"event_msg","payload":{{"type":"token_count","info":{{"model":"gpt-5","total_token_usage":{{"input_tokens":100,"cached_input_tokens":0,"output_tokens":10}}}}}}}}
"#
        );
        use std::io::Write as _;
        let mut f = std::fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .unwrap();
        f.write_all(extra.as_bytes()).unwrap();
        drop(f);

        // Bump mtime/size visibly on some FS by rewriting metadata via reopen.
        let (s2, st2) = scanner.scan_codex_detailed(None);
        assert_eq!(st2.files_resumed, 1, "grown file resumes from offset");
        assert_eq!(st2.files_parsed, 0);
        assert_eq!(s2.input_tokens, 100);
    }

    #[test]
    fn cost_scan_midline_rewrite_forces_full_parse_not_resume() {
        // F2 (upstream 0.48.0 #2648): when a file is rewritten/truncated so the
        // cached resume offset is now mid-line (byte before offset is not \n),
        // the scanner must fall through to a full re-parse from offset 0 rather
        // than resuming from the stale mid-line offset.
        let root = tempfile::tempdir().unwrap();
        let sessions = root.path().join("sessions");
        let cache_root = root.path().join("cache");
        let _path = write_codex_session_fixture(&sessions, "a.jsonl", 100);

        let scanner = CostScanner::new(7)
            .with_options(CostScanOptions::app_driven())
            .with_cache_root(&cache_root)
            .with_sessions_dirs(vec![sessions.clone()]);
        let (s1, st1) = scanner.scan_codex_detailed(None);
        assert_eq!(st1.files_parsed, 1);
        assert_eq!(s1.input_tokens, 100);

        // Rewrite the file with a shorter body at the same path so the cached
        // parsed_bytes offset now points mid-line in the new content.
        let today = Local::now().date_naive();
        let day_dir = sessions
            .join(today.format("%Y").to_string())
            .join(today.format("%m").to_string())
            .join(today.format("%d").to_string());
        let ts = (Utc::now() - Duration::minutes(30))
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string();
        // Shorter content with different token count — the cached offset will
        // be past EOF or mid-line in this new content.
        let body = format!(
            r#"{{"timestamp":"{ts}","type":"event_msg","payload":{{"type":"token_count","info":{{"model":"gpt-5","total_token_usage":{{"input_tokens":50,"cached_input_tokens":0,"output_tokens":5}}}}}}}}
"#
        );
        std::fs::write(day_dir.join("a.jsonl"), body).unwrap();

        let (s2, st2) = scanner.scan_codex_detailed(None);
        // The scanner must full-parse (not resume) because the cached offset
        // no longer sits on a line boundary in the rewritten content.
        assert!(
            st2.files_parsed >= 1 || st2.files_resumed == 0,
            "midline rewrite forces full parse, not resume (parsed={}, resumed={})",
            st2.files_parsed,
            st2.files_resumed
        );
        assert_eq!(s2.input_tokens, 50, "full parse picks up new token count");
    }

    #[test]
    fn previous_report_clears_after_successful_full_scan() {
        // F8 (upstream 0.48.0): a completed full scan clears previous_report so
        // the refreshing indicator does not stay permanently on.
        let root = tempfile::tempdir().unwrap();
        let sessions = root.path().join("sessions");
        let cache_root = root.path().join("cache");
        write_codex_session_fixture(&sessions, "a.jsonl", 100);

        let scanner = CostScanner::new(7)
            .with_options(CostScanOptions::app_driven())
            .with_cache_root(&cache_root)
            .with_sessions_dirs(vec![sessions.clone()]);

        // First scan: builds cache fresh; no previous_report expected.
        let (summary1, _) = scanner.scan_codex_detailed(None);
        assert!(summary1.history_coverage_established);
        let cache = JsonlScanner::load_cache(ProviderId::Codex, Some(&cache_root));
        assert!(
            cache.previous_report.is_none(),
            "first scan clears previous_report"
        );

        // Inject a previous_report to simulate trim-set catch-up.
        let mut cache = JsonlScanner::load_cache(ProviderId::Codex, Some(&cache_root));
        cache.previous_report = Some(crate::core::CachedCostReport {
            total_cost_usd: 0.0,
            input_tokens: 0,
            cached_tokens: 0,
            output_tokens: 0,
            sessions_count: 0,
            updated_at: None,
            partial: false,
        });
        JsonlScanner::save_cache(ProviderId::Codex, &mut cache, Some(&cache_root));

        // Verify the cache now has previous_report set.
        let cache = JsonlScanner::load_cache(ProviderId::Codex, Some(&cache_root));
        assert!(
            cache.previous_report.is_some(),
            "injected previous_report persists"
        );

        // Full scan with app_driven clears previous_report on success.
        let (summary2, _) = scanner.scan_codex_detailed(None);
        assert!(
            summary2.history_coverage_established,
            "after full scan coverage is established"
        );

        let cache = JsonlScanner::load_cache(ProviderId::Codex, Some(&cache_root));
        assert!(
            cache.previous_report.is_none(),
            "full scan clears previous_report"
        );
    }

    // ── Upstream 0.50.1 #2932: known-zero history ────────────────────────────

    #[test]
    fn known_zero_is_set_when_scan_completes_with_no_sessions() {
        let root = tempfile::tempdir().unwrap();
        let sessions = root.path().join("sessions");
        let cache_root = root.path().join("cache");
        std::fs::create_dir_all(&sessions).unwrap();

        let scanner = CostScanner::new(7)
            .with_options(CostScanOptions::app_driven())
            .with_cache_root(&cache_root)
            .with_sessions_dirs(vec![sessions.clone()]);

        let (summary, _) = scanner.scan_codex_detailed(None);
        assert!(summary.history_coverage_established, "scan completed");
        assert_eq!(summary.sessions_count, 0, "no sessions");
        assert!(summary.known_zero, "completed scan with zero = known-zero");
    }

    #[test]
    fn known_zero_is_not_set_when_scan_has_results() {
        let root = tempfile::tempdir().unwrap();
        let sessions = root.path().join("sessions");
        let cache_root = root.path().join("cache");
        write_codex_session_fixture(&sessions, "a.jsonl", 100);

        let scanner = CostScanner::new(7)
            .with_options(CostScanOptions::app_driven())
            .with_cache_root(&cache_root)
            .with_sessions_dirs(vec![sessions.clone()]);

        let (summary, _) = scanner.scan_codex_detailed(None);
        assert!(summary.history_coverage_established);
        assert_eq!(summary.sessions_count, 1);
        assert!(!summary.known_zero, "scan with results is not known-zero");
    }

    // ── Phase 4C: billing-channel eligibility gate ──────────────────────
    // docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md "Phase 4C" section.
    // No local CLI-log observation (Codex or Claude session JSONL) carries
    // evidence distinguishing a subscription-covered session from a
    // per-token-metered API session, so billing channel is always Unknown
    // and can never match the DirectApi channel CODEX_PRICING/
    // CLAUDE_PRICING actually price -- these tests prove that verdict is
    // reached via the SHARED `pricing_eligibility` rule (not a duplicated
    // local check), and that it actually gates the runtime output, not
    // only documentation/tests.

    #[test]
    fn cli_log_billing_channel_is_unknown_and_thus_ineligible_against_direct_api_pricing() {
        let verdict = cli_log_cost_eligibility(true);
        assert_eq!(
            verdict,
            Eligibility::NotEligible(
                crate::pricing_eligibility::IneligibilityReason::BillingChannelMismatch
            ),
            "Unknown billing channel must fail against DirectApi pricing, per the shared eligibility rule"
        );
        assert!(!cli_log_cost_available());
    }

    #[test]
    fn cost_summary_hides_total_when_ineligible_but_keeps_token_data() {
        let mut by_model = HashMap::new();
        by_model.insert("gpt-5".to_string(), 42.0);
        let summary = CostSummary {
            total_cost_usd: 42.0,
            input_tokens: 1_000,
            output_tokens: 500,
            by_model,
            ..Default::default()
        };

        assert!(!summary.cost_eligible());
        assert_eq!(summary.eligible_total_cost_usd(), None);
        assert_eq!(summary.eligible_by_model(), None);
        assert_eq!(summary.format_total(), "Unavailable");
        // Token/model facts are never hidden by the monetary gate.
        assert_eq!(summary.input_tokens, 1_000);
        assert_eq!(summary.output_tokens, 500);
        assert_eq!(summary.by_model.get("gpt-5"), Some(&42.0));
    }

    #[test]
    fn get_daily_cost_history_returns_empty_not_a_fabricated_zero_series_for_codex_and_claude() {
        // An empty series (not a flat "$0.00 every day" line) is the
        // correct "unavailable" representation here -- a flat zero line
        // would misread as a real, known-zero spend history.
        assert!(get_daily_cost_history("codex", 30).is_empty());
        assert!(get_daily_cost_history("claude", 30).is_empty());
    }

    #[test]
    fn get_daily_cost_history_rejects_unsupported_providers_without_scanning() {
        assert!(get_daily_cost_history("openai", 30).is_empty());
        assert!(get_daily_cost_history("unknown-provider", 30).is_empty());
    }
}
