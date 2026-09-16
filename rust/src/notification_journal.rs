//! Durable, typed notification history.
//!
//! Two kinds of rows: reset/quota-change observations (recorded whenever the
//! evidence is observed, regardless of delivery preferences) and a record of
//! every notification Quotalis issues, written at the same dedupe decision that
//! allows the toast, so one logical event is one row. No free-form provider
//! messages or credentials are accepted: values are bounded numbers and
//! `detail` is a closed code per kind.

use crate::core::ProviderId;
use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{path::PathBuf, sync::Mutex, time::Duration};

const SCHEMA_VERSION: i64 = 2;
const MAX_EVENTS: i64 = 5_000;
const MAX_BASELINES: i64 = 4_096;
const RETENTION_SECONDS: i64 = 90 * 86_400;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JournalEventKind {
    ScheduledResetObserved,
    UnexpectedQuotaChange,
    BankedResetsIncreased,
    BankedResetsDecreased,
    /// Usage first reached the configured high alert level in this window.
    UsageHighReached,
    /// Usage first reached the configured critical alert level in this window.
    UsageCriticalReached,
    /// The window was observed fully used.
    UsageExhausted,
    /// Usage crossed a user-selected percentage milestone.
    UsageMilestoneReached,
    /// The session quota was observed fully used.
    SessionDepleted,
    /// The session quota came back after a depleted notification.
    SessionRestored,
    /// Pace projects the window running out before it resets.
    PaceWarning,
    /// A provider kept failing to refresh (detail: provider state code).
    ProviderStatusIssue,
    /// DeepSeek pricing moved to another period (detail: period code).
    PricingPeriodChanged,
}

/// Semantic weight of a notification. Derived from what was observed, never
/// from provider accent or presentation choices.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NotificationSeverity {
    Info,
    Warning,
    Critical,
}

impl JournalEventKind {
    pub const fn severity(self) -> NotificationSeverity {
        match self {
            Self::ScheduledResetObserved
            | Self::BankedResetsIncreased
            | Self::BankedResetsDecreased
            | Self::UsageMilestoneReached
            | Self::SessionRestored
            | Self::PricingPeriodChanged => NotificationSeverity::Info,
            Self::UnexpectedQuotaChange
            | Self::UsageHighReached
            | Self::PaceWarning
            | Self::ProviderStatusIssue => NotificationSeverity::Warning,
            Self::UsageCriticalReached | Self::UsageExhausted | Self::SessionDepleted => {
                NotificationSeverity::Critical
            }
        }
    }

    /// Observation kinds are produced only by [`NotificationJournal::observe`].
    const fn is_observation(self) -> bool {
        matches!(
            self,
            Self::ScheduledResetObserved
                | Self::UnexpectedQuotaChange
                | Self::BankedResetsIncreased
                | Self::BankedResetsDecreased
        )
    }

    /// The only detail codes a kind may store.
    fn allowed_details(self) -> &'static [&'static str] {
        match self {
            Self::ProviderStatusIssue => &[
                "needsAuthentication",
                "expiredSession",
                "localRuntimeOffline",
                "unknown",
            ],
            Self::PricingPeriodChanged => &["peak", "offPeak", "standard"],
            Self::PaceWarning => &["session", "weekly"],
            _ => &[],
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationEvent {
    pub id: i64,
    pub provider_id: String,
    /// Opaque reference only. An unresolved account is never reassigned later.
    pub account_ref: Option<String>,
    pub window_key: String,
    pub kind: JournalEventKind,
    /// Observation comparisons cannot prove an exact occurrence timestamp.
    pub occurred_at: Option<i64>,
    pub detected_at: i64,
    pub received_at: i64,
    pub observed_from: i64,
    pub observed_to: i64,
    /// Earlier value (observations) or configured level (alerts); absent when
    /// the notification has no numeric evidence.
    pub previous_value: Option<f64>,
    pub current_value: Option<f64>,
    /// Closed per-kind code (see `JournalEventKind::allowed_details`).
    pub detail: Option<String>,
    pub is_read: bool,
    pub severity: NotificationSeverity,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct NotificationQuery {
    pub before_id: Option<i64>,
    pub limit: Option<u32>,
    pub provider_id: Option<String>,
    pub unread_only: bool,
    pub search: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationPage {
    pub items: Vec<NotificationEvent>,
    pub unread_count: i64,
    /// Capture this boundary when offering mark-all; newer arrivals stay unread.
    pub through_id: i64,
    pub has_more: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ResetObservation {
    Quota {
        used_percent: f64,
        resets_at: Option<i64>,
        observed_at: i64,
    },
    Banked {
        available: u32,
        observed_at: i64,
    },
}

impl ResetObservation {
    fn observed_at(self) -> i64 {
        match self {
            Self::Quota { observed_at, .. } | Self::Banked { observed_at, .. } => observed_at,
        }
    }

    fn value(self) -> f64 {
        match self {
            Self::Quota { used_percent, .. } => used_percent,
            Self::Banked { available, .. } => f64::from(available),
        }
    }

    fn lane_kind(self) -> &'static str {
        match self {
            Self::Quota { .. } => "quota",
            Self::Banked { .. } => "banked",
        }
    }
}

/// Evidence classification shared by live and restored observations. A drop
/// is explicitly a quota change, never proof of a company-wide reset.
fn classify(previous: ResetObservation, current: ResetObservation) -> Option<JournalEventKind> {
    match (previous, current) {
        (
            ResetObservation::Quota {
                used_percent: before,
                resets_at: old,
                ..
            },
            ResetObservation::Quota {
                used_percent: after,
                resets_at: next,
                observed_at,
            },
        ) => {
            let moved = matches!((old, next), (Some(a), Some(b)) if b.saturating_sub(a) > 300);
            if !moved && before - after < 20.0 {
                return None;
            }
            Some(
                if old.is_some_and(|boundary| observed_at >= boundary.saturating_sub(300)) {
                    JournalEventKind::ScheduledResetObserved
                } else {
                    JournalEventKind::UnexpectedQuotaChange
                },
            )
        }
        (
            ResetObservation::Banked {
                available: before, ..
            },
            ResetObservation::Banked {
                available: after, ..
            },
        ) => match after.cmp(&before) {
            std::cmp::Ordering::Greater => Some(JournalEventKind::BankedResetsIncreased),
            std::cmp::Ordering::Less => Some(JournalEventKind::BankedResetsDecreased),
            std::cmp::Ordering::Equal => None,
        },
        _ => None,
    }
}

/// One issued notification. Percentages are 0..=100; `detail` must be one of
/// the kind's allowed codes.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct NotificationRecord {
    pub kind: JournalEventKind,
    pub previous_value: Option<f64>,
    pub current_value: Option<f64>,
    pub detail: Option<&'static str>,
    pub observed_at: i64,
}

const CREATE_EVENTS_TABLE: &str = "CREATE TABLE notification_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id TEXT NOT NULL, account_ref TEXT, window_key TEXT NOT NULL,
    kind TEXT NOT NULL, occurred_at INTEGER, detected_at INTEGER NOT NULL,
    received_at INTEGER NOT NULL, observed_from INTEGER NOT NULL,
    observed_to INTEGER NOT NULL, previous_value REAL,
    current_value REAL, detail TEXT, is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1))
);
CREATE INDEX notification_unread ON notification_events(is_read, id);";

pub struct NotificationJournal {
    path: Option<PathBuf>,
    connection: Mutex<Option<Connection>>,
    /// Unknown identities may compare within this process, never across restarts.
    unresolved_session: String,
}

impl NotificationJournal {
    pub fn in_memory() -> Self {
        Self::new(None)
    }

    pub fn at(path: PathBuf) -> Self {
        Self::new(Some(path))
    }

    fn new(path: Option<PathBuf>) -> Self {
        Self {
            path,
            connection: Mutex::new(None),
            unresolved_session: uuid::Uuid::new_v4().to_string(),
        }
    }

    fn with_connection<T>(
        &self,
        action: impl FnOnce(&mut Connection) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut guard = self
            .connection
            .lock()
            .map_err(|_| "Notification history lock is unavailable")?;
        if guard.is_none() {
            let mut connection = if let Some(path) = &self.path {
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent)
                        .map_err(|_| "Notification history directory is unavailable")?;
                }
                Connection::open(path).map_err(|_| "Notification history cannot be opened")?
            } else {
                Connection::open_in_memory().map_err(|_| "Notification history cannot be opened")?
            };
            connection
                .busy_timeout(Duration::from_millis(500))
                .map_err(db_error)?;
            let version: i64 = connection
                .query_row("PRAGMA user_version", [], |row| row.get(0))
                .map_err(db_error)?;
            if version > SCHEMA_VERSION {
                return Err("Notification history was created by a newer version".into());
            }
            if version == 0 {
                let tx = connection.transaction().map_err(db_error)?;
                tx.execute_batch(&format!(
                    "{CREATE_EVENTS_TABLE}
                CREATE TABLE notification_baselines (
                    lane TEXT PRIMARY KEY, observation TEXT NOT NULL, received_at INTEGER NOT NULL
                );
                PRAGMA user_version = {SCHEMA_VERSION};"
                ))
                .map_err(db_error)?;
                tx.commit().map_err(db_error)?;
            } else if version == 1 {
                // v2 makes values optional and adds `detail`. SQLite cannot relax
                // NOT NULL in place, so rebuild the table inside one transaction;
                // ids, read state and baselines are preserved.
                let tx = connection.transaction().map_err(db_error)?;
                tx.execute_batch(&format!("ALTER TABLE notification_events RENAME TO notification_events_v1;
                DROP INDEX IF EXISTS notification_unread;
                {CREATE_EVENTS_TABLE}
                INSERT INTO notification_events
                    (id,provider_id,account_ref,window_key,kind,occurred_at,detected_at,received_at,observed_from,observed_to,previous_value,current_value,detail,is_read)
                    SELECT id,provider_id,account_ref,window_key,kind,occurred_at,detected_at,received_at,observed_from,observed_to,previous_value,current_value,NULL,is_read
                    FROM notification_events_v1;
                DROP TABLE notification_events_v1;
                PRAGMA user_version = {SCHEMA_VERSION};")).map_err(db_error)?;
                tx.commit().map_err(db_error)?;
            }
            *guard = Some(connection);
        }
        action(guard.as_mut().expect("initialized notification connection"))
    }

    /// Commit both the event and its new baseline in a single transaction.
    /// Same/older observations cannot rewind state or duplicate a stored event.
    pub fn observe(
        &self,
        provider: ProviderId,
        account: &str,
        window_key: &str,
        observation: ResetObservation,
        received_at: i64,
    ) -> Result<Option<NotificationEvent>, String> {
        if !valid_window_key(window_key) {
            return Err("Invalid notification window identity".into());
        }
        if !observation.value().is_finite()
            || observation.value() < 0.0
            || observation.observed_at() <= 0
            || received_at <= 0
        {
            return Err("Invalid notification observation".into());
        }
        let account_ref =
            (!account.trim().is_empty()).then(|| digest(&[provider.cli_name(), account]));
        let lane = digest(&[
            provider.cli_name(),
            account_ref.as_deref().unwrap_or(&self.unresolved_session),
            window_key,
            observation.lane_kind(),
        ]);
        self.with_connection(|connection| {
            let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate).map_err(db_error)?;
            let saved: Option<String> = tx.query_row("SELECT observation FROM notification_baselines WHERE lane=?1", [&lane], |row| row.get(0)).optional().map_err(db_error)?;
            let previous: Option<ResetObservation> = saved.map(|raw| serde_json::from_str(&raw)
                .map_err(|_| "Notification baseline cannot be decoded".to_string())).transpose()?;
            if previous.is_some_and(|before| observation.observed_at() <= before.observed_at()) { return Ok(None); }
            let event = previous.and_then(|before| classify(before, observation).map(|kind| (before, kind)));
            let inserted = if let Some((before, kind)) = event {
                let kind_json = serde_json::to_string(&kind).map_err(|_| "Invalid notification event")?;
                tx.execute("INSERT INTO notification_events
                    (provider_id,account_ref,window_key,kind,detected_at,received_at,observed_from,observed_to,previous_value,current_value)
                    VALUES (?1,?2,?3,?4,?5,?5,?6,?7,?8,?9)", params![provider.cli_name(), account_ref, window_key, kind_json, received_at, before.observed_at(), observation.observed_at(), before.value(), observation.value()]).map_err(db_error)?;
                Some(NotificationEvent { id: tx.last_insert_rowid(), provider_id: provider.cli_name().into(), account_ref: account_ref.clone(), window_key: window_key.into(), kind,
                    occurred_at: None, detected_at: received_at, received_at, observed_from: before.observed_at(), observed_to: observation.observed_at(), previous_value: Some(before.value()), current_value: Some(observation.value()), detail: None, is_read: false, severity: kind.severity() })
            } else { None };
            let json = serde_json::to_string(&observation).map_err(|_| "Invalid notification observation")?;
            tx.execute("INSERT INTO notification_baselines(lane,observation,received_at) VALUES(?1,?2,?3)
                ON CONFLICT(lane) DO UPDATE SET observation=excluded.observation, received_at=excluded.received_at", params![lane, json, received_at]).map_err(db_error)?;
            tx.execute("DELETE FROM notification_events WHERE received_at < ?1 OR id NOT IN
                (SELECT id FROM notification_events ORDER BY id DESC LIMIT ?2)", params![received_at.saturating_sub(RETENTION_SECONDS), MAX_EVENTS]).map_err(db_error)?;
            tx.execute("DELETE FROM notification_baselines WHERE received_at < ?1 OR lane NOT IN
                (SELECT lane FROM notification_baselines ORDER BY received_at DESC, lane LIMIT ?2)", params![received_at.saturating_sub(RETENTION_SECONDS), MAX_BASELINES]).map_err(db_error)?;
            tx.commit().map_err(db_error)?;
            Ok(inserted)
        })
    }

    /// Record a notification the moment its dedupe identity first fires;
    /// callers never call this for repeats, so one logical event is one row.
    pub fn record_notification(
        &self,
        provider: ProviderId,
        account: &str,
        window_key: &str,
        record: NotificationRecord,
    ) -> Result<NotificationEvent, String> {
        let NotificationRecord {
            kind,
            previous_value,
            current_value,
            detail,
            observed_at,
        } = record;
        if kind.is_observation() {
            return Err("Observation kinds are recorded from observations only".into());
        }
        if !valid_window_key(window_key) {
            return Err("Invalid notification window identity".into());
        }
        let valid = |value: Option<f64>| {
            value.is_none_or(|value| value.is_finite() && (0.0..=100.0).contains(&value))
        };
        if !valid(previous_value) || !valid(current_value) || observed_at <= 0 {
            return Err("Invalid notification observation".into());
        }
        if detail.is_some_and(|code| !kind.allowed_details().contains(&code))
            || (detail.is_none() && !kind.allowed_details().is_empty())
        {
            return Err("Invalid notification detail".into());
        }
        let account_ref =
            (!account.trim().is_empty()).then(|| digest(&[provider.cli_name(), account]));
        self.with_connection(|connection| {
            let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate).map_err(db_error)?;
            let kind_json = serde_json::to_string(&kind).map_err(|_| "Invalid notification event")?;
            tx.execute("INSERT INTO notification_events
                (provider_id,account_ref,window_key,kind,occurred_at,detected_at,received_at,observed_from,observed_to,previous_value,current_value,detail)
                VALUES (?1,?2,?3,?4,?5,?5,?5,?5,?5,?6,?7,?8)", params![provider.cli_name(), account_ref, window_key, kind_json, observed_at, previous_value, current_value, detail]).map_err(db_error)?;
            let id = tx.last_insert_rowid();
            tx.execute("DELETE FROM notification_events WHERE received_at < ?1 OR id NOT IN
                (SELECT id FROM notification_events ORDER BY id DESC LIMIT ?2)", params![observed_at.saturating_sub(RETENTION_SECONDS), MAX_EVENTS]).map_err(db_error)?;
            tx.commit().map_err(db_error)?;
            Ok(NotificationEvent { id, provider_id: provider.cli_name().into(), account_ref, window_key: window_key.into(), kind,
                occurred_at: Some(observed_at), detected_at: observed_at, received_at: observed_at, observed_from: observed_at, observed_to: observed_at,
                previous_value, current_value, detail: detail.map(str::to_string), is_read: false, severity: kind.severity() })
        })
    }

    pub fn page(&self, query: &NotificationQuery) -> Result<NotificationPage, String> {
        if query.search.len() > 256
            || query
                .provider_id
                .as_ref()
                .is_some_and(|id| ProviderId::from_cli_name(id).is_none())
        {
            return Err("Invalid notification filter".into());
        }
        let limit = i64::from(query.limit.unwrap_or(50).clamp(1, 100));
        self.with_connection(|connection| {
            let tx = connection.transaction().map_err(db_error)?;
            let (unread_count, through_id): (i64, i64) = tx.query_row("SELECT COALESCE(SUM(is_read=0),0), COALESCE(MAX(id),0) FROM notification_events", [], |row| Ok((row.get(0)?, row.get(1)?))).map_err(db_error)?;
            let mut statement = tx.prepare("SELECT id,provider_id,account_ref,window_key,kind,occurred_at,detected_at,received_at,observed_from,observed_to,previous_value,current_value,is_read,detail FROM notification_events
                WHERE (?1 IS NULL OR id < ?1) AND (?2 IS NULL OR provider_id=?2)
                AND (?3=0 OR is_read=0) AND instr(lower(provider_id || ' ' || window_key || ' ' || kind),lower(?4))>0
                ORDER BY id DESC LIMIT ?5").map_err(db_error)?;
            let mut items = statement.query_map(params![query.before_id, query.provider_id, query.unread_only, query.search, limit + 1], event_from_row).map_err(db_error)?.collect::<Result<Vec<_>, _>>().map_err(db_error)?;
            let has_more = items.len() > usize::try_from(limit).unwrap_or(100);
            if has_more { items.pop(); }
            Ok(NotificationPage { items, unread_count, through_id, has_more })
        })
    }

    /// One stored event, for opening it from history.
    pub fn event(&self, id: i64) -> Result<Option<NotificationEvent>, String> {
        if id <= 0 {
            return Err("Invalid notification ID".into());
        }
        self.with_connection(|connection| {
            connection
                .query_row("SELECT id,provider_id,account_ref,window_key,kind,occurred_at,detected_at,received_at,observed_from,observed_to,previous_value,current_value,is_read,detail FROM notification_events WHERE id=?1", [id], event_from_row)
                .optional()
                .map_err(db_error)
        })
    }

    pub fn mark_read(&self, id: i64) -> Result<bool, String> {
        if id <= 0 {
            return Err("Invalid notification ID".into());
        }
        self.with_connection(|connection| {
            connection
                .execute(
                    "UPDATE notification_events SET is_read=1 WHERE id=?1 AND is_read=0",
                    [id],
                )
                .map(|count| count == 1)
                .map_err(db_error)
        })
    }

    pub fn mark_all_read(&self, through_id: i64) -> Result<usize, String> {
        if through_id < 0 {
            return Err("Invalid notification boundary".into());
        }
        self.with_connection(|connection| {
            connection
                .execute(
                    "UPDATE notification_events SET is_read=1 WHERE id<=?1 AND is_read=0",
                    [through_id],
                )
                .map_err(db_error)
        })
    }
}

fn event_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NotificationEvent> {
    let raw: String = row.get(4)?;
    let kind: JournalEventKind = serde_json::from_str(&raw).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(4, rusqlite::types::Type::Text, Box::new(error))
    })?;
    Ok(NotificationEvent {
        id: row.get(0)?,
        provider_id: row.get(1)?,
        account_ref: row.get(2)?,
        window_key: row.get(3)?,
        kind,
        occurred_at: row.get(5)?,
        detected_at: row.get(6)?,
        received_at: row.get(7)?,
        observed_from: row.get(8)?,
        observed_to: row.get(9)?,
        previous_value: row.get(10)?,
        current_value: row.get(11)?,
        is_read: row.get(12)?,
        detail: row.get(13)?,
        severity: kind.severity(),
    })
}

fn valid_window_key(window_key: &str) -> bool {
    !window_key.is_empty()
        && window_key.len() <= 96
        && window_key
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_:".contains(&c))
}

fn digest(parts: &[&str]) -> String {
    let mut hash = Sha256::new();
    for part in parts {
        hash.update((part.len() as u64).to_le_bytes());
        hash.update(part.as_bytes());
    }
    format!("{:x}", hash.finalize())
}

fn db_error(_: rusqlite::Error) -> String {
    "Notification history storage failed".into()
}

#[cfg(test)]
mod tests;
