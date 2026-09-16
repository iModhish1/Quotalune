//! Which local token periods Quotalis can state, and how exact each one is.
//!
//! Sources (the only local token sources in the product):
//! - Codex: input + output tokens from `~/.codex` session logs, scanned into
//!   the Codex cost-usage cache (`CostScanner::scan_codex_detailed`). A scan
//!   reports `history_coverage_established` only when every session file in
//!   the window was read and the cache was not trimmed for budget.
//! - Claude: a single total (no input/cached/output split is surfaced) from
//!   `~/.claude/projects` transcripts via `get_claude_local_activity`. Claude
//!   transcripts can be pruned by Claude Code, and the walk reports no
//!   coverage proof, so every Claude period is a lower bound.
//!
//! Local logs never prove activity from before they begin, so a period whose
//! start precedes the earliest observed local activity is a lower bound, and
//! Lifetime is always a lower bound.

use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TokenPeriod {
    Today,
    Week,
    Month,
    Year,
    Lifetime,
}

impl TokenPeriod {
    pub const ALL: [TokenPeriod; 5] = [
        TokenPeriod::Today,
        TokenPeriod::Week,
        TokenPeriod::Month,
        TokenPeriod::Year,
        TokenPeriod::Lifetime,
    ];

    /// Settings value used by `ProviderTrayConfig::token_range`.
    pub const fn key(self) -> &'static str {
        match self {
            TokenPeriod::Today => "today",
            TokenPeriod::Week => "week",
            TokenPeriod::Month => "month",
            TokenPeriod::Year => "year",
            TokenPeriod::Lifetime => "lifetime",
        }
    }

    pub fn from_key(key: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|period| period.key() == key)
    }

    /// First calendar day of the period (Monday-based week, local calendar).
    pub fn start(self, today: NaiveDate) -> NaiveDate {
        match self {
            TokenPeriod::Today => today,
            TokenPeriod::Week => {
                today - chrono::Duration::days(i64::from(today.weekday().num_days_from_monday()))
            }
            TokenPeriod::Month => today.with_day(1).unwrap_or(today),
            TokenPeriod::Year => today.with_ordinal(1).unwrap_or(today),
            TokenPeriod::Lifetime => NaiveDate::from_ymd_opt(1970, 1, 1).unwrap_or(today),
        }
    }

    /// Calendar days from the period start through today, inclusive.
    pub fn days(self, today: NaiveDate) -> u32 {
        u32::try_from((today - self.start(today)).num_days() + 1).unwrap_or(1)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TokenBound {
    Exact,
    LowerBound,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TokenSource {
    CodexLocalSessions,
    ClaudeLocalTranscripts,
}

/// Static capability of one provider/period pair. `best_bound` is the most
/// exact a reading can be; a runtime reading may still degrade to a lower
/// bound when coverage is not proven.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenPeriodCapability {
    pub period: TokenPeriod,
    pub source: TokenSource,
    pub best_bound: TokenBound,
}

pub fn token_source(provider: &str) -> Option<TokenSource> {
    match provider {
        "codex" => Some(TokenSource::CodexLocalSessions),
        "claude" => Some(TokenSource::ClaudeLocalTranscripts),
        _ => None,
    }
}

pub fn token_period_capability(
    provider: &str,
    period: TokenPeriod,
) -> Option<TokenPeriodCapability> {
    let source = token_source(provider)?;
    let best_bound = match (source, period) {
        (TokenSource::CodexLocalSessions, TokenPeriod::Lifetime) => TokenBound::LowerBound,
        (TokenSource::CodexLocalSessions, _) => TokenBound::Exact,
        (TokenSource::ClaudeLocalTranscripts, _) => TokenBound::LowerBound,
    };
    Some(TokenPeriodCapability {
        period,
        source,
        best_bound,
    })
}

/// Every period this provider can state, in presentation order.
pub fn token_period_capabilities(provider: &str) -> Vec<TokenPeriodCapability> {
    TokenPeriod::ALL
        .into_iter()
        .filter_map(|period| token_period_capability(provider, period))
        .collect()
}

/// Evidence gathered by one local scan for a period.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TokenPeriodObservation {
    pub total: u64,
    /// The scanner proved it read the whole window (Codex only).
    pub coverage_established: bool,
    /// Earliest day in the window with observed local token activity.
    pub earliest_activity: Option<NaiveDate>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenPeriodReading {
    pub total: u64,
    pub bound: TokenBound,
}

/// Turns a scan into a statement the tooltip may show, or `None` when nothing
/// truthful can be said (an unproven zero is unknown, not zero).
pub fn resolve_token_reading(
    provider: &str,
    period: TokenPeriod,
    observation: TokenPeriodObservation,
    today: NaiveDate,
) -> Option<TokenPeriodReading> {
    let capability = token_period_capability(provider, period)?;
    let exact = capability.best_bound == TokenBound::Exact
        && observation.coverage_established
        && match period {
            // A year total is exact only when local history demonstrably
            // reaches the first day of the year.
            TokenPeriod::Year => observation
                .earliest_activity
                .is_some_and(|day| day <= period.start(today)),
            _ => true,
        };
    if observation.total == 0 && !exact {
        return None;
    }
    Some(TokenPeriodReading {
        total: observation.total,
        bound: if exact {
            TokenBound::Exact
        } else {
            TokenBound::LowerBound
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    fn observed(total: u64, coverage: bool, earliest: Option<NaiveDate>) -> TokenPeriodObservation {
        TokenPeriodObservation {
            total,
            coverage_established: coverage,
            earliest_activity: earliest,
        }
    }

    #[test]
    fn period_starts_and_lengths_follow_the_local_calendar() {
        let today = day(2026, 9, 16); // Wednesday
        assert_eq!(TokenPeriod::Today.start(today), today);
        assert_eq!(TokenPeriod::Week.start(today), day(2026, 9, 14));
        assert_eq!(TokenPeriod::Month.start(today), day(2026, 9, 1));
        assert_eq!(TokenPeriod::Year.start(today), day(2026, 1, 1));
        assert_eq!(TokenPeriod::Today.days(today), 1);
        assert_eq!(TokenPeriod::Week.days(today), 3);
        assert_eq!(TokenPeriod::Month.days(today), 16);
        assert_eq!(TokenPeriod::Year.days(today), 259);
        for period in TokenPeriod::ALL {
            assert_eq!(TokenPeriod::from_key(period.key()), Some(period));
        }
        assert_eq!(TokenPeriod::from_key("none"), None);
    }

    #[test]
    fn capability_matrix_is_explicit_per_source() {
        let codex: Vec<_> = token_period_capabilities("codex")
            .into_iter()
            .map(|c| (c.period, c.best_bound))
            .collect();
        assert_eq!(
            codex,
            vec![
                (TokenPeriod::Today, TokenBound::Exact),
                (TokenPeriod::Week, TokenBound::Exact),
                (TokenPeriod::Month, TokenBound::Exact),
                (TokenPeriod::Year, TokenBound::Exact),
                (TokenPeriod::Lifetime, TokenBound::LowerBound),
            ]
        );
        assert!(
            token_period_capabilities("claude")
                .iter()
                .all(|c| c.best_bound == TokenBound::LowerBound
                    && c.source == TokenSource::ClaudeLocalTranscripts)
        );
        assert_eq!(token_period_capabilities("claude").len(), 5);
        for provider in ["gemini", "copilot", "openrouter", "invented"] {
            assert!(token_period_capabilities(provider).is_empty(), "{provider}");
        }
    }

    #[test]
    fn codex_is_exact_only_with_proven_coverage() {
        let today = day(2026, 9, 16);
        let exact = resolve_token_reading(
            "codex",
            TokenPeriod::Week,
            observed(900, true, Some(day(2026, 9, 15))),
            today,
        );
        assert_eq!(
            exact,
            Some(TokenPeriodReading {
                total: 900,
                bound: TokenBound::Exact
            })
        );
        let partial = resolve_token_reading(
            "codex",
            TokenPeriod::Week,
            observed(900, false, Some(day(2026, 9, 15))),
            today,
        );
        assert_eq!(partial.unwrap().bound, TokenBound::LowerBound);
        // Proven coverage with no activity is a known zero; unproven zero is unknown.
        assert_eq!(
            resolve_token_reading("codex", TokenPeriod::Today, observed(0, true, None), today),
            Some(TokenPeriodReading {
                total: 0,
                bound: TokenBound::Exact
            })
        );
        assert_eq!(
            resolve_token_reading("codex", TokenPeriod::Today, observed(0, false, None), today),
            None
        );
    }

    #[test]
    fn a_year_with_ten_days_of_local_history_is_never_a_year_total() {
        let today = day(2026, 9, 16);
        let reading = resolve_token_reading(
            "codex",
            TokenPeriod::Year,
            observed(5_000, true, Some(day(2026, 9, 6))),
            today,
        );
        assert_eq!(
            reading,
            Some(TokenPeriodReading {
                total: 5_000,
                bound: TokenBound::LowerBound
            })
        );
        let full = resolve_token_reading(
            "codex",
            TokenPeriod::Year,
            observed(5_000, true, Some(day(2026, 1, 1))),
            today,
        );
        assert_eq!(full.unwrap().bound, TokenBound::Exact);
        let lifetime = resolve_token_reading(
            "codex",
            TokenPeriod::Lifetime,
            observed(5_000, true, Some(day(2023, 1, 1))),
            today,
        );
        assert_eq!(lifetime.unwrap().bound, TokenBound::LowerBound);
    }

    #[test]
    fn claude_periods_are_always_lower_bounds_and_zero_is_unknown() {
        let today = day(2026, 9, 16);
        for period in TokenPeriod::ALL {
            let reading = resolve_token_reading(
                "claude",
                period,
                observed(42, true, Some(day(2020, 1, 1))),
                today,
            );
            assert_eq!(
                reading,
                Some(TokenPeriodReading {
                    total: 42,
                    bound: TokenBound::LowerBound
                }),
                "{period:?}"
            );
            assert_eq!(
                resolve_token_reading("claude", period, observed(0, true, None), today),
                None
            );
        }
        assert_eq!(
            resolve_token_reading(
                "gemini",
                TokenPeriod::Today,
                observed(42, true, None),
                today
            ),
            None
        );
    }
}
