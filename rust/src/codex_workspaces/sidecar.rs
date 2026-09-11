//! CodexBar-owned SQLite sidecar for Workspaces snapshots.
//!
//! Never attaches to or writes Codex's `state_5.sqlite`. Schema version 5 and
//! payload format 4 match upstream; foreign `user_version` values are refused.

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags, OptionalExtension, params};

use super::types::CodexLocalProjectUsageSnapshot;

pub const SCHEMA_VERSION: i32 = 5;
/// Bumped 3 -> 4 when `CodexLocalProjectUsageSnapshot` gained `model_totals`
/// (Model Analytics). A cached payload written under format 3 deserializes
/// fine via `#[serde(default)]` (empty `model_totals`) but would then be
/// served forever with an empty Model Analytics table on a real machine
/// with a pre-existing sidecar cache, since `load_latest_snapshot` returns
/// the cached snapshot verbatim without rescanning. Bumping this constant
/// makes `format_version != PAYLOAD_FORMAT_VERSION` reject the stale
/// payload once, forcing exactly one real rescan that populates
/// `model_totals` correctly -- discovered via native proof against a real
/// machine's existing cache (docs/validation/ANALYTICS_PHASE3B_VISUAL_REVIEW.md).
pub const PAYLOAD_FORMAT_VERSION: i32 = 4;

#[derive(Debug, thiserror::Error)]
pub enum SidecarError {
    #[error("workspaces sidecar path unavailable")]
    PathUnavailable,
    #[error("workspaces sidecar open failed: {0}")]
    Open(String),
    #[error(
        "workspaces sidecar schema incompatible (user_version={found}, expected {SCHEMA_VERSION})"
    )]
    Incompatible { found: i32 },
    #[error("workspaces sidecar error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("workspaces sidecar encode/decode failed: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("workspaces sidecar io failed: {0}")]
    Io(#[from] std::io::Error),
}

/// Persistence for complete workspaces snapshots.
#[derive(Debug, Clone)]
pub struct WorkspaceUsageSidecar {
    path: PathBuf,
}

impl WorkspaceUsageSidecar {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    /// Default: `%LOCALAPPDATA%\CodexBar\local-usage\codex-workspaces-v1.sqlite`.
    pub fn default_path() -> Option<PathBuf> {
        dirs::data_local_dir().map(|root| {
            root.join(crate::paths::APP_DIR_NAME)
                .join("local-usage")
                .join("codex-workspaces-v1.sqlite")
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn load_latest_snapshot(
        &self,
        scope_signature: &str,
        history_days: u32,
    ) -> Result<Option<CodexLocalProjectUsageSnapshot>, SidecarError> {
        if !self.path.exists() {
            return Ok(None);
        }
        let conn = self.open(true)?;
        let row: Option<(Vec<u8>, i32)> = conn
            .query_row(
                "SELECT payload, payload_format_version
                 FROM snapshot_payloads
                 WHERE scope_signature = ?1
                   AND history_days = ?2
                   AND is_complete = 1
                 ORDER BY updated_at_ms DESC
                 LIMIT 1",
                params![scope_signature, history_days as i64],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        let Some((payload, format_version)) = row else {
            return Ok(None);
        };
        if format_version != PAYLOAD_FORMAT_VERSION {
            return Ok(None);
        }
        let snapshot = serde_json::from_slice(&payload)?;
        Ok(Some(snapshot))
    }

    /// Atomically replace the complete snapshot for `(scope, history_days)`.
    pub fn publish_snapshot(
        &self,
        snapshot: &CodexLocalProjectUsageSnapshot,
    ) -> Result<(), SidecarError> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let conn = self.open(false)?;
        let payload = serde_json::to_vec(snapshot)?;
        let updated_at_ms = snapshot.updated_at.timestamp_millis();
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "INSERT INTO snapshot_payloads (
                scope_signature, history_days, updated_at_ms, is_complete,
                payload_format_version, payload
             ) VALUES (?1, ?2, ?3, 1, ?4, ?5)
             ON CONFLICT(scope_signature, history_days) DO UPDATE SET
                updated_at_ms = excluded.updated_at_ms,
                is_complete = 1,
                payload_format_version = excluded.payload_format_version,
                payload = excluded.payload",
            params![
                snapshot.scope_signature,
                snapshot.history_days as i64,
                updated_at_ms,
                PAYLOAD_FORMAT_VERSION,
                payload,
            ],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn clear_snapshots(&self) -> Result<(), SidecarError> {
        if !self.path.exists() {
            return Ok(());
        }
        let conn = self.open(false)?;
        conn.execute("DELETE FROM snapshot_payloads", [])?;
        Ok(())
    }

    fn open(&self, read_only: bool) -> Result<Connection, SidecarError> {
        if read_only {
            let conn = Connection::open_with_flags(
                &self.path,
                OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
            )
            .map_err(|e| SidecarError::Open(e.to_string()))?;
            conn.busy_timeout(std::time::Duration::from_millis(250))?;
            Self::assert_compatible(&conn)?;
            return Ok(conn);
        }

        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let conn = Connection::open_with_flags(
            &self.path,
            OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(|e| SidecarError::Open(e.to_string()))?;
        conn.busy_timeout(std::time::Duration::from_millis(250))?;
        Self::ensure_schema(&conn)?;
        Ok(conn)
    }

    fn assert_compatible(conn: &Connection) -> Result<(), SidecarError> {
        let version: i32 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
        if version == 0 || version == SCHEMA_VERSION {
            Ok(())
        } else {
            Err(SidecarError::Incompatible { found: version })
        }
    }

    fn ensure_schema(conn: &Connection) -> Result<(), SidecarError> {
        let version: i32 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
        if version != 0 && version != SCHEMA_VERSION {
            return Err(SidecarError::Incompatible { found: version });
        }
        if version == 0 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS snapshot_payloads (
                    scope_signature TEXT NOT NULL,
                    history_days INTEGER NOT NULL,
                    updated_at_ms INTEGER NOT NULL,
                    is_complete INTEGER NOT NULL,
                    payload_format_version INTEGER NOT NULL,
                    payload BLOB NOT NULL,
                    PRIMARY KEY (scope_signature, history_days)
                );
                PRAGMA user_version = 5;",
            )?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::codex_workspaces::types::{SourceStatus, UsageTotals};
    use chrono::Utc;
    use tempfile::TempDir;

    fn sample_snapshot() -> CodexLocalProjectUsageSnapshot {
        CodexLocalProjectUsageSnapshot {
            updated_at: Utc::now(),
            history_days: 30,
            scope_signature: "scope-a".into(),
            indexed_file_count: 1,
            skipped_file_count: 0,
            total: UsageTotals::from_parts(10, 0, 5),
            sessions: vec![],
            projects: vec![],
            daily: vec![],
            source_status: SourceStatus::Complete,
            model_totals: vec![],
        }
    }

    /// Regression test for the real defect found via native proof against a
    /// machine with a pre-existing sidecar cache (owner: Model Analytics
    /// showed an empty table despite 70B+ real tokens, because
    /// `load_latest_snapshot` returned a cached payload serialized before
    /// `model_totals` existed, verbatim, forever -- see
    /// docs/validation/ANALYTICS_PHASE3B_VISUAL_REVIEW.md). A payload
    /// written under the OLD format version must be rejected as a cache
    /// miss so the caller re-scans and gets a snapshot with real
    /// `model_totals`, not silently served as-is.
    #[test]
    fn stale_payload_format_version_is_treated_as_a_cache_miss() {
        let tmp = TempDir::new().unwrap();
        let sidecar = WorkspaceUsageSidecar::new(tmp.path().join("side.sqlite"));
        sidecar.publish_snapshot(&sample_snapshot()).unwrap();

        // Sanity: a freshly published snapshot (current format) IS found.
        let fresh = sidecar
            .load_latest_snapshot("scope-a", 30)
            .unwrap()
            .expect("current-format snapshot must be served from cache");
        assert_eq!(fresh.scope_signature, "scope-a");

        // Now simulate a payload written under an OLDER format version
        // (e.g. from before model_totals existed) by overwriting the
        // stored payload_format_version directly.
        let conn = Connection::open(tmp.path().join("side.sqlite")).unwrap();
        conn.execute(
            "UPDATE snapshot_payloads SET payload_format_version = ?1 WHERE scope_signature = 'scope-a'",
            params![PAYLOAD_FORMAT_VERSION - 1],
        )
        .unwrap();

        let stale = sidecar.load_latest_snapshot("scope-a", 30).unwrap();
        assert!(
            stale.is_none(),
            "a payload written under an old format version must be treated as a cache miss, \
             not served verbatim -- otherwise a newly added field (like model_totals) stays \
             empty forever on any machine with a pre-existing cache"
        );
    }
}
