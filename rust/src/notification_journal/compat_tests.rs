//! Rollback safety: the frozen published 0.11.0 reader (`legacy_v0_11_0`)
//! must keep reading a history file after this version has migrated it and
//! written every notification category. Temporary files only.
use super::legacy_v0_11_0::NotificationJournal as LegacyJournal;
use super::*;
use rusqlite::Connection;
use std::path::{Path, PathBuf};

fn temp_db() -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("notifications.db");
    (dir, path)
}

type LegacyObservation = super::legacy_v0_11_0::ResetObservation;

/// Legacy-typed observation for the frozen reader.
fn legacy_quota(value: f64, time: i64, reset: Option<i64>) -> LegacyObservation {
    LegacyObservation::Quota {
        used_percent: value,
        resets_at: reset,
        observed_at: time,
    }
}

fn legacy_banked(value: u32, time: i64) -> LegacyObservation {
    LegacyObservation::Banked {
        available: value,
        observed_at: time,
    }
}

fn quota(value: f64, time: i64, reset: Option<i64>) -> ResetObservation {
    ResetObservation::Quota {
        used_percent: value,
        resets_at: reset,
        observed_at: time,
    }
}

fn record(
    kind: JournalEventKind,
    previous: Option<f64>,
    current: Option<f64>,
    detail: Option<&'static str>,
    at: i64,
) -> NotificationRecord {
    NotificationRecord {
        kind,
        previous_value: previous,
        current_value: current,
        detail,
        observed_at: at,
    }
}

/// A v0.11.0-style file, written by the frozen v0.11.0 code itself: two
/// observation events (one marked read), one banked event and three baselines.
fn write_legacy_fixture(path: &Path) -> Vec<super::legacy_v0_11_0::NotificationEvent> {
    let legacy = LegacyJournal::at(path.to_path_buf());
    legacy
        .observe(
            ProviderId::Codex,
            "acct-a",
            "weekly",
            legacy_quota(90.0, 1_000, Some(5_000)),
            1_010,
        )
        .unwrap();
    let reset = legacy
        .observe(
            ProviderId::Codex,
            "acct-a",
            "weekly",
            legacy_quota(2.0, 6_000, Some(600_000)),
            6_100,
        )
        .unwrap()
        .unwrap();
    legacy
        .observe(
            ProviderId::Claude,
            "",
            "session",
            legacy_quota(80.0, 2_000, None),
            2_000,
        )
        .unwrap();
    let change = legacy
        .observe(
            ProviderId::Claude,
            "",
            "session",
            legacy_quota(10.0, 3_000, None),
            3_000,
        )
        .unwrap()
        .unwrap();
    legacy
        .observe(
            ProviderId::Codex,
            "acct-a",
            "reset-credits",
            legacy_banked(0, 4_000),
            4_000,
        )
        .unwrap();
    let credit = legacy
        .observe(
            ProviderId::Codex,
            "acct-a",
            "reset-credits",
            legacy_banked(2, 4_500),
            4_500,
        )
        .unwrap()
        .unwrap();
    assert!(legacy.mark_read(reset.id).unwrap());
    let page = legacy
        .page(&super::legacy_v0_11_0::NotificationQuery::default())
        .unwrap();
    assert_eq!(page.items.len(), 3);
    assert_eq!(page.unread_count, 2);
    let _ = (change, credit);
    page.items
}

fn user_version(path: &Path) -> i64 {
    Connection::open(path)
        .unwrap()
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap()
}

fn table_sql(path: &Path, name: &str) -> String {
    Connection::open(path)
        .unwrap()
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?1",
            [name],
            |row| row.get(0),
        )
        .unwrap()
}

fn baselines(path: &Path) -> Vec<(String, String, i64)> {
    let connection = Connection::open(path).unwrap();
    let mut statement = connection
        .prepare("SELECT lane,observation,received_at FROM notification_baselines ORDER BY lane")
        .unwrap();
    statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap()
}

/// Every issued category this version can write, with realistic values.
fn write_every_category(store: &NotificationJournal, base: i64) -> Vec<NotificationEvent> {
    use JournalEventKind::*;
    [
        (UsageHighReached, Some(70.0), Some(72.5), None, "weekly"),
        (UsageCriticalReached, Some(90.0), Some(93.0), None, "weekly"),
        (UsageExhausted, Some(100.0), Some(100.0), None, "session"),
        (
            UsageMilestoneReached,
            Some(50.0),
            Some(51.0),
            None,
            "session",
        ),
        (SessionDepleted, Some(40.0), Some(100.0), None, "session"),
        (SessionRestored, Some(100.0), Some(3.0), None, "session"),
        (PaceWarning, None, Some(81.0), Some("weekly"), "weekly"),
        (
            ProviderStatusIssue,
            None,
            None,
            Some("needsAuthentication"),
            "status",
        ),
        (PricingPeriodChanged, None, None, Some("peak"), "pricing"),
    ]
    .into_iter()
    .enumerate()
    .map(|(index, (kind, previous, current, detail, window))| {
        store
            .record_notification(
                ProviderId::Codex,
                "acct-a",
                window,
                record(
                    kind,
                    previous,
                    current,
                    detail,
                    base + i64::try_from(index).unwrap(),
                ),
            )
            .unwrap()
    })
    .collect()
}

#[test]
fn frozen_legacy_reader_is_the_published_source() {
    let source = include_str!("legacy_v0_11_0.rs");
    assert!(source.contains("const SCHEMA_VERSION: i64 = 1;"));
    assert!(source.contains("previous_value REAL NOT NULL"));
    assert!(source.contains("version > SCHEMA_VERSION"));
}

#[test]
fn legacy_reader_rejects_the_wave2b_layout_for_three_independent_reasons() {
    // 1. user_version 2 alone is rejected before any table is read.
    let (_dir, path) = temp_db();
    write_legacy_fixture(&path);
    Connection::open(&path)
        .unwrap()
        .pragma_update(None, "user_version", 2)
        .unwrap();
    assert!(
        LegacyJournal::at(path.clone())
            .page(&super::legacy_v0_11_0::NotificationQuery::default())
            .is_err()
    );
    Connection::open(&path)
        .unwrap()
        .pragma_update(None, "user_version", 1)
        .unwrap();
    // 2. A non-legacy kind fails legacy row decoding (whole page errors).
    Connection::open(&path).unwrap().execute(
        "INSERT INTO notification_events (provider_id,window_key,kind,detected_at,received_at,observed_from,observed_to,previous_value,current_value)
         VALUES ('codex','weekly','\"usageHighReached\"',9,9,9,9,70,72)", []).unwrap();
    assert!(
        LegacyJournal::at(path.clone())
            .page(&super::legacy_v0_11_0::NotificationQuery::default())
            .is_err()
    );
    Connection::open(&path)
        .unwrap()
        .execute(
            "DELETE FROM notification_events WHERE kind='\"usageHighReached\"'",
            [],
        )
        .unwrap();
    // 3. A NULL value cannot be read into the legacy f64 field.
    Connection::open(&path).unwrap().execute_batch(
        "CREATE TABLE t AS SELECT * FROM notification_events; DROP TABLE notification_events;
         CREATE TABLE notification_events (id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id TEXT NOT NULL, account_ref TEXT, window_key TEXT NOT NULL,
            kind TEXT NOT NULL, occurred_at INTEGER, detected_at INTEGER NOT NULL, received_at INTEGER NOT NULL, observed_from INTEGER NOT NULL,
            observed_to INTEGER NOT NULL, previous_value REAL, current_value REAL, is_read INTEGER NOT NULL DEFAULT 0);
         INSERT INTO notification_events SELECT * FROM t; DROP TABLE t;
         INSERT INTO notification_events (provider_id,window_key,kind,detected_at,received_at,observed_from,observed_to,previous_value,current_value)
         VALUES ('codex','weekly','\"scheduledResetObserved\"',9,9,9,9,NULL,NULL);").unwrap();
    assert!(
        LegacyJournal::at(path)
            .page(&super::legacy_v0_11_0::NotificationQuery::default())
            .is_err()
    );
}

#[test]
fn rollback_drill_legacy_to_current_to_legacy_reader() {
    let (_dir, path) = temp_db();
    // 1-2. legacy fixture, verified by the frozen reader
    let legacy_rows = write_legacy_fixture(&path);
    let legacy_baselines = baselines(&path);
    assert_eq!(legacy_baselines.len(), 3);
    let legacy_schema = table_sql(&path, "notification_events");

    // 3. current migrate (open)
    let current = NotificationJournal::at(path.clone());
    let page = current.page(&NotificationQuery::default()).unwrap();
    assert_eq!(page.items.len(), 3);
    assert_eq!(page.unread_count, 2);
    assert_eq!(user_version(&path), 1);

    // 4. current writes: every issued category plus a new observation
    let written = write_every_category(&current, 10_000);
    assert_eq!(written.len(), 9);
    current
        .observe(
            ProviderId::Codex,
            "acct-a",
            "weekly",
            quota(1.0, 700_000, Some(1_200_000)),
            700_100,
        )
        .unwrap()
        .expect("reset after baseline");
    assert!(current.mark_read(written[0].id).unwrap());
    drop(current);

    // 5. current restart
    let current = NotificationJournal::at(path.clone());
    let all = current
        .page(&NotificationQuery {
            limit: Some(100),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(all.items.len(), 3 + 9 + 1);
    let mut ids: Vec<i64> = all.items.iter().map(|e| e.id).collect();
    ids.dedup();
    assert_eq!(ids.len(), 13, "ids are unique across both tables");
    assert!(ids.windows(2).all(|w| w[0] > w[1]), "descending id order");
    drop(current);

    // 6. frozen old reader reopens the same file
    assert_eq!(user_version(&path), 1);
    assert_eq!(table_sql(&path, "notification_events"), legacy_schema);
    let legacy = LegacyJournal::at(path.clone());
    let legacy_page = legacy
        .page(&super::legacy_v0_11_0::NotificationQuery {
            limit: Some(100),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(
        legacy_page.items.len(),
        4,
        "3 original + 1 new observation, no issued records"
    );
    for original in &legacy_rows {
        let seen = legacy_page
            .items
            .iter()
            .find(|e| e.id == original.id)
            .unwrap();
        assert_eq!(seen, original, "legacy row preserved byte-for-byte");
    }
    assert_eq!(legacy_page.unread_count, 3);
    // the old reader keeps working: it can observe and mark read
    let newer = legacy
        .observe(
            ProviderId::Codex,
            "acct-a",
            "reset-credits",
            legacy_banked(5, 800_000),
            800_000,
        )
        .unwrap()
        .unwrap();
    assert!(
        newer.id > ids[0],
        "legacy inserts continue the shared sequence"
    );
    assert!(legacy.mark_read(newer.id).unwrap());
    drop(legacy);

    // 7-8. current reopens and still sees everything, including the old reader's new row
    let current = NotificationJournal::at(path.clone());
    let after = current
        .page(&NotificationQuery {
            limit: Some(100),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(after.items.len(), 14);
    assert!(after.items.iter().any(|e| e.id == newer.id && e.is_read));
    assert!(
        after
            .items
            .iter()
            .any(|e| e.kind == JournalEventKind::ProviderStatusIssue
                && e.detail.as_deref() == Some("needsAuthentication")
                && e.previous_value.is_none())
    );
    assert!(
        after
            .items
            .iter()
            .any(|e| e.id == written[0].id && e.is_read)
    );
    let kept = baselines(&path);
    assert!(
        legacy_baselines
            .iter()
            .all(|b| kept.contains(b) || kept.iter().any(|k| k.0 == b.0))
    );
}

#[test]
fn wave2b_layout_converts_back_to_the_legacy_layout_without_losing_anything() {
    let (_dir, path) = temp_db();
    // Exactly what the short-lived Wave 2B build (627c0e29) wrote.
    Connection::open(&path).unwrap().execute_batch(
        "CREATE TABLE notification_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id TEXT NOT NULL, account_ref TEXT, window_key TEXT NOT NULL,
            kind TEXT NOT NULL, occurred_at INTEGER, detected_at INTEGER NOT NULL,
            received_at INTEGER NOT NULL, observed_from INTEGER NOT NULL,
            observed_to INTEGER NOT NULL, previous_value REAL,
            current_value REAL, detail TEXT, is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1))
        );
        CREATE INDEX notification_unread ON notification_events(is_read, id);
        CREATE TABLE notification_baselines (lane TEXT PRIMARY KEY, observation TEXT NOT NULL, received_at INTEGER NOT NULL);
        INSERT INTO notification_events (provider_id,window_key,kind,detected_at,received_at,observed_from,observed_to,previous_value,current_value,detail,is_read)
            VALUES ('codex','weekly','\"scheduledResetObserved\"',1000,1000,900,1000,94.0,3.0,NULL,1),
                   ('codex','weekly','\"usageHighReached\"',2000,2000,2000,2000,70.0,72.0,NULL,0),
                   ('codex','status','\"providerStatusIssue\"',3000,3000,3000,3000,NULL,NULL,'needsAuthentication',1),
                   ('codex','weekly','\"someFutureKind\"',4000,4000,4000,4000,NULL,NULL,NULL,0);
        INSERT INTO notification_baselines VALUES ('lane','{\"type\":\"quota\",\"usedPercent\":3.0,\"resetsAt\":null,\"observedAt\":1000}',1000);
        PRAGMA user_version = 2;").unwrap();
    let current = NotificationJournal::at(path.clone());
    let page = current.page(&NotificationQuery::default()).unwrap();
    assert_eq!(page.items.len(), 3, "future kind hidden, others kept");
    assert_eq!(page.items[0].id, 3);
    assert_eq!(page.items[0].detail.as_deref(), Some("needsAuthentication"));
    assert!(page.items[0].is_read);
    assert_eq!(page.items[1].kind, JournalEventKind::UsageHighReached);
    assert_eq!(page.items[2].id, 1);
    assert!(page.items[2].is_read);
    assert_eq!(page.unread_count, 1);
    drop(current);
    assert_eq!(user_version(&path), 1);
    assert!(table_sql(&path, "notification_events").contains("previous_value REAL NOT NULL"));
    assert!(!table_sql(&path, "notification_events").contains("detail"));
    let legacy = LegacyJournal::at(path.clone());
    let legacy_page = legacy
        .page(&super::legacy_v0_11_0::NotificationQuery::default())
        .unwrap();
    assert_eq!(legacy_page.items.len(), 1);
    assert_eq!(legacy_page.items[0].id, 1);
    assert!(legacy_page.items[0].is_read);
    assert_eq!(baselines(&path).len(), 1);
    // the future kind row was moved intact and is still stored
    let future: i64 = Connection::open(&path)
        .unwrap()
        .query_row(
            "SELECT COUNT(*) FROM quotalis_notification_records WHERE kind='\"someFutureKind\"'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(future, 1);
}

#[test]
fn migration_is_atomic_at_every_interruption_point() {
    for step in [
        MigrationStep::AfterAdditiveTables,
        MigrationStep::AfterRowMove,
        MigrationStep::AfterLegacyRebuild,
        MigrationStep::BeforeCommit,
    ] {
        let (_dir, path) = temp_db();
        Connection::open(&path).unwrap().execute_batch(
            "CREATE TABLE notification_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id TEXT NOT NULL, account_ref TEXT, window_key TEXT NOT NULL,
                kind TEXT NOT NULL, occurred_at INTEGER, detected_at INTEGER NOT NULL, received_at INTEGER NOT NULL,
                observed_from INTEGER NOT NULL, observed_to INTEGER NOT NULL, previous_value REAL, current_value REAL,
                detail TEXT, is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)));
            CREATE INDEX notification_unread ON notification_events(is_read, id);
            CREATE TABLE notification_baselines (lane TEXT PRIMARY KEY, observation TEXT NOT NULL, received_at INTEGER NOT NULL);
            INSERT INTO notification_events (provider_id,window_key,kind,detected_at,received_at,observed_from,observed_to,previous_value,current_value,detail,is_read)
                VALUES ('codex','weekly','\"scheduledResetObserved\"',1000,1000,900,1000,94.0,3.0,NULL,1),
                       ('codex','status','\"providerStatusIssue\"',3000,3000,3000,3000,NULL,NULL,'unknown',0);
            INSERT INTO notification_baselines VALUES ('lane','{}',1000);
            PRAGMA user_version = 2;").unwrap();
        let before_bytes = std::fs::read(&path).unwrap();
        let before_schema: Vec<String> = {
            let c = Connection::open(&path).unwrap();
            let mut s = c
                .prepare("SELECT COALESCE(sql,'') FROM sqlite_master ORDER BY name")
                .unwrap();
            s.query_map([], |r| r.get(0))
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap()
        };
        let mut connection = NotificationJournal::open(Some(&path)).unwrap();
        assert!(
            prepare_schema(&mut connection, Some(step)).is_err(),
            "{step:?}"
        );
        drop(connection);
        let after_schema: Vec<String> = {
            let c = Connection::open(&path).unwrap();
            let mut s = c
                .prepare("SELECT COALESCE(sql,'') FROM sqlite_master ORDER BY name")
                .unwrap();
            s.query_map([], |r| r.get(0))
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap()
        };
        assert_eq!(after_schema, before_schema, "{step:?}: schema rolled back");
        assert_eq!(user_version(&path), 2, "{step:?}");
        let rows: i64 = Connection::open(&path)
            .unwrap()
            .query_row("SELECT COUNT(*) FROM notification_events", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rows, 2, "{step:?}: rows untouched");
        let _ = before_bytes;
        // and a later, uninterrupted open succeeds from that state
        let current = NotificationJournal::at(path.clone());
        assert_eq!(
            current
                .page(&NotificationQuery::default())
                .unwrap()
                .items
                .len(),
            2
        );
        drop(current);
        assert_eq!(user_version(&path), 1);
    }
}

#[test]
fn repeated_opens_are_idempotent() {
    let (_dir, path) = temp_db();
    write_legacy_fixture(&path);
    let mut snapshots = Vec::new();
    for round in 0..5 {
        let current = NotificationJournal::at(path.clone());
        if round == 0 {
            write_every_category(&current, 50_000);
        }
        let page = current
            .page(&NotificationQuery {
                limit: Some(100),
                ..Default::default()
            })
            .unwrap();
        drop(current);
        let c = Connection::open(&path).unwrap();
        let objects: i64 = c
            .query_row("SELECT COUNT(*) FROM sqlite_master", [], |r| r.get(0))
            .unwrap();
        let component: i64 = c.query_row("SELECT version FROM quotalis_storage_version WHERE component='notification_records'", [], |r| r.get(0)).unwrap();
        snapshots.push((
            page.items.len(),
            page.unread_count,
            user_version(&path),
            objects,
            component,
            baselines(&path),
        ));
    }
    assert!(snapshots.windows(2).all(|w| w[0] == w[1]), "{snapshots:?}");
    assert_eq!(snapshots[0].0, 12);
    assert_eq!(snapshots[0].2, 1);
}

#[test]
fn current_round_trip_preserves_every_field_for_every_category() {
    let (_dir, path) = temp_db();
    let written = {
        let current = NotificationJournal::at(path.clone());
        let rows = write_every_category(&current, 20_000);
        assert!(current.mark_read(rows[6].id).unwrap());
        rows
    };
    let current = NotificationJournal::at(path);
    for original in &written {
        let stored = current.event(original.id).unwrap().unwrap();
        let mut expected = original.clone();
        expected.is_read = original.id == written[6].id;
        assert_eq!(stored, expected);
        assert_eq!(stored.severity, stored.kind.severity());
        assert_ne!(stored.account_ref.as_deref(), Some("acct-a"));
        assert_eq!(stored.account_ref.as_deref().map(str::len), Some(64));
    }
    let statuses: Vec<_> = written
        .iter()
        .filter(|e| e.previous_value.is_none() && e.current_value.is_none())
        .collect();
    assert_eq!(
        statuses.len(),
        2,
        "status and pricing carry no fabricated values"
    );
}

#[test]
fn unknown_future_kinds_are_tolerated_by_the_current_reader() {
    let (_dir, path) = temp_db();
    let current = NotificationJournal::at(path.clone());
    let known = current
        .record_notification(
            ProviderId::Codex,
            "",
            "weekly",
            record(
                JournalEventKind::UsageHighReached,
                Some(70.0),
                Some(71.0),
                None,
                5,
            ),
        )
        .unwrap();
    drop(current);
    Connection::open(&path).unwrap().execute(
        "INSERT INTO quotalis_notification_records (id,provider_id,window_key,kind,detected_at,received_at,observed_from,observed_to)
         VALUES (?1,'codex','weekly','\"holographicAlert\"',9,9,9,9)", [known.id + 1]).unwrap();
    let current = NotificationJournal::at(path.clone());
    let page = current.page(&NotificationQuery::default()).unwrap();
    assert_eq!(page.items.len(), 1);
    assert_eq!(page.items[0].id, known.id);
    assert_eq!(page.unread_count, 1);
    assert_eq!(current.event(known.id + 1).unwrap(), None);
    let next = current
        .record_notification(
            ProviderId::Codex,
            "",
            "weekly",
            record(
                JournalEventKind::PaceWarning,
                None,
                Some(80.0),
                Some("weekly"),
                6,
            ),
        )
        .unwrap();
    assert!(
        next.id > known.id + 1,
        "future row's id is respected, never reused"
    );
}

#[test]
fn legacy_reader_never_sees_a_null_or_new_kind_after_any_current_write() {
    let (_dir, path) = temp_db();
    write_legacy_fixture(&path);
    let current = NotificationJournal::at(path.clone());
    write_every_category(&current, 30_000);
    drop(current);
    let c = Connection::open(&path).unwrap();
    let bad: i64 = c
        .query_row(
            "SELECT COUNT(*) FROM notification_events WHERE previous_value IS NULL OR current_value IS NULL
             OR kind NOT IN ('\"scheduledResetObserved\"','\"unexpectedQuotaChange\"','\"bankedResetsIncreased\"','\"bankedResetsDecreased\"')",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(bad, 0);
    let columns: Vec<String> = {
        let mut s = c.prepare("PRAGMA table_info(notification_events)").unwrap();
        s.query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap()
    };
    assert!(!columns.contains(&"detail".to_string()));
}

#[test]
fn unregistered_provider_filters_are_rejected_and_stored_rows_stay_intact() {
    let (_dir, path) = temp_db();
    let current = NotificationJournal::at(path.clone());
    write_every_category(&current, 40_000);
    for bad in ["invented", "CODEX", "codex; DROP TABLE x", ""] {
        assert!(
            current
                .page(&NotificationQuery {
                    provider_id: Some(bad.into()),
                    ..Default::default()
                })
                .is_err(),
            "{bad:?}"
        );
    }
    let filtered = current
        .page(&NotificationQuery {
            provider_id: Some("codex".into()),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(filtered.items.len(), 9);
    assert!(filtered.items.iter().all(|e| e.provider_id == "codex"));
}
