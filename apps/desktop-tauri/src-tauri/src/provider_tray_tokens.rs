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
#[derive(Clone, Copy)]
struct TokenReading {
    total: u64,
    incomplete: bool,
}
#[derive(Default)]
struct Cache {
    values: HashMap<(String, String, NaiveDate), (Instant, Option<TokenReading>)>,
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
    let key = (
        provider.to_string(),
        range.to_string(),
        Local::now().date_naive(),
    );
    {
        let Ok(mut cache) = CACHE.lock() else {
            return;
        };
        cache.values.retain(|(_, _, day), _| *day == key.2);
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
            let count = days(&job_key.1, job_key.2);
            if Local::now().date_naive() != job_key.2 {
                return None;
            }
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
            let (values, incomplete) = get_daily_token_history(&job_key.0, count);
            let sum = values
                .iter()
                .try_fold(0_u64, |acc, (_, v)| acc.checked_add(*v))?;
            // This API zero-fills missing days. Zero without coverage is unknown.
            (sum > 0 && Local::now().date_naive() == job_key.2).then_some(TokenReading {
                total: sum,
                incomplete: incomplete || job_key.0 == "claude",
            })
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
    let value = CACHE
        .lock()
        .ok()
        .and_then(|cache| cached_value(&cache, provider, range, Local::now().date_naive()));
    format!(
        "{} {}",
        get_text(language, LocaleKey::TrayStudioLocalShort),
        value.map(format_reading).unwrap_or_else(|| "—".into())
    )
}
fn cached_value(
    cache: &Cache,
    provider: &str,
    range: &str,
    date: NaiveDate,
) -> Option<TokenReading> {
    cache
        .values
        .get(&(provider.into(), range.into(), date))
        .filter(|(at, _)| at.elapsed() < Duration::from_secs(300))
        .and_then(|(_, value)| *value)
}
fn format_reading(value: TokenReading) -> String {
    format!("{}{}", if value.incomplete { "≥" } else { "" }, value.total)
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
    fn incomplete_counts_are_lower_bounds() {
        assert_eq!(
            format_reading(TokenReading {
                total: 123,
                incomplete: true
            }),
            "≥123"
        );
        assert_eq!(
            format_reading(TokenReading {
                total: 123,
                incomplete: false
            }),
            "123"
        );
    }
    #[test]
    fn calendar_date_is_part_of_the_cache_identity() {
        let before = NaiveDate::from_ymd_opt(2026, 12, 31).unwrap();
        let after = NaiveDate::from_ymd_opt(2027, 1, 1).unwrap();
        let mut cache = Cache::default();
        cache.values.insert(
            ("codex".into(), "today".into(), before),
            (
                Instant::now(),
                Some(TokenReading {
                    total: 123,
                    incomplete: false,
                }),
            ),
        );
        assert_eq!(
            cached_value(&cache, "codex", "today", before).map(|v| v.total),
            Some(123)
        );
        assert!(cached_value(&cache, "codex", "today", after).is_none());
        cache.values.insert(
            ("codex".into(), "today".into(), before),
            (
                Instant::now() - Duration::from_secs(301),
                Some(TokenReading {
                    total: 123,
                    incomplete: false,
                }),
            ),
        );
        assert!(cached_value(&cache, "codex", "today", before).is_none());
    }
    #[test]
    fn unsupported_source_is_unavailable_not_zero() {
        assert!(label("gemini", "today", Language::English).ends_with('—'));
    }
}
