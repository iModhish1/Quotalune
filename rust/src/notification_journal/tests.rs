use super::*;

fn quota(value: f64, time: i64, reset: Option<i64>) -> ResetObservation {
    ResetObservation::Quota {
        used_percent: value,
        resets_at: reset,
        observed_at: time,
    }
}

fn banked(value: u32, time: i64) -> ResetObservation {
    ResetObservation::Banked {
        available: value,
        observed_at: time,
    }
}

#[test]
fn restart_recovers_change_with_interval_not_invented_occurrence_time() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("notifications.db");
    {
        let store = NotificationJournal::at(path.clone());
        assert!(
            store
                .observe(
                    ProviderId::Codex,
                    "account-a",
                    "weekly",
                    quota(90.0, 1_000, Some(5_000)),
                    1_010
                )
                .unwrap()
                .is_none()
        );
    }
    let store = NotificationJournal::at(path);
    let event = store
        .observe(
            ProviderId::Codex,
            "account-a",
            "weekly",
            quota(2.0, 3_000, Some(5_000)),
            3_100,
        )
        .unwrap()
        .unwrap();
    assert_eq!(event.kind, JournalEventKind::UnexpectedQuotaChange);
    assert_eq!(event.occurred_at, None);
    assert_eq!(
        (event.observed_from, event.observed_to, event.received_at),
        (1_000, 3_000, 3_100)
    );
    assert!(
        store
            .observe(
                ProviderId::Codex,
                "account-a",
                "weekly",
                quota(2.0, 3_000, Some(5_000)),
                3_200
            )
            .unwrap()
            .is_none()
    );
    assert_eq!(
        store
            .page(&NotificationQuery::default())
            .unwrap()
            .unread_count,
        1
    );
}

#[test]
fn unknown_account_baselines_do_not_cross_restarts_or_known_accounts() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("notifications.db");
    NotificationJournal::at(path.clone())
        .observe(
            ProviderId::Codex,
            "",
            "weekly",
            quota(90.0, 1_000, None),
            1_010,
        )
        .unwrap();
    let store = NotificationJournal::at(path);
    assert!(
        store
            .observe(
                ProviderId::Codex,
                "",
                "weekly",
                quota(0.0, 2_000, None),
                2_010
            )
            .unwrap()
            .is_none()
    );
    assert!(
        store
            .observe(
                ProviderId::Codex,
                "new-account",
                "weekly",
                quota(0.0, 2_000, None),
                2_010
            )
            .unwrap()
            .is_none()
    );
}

#[test]
fn all_four_codex_windows_and_accounts_have_independent_history() {
    let store = NotificationJournal::in_memory();
    for account in ["one", "two"] {
        for window in [
            "fiveHour",
            "weekly",
            "extra-codex-spark",
            "extra-codex-spark-weekly",
        ] {
            store
                .observe(
                    ProviderId::Codex,
                    account,
                    window,
                    quota(80.0, 1_000, Some(2_000)),
                    1_000,
                )
                .unwrap();
            store
                .observe(
                    ProviderId::Codex,
                    account,
                    window,
                    quota(0.0, 2_000, Some(10_000)),
                    2_000,
                )
                .unwrap();
        }
    }
    let page = store.page(&NotificationQuery::default()).unwrap();
    assert_eq!(page.unread_count, 8);
    assert!(
        page.items
            .iter()
            .all(|event| event.kind == JournalEventKind::ScheduledResetObserved)
    );
    assert_ne!(page.items[0].account_ref, page.items[4].account_ref);
}

#[test]
fn banked_inventory_records_increase_and_decrease_without_claiming_expiry() {
    let store = NotificationJournal::in_memory();
    for (count, time) in [(0, 1_000), (2, 2_000), (2, 3_000), (1, 4_000)] {
        store
            .observe(
                ProviderId::Codex,
                "one",
                "reset-credits",
                banked(count, time),
                time,
            )
            .unwrap();
    }
    let page = store.page(&NotificationQuery::default()).unwrap();
    assert_eq!(page.items.len(), 2);
    assert_eq!(page.items[0].kind, JournalEventKind::BankedResetsDecreased);
    assert_eq!(page.items[1].kind, JournalEventKind::BankedResetsIncreased);
}

#[test]
fn read_state_survives_restart_and_mark_all_preserves_new_arrivals() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("notifications.db");
    let store = NotificationJournal::at(path.clone());
    for time in 1..=3 {
        store
            .observe(
                ProviderId::Codex,
                "one",
                "reset-credits",
                banked(u32::try_from(time).unwrap(), time),
                time,
            )
            .unwrap();
    }
    let page = store.page(&NotificationQuery::default()).unwrap();
    store
        .observe(ProviderId::Codex, "one", "reset-credits", banked(4, 4), 4)
        .unwrap();
    assert_eq!(store.mark_all_read(page.through_id).unwrap(), 2);
    drop(store);
    let store = NotificationJournal::at(path);
    let next = store.page(&NotificationQuery::default()).unwrap();
    assert_eq!(next.unread_count, 1);
    assert!(store.mark_read(next.items[0].id).unwrap());
    assert!(!store.mark_read(next.items[0].id).unwrap());
    assert_eq!(
        store
            .page(&NotificationQuery::default())
            .unwrap()
            .unread_count,
        0
    );
}

#[test]
fn keyset_paging_and_literal_search_preserve_order() {
    let store = NotificationJournal::in_memory();
    for time in 1..=105 {
        store
            .observe(
                ProviderId::Codex,
                "one",
                "reset-credits",
                banked(u32::try_from(time).unwrap(), time),
                time,
            )
            .unwrap();
    }
    let page = store
        .page(&NotificationQuery {
            limit: Some(100),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(page.unread_count, 104);
    assert!(page.has_more);
    let next = store
        .page(&NotificationQuery {
            before_id: Some(page.items.last().unwrap().id),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(next.items.len(), 4);
    assert!(!next.has_more);
    assert!(
        store
            .page(&NotificationQuery {
                search: "%".into(),
                ..Default::default()
            })
            .unwrap()
            .items
            .is_empty()
    );
    assert_eq!(
        store
            .page(&NotificationQuery {
                search: "reset-credits".into(),
                ..Default::default()
            })
            .unwrap()
            .items
            .len(),
        50
    );
}

#[test]
fn older_and_nonfinite_observations_do_not_rewind_baseline() {
    let store = NotificationJournal::in_memory();
    store
        .observe(
            ProviderId::Codex,
            "one",
            "weekly",
            quota(90.0, 2_000, None),
            2_000,
        )
        .unwrap();
    assert!(
        store
            .observe(
                ProviderId::Codex,
                "one",
                "weekly",
                quota(0.0, 1_000, None),
                2_100
            )
            .unwrap()
            .is_none()
    );
    assert!(
        store
            .observe(
                ProviderId::Codex,
                "one",
                "weekly",
                quota(f64::NAN, 3_000, None),
                3_000
            )
            .is_err()
    );
    assert!(
        store
            .observe(
                ProviderId::Codex,
                "one",
                "weekly",
                quota(0.0, 3_000, None),
                3_000
            )
            .unwrap()
            .is_some()
    );
}

#[test]
fn raw_account_and_credentials_never_enter_the_database() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("notifications.db");
    let account = "private-account@example.invalid";
    {
        let store = NotificationJournal::at(path.clone());
        store
            .observe(
                ProviderId::Codex,
                account,
                "weekly",
                quota(90.0, 1_000, None),
                1_000,
            )
            .unwrap();
        store
            .observe(
                ProviderId::Codex,
                account,
                "weekly",
                quota(0.0, 2_000, None),
                2_000,
            )
            .unwrap();
        assert!(
            store
                .observe(
                    ProviderId::Codex,
                    account,
                    "token=secret",
                    quota(0.0, 3_000, None),
                    3_000
                )
                .is_err()
        );
    }
    let bytes = std::fs::read(path).unwrap();
    assert!(!String::from_utf8_lossy(&bytes).contains(account));
}

#[test]
fn future_schema_and_corrupt_files_fail_without_overwriting() {
    let dir = tempfile::tempdir().unwrap();
    let future = dir.path().join("future.db");
    Connection::open(&future)
        .unwrap()
        .pragma_update(None, "user_version", 99)
        .unwrap();
    let before = std::fs::read(&future).unwrap();
    assert!(
        NotificationJournal::at(future.clone())
            .page(&NotificationQuery::default())
            .is_err()
    );
    assert_eq!(std::fs::read(future).unwrap(), before);
    let corrupt = dir.path().join("corrupt.db");
    std::fs::write(&corrupt, b"not a sqlite database").unwrap();
    assert!(
        NotificationJournal::at(corrupt.clone())
            .page(&NotificationQuery::default())
            .is_err()
    );
    assert_eq!(std::fs::read(corrupt).unwrap(), b"not a sqlite database");
}
