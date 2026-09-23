//! Amp provider implementation
//!
//! Amp usage from the Amp balance RPC. Never interpret Cody data as Amp data.

use async_trait::async_trait;

use crate::core::{
    FetchContext, Provider, ProviderError, ProviderFetchResult, ProviderId, ProviderMetadata,
    RateWindow, SourceMode, UsageSnapshot,
};

/// Amp provider
pub struct AmpProvider {
    metadata: ProviderMetadata,
}

impl AmpProvider {
    pub fn new() -> Self {
        Self {
            metadata: ProviderMetadata {
                id: ProviderId::Amp,
                display_name: "Amp",
                session_label: "Usage",
                weekly_label: "Monthly",
                supports_opus: false,
                supports_credits: true,
                default_enabled: false,
                is_primary: false,
                dashboard_url: Some("https://ampcode.com/settings/usage"),
                status_page_url: Some("https://sourcegraphstatus.com"),
            },
        }
    }

    /// The private Amp RPC shape is established by upstream CodexBar's
    /// AmpUsageFetcher, pinned in WAVE3_IMPLEMENTATION_REPORT.md. It is not
    /// a public API guarantee; unknown responses fail closed.
    async fn fetch_via_web(&self, ctx: &FetchContext) -> Result<UsageSnapshot, ProviderError> {
        // A selected browser session identifies a different account lane. Do
        // not silently replace it with a saved/env API token.
        if ctx.manual_cookie_header.is_some() {
            return Err(ProviderError::UnsupportedSource(SourceMode::Web));
        }
        // An explicitly selected credential must never fall through to an
        // environment token for another account when it is not an Amp key.
        let token = if ctx.api_key.is_some() {
            access_token_from_context(ctx)
        } else {
            access_token_from_environment()
        }
        .ok_or(ProviderError::AuthRequired)?;

        let client = crate::core::credentialed_http_client_builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|_| ProviderError::Other("Amp HTTP client unavailable".into()))?;

        let resp = client
            .post("https://ampcode.com/api/internal?userDisplayBalanceInfo")
            .bearer_auth(token)
            .header("Accept", "application/json")
            .json(&serde_json::json!({"method": "userDisplayBalanceInfo", "params": {}}))
            .send()
            .await?;

        if matches!(resp.status().as_u16(), 401 | 403) {
            return Err(ProviderError::AuthRequired);
        }
        if !resp.status().is_success() {
            return Err(ProviderError::Other(format!(
                "Amp API returned HTTP {}",
                resp.status().as_u16()
            )));
        }
        let mut resp = resp;
        const LIMIT: usize = 1024 * 1024;
        if resp
            .content_length()
            .is_some_and(|size| size > LIMIT as u64)
        {
            return Err(ProviderError::Parse(
                "Amp response size limit exceeded".into(),
            ));
        }
        let mut body = Vec::new();
        while let Some(chunk) = resp.chunk().await? {
            if chunk.len() > LIMIT.saturating_sub(body.len()) {
                return Err(ProviderError::Parse(
                    "Amp response size limit exceeded".into(),
                ));
            }
            body.extend_from_slice(&chunk);
        }
        let json: serde_json::Value = serde_json::from_slice(&body)
            .map_err(|_| ProviderError::Parse("Invalid Amp balance response".into()))?;
        usage_from_balance_response(&json, chrono::Utc::now())
    }
}

fn access_token_from_context(ctx: &FetchContext) -> Option<String> {
    ctx.api_key
        .as_deref()
        .filter(|api_key| is_amp_issuer_token(api_key))
        .map(str::to_string)
}

fn access_token_from_environment() -> Option<String> {
    std::env::var("AMP_API_KEY")
        .ok()
        .filter(|token| is_amp_issuer_token(token))
}

fn is_amp_issuer_token(token: &str) -> bool {
    token.starts_with("sgamp_")
        && token.len() > "sgamp_".len()
        && !token.chars().any(char::is_whitespace)
}

fn usage_from_balance_response(
    json: &serde_json::Value,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<UsageSnapshot, ProviderError> {
    if json.get("ok").and_then(serde_json::Value::as_bool) != Some(true) {
        if json
            .pointer("/error/code")
            .and_then(serde_json::Value::as_str)
            == Some("auth-required")
        {
            return Err(ProviderError::AuthRequired);
        }
        return Err(ProviderError::Other("Amp balance request failed".into()));
    }
    let text = json
        .pointer("/result/displayText")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| ProviderError::Parse("Missing Amp usage display text".into()))?;
    usage_snapshot_from_amp_display_text(text, now)
        .ok_or_else(|| ProviderError::Parse("Unrecognized Amp usage display text".into()))
}

fn api_fetch_result(usage: UsageSnapshot) -> ProviderFetchResult {
    ProviderFetchResult::new(usage, "api")
}

impl Default for AmpProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for AmpProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Amp
    }

    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    async fn fetch_usage(&self, ctx: &FetchContext) -> Result<ProviderFetchResult, ProviderError> {
        tracing::debug!("Fetching Amp usage");

        match ctx.source_mode {
            SourceMode::Auto | SourceMode::Web => {
                let usage = self.fetch_via_web(ctx).await?;
                Ok(api_fetch_result(usage))
            }
            SourceMode::Cli => Err(ProviderError::UnsupportedSource(SourceMode::Cli)),
            SourceMode::OAuth => Err(ProviderError::UnsupportedSource(SourceMode::OAuth)),
        }
    }

    fn available_sources(&self) -> Vec<SourceMode> {
        vec![SourceMode::Auto, SourceMode::Web]
    }

    fn supports_web(&self) -> bool {
        true
    }

    fn supports_cli(&self) -> bool {
        false
    }
}

/// Monthly pace window sentinel used by Amp subscription/pace UI (30 days).
const AMP_MONTHLY_WINDOW_MINUTES: u32 = 30 * 24 * 60;

/// Parsed Amp subscription (Megawatt-style dual other/orb windows).
#[derive(Debug, Clone, PartialEq)]
pub struct AmpSubscriptionUsage {
    pub plan: String,
    pub other_used_percent: f64,
    pub orb_used_percent: f64,
    pub resets_at: chrono::DateTime<chrono::Utc>,
    pub reset_description: String,
}

/// Parse Amp Free percentage lines from Amp display text (upstream 0.42.1+ shape).
///
/// Matches lines like:
/// - `Amp Free: 72% remaining today`
/// - `Amp Free: 72% remaining (resets daily)`
///
/// Returns **used** percent (100 - remaining). The live Amp balance RPC
/// supplies this text; the helper also supports offline fixture tests.
pub fn parse_amp_free_percent_remaining(text: &str) -> Option<f64> {
    for line in text.lines() {
        let line = line.trim();
        let lower = line.to_ascii_lowercase();
        if !lower.starts_with("amp free:") {
            continue;
        }
        let rest = line["amp free:".len()..].trim();
        // Prefer percentage form over dollar `$used / $quota remaining`.
        let Some(percent_idx) = rest.find('%') else {
            continue;
        };
        let number_part = rest[..percent_idx].trim();
        // Reject dollar amounts mistaken for percentages (e.g. "$12 remaining").
        if number_part.contains('$') {
            continue;
        }
        let after = rest[percent_idx + 1..].trim().to_ascii_lowercase();
        if !after.starts_with("remaining") {
            continue;
        }
        let remaining: f64 = number_part.replace(',', "").parse().ok()?;
        if !remaining.is_finite() || !(0.0..=100.0).contains(&remaining) {
            continue;
        }
        return Some(100.0 - remaining);
    }
    None
}

fn normalize_amp_subscription_line(line: &str) -> String {
    let trimmed = line.trim();
    let Some(rest) = trimmed.strip_prefix("Amp ") else {
        return line.to_string();
    };
    let Some((plan, suffix)) = rest.split_once(" Subscription:") else {
        return line.to_string();
    };
    let plan = plan.trim();
    if plan.is_empty() {
        return line.to_string();
    }
    format!("Subscription {plan}:{suffix}")
}

/// Parse Amp subscription display text (Megawatt/Gigawatt dual other/orb windows).
///
/// Matches:
/// `Subscription Megawatt: 42% other usage and 88% orb usage remaining - resets upon renewal in 12 days`
/// `Subscription Gigawatt: 10% other usage and 95% orb usage remaining - resets upon renewal in 2 months`
///
/// Upstream 0.49.6 #2601: monthly (Gigawatt) renewals advance by calendar
/// month, not 30-day buckets.
pub fn parse_amp_subscription_usage(
    text: &str,
    now: chrono::DateTime<chrono::Utc>,
) -> Option<AmpSubscriptionUsage> {
    let re = regex_lite::Regex::new(
        r"(?im)^\s*Subscription\s+(.+?):\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*%\s+other\s+usage\s+and\s+([0-9][0-9,]*(?:\.[0-9]+)?)\s*%\s+orb\s+usage\s+remaining\s*-\s*resets\s+upon\s+renewal\s+in\s+([0-9][0-9,]*)\s+(days?|months?)(?:\s+-\s+https?://\S+)?\s*$",
    )
    .ok()?;

    for line in text.lines() {
        let normalized_line = normalize_amp_subscription_line(line);
        let Some(caps) = re.captures(&normalized_line) else {
            continue;
        };
        let plan = caps.get(1)?.as_str().trim();
        if plan.is_empty() {
            continue;
        }
        let other_remaining = parse_amp_number(caps.get(2)?.as_str())?;
        let orb_remaining = parse_amp_number(caps.get(3)?.as_str())?;
        if !(0.0..=100.0).contains(&other_remaining) || !(0.0..=100.0).contains(&orb_remaining) {
            continue;
        }
        let renewal_value: i64 = caps.get(4)?.as_str().replace(',', "").parse().ok()?;
        if renewal_value < 0 {
            continue;
        }
        let unit = caps.get(5)?.as_str().to_ascii_lowercase();
        let resets_at = if unit.starts_with("month") {
            add_calendar_months(now, renewal_value)?
        } else {
            now + chrono::Duration::days(renewal_value)
        };
        let singular_unit = if unit.starts_with("month") {
            "month"
        } else {
            "day"
        };
        let reset_description = if renewal_value == 1 {
            format!("renews in 1 {singular_unit}")
        } else {
            format!("renews in {renewal_value} {singular_unit}s")
        };
        return Some(AmpSubscriptionUsage {
            plan: plan.to_string(),
            other_used_percent: 100.0 - other_remaining,
            orb_used_percent: 100.0 - orb_remaining,
            resets_at,
            reset_description,
        });
    }
    None
}

/// Add whole calendar months via chrono's calendar arithmetic, mirroring
/// upstream `Calendar.date(byAdding: .month:)` for monthly renewals.
fn add_calendar_months(
    now: chrono::DateTime<chrono::Utc>,
    months: i64,
) -> Option<chrono::DateTime<chrono::Utc>> {
    now.checked_add_months(chrono::Months::new(u32::try_from(months).ok()?))
}

/// Build a [`UsageSnapshot`] from Amp Free / subscription display text.
///
/// Subscription (Megawatt) wins for primary/secondary windows when present:
/// - primary = other usage
/// - secondary = orb usage
///
/// Free percent path fills primary when there is no subscription match.
pub fn usage_snapshot_from_amp_display_text(
    text: &str,
    now: chrono::DateTime<chrono::Utc>,
) -> Option<UsageSnapshot> {
    if let Some(sub) = parse_amp_subscription_usage(text, now) {
        // Labels: primary = "Other usage", secondary = "Orb usage"
        // (surfaced via provider session/weekly labels + plan login_method).
        let monthly_minutes = RateWindow::monthly_window_minutes(Some(sub.resets_at))
            .unwrap_or(AMP_MONTHLY_WINDOW_MINUTES);
        let other = RateWindow::with_details(
            sub.other_used_percent,
            Some(monthly_minutes),
            Some(sub.resets_at),
            Some(sub.reset_description.clone()),
        );
        let orb = RateWindow::with_details(
            sub.orb_used_percent,
            Some(monthly_minutes),
            Some(sub.resets_at),
            Some(sub.reset_description),
        );
        return Some(
            UsageSnapshot::new(other)
                .with_secondary(orb)
                .with_login_method(sub.plan),
        );
    }

    let free_used = parse_amp_free_percent_remaining(text)?;
    // Upstream 0.49.6 #2601: the Amp Free daily tier resets at 8:00 PM
    // America/New_York, not local midnight.
    let primary = RateWindow::with_details(
        free_used,
        Some(24 * 60),
        next_free_tier_reset(now),
        Some("resets daily".to_string()),
    );
    Some(UsageSnapshot::new(primary).with_login_method("Amp Free"))
}

/// Next 8:00 PM America/New_York boundary strictly after `now`.
fn next_free_tier_reset(
    now: chrono::DateTime<chrono::Utc>,
) -> Option<chrono::DateTime<chrono::Utc>> {
    use chrono::{Datelike, TimeZone};
    let tz = chrono_tz::America::New_York;
    let local_now = now.with_timezone(&tz);
    let today = local_now.date_naive();
    let today_reset = tz
        .with_ymd_and_hms(today.year(), today.month(), today.day(), 20, 0, 0)
        .single()?
        .with_timezone(&chrono::Utc);
    if today_reset > now {
        return Some(today_reset);
    }
    let tomorrow = today + chrono::Duration::days(1);
    tz.with_ymd_and_hms(tomorrow.year(), tomorrow.month(), tomorrow.day(), 20, 0, 0)
        .single()
        .map(|dt| dt.with_timezone(&chrono::Utc))
}

fn parse_amp_number(raw: &str) -> Option<f64> {
    let value: f64 = raw.replace(',', "").parse().ok()?;
    value.is_finite().then_some(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};

    #[test]
    fn dashboard_points_to_current_usage_page() {
        assert_eq!(
            AmpProvider::new().metadata().dashboard_url,
            Some("https://ampcode.com/settings/usage")
        );
    }

    #[test]
    fn parses_amp_free_percent_remaining_today() {
        let text = "Signed in as user@example.com\nAmp Free: 72% remaining today\n";
        assert_eq!(parse_amp_free_percent_remaining(text), Some(28.0));
    }

    #[test]
    fn parses_amp_free_percent_resets_daily() {
        let text = "Amp Free: 100% remaining (resets daily)";
        assert_eq!(parse_amp_free_percent_remaining(text), Some(0.0));
    }

    #[test]
    fn ignores_dollar_remaining_form() {
        let text = "Amp Free: $4.20 / $10 remaining (replenishes +$1 / hour)";
        assert_eq!(parse_amp_free_percent_remaining(text), None);
    }

    #[test]
    fn returns_none_when_amp_free_missing() {
        assert_eq!(
            parse_amp_free_percent_remaining("Individual credits: $3 remaining"),
            None
        );
    }

    #[test]
    fn parses_megawatt_subscription_dual_windows() {
        let now = Utc.with_ymd_and_hms(2026, 7, 1, 12, 0, 0).unwrap();
        let text = "Signed in as user@example.com (Acme)\n\
Subscription Megawatt: 42% other usage and 88% orb usage remaining - resets upon renewal in 12 days\n";
        let sub = parse_amp_subscription_usage(text, now).expect("subscription");
        assert_eq!(sub.plan, "Megawatt");
        assert!((sub.other_used_percent - 58.0).abs() < f64::EPSILON);
        assert!((sub.orb_used_percent - 12.0).abs() < f64::EPSILON);
        assert_eq!(sub.reset_description, "renews in 12 days");
        assert_eq!(sub.resets_at, now + chrono::Duration::days(12));

        let snapshot = usage_snapshot_from_amp_display_text(text, now).expect("snapshot");
        assert!((snapshot.primary.used_percent - 58.0).abs() < f64::EPSILON);
        assert_eq!(
            snapshot.primary.window_minutes,
            RateWindow::monthly_window_minutes(snapshot.primary.resets_at)
                .or(Some(AMP_MONTHLY_WINDOW_MINUTES))
        );
        assert_eq!(
            snapshot.primary.reset_description.as_deref(),
            Some("renews in 12 days")
        );
        let secondary = snapshot.secondary.expect("orb secondary");
        assert!((secondary.used_percent - 12.0).abs() < f64::EPSILON);
        assert_eq!(
            secondary.window_minutes,
            RateWindow::monthly_window_minutes(secondary.resets_at)
                .or(Some(AMP_MONTHLY_WINDOW_MINUTES))
        );
        assert_eq!(snapshot.login_method.as_deref(), Some("Megawatt"));
    }

    #[test]
    fn megawatt_one_day_renewal_wording() {
        let now = Utc.with_ymd_and_hms(2026, 7, 1, 0, 0, 0).unwrap();
        let text = "Subscription Megawatt: 0% other usage and 100% orb usage remaining - resets upon renewal in 1 day";
        let sub = parse_amp_subscription_usage(text, now).unwrap();
        assert_eq!(sub.reset_description, "renews in 1 day");
        assert!((sub.other_used_percent - 100.0).abs() < f64::EPSILON);
        assert!((sub.orb_used_percent - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn gigawatt_monthly_renewal_advances_calendar_months() {
        // Upstream 0.49.6 #2601: monthly renewals (Gigawatt) use calendar
        // months, not 30-day buckets.
        let now = Utc.with_ymd_and_hms(2026, 8, 17, 12, 0, 0).unwrap();
        let text = "Subscription Gigawatt: 10% other usage and 95% orb usage remaining - resets upon renewal in 2 months";
        let sub = parse_amp_subscription_usage(text, now).expect("subscription");
        assert_eq!(sub.plan, "Gigawatt");
        assert_eq!(sub.reset_description, "renews in 2 months");
        assert_eq!(
            sub.resets_at,
            Utc.with_ymd_and_hms(2026, 10, 17, 12, 0, 0).unwrap()
        );
    }

    #[test]
    fn free_tier_resets_at_8pm_new_york() {
        // Upstream 0.49.6 #2601: Amp Free resets at 8:00 PM America/New_York.
        // 2026-08-17 18:00 UTC = 14:00 EDT → same-day 20:00 EDT = 00:00 UTC Aug 18.
        let now = Utc.with_ymd_and_hms(2026, 8, 17, 18, 0, 0).unwrap();
        let snapshot =
            usage_snapshot_from_amp_display_text("Amp Free: 72% remaining (resets daily)", now)
                .expect("snapshot");
        assert_eq!(
            snapshot.primary.resets_at,
            Some(Utc.with_ymd_and_hms(2026, 8, 18, 0, 0, 0).unwrap())
        );

        // 2026-08-18 00:30 UTC = 20:30 EDT Aug 17 (after the boundary) → the
        // next reset is Aug 18 20:00 EDT = Aug 19 00:00 UTC.
        let later = Utc.with_ymd_and_hms(2026, 8, 18, 0, 30, 0).unwrap();
        let snapshot =
            usage_snapshot_from_amp_display_text("Amp Free: 72% remaining (resets daily)", later)
                .expect("snapshot");
        assert_eq!(
            snapshot.primary.resets_at,
            Some(Utc.with_ymd_and_hms(2026, 8, 19, 0, 0, 0).unwrap())
        );
    }

    #[test]
    fn free_path_still_builds_snapshot() {
        let now = Utc.with_ymd_and_hms(2026, 7, 1, 0, 0, 0).unwrap();
        let text = "Amp Free: 72% remaining today";
        let snapshot = usage_snapshot_from_amp_display_text(text, now).unwrap();
        assert!((snapshot.primary.used_percent - 28.0).abs() < f64::EPSILON);
        assert!(snapshot.secondary.is_none());
        assert_eq!(snapshot.login_method.as_deref(), Some("Amp Free"));
    }
}

#[cfg(test)]
mod current_subscription_tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    #[test]
    fn parses_current_amp_subscription_line_format() {
        let now = Utc.with_ymd_and_hms(2026, 8, 18, 12, 0, 0).unwrap();
        let text = "Signed in as user@example.com\nAmp Megawatt Subscription: 100% other usage and 100% orb usage remaining - resets upon renewal in 1 month\n";
        let sub = parse_amp_subscription_usage(text, now).expect("subscription");

        assert_eq!(sub.plan, "Megawatt");
        assert!((sub.other_used_percent - 0.0).abs() < f64::EPSILON);
        assert!((sub.orb_used_percent - 0.0).abs() < f64::EPSILON);
        assert_eq!(
            sub.resets_at,
            Utc.with_ymd_and_hms(2026, 9, 18, 12, 0, 0).unwrap()
        );
        assert_eq!(sub.reset_description, "renews in 1 month");
    }
}

#[cfg(test)]
mod source_truth_tests {
    use super::*;
    use chrono::{TimeZone, Utc};

    #[tokio::test]
    async fn cli_configuration_does_not_report_zero_usage() {
        let ctx = FetchContext {
            source_mode: SourceMode::Cli,
            api_key: Some("sgamp_synthetic_key".into()),
            ..FetchContext::default()
        };
        assert!(matches!(
            AmpProvider::new().fetch_usage(&ctx).await,
            Err(ProviderError::UnsupportedSource(SourceMode::Cli))
        ));
    }

    #[tokio::test]
    async fn selected_cookie_does_not_fall_back_to_a_different_api_key() {
        let ctx = FetchContext {
            source_mode: SourceMode::Web,
            manual_cookie_header: Some("session=synthetic".into()),
            api_key: Some("sgamp_synthetic_key".into()),
            ..FetchContext::default()
        };
        assert!(matches!(
            AmpProvider::new().fetch_usage(&ctx).await,
            Err(ProviderError::UnsupportedSource(SourceMode::Web))
        ));
    }

    #[test]
    fn cody_token_cannot_be_sent_to_amp() {
        let ctx = FetchContext {
            api_key: Some("sgp_synthetic_cody_token".into()),
            ..FetchContext::default()
        };
        assert!(access_token_from_context(&ctx).is_none());
    }

    #[test]
    fn amp_balance_requires_real_display_text() {
        let now = Utc.with_ymd_and_hms(2026, 9, 1, 12, 0, 0).unwrap();
        assert!(matches!(
            usage_from_balance_response(
                &serde_json::json!({"ok": false, "error": {"code": "auth-required"}}),
                now
            ),
            Err(ProviderError::AuthRequired)
        ));
        for body in [
            serde_json::json!({"ok": true, "result": {}}),
            serde_json::json!({"ok": false, "result": {"displayText": "Amp Free: 100% remaining today"}}),
            serde_json::json!({"ok": true, "result": {"displayText": "unknown"}}),
        ] {
            assert!(usage_from_balance_response(&body, now).is_err());
        }
        let valid = serde_json::json!({"ok": true, "result": {"displayText": "Amp Free: 72% remaining today"}});
        let usage = usage_from_balance_response(&valid, now).unwrap();
        assert_eq!(usage.primary.used_percent, 28.0);
        assert_eq!(api_fetch_result(usage).source_label, "api");
    }

    #[test]
    fn impossible_reported_percentages_are_not_clamped_to_fake_limits() {
        assert_eq!(
            parse_amp_free_percent_remaining("Amp Free: 120% remaining today"),
            None
        );
        let now = Utc.with_ymd_and_hms(2026, 9, 1, 12, 0, 0).unwrap();
        assert!(parse_amp_subscription_usage(
            "Subscription Megawatt: 120% other usage and 80% orb usage remaining - resets upon renewal in 12 days",
            now
        ).is_none());
    }
}
