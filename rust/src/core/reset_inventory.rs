//! Typed reset inventory and reset-event evidence.
//!
//! Reset facts deliberately distinguish confirmed values from missing evidence
//! and unsupported capabilities. Consumers must not turn either latter state
//! into a confirmed zero.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A provider datum with explicit evidence availability.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum ResetDatum<T> {
    Known { value: T },
    Unavailable { reason: ResetUnavailableReason },
    Unsupported,
}

impl<T> ResetDatum<T> {
    pub fn known(value: T) -> Self {
        Self::Known { value }
    }

    pub fn unavailable(reason: ResetUnavailableReason) -> Self {
        Self::Unavailable { reason }
    }
}

/// Why a reset datum could not be established.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ResetUnavailableReason {
    NotReported,
    FetchFailed,
    Malformed,
    NotObserved,
    AmbiguousAccount,
    ConflictingEvidence,
}

/// Reset facts for one provider/account observation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderResetFacts {
    pub observed_at: DateTime<Utc>,
    pub provider_issued_resets: ResetDatum<u32>,
    pub last_actual_reset: ResetDatum<ActualResetEvent>,
    pub next_weekly_reset: ResetDatum<ScheduledReset>,
    pub banked_reset_cards: ResetDatum<BankedResetInventory>,
}

/// A provider-scheduled quota reset backed by an identified weekly window.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledReset {
    pub window_key: String,
    pub resets_at: DateTime<Utc>,
}

/// A reset event backed by provider or boundary-transition evidence.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActualResetEvent {
    pub window_key: String,
    pub observed_at: DateTime<Utc>,
    pub classification: ActualResetClassification,
    pub evidence: ActualResetEvidence,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ActualResetClassification {
    Scheduled,
    Unexpected,
}

/// Evidence accepted for an actual reset event.
///
/// A local usage-percentage drop is intentionally absent: it cannot establish
/// a provider-issued or company-wide reset cause.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ActualResetEvidence {
    ProviderReported,
    BoundaryAdvanced,
}

/// The reset cards reported for one account.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BankedResetInventory {
    pub reported_available_count: u32,
    pub cards: Vec<BankedResetCard>,
    /// False when the aggregate count and card details disagree or a card has
    /// an unknown status/expiry.
    pub details_complete: bool,
}

impl BankedResetInventory {
    pub fn from_reported(reported_available_count: u32, cards: Vec<BankedResetCard>) -> Self {
        let known_available_count = cards
            .iter()
            .filter(|card| card.status == ResetCardStatus::Available)
            .count();
        let card_details_known = cards.iter().all(|card| {
            card.status != ResetCardStatus::Unknown
                && matches!(card.expires_at, ResetDatum::Known { .. })
        });
        let count_matches = usize::try_from(reported_available_count)
            .is_ok_and(|count| count == known_available_count);

        Self {
            reported_available_count,
            cards,
            details_complete: count_matches && card_details_known,
        }
    }
}

/// One banked reset card. Expiry availability is tracked per card.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BankedResetCard {
    pub opaque_id: Option<String>,
    pub status: ResetCardStatus,
    pub expires_at: ResetDatum<DateTime<Utc>>,
}

impl BankedResetCard {
    pub fn from_reported(
        opaque_id: Option<String>,
        status: Option<&str>,
        expires_at: Option<&str>,
    ) -> Self {
        let opaque_id = opaque_id.and_then(|value| {
            let trimmed = value.trim();
            (!trimmed.is_empty()).then(|| trimmed.to_string())
        });
        let status = ResetCardStatus::from_reported(status);
        let expires_at = match expires_at.map(str::trim) {
            None | Some("") => ResetDatum::unavailable(ResetUnavailableReason::NotReported),
            Some(raw) => match DateTime::parse_from_rfc3339(raw) {
                Ok(value) => ResetDatum::known(value.with_timezone(&Utc)),
                Err(_) => ResetDatum::unavailable(ResetUnavailableReason::Malformed),
            },
        };

        Self {
            opaque_id,
            status,
            expires_at,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ResetCardStatus {
    Available,
    Used,
    Expired,
    Unknown,
}

impl ResetCardStatus {
    pub fn from_reported(status: Option<&str>) -> Self {
        match status.map(str::trim).filter(|value| !value.is_empty()) {
            Some(value) if value.eq_ignore_ascii_case("available") => Self::Available,
            Some(value) if value.eq_ignore_ascii_case("used") => Self::Used,
            Some(value) if value.eq_ignore_ascii_case("expired") => Self::Expired,
            _ => Self::Unknown,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reset_contract_serializes_as_camel_case_tagged_data() {
        let facts = ProviderResetFacts {
            observed_at: DateTime::parse_from_rfc3339("2026-09-13T10:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            provider_issued_resets: ResetDatum::unavailable(ResetUnavailableReason::NotReported),
            last_actual_reset: ResetDatum::unavailable(ResetUnavailableReason::NotObserved),
            next_weekly_reset: ResetDatum::Unsupported,
            banked_reset_cards: ResetDatum::known(BankedResetInventory::from_reported(0, vec![])),
        };

        let value = serde_json::to_value(facts).unwrap();
        assert_eq!(value["providerIssuedResets"]["state"], "unavailable");
        assert_eq!(value["providerIssuedResets"]["reason"], "notReported");
        assert_eq!(value["lastActualReset"]["reason"], "notObserved");
        assert_eq!(value["nextWeeklyReset"], json!({ "state": "unsupported" }));
        assert_eq!(
            value["bankedResetCards"]["value"]["reportedAvailableCount"],
            0
        );
        assert_eq!(value["bankedResetCards"]["value"]["detailsComplete"], true);
    }

    #[test]
    fn reported_card_preserves_known_and_malformed_expiries() {
        let known = BankedResetCard::from_reported(
            Some(" card-a ".into()),
            Some("AVAILABLE"),
            Some("2026-10-01T12:30:00+03:00"),
        );
        let malformed =
            BankedResetCard::from_reported(None, Some("mystery"), Some("next Thursday"));

        assert_eq!(known.opaque_id.as_deref(), Some("card-a"));
        assert_eq!(known.status, ResetCardStatus::Available);
        assert!(matches!(known.expires_at, ResetDatum::Known { .. }));
        assert_eq!(malformed.status, ResetCardStatus::Unknown);
        assert_eq!(
            malformed.expires_at,
            ResetDatum::unavailable(ResetUnavailableReason::Malformed)
        );
    }

    #[test]
    fn inventory_marks_count_or_card_detail_mismatch_incomplete() {
        let card = BankedResetCard::from_reported(
            Some("card-a".into()),
            Some("available"),
            Some("2026-10-01T00:00:00Z"),
        );
        assert!(BankedResetInventory::from_reported(1, vec![card.clone()]).details_complete);
        assert!(!BankedResetInventory::from_reported(2, vec![card]).details_complete);
    }
}
