//! One deterministic connection state model for provider onboarding.
//!
//! `ConnectionState` is what the UI shows; `ConnectionIssue` is why. Both are
//! derived only from typed evidence (`ProviderStateKind`, the fetch outcome,
//! CLI detection) -- never inferred from a config file, executable or cookie
//! row merely existing. A state/issue pair is produced by one function so
//! impossible combinations cannot be assembled by callers.

use crate::connection_capabilities::ConnectionMethod;
use crate::core::ProviderStateKind;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionState {
    Idle,
    Detecting,
    RequirementsMissing,
    ReadyToAuthenticate,
    Authenticating,
    Verifying,
    Connected,
    Refreshing,
    ActionRequired,
    RateLimited,
    Offline,
    TimedOut,
    Error,
    Disconnecting,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionIssue {
    CliMissing,
    CliTooOld,
    CliBroken,
    CliUnauthenticated,
    BrowserSessionMissing,
    SessionExpired,
    CredentialsRejected,
    PermissionDenied,
    RateLimited,
    Offline,
    TimedOut,
    SourceUnreadable,
    Unsupported,
    Error,
}

/// The exact fetch error string the refresh path stores for an elapsed timeout.
pub const TIMEOUT_ERROR: &str = "Timeout";

/// State and issue for the outcome of a read-only verification/refresh of a
/// provider connected through `method`.
pub fn classify_fetch_outcome(
    kind: ProviderStateKind,
    error: Option<&str>,
    method: Option<ConnectionMethod>,
) -> (ConnectionState, Option<ConnectionIssue>) {
    match kind {
        ProviderStateKind::Ready if error.is_none() => (ConnectionState::Connected, None),
        ProviderStateKind::Ready | ProviderStateKind::Unknown => {
            if error == Some(TIMEOUT_ERROR) {
                (ConnectionState::TimedOut, Some(ConnectionIssue::TimedOut))
            } else {
                (ConnectionState::Error, Some(ConnectionIssue::Error))
            }
        }
        ProviderStateKind::NeedsAuthentication => (
            ConnectionState::ActionRequired,
            Some(match method {
                Some(ConnectionMethod::CliSession) => ConnectionIssue::CliUnauthenticated,
                Some(ConnectionMethod::BrowserSession) => ConnectionIssue::BrowserSessionMissing,
                Some(ConnectionMethod::LocalScanner) => ConnectionIssue::SourceUnreadable,
                _ => ConnectionIssue::CredentialsRejected,
            }),
        ),
        ProviderStateKind::ExpiredSession => (
            ConnectionState::ActionRequired,
            Some(ConnectionIssue::SessionExpired),
        ),
        ProviderStateKind::LocalRuntimeOffline => {
            (ConnectionState::Offline, Some(ConnectionIssue::Offline))
        }
        ProviderStateKind::RateLimited => (
            ConnectionState::RateLimited,
            Some(ConnectionIssue::RateLimited),
        ),
        ProviderStateKind::PermissionDenied => (
            ConnectionState::ActionRequired,
            Some(ConnectionIssue::PermissionDenied),
        ),
    }
}

/// Whether an outcome is worth retrying automatically. Credential and
/// permission problems never are; rate limits wait for the provider.
pub fn is_transient(issue: Option<ConnectionIssue>) -> bool {
    matches!(
        issue,
        Some(ConnectionIssue::TimedOut | ConnectionIssue::Offline | ConnectionIssue::Error)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_kind_maps_to_one_state_and_the_method_names_the_fix() {
        use ConnectionMethod::*;
        assert_eq!(
            classify_fetch_outcome(ProviderStateKind::Ready, None, Some(ApiKey)),
            (ConnectionState::Connected, None)
        );
        assert_eq!(
            classify_fetch_outcome(
                ProviderStateKind::Unknown,
                Some(TIMEOUT_ERROR),
                Some(ApiKey)
            ),
            (ConnectionState::TimedOut, Some(ConnectionIssue::TimedOut))
        );
        assert_eq!(
            classify_fetch_outcome(ProviderStateKind::Unknown, Some("boom"), None).0,
            ConnectionState::Error
        );
        assert_eq!(
            classify_fetch_outcome(
                ProviderStateKind::NeedsAuthentication,
                Some("401"),
                Some(CliSession)
            )
            .1,
            Some(ConnectionIssue::CliUnauthenticated)
        );
        assert_eq!(
            classify_fetch_outcome(
                ProviderStateKind::NeedsAuthentication,
                None,
                Some(BrowserSession)
            )
            .1,
            Some(ConnectionIssue::BrowserSessionMissing)
        );
        assert_eq!(
            classify_fetch_outcome(ProviderStateKind::NeedsAuthentication, None, Some(ApiKey)).1,
            Some(ConnectionIssue::CredentialsRejected)
        );
        assert_eq!(
            classify_fetch_outcome(
                ProviderStateKind::ExpiredSession,
                None,
                Some(BrowserSession)
            ),
            (
                ConnectionState::ActionRequired,
                Some(ConnectionIssue::SessionExpired)
            )
        );
        assert_eq!(
            classify_fetch_outcome(ProviderStateKind::RateLimited, Some("429"), Some(ApiKey)),
            (
                ConnectionState::RateLimited,
                Some(ConnectionIssue::RateLimited)
            )
        );
        assert_eq!(
            classify_fetch_outcome(
                ProviderStateKind::PermissionDenied,
                Some("403"),
                Some(ApiKey)
            ),
            (
                ConnectionState::ActionRequired,
                Some(ConnectionIssue::PermissionDenied)
            )
        );
        assert_eq!(
            classify_fetch_outcome(
                ProviderStateKind::LocalRuntimeOffline,
                Some("x"),
                Some(LocalScanner)
            )
            .0,
            ConnectionState::Offline
        );
    }

    #[test]
    fn unknown_without_error_is_not_connected() {
        assert_eq!(
            classify_fetch_outcome(ProviderStateKind::Unknown, None, None).0,
            ConnectionState::Error
        );
    }

    #[test]
    fn only_transient_outcomes_are_retryable() {
        assert!(is_transient(Some(ConnectionIssue::TimedOut)));
        assert!(is_transient(Some(ConnectionIssue::Offline)));
        for fixed in [
            ConnectionIssue::CredentialsRejected,
            ConnectionIssue::PermissionDenied,
            ConnectionIssue::RateLimited,
            ConnectionIssue::Unsupported,
            ConnectionIssue::CliMissing,
        ] {
            assert!(!is_transient(Some(fixed)), "{fixed:?}");
        }
        assert!(!is_transient(None));
    }
}
