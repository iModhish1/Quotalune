//! Opt-in, bounded background token reads. No log scanning in tray callbacks.
//! What each provider/period can truthfully state lives in
//! `quotalis_core::token_periods`.
use chrono::{Local, NaiveDate};
use quotalis_core::{
    cost_scanner::observe_token_period,
    locale::{LocaleKey, get_text},
    settings::Language,
    token_periods::{
        TokenBound, TokenPeriod, TokenPeriodCapability, TokenPeriodReading, resolve_token_reading,
        token_period_capabilities, token_period_capability,
    },
};
use std::{
    collections::{HashMap, HashSet},
    sync::{LazyLock, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

#[derive(Default)]
struct Cache {
    values: HashMap<(String, TokenPeriod, NaiveDate), (Instant, Option<TokenPeriodReading>)>,
    running: HashSet<String>,
}
static CACHE: LazyLock<Mutex<Cache>> = LazyLock::new(|| Mutex::new(Cache::default()));
const READING_TTL: Duration = Duration::from_secs(300);

/// The configured period, only when this provider can actually state it.
pub fn supported_period(provider: &str, range: &str) -> Option<TokenPeriod> {
    TokenPeriod::from_key(range)
        .filter(|period| token_period_capability(provider, *period).is_some())
}

pub fn request(app: &AppHandle, provider: &str, range: &str) {
    let Some(period) = supported_period(provider, range) else {
        return;
    };
    let today = Local::now().date_naive();
    let key = (provider.to_string(), period, today);
    {
        let Ok(mut cache) = CACHE.lock() else {
            return;
        };
        cache.values.retain(|(_, _, day), _| *day == today);
        if cache.running.contains(provider)
            || cache
                .values
                .get(&key)
                .is_some_and(|(at, _)| at.elapsed() < READING_TTL)
        {
            return;
        }
        cache.running.insert(provider.into());
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let job_key = key.clone();
        let result = tauri::async_runtime::spawn_blocking(move || {
            let (provider, period, day) = job_key;
            let observation = observe_token_period(&provider, period, day)?;
            // A scan that crossed midnight describes a different calendar period.
            (Local::now().date_naive() == day)
                .then(|| resolve_token_reading(&provider, period, observation, day))
                .flatten()
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

/// A token tooltip row. Only `label` may be shortened: cutting digits off
/// `reading` would state a different number.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TokenLine {
    pub label: String,
    pub reading: String,
}

#[cfg(test)]
impl TokenLine {
    fn text(&self) -> String {
        format!("{}: {}", self.label, self.reading)
    }
}

/// Tooltip line for a configured period, or `None` when the provider has no
/// source for it (an unsupported period is omitted, never shown as zero).
pub fn label(provider: &str, range: &str, language: Language) -> Option<TokenLine> {
    let period = supported_period(provider, range)?;
    let reading = CACHE
        .lock()
        .ok()
        .and_then(|cache| cached_value(&cache, provider, period, Local::now().date_naive()));
    Some(format_line(period, reading, language))
}

/// Dev QA fixture token line: same format as a real reading, `—` when absent.
pub fn fixture_label(total: Option<u64>, range: &str, language: Language) -> Option<TokenLine> {
    let period = TokenPeriod::from_key(range)?;
    let reading = total.map(|total| TokenPeriodReading {
        total,
        bound: TokenBound::Exact,
    });
    Some(format_line(period, reading, language))
}

fn period_key(period: TokenPeriod) -> LocaleKey {
    match period {
        TokenPeriod::Today => LocaleKey::TrayStudioToday,
        TokenPeriod::Week => LocaleKey::TrayStudioWeek,
        TokenPeriod::Month => LocaleKey::TrayStudioMonth,
        TokenPeriod::Year => LocaleKey::TrayStudioYear,
        TokenPeriod::Lifetime => LocaleKey::TrayStudioLifetime,
    }
}

fn format_line(
    period: TokenPeriod,
    reading: Option<TokenPeriodReading>,
    language: Language,
) -> TokenLine {
    TokenLine {
        label: format!(
            "{} · {}",
            get_text(language, LocaleKey::TrayStudioLocalShort),
            get_text(language, period_key(period)),
        ),
        reading: reading.map(format_reading).unwrap_or_else(|| "—".into()),
    }
}

fn cached_value(
    cache: &Cache,
    provider: &str,
    period: TokenPeriod,
    date: NaiveDate,
) -> Option<TokenPeriodReading> {
    cache
        .values
        .get(&(provider.into(), period, date))
        .filter(|(at, _)| at.elapsed() < READING_TTL)
        .and_then(|(_, value)| *value)
}

fn format_reading(value: TokenPeriodReading) -> String {
    format!(
        "{}{}",
        if value.bound == TokenBound::LowerBound {
            "≥"
        } else {
            ""
        },
        value.total
    )
}

/// Periods Tray Studio may offer for a provider, with how exact each can be.
#[tauri::command]
pub fn get_tray_token_periods(provider_id: String) -> Vec<TokenPeriodCapability> {
    token_period_capabilities(&provider_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use quotalis_core::token_periods::TokenPeriodObservation;

    #[test]
    fn lower_bounds_are_marked_and_exact_readings_are_not() {
        assert_eq!(
            format_reading(TokenPeriodReading {
                total: 123,
                bound: TokenBound::LowerBound
            }),
            "≥123"
        );
        assert_eq!(
            format_reading(TokenPeriodReading {
                total: 123,
                bound: TokenBound::Exact
            }),
            "123"
        );
    }

    #[test]
    fn calendar_date_is_part_of_the_cache_identity() {
        let before = NaiveDate::from_ymd_opt(2026, 12, 31).unwrap();
        let after = NaiveDate::from_ymd_opt(2027, 1, 1).unwrap();
        let reading = TokenPeriodReading {
            total: 123,
            bound: TokenBound::Exact,
        };
        let mut cache = Cache::default();
        cache.values.insert(
            ("codex".into(), TokenPeriod::Today, before),
            (Instant::now(), Some(reading)),
        );
        assert_eq!(
            cached_value(&cache, "codex", TokenPeriod::Today, before),
            Some(reading)
        );
        assert!(cached_value(&cache, "codex", TokenPeriod::Today, after).is_none());
        assert!(cached_value(&cache, "codex", TokenPeriod::Week, before).is_none());
        cache.values.insert(
            ("codex".into(), TokenPeriod::Today, before),
            (Instant::now() - Duration::from_secs(301), Some(reading)),
        );
        assert!(cached_value(&cache, "codex", TokenPeriod::Today, before).is_none());
    }

    #[test]
    fn unsupported_sources_and_periods_produce_no_line() {
        assert_eq!(label("gemini", "today", Language::English), None);
        assert_eq!(label("codex", "none", Language::English), None);
        assert_eq!(label("codex", "fortnight", Language::English), None);
        assert!(supported_period("claude", "lifetime").is_some());
        assert!(get_tray_token_periods("gemini".into()).is_empty());
        assert_eq!(get_tray_token_periods("codex".into()).len(), 5);
    }

    #[test]
    fn line_names_the_period_and_keeps_unknown_distinct_from_zero() {
        let unknown = label("codex", "week", Language::English).unwrap();
        assert!(
            unknown.label.contains("This week") && unknown.reading == "—",
            "{unknown:?}"
        );
        let today = NaiveDate::from_ymd_opt(2026, 9, 16).unwrap();
        let claude = resolve_token_reading(
            "claude",
            TokenPeriod::Month,
            TokenPeriodObservation {
                total: 987,
                coverage_established: true,
                earliest_activity: Some(today),
            },
            today,
        );
        assert_eq!(
            format_line(TokenPeriod::Month, claude, Language::English).text(),
            "Local tokens · This month: ≥987"
        );
        let arabic = format_line(TokenPeriod::Year, claude, Language::Arabic).text();
        assert!(
            arabic.contains("≥987") && !arabic.contains("This"),
            "{arabic}"
        );
    }
}
