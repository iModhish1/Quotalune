//! Account-scoped local usage history.
//!
//! SQLite (WAL) store at `<config>/history.db`. New quota samples carry an
//! explicit account scope and stable physical-window key. Older rows retain
//! NULL identity metadata so consumers cannot silently treat historical
//! presentation/profile attribution as observed account identity.
//!
//! Deduplication: a sample is skipped when the newest row for the same
//! (account, window) already carries the same usage within the dedup window,
//! so idle polling does not spam the database. Retention pruning deletes
//! rows older than the configured number of days. Schema changes go through
//! `PRAGMA user_version` migrations (tested).

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;

/// Rows with identical usage for the same (account, window) inside this
/// window are considered duplicates of the stored sample.
pub const DEDUP_WINDOW_SECS: i64 = 45;

/// Default retention in days (matches the bounded-retention policy).
pub const DEFAULT_RETENTION_DAYS: u32 = 90;

#[derive(Debug, Clone, PartialEq)]
pub struct UsageSample {
    pub account_id: String,
    /// How confidently `account_id` identifies the account that produced
    /// this observation. `None` is a legacy row and must never be promoted
    /// into an account-comparable series.
    pub account_scope: Option<String>,
    pub provider: String,
    pub window_id: Option<String>,
    /// Stable physical quota-window identity for new rows. Unlike the
    /// legacy `window_id == "selected"` alias, this never depends on a
    /// presentation preference. `None` marks legacy identity evidence.
    pub window_key: Option<String>,
    pub window_label: Option<String>,
    /// Provider-reported window duration, when known. Duration participates
    /// in series identity so a slot whose cadence changes is not compared.
    pub window_minutes: Option<u32>,
    pub used_percent: f64,
    pub remaining_percent: f64,
    pub cost_used: Option<f64>,
    /// ISO 4217 currency code for `cost_used` (e.g. "USD"), always written
    /// alongside a cost sample as of Phase 4A (schema `user_version` 2) --
    /// `CostSnapshot::currency_code` is a required, non-optional field on
    /// every provider adapter, so every NEW cost row can carry it. Rows
    /// written before this column existed read back as `None`: that is
    /// legacy/ambiguous data, not "USD assumed" -- callers must not guess
    /// a currency for a pre-migration row (owner Phase 4A section 4/14).
    pub cost_currency_code: Option<String>,
    /// "cumulative" | "point_in_time" | "unknown" (or `None` for a
    /// pre-Phase-4A row). See `dashboard_data::CostMeasurementKind` --
    /// stored as a plain string here rather than an enum so an old row
    /// with no value, or a future kind this build doesn't know about,
    /// both read back safely as `None`/an unrecognized string rather than
    /// failing to deserialize.
    pub cost_measurement_kind: Option<String>,
    /// "spend" | "balance" | "credits" | "unknown" (or `None` for a
    /// pre-Phase-4A.1 row). See `dashboard_data::MonetaryQuantityKind` --
    /// the orthogonal dimension to `cost_measurement_kind`: WHAT the
    /// number represents (spend vs. a prepaid balance vs. a
    /// provider-defined credits unit), not its temporal shape. Stored as
    /// a plain string for the same forward/backward-compat reason as
    /// `cost_measurement_kind`.
    pub monetary_quantity_kind: Option<String>,
    /// Epoch seconds.
    pub resets_at: Option<i64>,
    /// Epoch seconds.
    pub captured_at: i64,
}

#[derive(Debug, Clone, Default)]
pub struct HistoryQuery {
    pub account_ids: Vec<String>,
    pub providers: Vec<String>,
    /// Epoch seconds (inclusive).
    pub since: Option<i64>,
    /// Epoch seconds (inclusive). `None` = now.
    pub until: Option<i64>,
}

pub struct HistoryStore {
    path: PathBuf,
    conn: Mutex<Option<Connection>>,
}

fn now_epoch() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().cast_signed())
        .unwrap_or(0)
}

impl HistoryStore {
    pub fn path() -> Option<PathBuf> {
        crate::paths::config_dir().map(|p| p.join("history.db"))
    }

    pub fn open() -> Self {
        let path = Self::path().unwrap_or_else(|| PathBuf::from("quotaarc-history.db"));
        Self {
            path,
            conn: Mutex::new(None),
        }
    }

    /// Open a store against an explicit path (tests).
    pub fn open_at(path: PathBuf) -> Self {
        Self {
            path,
            conn: Mutex::new(None),
        }
    }

    fn with_conn<T>(
        &self,
        f: impl FnOnce(&Connection) -> Result<T, rusqlite::Error>,
    ) -> Result<T, String> {
        let mut guard = self
            .conn
            .lock()
            .map_err(|_| "history store lock poisoned".to_string())?;
        if guard.is_none() {
            if let Some(parent) = self.path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let conn = Connection::open(&self.path).map_err(|e| e.to_string())?;
            conn.busy_timeout(std::time::Duration::from_millis(500))
                .map_err(|e| e.to_string())?;
            conn.pragma_update(None, "journal_mode", "WAL")
                .map_err(|e| e.to_string())?;
            conn.pragma_update(None, "synchronous", "NORMAL")
                .map_err(|e| e.to_string())?;
            Self::migrate(&conn).map_err(|e| e.to_string())?;
            *guard = Some(conn);
        }
        f(guard.as_ref().expect("connection initialized")).map_err(|e| e.to_string())
    }

    fn migrate(conn: &Connection) -> Result<(), rusqlite::Error> {
        let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        if version < 1 {
            conn.execute_batch(
                "BEGIN;
                 CREATE TABLE IF NOT EXISTS usage_samples (
                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                     account_id TEXT NOT NULL,
                     provider TEXT NOT NULL,
                     window_id TEXT,
                     window_label TEXT,
                     used_percent REAL NOT NULL,
                     remaining_percent REAL NOT NULL,
                     cost_used REAL,
                     resets_at INTEGER,
                     captured_at INTEGER NOT NULL
                 );
                 CREATE INDEX IF NOT EXISTS idx_usage_account_time
                     ON usage_samples(account_id, captured_at);
                 CREATE INDEX IF NOT EXISTS idx_usage_provider_time
                     ON usage_samples(provider, captured_at);
                 PRAGMA user_version = 1;
                 COMMIT;",
            )?;
        }
        if version < 2 {
            // Phase 4A: add a currency column for cost samples. Additive,
            // backward-compatible -- existing rows get NULL (legacy/
            // ambiguous currency, never silently assumed to be USD), no
            // existing row's cost_used/used_percent/etc. is touched or
            // rewritten (owner Phase 4A section 14: no destructive
            // migration, old history stays fully readable).
            conn.execute_batch(
                "BEGIN;
                 ALTER TABLE usage_samples ADD COLUMN cost_currency_code TEXT;
                 PRAGMA user_version = 2;
                 COMMIT;",
            )?;
        }
        if version < 3 {
            // Phase 4A part 2: add a measurement-kind column. A real
            // provider-adapter audit (docs/validation/
            // PHASE4_DATA_ACCURACY_AUDIT.md "Phase 4A" section) proved
            // that `cost_used` does NOT mean the same thing for every
            // provider -- several pass a point-in-time prepaid balance
            // (not period spend) into the same field. This column records,
            // per row, which one a provider was proven to write at the
            // time it was recorded (see `dashboard_data::
            // provider_cost_measurement_kind`), so a mixed-kind aggregate
            // can never be silently produced. Additive, backward-
            // compatible: existing rows get NULL (legacy/unknown kind).
            conn.execute_batch(
                "BEGIN;
                 ALTER TABLE usage_samples ADD COLUMN cost_measurement_kind TEXT;
                 PRAGMA user_version = 3;
                 COMMIT;",
            )?;
        }
        if version < 4 {
            // Phase 4A.1: add the orthogonal monetary_quantity_kind column
            // (docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md "Phase 4A.1"
            // section). cost_measurement_kind alone couldn't distinguish
            // "the provider's own currency balance" from "genuine spend"
            // when both happen to read as the same temporal shape --
            // conflating a balance with spend is a distinct mistake from
            // the original cumulative-summing bug. Additive, backward-
            // compatible: existing rows get NULL (legacy/unknown quantity).
            conn.execute_batch(
                "BEGIN;
                 ALTER TABLE usage_samples ADD COLUMN monetary_quantity_kind TEXT;
                 PRAGMA user_version = 4;
                 COMMIT;",
            )?;
        }
        if version < 5 {
            // Product V2 analytics identity. Additive and deliberately not
            // backfilled: older account/window attribution cannot be proven
            // after the fact, especially the mutable legacy "selected"
            // series. NULL therefore means legacy/unknown, not a default.
            conn.execute_batch(
                "BEGIN;
                 ALTER TABLE usage_samples ADD COLUMN account_scope TEXT;
                 ALTER TABLE usage_samples ADD COLUMN window_key TEXT;
                 ALTER TABLE usage_samples ADD COLUMN window_minutes INTEGER;
                 CREATE INDEX IF NOT EXISTS idx_usage_series_time
                     ON usage_samples(provider, account_id, window_key, captured_at);
                 PRAGMA user_version = 5;
                 COMMIT;",
            )?;
        }
        Ok(())
    }

    /// Record samples with deduplication. Returns the number of rows stored.
    pub fn record_samples(&self, samples: &[UsageSample]) -> Result<usize, String> {
        if samples.is_empty() {
            return Ok(0);
        }
        self.with_conn(|conn| {
            let mut stored = 0usize;
            for sample in samples {
                // `cost_used` is included in the dedup key (via `IS`, so two
                // NULLs still match) alongside `used_percent`: a cost sample
                // (window_id "cost") always carries `used_percent == 0.0`,
                // so comparing only `used_percent` would treat any two
                // different cost readings within the dedup window as
                // duplicates of each other.
                //
                // Phase 4A.1 (owner section 9): the numeric value alone is
                // NOT sufficient either -- two samples with the SAME
                // cost_used but different currency, quantity kind
                // (spend/balance/credits), or measurement kind
                // (cumulative/point-in-time) are different facts, not
                // duplicates of each other (5 USD Spend != 5 EUR Spend !=
                // 5 USD Balance != 5 USD Cumulative-Spend vs
                // PointInTime-Spend). All three columns join the dedup key
                // via NULL-safe `IS`, alongside `account_id` (already
                // exact-match, so multi-account never collapses).
                let duplicate: bool = conn
                    .query_row(
                        "SELECT EXISTS(
                             SELECT 1 FROM usage_samples
                             WHERE account_id = ?1
                               AND account_scope IS ?2
                               AND provider = ?3
                               AND window_id IS ?4
                               AND window_key IS ?5
                               AND window_minutes IS ?6
                               AND resets_at IS ?7
                               AND used_percent = ?8
                               AND cost_used IS ?9
                               AND cost_currency_code IS ?10
                               AND cost_measurement_kind IS ?11
                               AND monetary_quantity_kind IS ?12
                               AND captured_at >= ?13
                         )",
                        rusqlite::params![
                            sample.account_id,
                            sample.account_scope,
                            sample.provider,
                            sample.window_id,
                            sample.window_key,
                            sample.window_minutes,
                            sample.resets_at,
                            sample.used_percent,
                            sample.cost_used,
                            sample.cost_currency_code,
                            sample.cost_measurement_kind,
                            sample.monetary_quantity_kind,
                            now_epoch() - DEDUP_WINDOW_SECS,
                        ],
                        |r| r.get::<_, i64>(0),
                    )
                    .map(|v| v != 0)
                    .unwrap_or(false);
                if duplicate {
                    continue;
                }
                conn.execute(
                    "INSERT INTO usage_samples
                         (account_id, account_scope, provider, window_id,
                          window_key, window_label, window_minutes,
                          used_percent, remaining_percent, cost_used,
                          cost_currency_code, cost_measurement_kind,
                          monetary_quantity_kind, resets_at, captured_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                    rusqlite::params![
                        sample.account_id,
                        sample.account_scope,
                        sample.provider,
                        sample.window_id,
                        sample.window_key,
                        sample.window_label,
                        sample.window_minutes,
                        sample.used_percent,
                        sample.remaining_percent,
                        sample.cost_used,
                        sample.cost_currency_code,
                        sample.cost_measurement_kind,
                        sample.monetary_quantity_kind,
                        sample.resets_at,
                        sample.captured_at,
                    ],
                )?;
                stored += 1;
            }
            Ok(stored)
        })
    }

    /// Query samples, oldest first.
    pub fn query(&self, filter: &HistoryQuery) -> Result<Vec<UsageSample>, String> {
        self.with_conn(|conn| {
            let mut sql = String::from(
                "SELECT account_id, account_scope, provider, window_id,
                        window_key, window_label, window_minutes,
                        used_percent, remaining_percent, cost_used,
                        cost_currency_code, cost_measurement_kind,
                        monetary_quantity_kind, resets_at, captured_at
                 FROM usage_samples WHERE 1=1",
            );
            let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
            if !filter.account_ids.is_empty() {
                let placeholders = filter
                    .account_ids
                    .iter()
                    .map(|_| "?")
                    .collect::<Vec<_>>()
                    .join(",");
                sql.push_str(&format!(" AND account_id IN ({placeholders})"));
                for id in &filter.account_ids {
                    params.push(Box::new(id.clone()));
                }
            }
            if !filter.providers.is_empty() {
                let placeholders = filter
                    .providers
                    .iter()
                    .map(|_| "?")
                    .collect::<Vec<_>>()
                    .join(",");
                sql.push_str(&format!(" AND provider IN ({placeholders})"));
                for p in &filter.providers {
                    params.push(Box::new(p.clone()));
                }
            }
            if let Some(since) = filter.since {
                sql.push_str(" AND captured_at >= ?");
                params.push(Box::new(since));
            }
            let until = filter.until.unwrap_or_else(now_epoch);
            sql.push_str(" AND captured_at <= ?");
            params.push(Box::new(until));
            sql.push_str(" ORDER BY captured_at ASC");

            let mut stmt = conn.prepare(&sql)?;
            let refs: Vec<&dyn rusqlite::types::ToSql> =
                params.iter().map(|p| p.as_ref()).collect();
            let rows = stmt.query_map(refs.as_slice(), |r| {
                Ok(UsageSample {
                    account_id: r.get(0)?,
                    account_scope: r.get(1)?,
                    provider: r.get(2)?,
                    window_id: r.get(3)?,
                    window_key: r.get(4)?,
                    window_label: r.get(5)?,
                    window_minutes: r.get(6)?,
                    used_percent: r.get(7)?,
                    remaining_percent: r.get(8)?,
                    cost_used: r.get(9)?,
                    cost_currency_code: r.get(10)?,
                    cost_measurement_kind: r.get(11)?,
                    monetary_quantity_kind: r.get(12)?,
                    resets_at: r.get(13)?,
                    captured_at: r.get(14)?,
                })
            })?;
            let mut out = Vec::new();
            for row in rows {
                out.push(row?);
            }
            Ok(out)
        })
    }

    /// Delete rows older than `keep_days`. Returns rows removed.
    pub fn prune(&self, keep_days: u32) -> Result<usize, String> {
        let cutoff = now_epoch() - i64::from(keep_days) * 86_400;
        self.with_conn(|conn| {
            conn.execute(
                "DELETE FROM usage_samples WHERE captured_at < ?1",
                rusqlite::params![cutoff],
            )
        })
    }

    pub fn clear_all(&self) -> Result<usize, String> {
        self.with_conn(|conn| conn.execute("DELETE FROM usage_samples", []))
    }

    pub fn clear_accounts(&self, account_ids: &[String]) -> Result<usize, String> {
        if account_ids.is_empty() {
            return Ok(0);
        }
        self.with_conn(|conn| {
            let placeholders = account_ids
                .iter()
                .map(|_| "?")
                .collect::<Vec<_>>()
                .join(",");
            let sql = format!("DELETE FROM usage_samples WHERE account_id IN ({placeholders})");
            conn.execute(&sql, rusqlite::params_from_iter(account_ids.iter()))
        })
    }

    pub fn row_count(&self) -> Result<i64, String> {
        self.with_conn(|conn| {
            conn.query_row("SELECT COUNT(*) FROM usage_samples", [], |r| r.get(0))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> HistoryStore {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("history.db");
        // Leak the tempdir for the lifetime of the test process; fine here.
        std::mem::forget(dir);
        HistoryStore::open_at(path)
    }

    fn sample(account: &str, provider: &str, window: &str, used: f64, at: i64) -> UsageSample {
        UsageSample {
            account_id: account.to_string(),
            account_scope: None,
            provider: provider.to_string(),
            window_id: Some(window.to_string()),
            window_key: None,
            window_label: Some("Window".to_string()),
            window_minutes: None,
            used_percent: used,
            remaining_percent: 100.0 - used,
            cost_used: None,
            cost_currency_code: None,
            cost_measurement_kind: None,
            monetary_quantity_kind: None,
            resets_at: None,
            captured_at: at,
        }
    }

    #[test]
    fn schema_created_and_versioned() {
        let store = store();
        assert_eq!(store.row_count().unwrap(), 0);
        let version = store
            .with_conn(|conn| conn.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0)))
            .unwrap();
        assert_eq!(version, 5);
        let columns = store
            .with_conn(|conn| {
                let mut statement = conn.prepare("PRAGMA table_info(usage_samples)")?;
                statement
                    .query_map([], |row| row.get::<_, String>(1))?
                    .collect::<Result<Vec<_>, _>>()
            })
            .unwrap();
        for expected in ["account_scope", "window_key", "window_minutes"] {
            assert!(columns.iter().any(|column| column == expected));
        }
    }

    #[test]
    fn version_four_rows_migrate_without_inventing_identity_metadata() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("history.db");
        {
            let conn = Connection::open(&path).expect("create version four database");
            conn.execute_batch(
                "CREATE TABLE usage_samples (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    window_id TEXT,
                    window_label TEXT,
                    used_percent REAL NOT NULL,
                    remaining_percent REAL NOT NULL,
                    cost_used REAL,
                    resets_at INTEGER,
                    captured_at INTEGER NOT NULL,
                    cost_currency_code TEXT,
                    cost_measurement_kind TEXT,
                    monetary_quantity_kind TEXT
                 );
                 INSERT INTO usage_samples (
                    account_id, provider, window_id, window_label,
                    used_percent, remaining_percent, resets_at, captured_at
                 ) VALUES ('profile-account', 'codex', 'selected', 'Weekly', 20, 80, 999, 123);
                 PRAGMA user_version = 4;",
            )
            .expect("seed version four schema");
        }

        let store = HistoryStore::open_at(path);
        let rows = store.query(&HistoryQuery::default()).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].account_id, "profile-account");
        assert_eq!(rows[0].window_id.as_deref(), Some("selected"));
        assert_eq!(rows[0].account_scope, None);
        assert_eq!(rows[0].window_key, None);
        assert_eq!(rows[0].window_minutes, None);
    }

    #[test]
    fn records_and_queries_range() {
        let store = store();
        let now = now_epoch();
        store
            .record_samples(&[
                sample("a1", "claude", "session", 10.0, now - 3600),
                sample("a1", "claude", "session", 20.0, now - 60),
                sample("a2", "codex", "weekly", 5.0, now - 30),
            ])
            .unwrap();
        assert_eq!(store.row_count().unwrap(), 3);

        let all = store.query(&HistoryQuery::default()).unwrap();
        assert_eq!(all.len(), 3);
        assert!(all[0].captured_at <= all[2].captured_at);

        let recent = store
            .query(&HistoryQuery {
                since: Some(now - 120),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(recent.len(), 2);
    }

    #[test]
    fn dedups_identical_recent_samples() {
        let store = store();
        let s = sample("a1", "claude", "session", 42.0, now_epoch());
        assert_eq!(store.record_samples(std::slice::from_ref(&s)).unwrap(), 1);
        // Same value within the dedup window: skipped.
        assert_eq!(store.record_samples(&[s]).unwrap(), 0);
        // Changed value: stored.
        assert_eq!(
            store
                .record_samples(&[sample("a1", "claude", "session", 43.0, now_epoch())])
                .unwrap(),
            1
        );
        // Same value but a different window: stored.
        assert_eq!(
            store
                .record_samples(&[sample("a1", "claude", "weekly", 42.0, now_epoch())])
                .unwrap(),
            1
        );
    }

    #[test]
    fn dedup_preserves_quota_series_identity_duration_and_reset_cycle() {
        let store = store();
        let now = now_epoch();
        let mut original = sample("a1", "codex", "primary", 42.0, now);
        original.account_scope = Some("observed".to_string());
        original.window_key = Some("primary".to_string());
        original.window_minutes = Some(300);
        original.resets_at = Some(now + 300);
        assert_eq!(store.record_samples(&[original.clone()]).unwrap(), 1);
        assert_eq!(store.record_samples(&[original.clone()]).unwrap(), 0);

        let mut different_duration = original.clone();
        different_duration.window_minutes = Some(10_080);
        assert_eq!(store.record_samples(&[different_duration]).unwrap(), 1);

        let mut different_window = original.clone();
        different_window.window_key = Some("secondary".to_string());
        assert_eq!(store.record_samples(&[different_window]).unwrap(), 1);

        let mut different_scope = original.clone();
        different_scope.account_scope = Some("unresolved".to_string());
        assert_eq!(store.record_samples(&[different_scope]).unwrap(), 1);

        let mut different_reset = original;
        different_reset.resets_at = Some(now + 600);
        assert_eq!(store.record_samples(&[different_reset]).unwrap(), 1);
    }

    /// Regression test for the dedup key: a `used_percent`-only comparison
    /// would treat two different cost readings (both carrying the
    /// placeholder `used_percent: 0.0` a "cost" sample uses) as duplicates
    /// of each other. `cost_used` must be part of the dedup key too.
    #[test]
    fn dedups_cost_samples_by_cost_value_not_placeholder_percent() {
        let store = store();
        let now = now_epoch();
        let cost_sample = |cost: f64, at: i64| UsageSample {
            account_id: "a1".to_string(),
            account_scope: None,
            provider: "codex".to_string(),
            window_id: Some("cost".to_string()),
            window_key: None,
            window_label: Some("month".to_string()),
            window_minutes: None,
            used_percent: 0.0,
            remaining_percent: 0.0,
            cost_used: Some(cost),
            cost_currency_code: Some("USD".to_string()),
            cost_measurement_kind: Some("unknown".to_string()),
            monetary_quantity_kind: Some("unknown".to_string()),
            resets_at: None,
            captured_at: at,
        };
        assert_eq!(store.record_samples(&[cost_sample(12.34, now)]).unwrap(), 1);
        // Same cost within the dedup window: skipped.
        assert_eq!(store.record_samples(&[cost_sample(12.34, now)]).unwrap(), 0);
        // Different cost within the dedup window: must still be stored --
        // the bug this test guards against would have dropped this too.
        assert_eq!(store.record_samples(&[cost_sample(15.00, now)]).unwrap(), 1);
    }

    // ── Phase 4A.1: dedup must preserve semantic differences ────────────
    // docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md "Phase 4A.1" section,
    // owner sections 9/10. Same numeric value, different currency/
    // quantity-kind/measurement-kind/account must never collapse into one
    // row -- "5 USD Spend" != "5 EUR Spend" != "5 USD Balance" != "5 USD
    // Cumulative Spend" vs "5 USD PointInTime Spend".

    #[allow(
        clippy::too_many_arguments,
        reason = "test fixture constructor mirrors the real row's column count"
    )]
    fn semantic_cost_sample(
        account: &str,
        cost: f64,
        currency: &str,
        quantity_kind: &str,
        measurement_kind: &str,
        at: i64,
    ) -> UsageSample {
        UsageSample {
            account_id: account.to_string(),
            account_scope: None,
            provider: "claude".to_string(),
            window_id: Some("cost".to_string()),
            window_key: None,
            window_label: Some("Monthly".to_string()),
            window_minutes: None,
            used_percent: 0.0,
            remaining_percent: 0.0,
            cost_used: Some(cost),
            cost_currency_code: Some(currency.to_string()),
            cost_measurement_kind: Some(measurement_kind.to_string()),
            monetary_quantity_kind: Some(quantity_kind.to_string()),
            resets_at: None,
            captured_at: at,
        }
    }

    #[test]
    fn dedup_same_value_and_semantics_still_dedups_per_existing_timing_rules() {
        let store = store();
        let now = now_epoch();
        let s = semantic_cost_sample("a1", 5.0, "USD", "spend", "cumulative", now);
        assert_eq!(store.record_samples(std::slice::from_ref(&s)).unwrap(), 1);
        assert_eq!(
            store.record_samples(&[s]).unwrap(),
            0,
            "identical semantics + value + within window must still dedup"
        );
    }

    #[test]
    fn dedup_same_value_different_currency_never_collapses() {
        let store = store();
        let now = now_epoch();
        let usd = semantic_cost_sample("a1", 5.0, "USD", "spend", "cumulative", now);
        let eur = semantic_cost_sample("a1", 5.0, "EUR", "spend", "cumulative", now);
        assert_eq!(store.record_samples(&[usd]).unwrap(), 1);
        assert_eq!(
            store.record_samples(&[eur]).unwrap(),
            1,
            "5 USD Spend and 5 EUR Spend are different facts -- must not dedup"
        );
    }

    #[test]
    fn dedup_same_value_different_quantity_kind_never_collapses() {
        let store = store();
        let now = now_epoch();
        let spend = semantic_cost_sample("a1", 5.0, "USD", "spend", "cumulative", now);
        let balance = semantic_cost_sample("a1", 5.0, "USD", "balance", "cumulative", now);
        assert_eq!(store.record_samples(&[spend]).unwrap(), 1);
        assert_eq!(
            store.record_samples(&[balance]).unwrap(),
            1,
            "5 USD Spend and 5 USD Balance are different facts -- must not dedup"
        );
    }

    #[test]
    fn dedup_same_value_different_measurement_kind_never_collapses() {
        let store = store();
        let now = now_epoch();
        let cumulative = semantic_cost_sample("a1", 5.0, "USD", "spend", "cumulative", now);
        let point_in_time = semantic_cost_sample("a1", 5.0, "USD", "spend", "point_in_time", now);
        assert_eq!(store.record_samples(&[cumulative]).unwrap(), 1);
        assert_eq!(
            store.record_samples(&[point_in_time]).unwrap(),
            1,
            "5 USD Cumulative Spend and 5 USD PointInTime Spend are different facts -- must not dedup"
        );
    }

    #[test]
    fn dedup_same_value_different_account_never_collapses() {
        let store = store();
        let now = now_epoch();
        let a1 = semantic_cost_sample("a1", 5.0, "USD", "spend", "cumulative", now);
        let a2 = semantic_cost_sample("a2", 5.0, "USD", "spend", "cumulative", now);
        assert_eq!(store.record_samples(&[a1]).unwrap(), 1);
        assert_eq!(
            store.record_samples(&[a2]).unwrap(),
            1,
            "same value on a different account is a different fact -- must not dedup"
        );
    }

    #[test]
    fn dedup_none_vs_known_semantic_never_silently_collapses() {
        let store = store();
        let now = now_epoch();
        let legacy_unknown = UsageSample {
            account_id: "a1".to_string(),
            account_scope: None,
            provider: "claude".to_string(),
            window_id: Some("cost".to_string()),
            window_key: None,
            window_label: Some("Monthly".to_string()),
            window_minutes: None,
            used_percent: 0.0,
            remaining_percent: 0.0,
            cost_used: Some(5.0),
            cost_currency_code: None,
            cost_measurement_kind: None,
            monetary_quantity_kind: None,
            resets_at: None,
            captured_at: now,
        };
        let known = semantic_cost_sample("a1", 5.0, "USD", "spend", "cumulative", now);
        assert_eq!(store.record_samples(&[legacy_unknown]).unwrap(), 1);
        assert_eq!(
            store.record_samples(&[known]).unwrap(),
            1,
            "an untagged legacy row and a semantically-known row with the same numeric value must not silently collapse"
        );
    }

    #[test]
    fn filters_by_account_and_provider() {
        let store = store();
        let now = now_epoch();
        store
            .record_samples(&[
                sample("a1", "claude", "session", 10.0, now),
                sample("a2", "codex", "weekly", 20.0, now),
            ])
            .unwrap();

        let by_account = store
            .query(&HistoryQuery {
                account_ids: vec!["a2".into()],
                ..Default::default()
            })
            .unwrap();
        assert_eq!(by_account.len(), 1);
        assert_eq!(by_account[0].provider, "codex");

        let by_provider = store
            .query(&HistoryQuery {
                providers: vec!["claude".into()],
                ..Default::default()
            })
            .unwrap();
        assert_eq!(by_provider.len(), 1);
        assert_eq!(by_provider[0].account_id, "a1");
    }

    #[test]
    fn prunes_by_retention_and_clears_selectively() {
        let store = store();
        let now = now_epoch();
        store
            .record_samples(&[
                sample("a1", "claude", "session", 10.0, now - 90 * 86_400 - 10),
                sample("a1", "claude", "session", 20.0, now),
                sample("a2", "codex", "weekly", 30.0, now),
            ])
            .unwrap();
        assert_eq!(store.prune(DEFAULT_RETENTION_DAYS).unwrap(), 1);
        assert_eq!(store.row_count().unwrap(), 2);

        assert_eq!(store.clear_accounts(&["a2".to_string()]).unwrap(), 1);
        assert_eq!(store.row_count().unwrap(), 1);
        assert_eq!(store.clear_all().unwrap(), 1);
        assert_eq!(store.row_count().unwrap(), 0);
    }

    #[test]
    fn history_store_uses_quotaarc_dir() {
        let path = HistoryStore::path().expect("path");
        let name = path.file_name().unwrap().to_string_lossy();
        assert_eq!(name, "history.db");
        assert!(
            path.to_string_lossy()
                .contains(if cfg!(feature = "dev-channel") {
                    "QuotaArc-Dev"
                } else {
                    "QuotaArc"
                })
        );
    }
}
