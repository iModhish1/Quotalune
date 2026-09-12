//! Analytics source registry -- the authoritative capability map the
//! Analytics UI must consult before showing a tab, filter, or metric.
//!
//! Quotalis has several real, independent analytics-relevant data
//! families (provider current-state/quota, Dashboard history,
//! provider-reported monetary observations, and the two local CLI-log
//! scanners for Codex and Claude). This module does not replace any of
//! their existing storage or parsers -- it describes, in one place, what
//! each one can actually prove, so the frontend never has to *infer*
//! capability from a provider id string (e.g. "this is Claude, so it
//! must have tokens like Codex does").
//!
//! See `docs/validation/AI_USAGE_RESEARCH_INTEGRATION.md` for the full
//! data-reality audit this registry's capability values are drawn from,
//! and `docs/validation/ANALYTICS_SUPERSTACK_VALIDATION.md` for how the
//! frontend is expected to consume it.

use crate::cost_scanner::CostScanner;
use serde::{Deserialize, Serialize};

/// A real, distinct source of analytics-relevant data.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AnalyticsSourceId {
    /// Live per-provider quota/plan/connection state (`ProviderUsageSnapshot`).
    ProviderCurrentState,
    /// Persisted quota/spend history (`dashboard_data.rs`, `usage_samples`).
    ProviderHistory,
    /// Provider-reported Spend/Balance/Credits observations, when a
    /// provider's cost contract is eligible (`CostOrigin::ProviderReported`).
    ProviderReportedMonetary,
    /// Codex's local JSONL session-log scanner (`cost_scanner.rs`,
    /// `codex_workspaces.rs`).
    CodexLocalActivity,
    /// Claude's local transcript scanner (`cost_scanner.rs`).
    ClaudeLocalActivity,
}

/// What real scope an observation from this source can honestly claim.
/// The UI must never let a `Device`-scoped source be presented as if it
/// were `Account`-scoped, or vice versa.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AnalyticsScope {
    /// Tied to one authenticated, resolved account
    /// (`QuotaAccountScope::Observed`).
    Account,
    /// Aggregated across a whole provider, not one account.
    Provider,
    /// Local-machine activity with no reliable account attribution --
    /// Codex/Claude local log scanning is scope `Device`, never
    /// `Account`, even when only one account is configured, because the
    /// log format itself carries no authenticated-account identity.
    Device,
}

/// What this source can actually prove today. Every field here must be
/// backed by a real, cited data path -- see
/// `docs/validation/AI_USAGE_RESEARCH_INTEGRATION.md` for the audit each
/// flag reflects. The UI must hide (not disable) a section whose
/// required capability is `false` here.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsCapabilities {
    /// Real quota/usage percentage + physical windows.
    pub quota: bool,
    /// Real reset timestamps for at least one physical window.
    pub resets: bool,
    /// Real Spend/Balance/Credits with a valid, non-fabricated cost contract.
    pub monetary: bool,
    /// Real token counts (input/output/cached) -- never dollar cost.
    pub tokens: bool,
    /// Real per-model identity attached to observations.
    pub models: bool,
    /// A real session/conversation count -- NOT a per-session record
    /// (Quotalis's local scanners only ever produce an aggregate count,
    /// never a drillable session list; see item 13 in
    /// AI_USAGE_RESEARCH_INTEGRATION.md).
    pub session_count: bool,
    /// A real per-day activity series suitable for a trend chart or
    /// calendar heatmap.
    pub daily_activity: bool,
}

/// How trustworthy/fresh a source's data is right now, without scanning
/// its full contents (cheap directory/config checks only).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AnalyticsAvailability {
    /// The source has real local data to report right now.
    Available,
    /// The source is a real Quotalis capability, but nothing has been
    /// observed yet on this machine (e.g. Claude Code has never been
    /// run here) -- distinct from `Unsupported`, which means the
    /// capability does not exist at all.
    NoDataYet,
    /// This source is not implemented for the current build/platform.
    Unsupported,
}

/// One atomic, real fact about what a source reads or does not read.
/// Backend-authoritative (owner Phase 3M: "do not duplicate backend
/// truth in frontend code") -- the frontend/locale layer only ever maps
/// one of these identifiers to a short localized phrase; it never
/// re-derives which facts apply to which source. Stable `as_str()` form
/// is the wire identifier the bridge/frontend switches on, independent
/// of Rust's own variant names.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AnalyticsSourceFact {
    /// "Each configured provider's live quota, plan, and connection status."
    ProviderLiveQuotaPlanStatus,
    /// "Persisted quota-percentage and reset-boundary samples over time,
    /// per resolved account."
    PersistedQuotaResetSamples,
    /// "Spend, Balance, or Credits figures the provider itself reports,
    /// only when the cost contract is eligible."
    ProviderReportedMonetaryFigures,
    /// A parsed event/message timestamp.
    Timestamps,
    /// Real token counters (input/output/cached) -- never a dollar amount.
    TokenCounts,
    /// A parsed model identifier string.
    ModelIdentifiers,
    /// Prompt or assistant response text -- never deserialized by any
    /// local scanner (see `docs/validation/LOCAL_ACTIVITY_PRIVACY.md`).
    PromptOrResponseContent,
    /// Codex's own CLI log directory contents beyond the bounded fields
    /// this registry's other facts already name.
    LocalCliLogs,
    /// A dollar figure Quotalis computed itself from local token counts
    /// -- the channel this registry's `ProviderReportedMonetary` source
    /// is permanently ineligible to show (see `CostOrigin`).
    LocallyEstimatedCost,
    /// A per-session/per-conversation drillable record -- only ever an
    /// aggregate count is available (Codex), or not even that (Claude).
    PerSessionRecord,
    /// A locally-computed dollar cost for local activity (distinct from
    /// `LocallyEstimatedCost`, which is specifically the Monetary
    /// source's ineligible channel) -- local scanners never surface one.
    DollarCost,
    /// Any per-conversation/session identity -- Claude's local scanner
    /// has no authenticated session concept at all.
    SessionIdentity,
}

/// One row in the analytics source registry -- the UI's authoritative
/// capability map (owner: "capability registry drives available
/// sections").
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsSourceDescriptor {
    pub id: AnalyticsSourceId,
    pub label: &'static str,
    pub scope: AnalyticsScope,
    pub capabilities: AnalyticsCapabilities,
    pub availability: AnalyticsAvailability,
    /// The real, atomic facts this source reads -- shown in Settings ->
    /// Analytics -> Data Sources (owner section 71: "Explain what each
    /// source reads... only claim that if implementation proves it").
    /// Structured, not prose: the frontend localizes each identifier,
    /// it does not receive (or need to translate) English sentences.
    pub reads: Vec<AnalyticsSourceFact>,
    /// What this source explicitly does NOT read, stated for the same
    /// reason and in the same structured form.
    pub does_not_read: Vec<AnalyticsSourceFact>,
}

/// Build the current, real analytics source registry. Availability
/// checks are cheap directory/config existence checks -- no file
/// contents are scanned, so this is safe to call from a settings page
/// on every render.
pub fn analytics_source_registry() -> Vec<AnalyticsSourceDescriptor> {
    let scanner = CostScanner::new(1);
    vec![
        AnalyticsSourceDescriptor {
            id: AnalyticsSourceId::ProviderCurrentState,
            label: "Provider current state",
            scope: AnalyticsScope::Account,
            capabilities: AnalyticsCapabilities {
                quota: true,
                resets: true,
                ..Default::default()
            },
            availability: AnalyticsAvailability::Available,
            reads: vec![AnalyticsSourceFact::ProviderLiveQuotaPlanStatus],
            does_not_read: vec![
                AnalyticsSourceFact::PromptOrResponseContent,
                AnalyticsSourceFact::TokenCounts,
                AnalyticsSourceFact::LocalCliLogs,
            ],
        },
        AnalyticsSourceDescriptor {
            id: AnalyticsSourceId::ProviderHistory,
            label: "Provider quota history",
            scope: AnalyticsScope::Account,
            capabilities: AnalyticsCapabilities {
                quota: true,
                resets: true,
                daily_activity: true,
                ..Default::default()
            },
            availability: AnalyticsAvailability::Available,
            reads: vec![AnalyticsSourceFact::PersistedQuotaResetSamples],
            does_not_read: vec![
                AnalyticsSourceFact::PromptOrResponseContent,
                AnalyticsSourceFact::TokenCounts,
            ],
        },
        AnalyticsSourceDescriptor {
            id: AnalyticsSourceId::ProviderReportedMonetary,
            label: "Provider-reported monetary data",
            scope: AnalyticsScope::Account,
            capabilities: AnalyticsCapabilities {
                monetary: true,
                ..Default::default()
            },
            availability: AnalyticsAvailability::Available,
            reads: vec![AnalyticsSourceFact::ProviderReportedMonetaryFigures],
            does_not_read: vec![AnalyticsSourceFact::LocallyEstimatedCost],
        },
        AnalyticsSourceDescriptor {
            id: AnalyticsSourceId::CodexLocalActivity,
            label: "Codex local activity",
            scope: AnalyticsScope::Device,
            capabilities: AnalyticsCapabilities {
                tokens: true,
                models: true,
                session_count: true,
                daily_activity: true,
                ..Default::default()
            },
            availability: if scanner.codex_local_activity_available() {
                AnalyticsAvailability::Available
            } else {
                AnalyticsAvailability::NoDataYet
            },
            reads: vec![
                AnalyticsSourceFact::Timestamps,
                AnalyticsSourceFact::TokenCounts,
                AnalyticsSourceFact::ModelIdentifiers,
            ],
            does_not_read: vec![
                AnalyticsSourceFact::PromptOrResponseContent,
                AnalyticsSourceFact::PerSessionRecord,
                AnalyticsSourceFact::DollarCost,
            ],
        },
        AnalyticsSourceDescriptor {
            id: AnalyticsSourceId::ClaudeLocalActivity,
            label: "Claude local activity",
            scope: AnalyticsScope::Device,
            capabilities: AnalyticsCapabilities {
                tokens: true,
                models: true,
                daily_activity: true,
                // Deliberately false: Claude's local scanner has no
                // per-conversation count exposed today (only a per-day
                // token series) -- see AI_USAGE_RESEARCH_INTEGRATION.md
                // and the Codex-vs-Claude field audit. Do not flip this
                // true without adding the real field first.
                session_count: false,
                ..Default::default()
            },
            availability: if scanner.claude_local_activity_available() {
                AnalyticsAvailability::Available
            } else {
                AnalyticsAvailability::NoDataYet
            },
            reads: vec![
                AnalyticsSourceFact::Timestamps,
                AnalyticsSourceFact::TokenCounts,
                AnalyticsSourceFact::ModelIdentifiers,
            ],
            does_not_read: vec![
                AnalyticsSourceFact::PromptOrResponseContent,
                AnalyticsSourceFact::SessionIdentity,
                AnalyticsSourceFact::DollarCost,
            ],
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_has_one_row_per_real_source_and_no_duplicates() {
        let registry = analytics_source_registry();
        assert_eq!(registry.len(), 5);
        let mut ids: Vec<AnalyticsSourceId> = registry.iter().map(|d| d.id).collect();
        let before = ids.len();
        ids.sort_by_key(|id| format!("{id:?}"));
        ids.dedup();
        assert_eq!(ids.len(), before, "duplicate source id in registry");
    }

    #[test]
    fn local_activity_sources_are_device_scoped_never_account_scoped() {
        // Hard invariant: local CLI-log scanning can never honestly claim
        // per-account attribution -- the log format carries no
        // authenticated-account identity.
        for descriptor in analytics_source_registry() {
            if matches!(
                descriptor.id,
                AnalyticsSourceId::CodexLocalActivity | AnalyticsSourceId::ClaudeLocalActivity
            ) {
                assert_eq!(descriptor.scope, AnalyticsScope::Device);
            }
        }
    }

    #[test]
    fn claude_source_never_claims_a_session_count_it_cannot_prove() {
        let registry = analytics_source_registry();
        let claude = registry
            .iter()
            .find(|d| d.id == AnalyticsSourceId::ClaudeLocalActivity)
            .unwrap();
        assert!(
            !claude.capabilities.session_count,
            "Claude's local scanner has no per-conversation count -- flipping this true \
             without adding the real field would fabricate a capability"
        );
    }

    #[test]
    fn monetary_source_never_advertises_tokens_or_local_estimation() {
        let registry = analytics_source_registry();
        let monetary = registry
            .iter()
            .find(|d| d.id == AnalyticsSourceId::ProviderReportedMonetary)
            .unwrap();
        assert!(!monetary.capabilities.tokens);
        assert!(
            monetary
                .does_not_read
                .contains(&AnalyticsSourceFact::LocallyEstimatedCost)
        );
    }

    #[test]
    fn availability_reflects_a_real_directory_check_not_a_hardcoded_value() {
        // Both branches are reachable at compile time (Available vs
        // NoDataYet) -- this test doesn't assert a specific value since
        // that depends on the machine running it, only that the
        // registry actually calls through to the real scanner methods
        // rather than hardcoding `Available`.
        let registry = analytics_source_registry();
        let codex = registry
            .iter()
            .find(|d| d.id == AnalyticsSourceId::CodexLocalActivity)
            .unwrap();
        let scanner = CostScanner::new(1);
        let expected = if scanner.codex_local_activity_available() {
            AnalyticsAvailability::Available
        } else {
            AnalyticsAvailability::NoDataYet
        };
        assert_eq!(codex.availability, expected);
    }
}
