//! Durable, typed notification history. Delivery preferences never decide whether
//! an observed event is recorded. No free-form provider messages or credentials
//! are accepted by this store.

use crate::core::ProviderId;
use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{path::PathBuf, sync::Mutex, time::Duration};

const SCHEMA_VERSION: i64 = 1;
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
    pub previous_value: f64,
    pub current_value: f64,
    pub is_read: bool,
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
                tx.execute_batch("CREATE TABLE notification_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    provider_id TEXT NOT NULL, account_ref TEXT, window_key TEXT NOT NULL,
                    kind TEXT NOT NULL, occurred_at INTEGER, detected_at INTEGER NOT NULL,
                    received_at INTEGER NOT NULL, observed_from INTEGER NOT NULL,
                    observed_to INTEGER NOT NULL, previous_value REAL NOT NULL,
                    current_value REAL NOT NULL, is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1))
                );
                CREATE INDEX notification_unread ON notification_events(is_read, id);
                CREATE TABLE notification_baselines (
                    lane TEXT PRIMARY KEY, observation TEXT NOT NULL, received_at INTEGER NOT NULL
                );
                PRAGMA user_version = 1;").map_err(db_error)?;
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
        if window_key.is_empty()
            || window_key.len() > 96
            || !window_key
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"-_:".contains(&c))
        {
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
                    occurred_at: None, detected_at: received_at, received_at, observed_from: before.observed_at(), observed_to: observation.observed_at(), previous_value: before.value(), current_value: observation.value(), is_read: false })
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
            let mut statement = tx.prepare("SELECT id,provider_id,account_ref,window_key,kind,occurred_at,detected_at,received_at,observed_from,observed_to,previous_value,current_value,is_read FROM notification_events
                WHERE (?1 IS NULL OR id < ?1) AND (?2 IS NULL OR provider_id=?2)
                AND (?3=0 OR is_read=0) AND instr(lower(provider_id || ' ' || window_key || ' ' || kind),lower(?4))>0
                ORDER BY id DESC LIMIT ?5").map_err(db_error)?;
            let mut items = statement.query_map(params![query.before_id, query.provider_id, query.unread_only, query.search, limit + 1], |row| {
                let raw: String = row.get(4)?;
                let kind = serde_json::from_str(&raw).map_err(|error| rusqlite::Error::FromSqlConversionFailure(4, rusqlite::types::Type::Text, Box::new(error)))?;
                Ok(NotificationEvent { id: row.get(0)?, provider_id: row.get(1)?, account_ref: row.get(2)?, window_key: row.get(3)?, kind, occurred_at: row.get(5)?, detected_at: row.get(6)?, received_at: row.get(7)?, observed_from: row.get(8)?, observed_to: row.get(9)?, previous_value: row.get(10)?, current_value: row.get(11)?, is_read: row.get(12)? })
            }).map_err(db_error)?.collect::<Result<Vec<_>, _>>().map_err(db_error)?;
            let has_more = items.len() > usize::try_from(limit).unwrap_or(100);
            if has_more { items.pop(); }
            Ok(NotificationPage { items, unread_count, through_id, has_more })
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
