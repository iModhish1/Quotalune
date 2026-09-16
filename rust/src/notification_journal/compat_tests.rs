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
    use sha2::{Digest, Sha256};
    let source = include_str!("legacy_v0_11_0.rs");
    let body_start = source.find(")]\n\n").expect("allowance header") + 4;
    let digest = format!("{:x}", Sha256::digest(&source.as_bytes()[body_start..]));
    assert_eq!(
        digest, "6b6c3355ebdd08619c80a235986998f950907aa11d041b71ff0d8dffb97084a7",
        "legacy_v0_11_0.rs body drifted from published 0.11.0 c1902e9a"
    );
    assert!(source.contains("c1902e9a3df6c8c11eab2a2afae64cf03e5271bd"));
    assert!(source.contains("const SCHEMA_VERSION: i64 = 1;"));
}

#[test]
fn published_reader_never_enumerates_drops_or_rebuilds_tables() {
    let body = include_str!("legacy_v0_11_0.rs");
    for forbidden in [
        "DROP TABLE",
        "DROP INDEX",
        "VACUUM",
        "sqlite_master",
        "ALTER TABLE",
    ] {
        assert!(!body.contains(forbidden), "{forbidden}");
    }
    // Its only DDL runs when user_version is 0 (a brand-new file).
    assert_eq!(body.matches("CREATE TABLE").count(), 2);
    assert!(body.contains("if version == 0 {"));
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
    // Exactly what the unpublished Wave 2B Dev build (c98d339a..627c0e29) wrote:
    // every category it knew, hashed account refs, one read row, one baseline.
    let hash = "a".repeat(64);
    let rows = [
        (
            "\"scheduledResetObserved\"",
            "weekly",
            "94.0",
            "3.0",
            "NULL",
            1,
        ),
        (
            "\"bankedResetsIncreased\"",
            "reset-credits",
            "0.0",
            "2.0",
            "NULL",
            0,
        ),
        ("\"usageHighReached\"", "weekly", "70.0", "72.0", "NULL", 0),
        (
            "\"usageCriticalReached\"",
            "weekly",
            "90.0",
            "93.0",
            "NULL",
            1,
        ),
        ("\"usageExhausted\"", "session", "100.0", "100.0", "NULL", 0),
        (
            "\"usageMilestoneReached\"",
            "session",
            "50.0",
            "51.0",
            "NULL",
            0,
        ),
        ("\"sessionDepleted\"", "session", "40.0", "100.0", "NULL", 0),
        ("\"sessionRestored\"", "session", "100.0", "3.0", "NULL", 1),
        ("\"paceWarning\"", "weekly", "NULL", "81.0", "'weekly'", 0),
        (
            "\"providerStatusIssue\"",
            "status",
            "NULL",
            "NULL",
            "'needsAuthentication'",
            1,
        ),
        (
            "\"pricingPeriodChanged\"",
            "pricing",
            "NULL",
            "NULL",
            "'peak'",
            0,
        ),
        ("\"someFutureKind\"", "weekly", "NULL", "NULL", "NULL", 0),
    ];
    let inserts: String = rows
        .iter()
        .enumerate()
        .map(|(i, (kind, window, prev, cur, detail, read))| {
            let t = 1_000 + i64::try_from(i).unwrap();
            format!("INSERT INTO notification_events (provider_id,account_ref,window_key,kind,detected_at,received_at,observed_from,observed_to,previous_value,current_value,detail,is_read) VALUES ('codex','{hash}','{window}','{kind}',{t},{t},{t},{t},{prev},{cur},{detail},{read});")
        })
        .collect();
    Connection::open(&path).unwrap().execute_batch(&format!(
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
        {inserts}
        INSERT INTO notification_baselines VALUES ('lane','{{\"type\":\"quota\",\"usedPercent\":3.0,\"resetsAt\":null,\"observedAt\":1000}}',1000);
        PRAGMA user_version = 2;")).unwrap();

    let current = NotificationJournal::at(path.clone());
    let page = current
        .page(&NotificationQuery {
            limit: Some(100),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(
        page.items.len(),
        11,
        "future kind hidden, all Wave 2B categories kept"
    );
    for (i, (kind, window, prev, cur, detail, read)) in rows.iter().enumerate().take(11) {
        let id = i64::try_from(i + 1).unwrap();
        let event = current
            .event(id)
            .unwrap()
            .unwrap_or_else(|| panic!("row {id} missing"));
        let expected_kind: JournalEventKind = serde_json::from_str(kind).unwrap();
        assert_eq!(event.kind, expected_kind);
        assert_eq!(event.severity, expected_kind.severity());
        assert_eq!(event.window_key, *window);
        let num = |v: &str| (v != "NULL").then(|| v.parse::<f64>().unwrap());
        assert_eq!(event.previous_value, num(prev), "{kind}");
        assert_eq!(event.current_value, num(cur), "{kind}");
        assert_eq!(
            event.detail.as_deref(),
            (*detail != "NULL").then(|| detail.trim_matches('\'')),
            "{kind}"
        );
        assert_eq!(event.is_read, *read == 1, "{kind}");
        assert_eq!(event.account_ref.as_deref(), Some(hash.as_str()));
        assert_eq!(
            (event.detected_at, event.received_at),
            (1_000 + id - 1, 1_000 + id - 1)
        );
        assert!(NotificationManager_destination_ok(&event));
    }
    assert_eq!(page.unread_count, 7);
    drop(current);

    assert_eq!(user_version(&path), 1);
    assert!(table_sql(&path, "notification_events").contains("previous_value REAL NOT NULL"));
    assert!(!table_sql(&path, "notification_events").contains("detail"));
    let legacy = LegacyJournal::at(path.clone());
    let legacy_page = legacy
        .page(&super::legacy_v0_11_0::NotificationQuery::default())
        .unwrap();
    assert_eq!(
        legacy_page.items.len(),
        2,
        "0.11.0 sees exactly the two observation rows"
    );
    assert_eq!(legacy_page.items[0].id, 2);
    assert_eq!(legacy_page.items[1].id, 1);
    assert!(legacy_page.items[1].is_read);
    assert_eq!(baselines(&path).len(), 1);
    let future: i64 = Connection::open(&path)
        .unwrap()
        .query_row("SELECT COUNT(*) FROM quotalis_notification_records WHERE kind='\"someFutureKind\"' AND id=12", [], |r| r.get(0))
        .unwrap();
    assert_eq!(future, 1, "unknown kind moved intact with its id");
}

#[allow(non_snake_case, reason = "helper name mirrors the type it validates")]
fn NotificationManager_destination_ok(event: &NotificationEvent) -> bool {
    crate::notifications::NotificationManager::history_destination(event).is_some()
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
    for round in 0..10 {
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
        let schema: Vec<String> = {
            let mut st = c
                .prepare("SELECT COALESCE(sql,'') FROM sqlite_master ORDER BY name")
                .unwrap();
            st.query_map([], |r| r.get(0))
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap()
        };
        let ids: Vec<i64> = page.items.iter().map(|e| e.id).collect();
        let component: i64 = c
            .query_row(
                "SELECT version FROM quotalis_storage_version WHERE component='notification_records'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let seq: i64 = c
            .query_row(
                "SELECT seq FROM sqlite_sequence WHERE name='notification_events'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        snapshots.push((
            ids,
            page.unread_count,
            user_version(&path),
            schema,
            component,
            seq,
            baselines(&path),
        ));
    }
    assert!(
        snapshots.windows(2).all(|w| w[0] == w[1]),
        "schema or data churned across opens"
    );
    assert_eq!(snapshots[0].0.len(), 12);
    assert_eq!(snapshots[0].2, 1);
    assert_eq!(
        snapshots[0]
            .3
            .iter()
            .filter(|sql| sql.starts_with("CREATE TABLE"))
            .count(),
        5,
        "events, baselines, records, storage_version and SQLite's own sqlite_sequence"
    );
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
fn every_canonical_provider_id_round_trips_and_is_found_by_its_filter() {
    let (_dir, path) = temp_db();
    let current = NotificationJournal::at(path.clone());
    for (index, provider) in ProviderId::all().iter().enumerate() {
        let id = provider.cli_name();
        assert_eq!(ProviderId::from_cli_name(id), Some(*provider), "{id}");
        assert_eq!(
            ProviderId::from_cli_name(id).unwrap().cli_name(),
            id,
            "{id}"
        );
        current
            .record_notification(
                *provider,
                "",
                "weekly",
                record(
                    JournalEventKind::UsageHighReached,
                    Some(70.0),
                    Some(71.0),
                    None,
                    100 + i64::try_from(index).unwrap(),
                ),
            )
            .unwrap();
    }
    for provider in ProviderId::all() {
        let page = current
            .page(&NotificationQuery {
                provider_id: Some(provider.cli_name().into()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(page.items.len(), 1, "{}", provider.cli_name());
        assert_eq!(page.items[0].provider_id, provider.cli_name());
    }
    for bad in ["invented", "", "codex; DROP TABLE x"] {
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
}

/// Logical identity of an event, independent of which table holds it.
fn logical_key(e: &NotificationEvent) -> (String, String, JournalEventKind, i64, i64, i64) {
    (
        e.provider_id.clone(),
        e.window_key.clone(),
        e.kind,
        e.received_at,
        e.observed_from,
        e.observed_to,
    )
}

#[test]
fn legacy_writer_after_rollback_full_lifecycle() {
    let (_dir, path) = temp_db();
    // A-B. v0.11 fixture written by v0.11 code.
    let originals = write_legacy_fixture(&path);
    // C-D. current migrates and writes Wave 2 records.
    let current = NotificationJournal::at(path.clone());
    let records = write_every_category(&current, 10_000);
    assert!(current.mark_read(records[1].id).unwrap());
    let before_rollback = current
        .page(&NotificationQuery {
            limit: Some(100),
            ..Default::default()
        })
        .unwrap();
    drop(current);
    // E-F. v0.11 reopens and WRITES (observe + read-state mutations).
    let legacy = LegacyJournal::at(path.clone());
    legacy
        .observe(
            ProviderId::Claude,
            "acct-b",
            "weekly",
            legacy_quota(85.0, 900_000, Some(950_000)),
            900_000,
        )
        .unwrap();
    let rollback_row = legacy
        .observe(
            ProviderId::Claude,
            "acct-b",
            "weekly",
            legacy_quota(1.0, 951_000, Some(1_500_000)),
            951_000,
        )
        .unwrap()
        .expect("scheduled reset observed by 0.11.0");
    let legacy_page = legacy
        .page(&super::legacy_v0_11_0::NotificationQuery {
            limit: Some(100),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(legacy_page.items.len(), originals.len() + 1);
    let max_record_id = records.iter().map(|r| r.id).max().unwrap();
    assert!(
        rollback_row.id > max_record_id,
        "0.11.0 continued above every record id"
    );
    assert!(legacy.mark_read(rollback_row.id).unwrap());
    assert!(
        !legacy.mark_read(records[0].id).unwrap(),
        "record ids are invisible to 0.11.0"
    );
    drop(legacy);
    // G. current reopens and merges both stores.
    let current = NotificationJournal::at(path.clone());
    let after = current
        .page(&NotificationQuery {
            limit: Some(100),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(after.items.len(), before_rollback.items.len() + 1);
    for original in &originals {
        let seen = after
            .items
            .iter()
            .find(|e| e.id == original.id)
            .expect("original row kept");
        assert_eq!(
            (seen.kind as u8, seen.is_read, seen.received_at),
            (
                serde_json::from_value::<JournalEventKind>(
                    serde_json::to_value(original.kind).unwrap()
                )
                .unwrap() as u8,
                original.is_read,
                original.received_at,
            )
        );
    }
    for record in &records {
        let seen = after
            .items
            .iter()
            .find(|e| e.id == record.id)
            .expect("current-only row kept");
        assert_eq!(seen.kind, record.kind);
        assert_eq!(seen.detail, record.detail);
        assert_eq!(seen.is_read, record.id == records[1].id);
    }
    let merged = after
        .items
        .iter()
        .find(|e| e.id == rollback_row.id)
        .expect("rollback-era row appears");
    assert!(merged.is_read && merged.kind == JournalEventKind::ScheduledResetObserved);
    let ids: Vec<i64> = after.items.iter().map(|e| e.id).collect();
    let mut unique = ids.clone();
    unique.sort_unstable();
    unique.dedup();
    assert_eq!(unique.len(), ids.len(), "no id collision");
    assert!(
        ids.windows(2).all(|w| w[0] > w[1]),
        "deterministic id order"
    );
    let again = current
        .page(&NotificationQuery {
            limit: Some(100),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(again.items, after.items, "paging is stable");
    let mut keys: Vec<String> = after
        .items
        .iter()
        .map(|e| format!("{:?}", logical_key(e)))
        .collect();
    keys.sort();
    keys.dedup();
    assert_eq!(keys.len(), after.items.len(), "no duplicate logical event");
    assert_eq!(
        after.unread_count, before_rollback.unread_count,
        "read state preserved (new row already read)"
    );
}

#[test]
fn old_writer_ids_never_collide_and_a_reset_sequence_is_repaired() {
    let (_dir, path) = temp_db();
    write_legacy_fixture(&path);
    let current = NotificationJournal::at(path.clone());
    let records = write_every_category(&current, 60_000);
    drop(current);
    let max_record = records.iter().map(|r| r.id).max().unwrap();
    // Normal case: SQLite consults sqlite_sequence for the legacy table no
    // matter who inserts, so 0.11.0 starts above the records.
    let legacy = LegacyJournal::at(path.clone());
    for t in 0..3_u8 {
        legacy
            .observe(
                ProviderId::Codex,
                "acct-z",
                "session",
                legacy_quota(90.0 - f64::from(t) * 30.0, 700_000 + i64::from(t), None),
                700_000 + i64::from(t),
            )
            .unwrap();
    }
    drop(legacy);
    let ids: Vec<i64> = Connection::open(&path)
        .unwrap()
        .prepare("SELECT id FROM notification_events WHERE received_at >= 700000")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert!(
        !ids.is_empty() && ids.iter().all(|id| *id > max_record),
        "{ids:?}"
    );

    // Records now sit above the legacy table's own max rowid, which is the
    // only arrangement in which a wiped sequence can make 0.11.0 reuse an id.
    let current = NotificationJournal::at(path.clone());
    let upper = write_every_category(&current, 80_000);
    drop(current);
    let legacy_max: i64 = Connection::open(&path)
        .unwrap()
        .query_row("SELECT MAX(id) FROM notification_events", [], |r| r.get(0))
        .unwrap();
    assert!(upper.iter().all(|r| r.id > legacy_max));

    // Hostile case: the sequence row is wiped outside Quotalis, so a 0.11.0
    // insert reuses a record id at the raw level.
    Connection::open(&path)
        .unwrap()
        .execute(
            "DELETE FROM sqlite_sequence WHERE name='notification_events'",
            [],
        )
        .unwrap();
    let legacy = LegacyJournal::at(path.clone());
    legacy
        .observe(
            ProviderId::Codex,
            "acct-y",
            "session",
            legacy_quota(90.0, 800_000, None),
            800_000,
        )
        .unwrap();
    let collided = legacy
        .observe(
            ProviderId::Codex,
            "acct-y",
            "session",
            legacy_quota(0.0, 800_001, None),
            800_001,
        )
        .unwrap()
        .unwrap();
    drop(legacy);
    let raw_collisions: i64 = Connection::open(&path).unwrap().query_row(
        "SELECT COUNT(*) FROM notification_events e JOIN quotalis_notification_records r ON r.id=e.id", [], |r| r.get(0)).unwrap();
    assert!(
        raw_collisions >= 1,
        "the hostile setup really collides ({} at id {})",
        raw_collisions,
        collided.id
    );
    let records_before: i64 = Connection::open(&path)
        .unwrap()
        .query_row(
            "SELECT COUNT(*) FROM quotalis_notification_records",
            [],
            |r| r.get(0),
        )
        .unwrap();

    // Current open repairs: legacy row untouched, record moved above everything.
    let current = NotificationJournal::at(path.clone());
    let page = current
        .page(&NotificationQuery {
            limit: Some(100),
            ..Default::default()
        })
        .unwrap();
    let ids: Vec<i64> = page.items.iter().map(|e| e.id).collect();
    let mut unique = ids.clone();
    unique.sort_unstable();
    unique.dedup();
    assert_eq!(unique.len(), ids.len());
    let at_collided = current.event(collided.id).unwrap().unwrap();
    assert_eq!(
        at_collided.kind,
        JournalEventKind::UnexpectedQuotaChange,
        "legacy row keeps its id"
    );
    let records_after: i64 = Connection::open(&path)
        .unwrap()
        .query_row(
            "SELECT COUNT(*) FROM quotalis_notification_records",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        records_after, records_before,
        "no record lost or duplicated"
    );
    let raw_collisions: i64 = Connection::open(&path).unwrap().query_row(
        "SELECT COUNT(*) FROM notification_events e JOIN quotalis_notification_records r ON r.id=e.id", [], |r| r.get(0)).unwrap();
    assert_eq!(raw_collisions, 0);
    let total = page.items.len();
    drop(current);
    // and the repair is not repeated
    let current = NotificationJournal::at(path);
    assert_eq!(
        current
            .page(&NotificationQuery {
                limit: Some(100),
                ..Default::default()
            })
            .unwrap()
            .items
            .len(),
        total
    );
}

#[test]
fn legacy_read_state_mutations_after_rollback_touch_only_legacy_rows() {
    let (_dir, path) = temp_db();
    let originals = write_legacy_fixture(&path);
    let current = NotificationJournal::at(path.clone());
    let records = write_every_category(&current, 70_000);
    drop(current);
    // 0.11.0 supports mark_read / mark_all_read and retention deletes on its
    // own table; it has no clear/delete-history action.
    let legacy = LegacyJournal::at(path.clone());
    let page = legacy
        .page(&super::legacy_v0_11_0::NotificationQuery::default())
        .unwrap();
    let marked = legacy.mark_all_read(page.through_id).unwrap();
    assert_eq!(marked, 2, "only the two unread legacy rows");
    assert!(!legacy.mark_read(records[0].id).unwrap());
    drop(legacy);
    let current = NotificationJournal::at(path);
    for original in &originals {
        assert!(current.event(original.id).unwrap().unwrap().is_read);
    }
    for record in &records {
        let seen = current.event(record.id).unwrap().unwrap();
        assert!(!seen.is_read, "records stay unread: 0.11.0 cannot see them");
        assert_eq!(seen.kind, record.kind);
        assert_eq!(seen.detail, record.detail);
    }
}
