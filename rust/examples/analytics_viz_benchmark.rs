//! Reproducible synthetic benchmark. In-memory SQLite only; no app database.
//! Breaks the previously-combined "SQLite read + Rust aggregate" number into
//! its two real layers (Claude continuation wave, owner section 14: "do not
//! report only one combined number").
use quotalis_core::dashboard_data::{Grain, aggregate_quota_history};
use quotalis_core::history::UsageSample;
use rusqlite::Connection;
use std::time::Instant;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    for count in [1_000usize, 25_000, 100_000, 250_000] {
        let db = Connection::open_in_memory()?;
        db.execute_batch("CREATE TABLE observations(provider TEXT, at INTEGER, used REAL)")?;
        let tx_conn = db;
        let tx = std::cell::RefCell::new(tx_conn);
        {
            let mut conn = tx.borrow_mut();
            let txn = conn.transaction()?;
            {
                let mut insert = txn.prepare("INSERT INTO observations VALUES(?1,?2,?3)")?;
                for i in 0..count {
                    insert.execute(rusqlite::params![
                        format!("fixture-{}", i % 70),
                        1_800_000_000_i64 - i64::try_from(i / 70)? * 60,
                        (i / 70 % 100) as f64
                    ])?;
                }
            }
            txn.commit()?;
        }
        let db = tx.into_inner();

        let mut read_times = Vec::new();
        let mut aggregate_times = Vec::new();
        let mut output_rows = 0;
        for run in 0..6 {
            let read_start = Instant::now();
            let mut query = db.prepare("SELECT provider,at,used FROM observations ORDER BY at")?;
            let samples = query
                .query_map([], |row| {
                    let used: f64 = row.get(2)?;
                    Ok(UsageSample {
                        provider: row.get(0)?,
                        account_id: "fixture-account".into(),
                        account_scope: Some("observed".into()),
                        window_id: Some("primary".into()),
                        window_key: Some("primary:10080".into()),
                        window_label: None,
                        window_minutes: Some(10080),
                        used_percent: used,
                        remaining_percent: 100.0 - used,
                        cost_used: None,
                        cost_currency_code: None,
                        cost_measurement_kind: None,
                        monetary_quantity_kind: None,
                        resets_at: Some(1_900_000_000),
                        captured_at: row.get(1)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            let read_ms = read_start.elapsed().as_secs_f64() * 1000.0;

            let aggregate_start = Instant::now();
            output_rows = aggregate_quota_history(&samples, chrono_tz::UTC, Grain::Daily).len();
            let aggregate_ms = aggregate_start.elapsed().as_secs_f64() * 1000.0;

            if run > 0 {
                read_times.push(read_ms);
                aggregate_times.push(aggregate_ms);
            }
        }
        read_times.sort_by(f64::total_cmp);
        aggregate_times.sort_by(f64::total_cmp);
        println!(
            "{}",
            serde_json::json!({
                "input": count,
                "output": output_rows,
                "sqliteReadMedianMs": read_times[2],
                "rustAggregateMedianMs": aggregate_times[2],
                "combinedMedianMs": read_times[2] + aggregate_times[2],
                "readSamplesMs": read_times,
                "aggregateSamplesMs": aggregate_times,
            })
        );
    }
    Ok(())
}
