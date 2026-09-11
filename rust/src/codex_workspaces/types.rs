//! Snapshot DTOs for Codex local Workspaces indexing.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Progress phases emitted while building a workspaces snapshot.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProgressPhase {
    ScanningLogs,
    IndexingProjects,
    Saving,
}

/// Progress callback payload.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub phase: ProgressPhase,
    pub processed_file_count: Option<u32>,
    pub total_file_count: Option<u32>,
    pub indexed_file_count: u32,
    pub skipped_file_count: u32,
}

impl Progress {
    pub fn phase(phase: ProgressPhase) -> Self {
        Self {
            phase,
            processed_file_count: None,
            total_file_count: None,
            indexed_file_count: 0,
            skipped_file_count: 0,
        }
    }
}

/// Completeness of the read-only Codex thread catalog (`state_5.sqlite`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceStatus {
    Complete,
    CatalogMissing,
    CatalogLocked,
    CatalogCorrupt,
    CatalogIncompatible,
}

impl SourceStatus {
    pub fn is_partial(self) -> bool {
        self != Self::Complete
    }
}

/// Known vs unknown cost split. Unknown pricing never becomes a synthetic zero.
///
/// Phase 4C: `known_usd` is computed from local Codex JSONL session logs,
/// which carry no evidence distinguishing a subscription-covered session
/// from a per-token-metered API session (see `cost_scanner.rs`'s module
/// doc comment) -- `eligible` reports whether `known_usd` may be shown to
/// a user as a trustworthy dollar figure. Always `false` today. Callers
/// MUST check `eligible` before displaying `known_usd`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CostEstimate {
    pub known_usd: f64,
    pub unknown_tokens: u64,
    pub eligible: bool,
}

impl Default for CostEstimate {
    fn default() -> Self {
        Self {
            known_usd: 0.0,
            unknown_tokens: 0,
            eligible: crate::cost_scanner::cli_log_cost_available(),
        }
    }
}

impl CostEstimate {
    pub fn add_assign(&mut self, other: &Self) {
        self.known_usd += other.known_usd;
        self.unknown_tokens = self.unknown_tokens.saturating_add(other.unknown_tokens);
        self.eligible = self.eligible && other.eligible;
    }

    /// The trustworthy total, or `None` when billing-channel eligibility
    /// could not be established (owner Phase 4C section 8: unavailable,
    /// never a fabricated `$0`).
    pub fn eligible_known_usd(&self) -> Option<f64> {
        self.eligible.then_some(self.known_usd)
    }
}

/// Aggregated token totals.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UsageTotals {
    pub input_tokens: u64,
    pub cached_input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
}

impl UsageTotals {
    pub fn add_assign(&mut self, other: &Self) {
        self.input_tokens = self.input_tokens.saturating_add(other.input_tokens);
        self.cached_input_tokens = self
            .cached_input_tokens
            .saturating_add(other.cached_input_tokens);
        self.output_tokens = self.output_tokens.saturating_add(other.output_tokens);
        self.total_tokens = self.total_tokens.saturating_add(other.total_tokens);
    }

    pub fn from_parts(input: u64, cached: u64, output: u64) -> Self {
        let cached = cached.min(input);
        Self {
            input_tokens: input,
            cached_input_tokens: cached,
            output_tokens: output,
            total_tokens: input.saturating_add(output),
        }
    }
}

/// One calendar-day aggregate point.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyPoint {
    pub day: String,
    pub total_tokens: u64,
    pub cached_input_tokens: u64,
    pub estimated_cost_usd: Option<f64>,
}

/// Per-session usage row (top sessions only on projects).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionUsage {
    pub id: String,
    pub project_id: String,
    pub display_title: String,
    pub cwd: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub latest_activity: Option<DateTime<Utc>>,
    pub totals: UsageTotals,
    pub cost_estimate: CostEstimate,
    pub top_model: Option<String>,
}

/// Global per-model token aggregate across every indexed session in the
/// history window (owner: Model Analytics must show a real ranked
/// breakdown, not just each session's single `top_model`). `total_tokens`
/// sums `SessionBucket::model_tokens` across all sessions that used this
/// model; `last_observed` is the latest `latest_activity` among those
/// sessions. Codex-only -- Claude's local scanner has no per-message model
/// attribution beyond a single `topModel` guess (see
/// docs/validation/LOCAL_ACTIVITY_FIELD_MATRIX.md), so it cannot populate
/// an equivalent list.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsage {
    pub model: String,
    pub total_tokens: u64,
    pub last_observed: Option<DateTime<Utc>>,
}

/// Per-project usage aggregate.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectUsage {
    pub id: String,
    pub display_name: String,
    pub path: Option<String>,
    pub totals: UsageTotals,
    pub cost_estimate: CostEstimate,
    pub session_count: u32,
    pub latest_activity: Option<DateTime<Utc>>,
    pub top_model: Option<String>,
    pub top_sessions: Vec<SessionUsage>,
}

/// Complete workspaces snapshot published to the sidecar and presentation layer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexLocalProjectUsageSnapshot {
    pub updated_at: DateTime<Utc>,
    pub history_days: u32,
    pub scope_signature: String,
    pub indexed_file_count: u32,
    pub skipped_file_count: u32,
    pub total: UsageTotals,
    /// All indexed conversations in the selected history window.
    #[serde(default)]
    pub sessions: Vec<SessionUsage>,
    pub projects: Vec<ProjectUsage>,
    pub daily: Vec<DailyPoint>,
    pub source_status: SourceStatus,
    /// Ranked (descending `total_tokens`) global model breakdown. Empty on
    /// snapshots cached before this field existed -- `#[serde(default)]`
    /// keeps old sidecar files loadable.
    #[serde(default)]
    pub model_totals: Vec<ModelUsage>,
}

impl CodexLocalProjectUsageSnapshot {
    /// Strip paths/titles for presentation when hide-personal-info is on.
    /// Does not rewrite the sidecar.
    pub fn redact_for_privacy(&mut self) {
        for session in &mut self.sessions {
            session.display_title = "Local Codex chat".to_string();
            session.cwd = None;
        }
        for project in &mut self.projects {
            if project.id == crate::codex_workspaces::CHATS_PROJECT_ID {
                project.display_name = crate::codex_workspaces::CHATS_DISPLAY_NAME.to_string();
            } else {
                project.display_name = "Workspace".to_string();
            }
            project.path = None;
            for session in &mut project.top_sessions {
                session.display_title = "Local Codex chat".to_string();
                session.cwd = None;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Phase 4C: billing-channel eligibility gate on CostEstimate --
    // docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md "Phase 4C" section.

    #[test]
    fn default_cost_estimate_is_ineligible_today() {
        let estimate = CostEstimate::default();
        assert!(
            !estimate.eligible,
            "no local CLI-log observation has an established billing channel today"
        );
    }

    #[test]
    fn eligible_known_usd_hides_the_figure_when_ineligible() {
        let estimate = CostEstimate {
            known_usd: 12.34,
            unknown_tokens: 0,
            eligible: false,
        };
        assert_eq!(
            estimate.eligible_known_usd(),
            None,
            "a real computed total must not be shown when billing channel is unknown"
        );
        // The raw field is still readable internally (diagnostics/tests
        // proving the pricing math itself is correct) -- only the
        // accessor gates display-worthiness.
        assert_eq!(estimate.known_usd, 12.34);
    }

    #[test]
    fn eligible_known_usd_shows_the_figure_when_eligible() {
        let estimate = CostEstimate {
            known_usd: 5.0,
            unknown_tokens: 0,
            eligible: true,
        };
        assert_eq!(estimate.eligible_known_usd(), Some(5.0));
    }

    #[test]
    fn add_assign_stays_ineligible_if_either_side_is_ineligible() {
        let mut a = CostEstimate {
            known_usd: 1.0,
            unknown_tokens: 0,
            eligible: true,
        };
        let b = CostEstimate {
            known_usd: 2.0,
            unknown_tokens: 0,
            eligible: false,
        };
        a.add_assign(&b);
        assert_eq!(a.known_usd, 3.0);
        assert!(
            !a.eligible,
            "combining an eligible and an ineligible estimate must not silently become eligible"
        );
    }
}
