//! Reproducible synthetic benchmark. In-memory SQLite only; no app database.
use quotalis_core::dashboard_data::{Grain, aggregate_quota_history};
use quotalis_core::history::UsageSample;
use rusqlite::Connection;
use std::time::Instant;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    for count in [25000usize, 100000, 250000] {
        let mut db = Connection::open_in_memory()?;
        db.execute_batch("CREATE TABLE observations(provider TEXT, at INTEGER, used REAL)")?;
        let tx = db.transaction()?;
        {
            let mut insert = tx.prepare("INSERT INTO observations VALUES(?1,?2,?3)")?;
            for i in 0..count {
                insert.execute(rusqlite::params![
                    format!("fixture-{}", i % 70),
                    1_800_000_000_i64 - i64::try_from(i / 70)? * 60,
                    (i / 70 % 100) as f64
                ])?;
            }
        }
        tx.commit()?;
        let mut times = Vec::new();
        let mut output_rows = 0;
        for run in 0..6 {
            let start = Instant::now();
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
            output_rows = aggregate_quota_history(&samples, chrono_tz::UTC, Grain::Daily).len();
            if run > 0 {
                times.push(start.elapsed().as_secs_f64() * 1000.0);
            }
        }
        times.sort_by(f64::total_cmp);
        println!(
            "{}",
            serde_json::json!({"input":count,"output":output_rows,"sqliteReadAndRustAggregateMedianMs":times[2],"samplesMs":times})
        );
    }
    Ok(())
}
