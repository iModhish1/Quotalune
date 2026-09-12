//! Opt-in, bounded background token reads. No log scanning in tray callbacks.
use chrono::{Datelike, Local, NaiveDate};
use quotalis_core::{
    cost_scanner::{CostScanner, get_daily_token_history},
    locale::{LocaleKey, get_text},
    settings::Language,
};
use std::{
    collections::{HashMap, HashSet},
    sync::{LazyLock, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};
#[derive(Default)]
struct Cache {
    values: HashMap<(String, String), (Instant, Option<u64>)>,
    running: HashSet<String>,
}
static CACHE: LazyLock<Mutex<Cache>> = LazyLock::new(|| Mutex::new(Cache::default()));
fn days(range: &str, today: NaiveDate) -> u32 {
    match range {
        "today" => 1,
        "week" => today.weekday().num_days_from_monday() + 1,
        "month" => today.day(),
        "year" => today.ordinal(),
        "lifetime" => {
            u32::try_from((today - NaiveDate::from_ymd_opt(1970, 1, 1).unwrap()).num_days() + 1)
                .unwrap_or(1)
        }
        _ => 0,
    }
}
pub fn request(app: &AppHandle, provider: &str, range: &str) {
    if !["codex", "claude"].contains(&provider) || range == "none" {
        return;
    }
    let key = (provider.to_string(), range.to_string());
    {
        let Ok(mut cache) = CACHE.lock() else {
            return;
        };
        if cache.running.contains(provider)
            || cache
                .values
                .get(&key)
                .is_some_and(|(at, _)| at.elapsed() < Duration::from_secs(300))
        {
            return;
        }
        cache.running.insert(provider.into());
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let job_key = key.clone();
        let result = tauri::async_runtime::spawn_blocking(move || {
            let count = days(&job_key.1, Local::now().date_naive());
            if count == 0 {
                return None;
            }
            let scanner = CostScanner::new(count);
            if !(if job_key.0 == "codex" {
                scanner.codex_local_activity_available()
            } else {
                scanner.claude_local_activity_available()
            }) {
                return None;
            }
            let (values, _) = get_daily_token_history(&job_key.0, count);
            let sum = values
                .iter()
                .try_fold(0_u64, |acc, (_, v)| acc.checked_add(*v))?;
            // This API zero-fills missing days. Zero without coverage is unknown.
            (sum > 0).then_some(sum)
        })
        .await
        .ok()
        .flatten();
        if let Ok(mut cache) = CACHE.lock() {
            cache.running.remove(&key.0);
            cache.values.insert(key, (Instant::now(), result));
        }
        let snapshots = app
            .state::<Mutex<crate::state::AppState>>()
            .lock()
            .ok()
            .map(|s| s.provider_cache.clone())
            .unwrap_or_default();
        crate::tray_bridge::update_tray_icon_and_tooltip(&app, &snapshots);
    });
}
pub fn label(provider: &str, range: &str, language: Language) -> String {
    let value = CACHE.lock().ok().and_then(|cache| {
        cache
            .values
            .get(&(provider.into(), range.into()))
            .and_then(|(_, v)| *v)
    });
    format!(
        "{} {}",
        get_text(language, LocaleKey::TrayStudioLocalShort),
        value.map(|v| v.to_string()).unwrap_or_else(|| "—".into())
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn calendar_ranges_include_today() {
        let d = NaiveDate::from_ymd_opt(2026, 9, 12).unwrap();
        assert_eq!(days("today", d), 1);
        assert_eq!(days("week", d), 6);
        assert_eq!(days("month", d), 12);
        assert_eq!(days("year", d), 255);
        assert!(days("lifetime", d) > 20000);
    }
    #[test]
    fn unsupported_source_is_unavailable_not_zero() {
        assert!(label("gemini", "today", Language::English).ends_with('—'));
    }
}
