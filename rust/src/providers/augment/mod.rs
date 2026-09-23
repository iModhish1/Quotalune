//! Augment provider implementation
//!
//! Fetches usage data from Augment Code AI
//! Augment stores auth tokens and config locally

mod keepalive;

// Re-exports for future session management
#[allow(
    unused_imports,
    reason = "keepalive API re-exported for upcoming session-management wiring"
)]
pub use keepalive::{AugmentSessionKeepalive, KeepaliveConfig};

use async_trait::async_trait;
use regex_lite::Regex;
use std::path::PathBuf;
use std::sync::OnceLock;

use crate::cli_dependencies::{self, CliReadOutput, ProbeFailure};
use crate::core::{
    FetchContext, Provider, ProviderError, ProviderFetchResult, ProviderId, ProviderMetadata,
    RateWindow, SourceMode, UsageSnapshot,
};

/// Augment provider
pub struct AugmentProvider {
    metadata: ProviderMetadata,
}

const MAX_AUGMENT_RESPONSE_BYTES: usize = 1024 * 1024;

fn check_usage_http_status(status: reqwest::StatusCode) -> Result<(), ProviderError> {
    if matches!(status.as_u16(), 401 | 403) {
        return Err(ProviderError::AuthRequired);
    }
    if !status.is_success() {
        return Err(ProviderError::Other(format!(
            "Augment usage API returned HTTP {}",
            status.as_u16()
        )));
    }
    Ok(())
}

impl AugmentProvider {
    pub fn new() -> Self {
        Self {
            metadata: ProviderMetadata {
                id: ProviderId::Augment,
                display_name: "Augment",
                session_label: "Session",
                weekly_label: "Monthly",
                supports_opus: false,
                supports_credits: true,
                default_enabled: false,
                is_primary: false,
                dashboard_url: Some("https://app.augmentcode.com/account"),
                status_page_url: Some("https://status.augmentcode.com"),
            },
        }
    }

    /// Get Augment config directory
    fn get_augment_config_path() -> Option<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            dirs::config_dir().map(|p| p.join("augment"))
        }
        #[cfg(not(target_os = "windows"))]
        {
            dirs::home_dir().map(|p| p.join(".augment"))
        }
    }

    /// Find Augment CLI
    fn which_augment() -> Option<PathBuf> {
        let possible_paths = [
            which::which("augment").ok(),
            which::which("auggie").ok(),
            #[cfg(target_os = "windows")]
            dirs::data_local_dir().map(|p| p.join("Programs").join("Augment").join("augment.exe")),
            #[cfg(target_os = "windows")]
            dirs::data_local_dir().map(|p| p.join("Programs").join("Augment").join("auggie.exe")),
            #[cfg(not(target_os = "windows"))]
            None,
            #[cfg(not(target_os = "windows"))]
            None,
        ];

        possible_paths.into_iter().flatten().find(|p| p.exists())
    }

    /// Read Augment auth token
    async fn read_auth_token(&self) -> Result<String, ProviderError> {
        let config_path = Self::get_augment_config_path()
            .ok_or_else(|| ProviderError::NotInstalled("Augment config not found".to_string()))?;

        // Check for token file
        let token_file = config_path.join("auth.json");
        if token_file.exists() {
            let content = tokio::fs::read_to_string(&token_file)
                .await
                .map_err(|e| ProviderError::Other(e.to_string()))?;

            let json: serde_json::Value =
                serde_json::from_str(&content).map_err(|e| ProviderError::Parse(e.to_string()))?;

            if let Some(token) = json.get("access_token").and_then(|v| v.as_str()) {
                return Ok(token.to_string());
            }
        }

        // Check for credentials in VS Code extension settings
        let vscode_settings = Self::get_vscode_augment_settings().await;
        if let Some(token) = vscode_settings {
            return Ok(token);
        }

        Err(ProviderError::AuthRequired)
    }

    async fn get_vscode_augment_settings() -> Option<String> {
        #[cfg(target_os = "windows")]
        let settings_path = dirs::config_dir().map(|p| {
            p.join("Code")
                .join("User")
                .join("globalStorage")
                .join("augment.augment-vscode")
                .join("auth.json")
        });
        #[cfg(not(target_os = "windows"))]
        let settings_path = dirs::config_dir().map(|p| {
            p.join("Code")
                .join("User")
                .join("globalStorage")
                .join("augment.augment-vscode")
                .join("auth.json")
        });

        if let Some(path) = settings_path
            && path.exists()
            && let Ok(content) = tokio::fs::read_to_string(&path).await
            && let Ok(json) = serde_json::from_str::<serde_json::Value>(&content)
            && let Some(token) = json.get("accessToken").and_then(|v| v.as_str())
        {
            return Some(token.to_string());
        }

        None
    }

    /// Fetch usage via Augment API
    async fn fetch_via_web(&self) -> Result<UsageSnapshot, ProviderError> {
        let token = self.read_auth_token().await?;

        let client = crate::core::credentialed_http_client_builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| ProviderError::Other(e.to_string()))?;

        let mut resp = client
            .get("https://api.augmentcode.com/v1/user/usage")
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await?;

        check_usage_http_status(resp.status())?;
        if resp
            .content_length()
            .is_some_and(|size| size > MAX_AUGMENT_RESPONSE_BYTES as u64)
        {
            return Err(ProviderError::Parse(
                "Augment usage response size limit exceeded".into(),
            ));
        }
        let mut body = Vec::new();
        while let Some(chunk) = resp.chunk().await? {
            if chunk.len() > MAX_AUGMENT_RESPONSE_BYTES.saturating_sub(body.len()) {
                return Err(ProviderError::Parse(
                    "Augment usage response size limit exceeded".into(),
                ));
            }
            body.extend_from_slice(&chunk);
        }
        let json: serde_json::Value = serde_json::from_slice(&body)
            .map_err(|_| ProviderError::Parse("Invalid Augment usage response".into()))?;

        self.parse_usage_response(&json)
    }

    fn parse_usage_response(
        &self,
        json: &serde_json::Value,
    ) -> Result<UsageSnapshot, ProviderError> {
        let used = json
            .get("used_credits")
            .and_then(|v| v.as_f64())
            .or_else(|| json.get("usage").and_then(|v| v.as_f64()))
            .filter(|value| value.is_finite() && *value >= 0.0);

        let limit = json
            .get("credit_limit")
            .and_then(|v| v.as_f64())
            .or_else(|| json.get("limit").and_then(|v| v.as_f64()))
            .filter(|value| value.is_finite() && *value > 0.0);

        let email = json
            .get("email")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty());

        let plan = json
            .get("plan")
            .and_then(|v| v.as_str())
            .or_else(|| json.get("subscription").and_then(|v| v.as_str()))
            .map(str::trim)
            .filter(|value| !value.is_empty());

        if used.is_none() && limit.is_none() && email.is_none() && plan.is_none() {
            return Err(ProviderError::Parse(
                "Augment usage response contained no recognized fields".into(),
            ));
        }

        let percent = used.zip(limit).map(|(used, limit)| used / limit * 100.0);
        let window = match percent.filter(|value| value.is_finite()) {
            Some(percent) => RateWindow::new(percent),
            None => RateWindow::informational("Credit usage unavailable"),
        };

        let mut usage = UsageSnapshot::new(window);

        if let Some(plan) = plan {
            usage = usage.with_login_method(plan);
        }

        if let Some(email) = email {
            usage = usage.with_email(email);
        }

        Ok(usage)
    }

    async fn fetch_via_cli(&self) -> Result<UsageSnapshot, ProviderError> {
        let cli_path = Self::which_augment().ok_or_else(|| {
            ProviderError::NotInstalled(
                "Augment CLI not found. Install from https://www.augmentcode.com".to_string(),
            )
        })?;

        let output = cli_dependencies::read_provider_cli(&cli_path, &["account", "status"], None)
            .await
            .map_err(|failure| match failure {
                ProbeFailure::Timeout => ProviderError::Timeout,
                ProbeFailure::Cancelled => ProviderError::Other("Augment CLI cancelled".into()),
                ProbeFailure::Launch | ProbeFailure::Capture => {
                    ProviderError::Other("Augment CLI could not be read".into())
                }
            })?;
        let stdout = checked_auggie_status_output(output)?;
        if stdout.trim().is_empty() {
            return Err(ProviderError::Parse(
                "Augment CLI returned no account status output".to_string(),
            ));
        }
        parse_auggie_account_status(&stdout)
    }

    #[allow(
        dead_code,
        reason = "detection probe kept alongside the fetch path; only fetch_via_cli is wired into fetch() today"
    )]
    /// Probe CLI for detection
    async fn probe_cli(&self) -> Result<UsageSnapshot, ProviderError> {
        self.fetch_via_cli().await.or_else(|_| {
            let augment_path = Self::which_augment();
            let config_path = Self::get_augment_config_path();

            if augment_path.map(|p| p.exists()).unwrap_or(false)
                || config_path.map(|p| p.exists()).unwrap_or(false)
            {
                let usage = UsageSnapshot::new(RateWindow::new(0.0))
                    .with_login_method("Augment (installed)");
                Ok(usage)
            } else {
                Err(ProviderError::NotInstalled(
                    "Augment not found. Install from https://www.augmentcode.com".to_string(),
                ))
            }
        })
    }
}

fn checked_auggie_status_output(output: CliReadOutput) -> Result<String, ProviderError> {
    if output.stdout.len() > cli_dependencies::OUTPUT_CAP
        || output.stderr.len() > cli_dependencies::OUTPUT_CAP
    {
        return Err(ProviderError::Other(
            "Augment CLI output exceeded the safe limit".into(),
        ));
    }
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr);
    if output.exit_code != Some(0) {
        let combined = format!("{stdout} {stderr}").to_lowercase();
        if combined.contains("authentication failed") || combined.contains("auggie login") {
            return Err(ProviderError::AuthRequired);
        }
        return Err(ProviderError::Other("Augment CLI command failed".into()));
    }
    Ok(stdout)
}

impl Default for AugmentProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for AugmentProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Augment
    }

    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    async fn fetch_usage(&self, ctx: &FetchContext) -> Result<ProviderFetchResult, ProviderError> {
        tracing::debug!("Fetching Augment usage");

        match ctx.source_mode {
            SourceMode::Auto => {
                if let Ok(usage) = self.fetch_via_cli().await {
                    return Ok(ProviderFetchResult::new(usage, "cli"));
                }
                let usage = self.fetch_via_web().await?;
                Ok(ProviderFetchResult::new(usage, "web"))
            }
            SourceMode::Web => {
                let usage = self.fetch_via_web().await?;
                Ok(ProviderFetchResult::new(usage, "web"))
            }
            SourceMode::Cli => {
                let usage = self.fetch_via_cli().await?;
                Ok(ProviderFetchResult::new(usage, "cli"))
            }
            SourceMode::OAuth => Err(ProviderError::UnsupportedSource(SourceMode::OAuth)),
        }
    }

    fn available_sources(&self) -> Vec<SourceMode> {
        vec![SourceMode::Auto, SourceMode::Web, SourceMode::Cli]
    }

    fn supports_web(&self) -> bool {
        true
    }

    fn supports_cli(&self) -> bool {
        true
    }
    /// Augment's CLI probes raise `NotInstalled` when the CLI binary or
    /// config root is absent ("Augment CLI not found. Install from ...",
    /// "Augment not found. Install from ...") — an installation gap, not a
    /// credential problem — so those surface as an offline local runtime
    /// (matching the pre-backend classifier's treatment of CLI-presence
    /// failures). The guard is message-scoped: "Augment config not found"
    /// (a missing auth config) keeps the default sign-in mapping.
    fn error_state_kind(&self, error: &ProviderError) -> crate::core::ProviderStateKind {
        match error {
            ProviderError::NotInstalled(msg)
                if msg.contains("Install from") || msg.contains("not found. Install") =>
            {
                crate::core::ProviderStateKind::LocalRuntimeOffline
            }
            _ => error.state_kind(),
        }
    }
}

fn parse_auggie_account_status(output: &str) -> Result<UsageSnapshot, ProviderError> {
    static MONTHLY_RE: OnceLock<Regex> = OnceLock::new();
    static REMAINING_RE: OnceLock<Regex> = OnceLock::new();
    static LEGACY_RE: OnceLock<Regex> = OnceLock::new();
    static LEGACY_REMAINING_RE: OnceLock<Regex> = OnceLock::new();
    static BILLING_RE: OnceLock<Regex> = OnceLock::new();

    let monthly_re = MONTHLY_RE
        .get_or_init(|| Regex::new(r"(?i)([\d,]+)\s+credits\s*/\s*month").expect("valid regex"));
    let remaining_re = REMAINING_RE
        .get_or_init(|| Regex::new(r"(?i)([\d,]+)\s+credits\s+remaining").expect("valid regex"));
    let legacy_re = LEGACY_RE.get_or_init(|| {
        Regex::new(r"(?i)([\d,]+)\s*/\s*([\d,]+)\s+credits used").expect("valid regex")
    });
    let legacy_remaining_re = LEGACY_REMAINING_RE
        .get_or_init(|| Regex::new(r"(?i)([\d,]+)\s+remaining").expect("valid regex"));
    let billing_re = BILLING_RE
        .get_or_init(|| Regex::new(r"(?i)billing cycle.*ends\s+([\d/]+)").expect("valid regex"));

    let mut max_credits: Option<f64> = None;
    let mut remaining: Option<f64> = None;
    let mut used: Option<f64> = None;
    let mut total: Option<f64> = None;
    let mut reset_description: Option<String> = None;

    for line in output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        if let Some(caps) = monthly_re.captures(line) {
            let value = parse_credit_number(&caps[1]);
            max_credits = value;
            total = total.or(value);
        }

        if let Some(caps) = remaining_re.captures(line) {
            remaining = parse_credit_number(&caps[1]);
        } else if line.to_ascii_lowercase().contains("credits used")
            && let Some(caps) = legacy_remaining_re.captures(line)
        {
            remaining = parse_credit_number(&caps[1]);
        }

        if let Some(caps) = legacy_re.captures(line) {
            used = parse_credit_number(&caps[1]);
            total = parse_credit_number(&caps[2]);
        }

        if let Some(caps) = billing_re.captures(line) {
            reset_description = Some(format!("ends {}", &caps[1]));
        }
    }

    let remaining = remaining.ok_or_else(|| {
        ProviderError::Parse("Could not extract Augment remaining credits".to_string())
    })?;
    let total = total.or(max_credits).ok_or_else(|| {
        ProviderError::Parse("Could not extract Augment credit limit".to_string())
    })?;
    if total <= 0.0 || remaining > total {
        return Err(ProviderError::Parse(
            "Augment credit limit is zero or inconsistent with remaining credits".to_string(),
        ));
    }
    let used = used.unwrap_or_else(|| (total - remaining).max(0.0));
    let used_percent = (used / total) * 100.0;

    let mut window = RateWindow::new(used_percent);
    window.reset_description = reset_description;
    let plan = max_credits
        .map(|credits| format!("{} credits/month", format_integer_credits(credits)))
        .unwrap_or_else(|| "Augment".to_string());
    Ok(UsageSnapshot::new(window).with_login_method(plan))
}

fn parse_credit_number(value: &str) -> Option<f64> {
    value
        .replace(',', "")
        .trim()
        .parse::<f64>()
        .ok()
        .filter(|number| number.is_finite())
}

fn format_integer_credits(value: f64) -> String {
    let mut digits = format!("{:.0}", value).chars().rev().collect::<Vec<_>>();
    let mut out = String::new();
    for (idx, ch) in digits.drain(..).enumerate() {
        if idx > 0 && idx % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    out.chars().rev().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cli_output(exit_code: Option<i32>, stdout: &[u8], stderr: &[u8]) -> CliReadOutput {
        CliReadOutput {
            exit_code,
            stdout: stdout.to_vec(),
            stderr: stderr.to_vec(),
        }
    }

    #[test]
    fn cli_status_rejects_private_failures_and_truncation() {
        assert!(matches!(
            checked_auggie_status_output(cli_output(Some(1), b"", b"Authentication failed")),
            Err(ProviderError::AuthRequired)
        ));
        assert!(matches!(
            checked_auggie_status_output(cli_output(Some(1), b"private token", b"failure")),
            Err(ProviderError::Other(message)) if !message.contains("private")
        ));
        assert!(matches!(
            checked_auggie_status_output(cli_output(
                Some(0),
                &vec![b'x'; cli_dependencies::OUTPUT_CAP + 1],
                b"",
            )),
            Err(ProviderError::Other(message)) if message.contains("safe limit")
        ));
        assert_eq!(
            checked_auggie_status_output(cli_output(Some(0), b"account status", b""))
                .expect("bounded successful output"),
            "account status"
        );
    }

    #[test]
    fn parses_current_auggie_account_status() {
        let usage = parse_auggie_account_status(
            r#"
            319,054 credits remaining                     Max Plan
            450,000 credits / month
            9 days remaining in this billing cycle (ends 6/9/2026)
            "#,
        )
        .unwrap();

        assert!((usage.primary.used_percent - 29.098).abs() < 0.01);
        assert_eq!(usage.login_method.as_deref(), Some("450,000 credits/month"));
        assert_eq!(
            usage.primary.reset_description.as_deref(),
            Some("ends 6/9/2026")
        );
    }

    #[test]
    fn parses_legacy_auggie_account_status() {
        let usage = parse_auggie_account_status(
            r#"
            Max Plan 450,000 credits / month
            11,657 remaining · 953,170 / 964,827 credits used
            2 days remaining in this billing cycle (ends 1/8/2026)
            "#,
        )
        .unwrap();

        assert!((usage.primary.used_percent - 98.79).abs() < 0.01);
        assert_eq!(usage.login_method.as_deref(), Some("450,000 credits/month"));
    }

    #[test]
    fn rejects_zero_or_contradictory_credit_limits_instead_of_reporting_zero_usage() {
        for status in [
            "0 credits remaining\n0 credits / month",
            "120 credits remaining\n100 credits / month",
        ] {
            assert!(matches!(
                parse_auggie_account_status(status),
                Err(ProviderError::Parse(_))
            ));
        }
    }

    #[test]
    fn rejects_credit_numbers_that_overflow_finite_arithmetic() {
        let huge = "9".repeat(350);
        let status = format!("{huge} credits remaining\n{huge} credits / month");
        assert!(matches!(
            parse_auggie_account_status(&status),
            Err(ProviderError::Parse(_))
        ));
    }

    #[test]
    fn web_usage_missing_limit_is_informational_and_keeps_observed_plan() {
        let usage = AugmentProvider::new()
            .parse_usage_response(&serde_json::json!({"used_credits": 23, "plan": "Max"}))
            .unwrap();
        assert!(usage.primary.is_informational);
        assert_eq!(usage.login_method.as_deref(), Some("Max"));
    }

    #[test]
    fn web_usage_observed_zero_and_positive_limit_is_real_zero() {
        let usage = AugmentProvider::new()
            .parse_usage_response(&serde_json::json!({"used_credits": 0, "credit_limit": 100}))
            .unwrap();
        assert!(!usage.primary.is_informational);
        assert_eq!(usage.primary.used_percent, 0.0);
        assert!(usage.login_method.is_none());
    }

    #[test]
    fn web_usage_uses_observed_fallback_fields_when_primary_fields_are_null() {
        let usage = AugmentProvider::new()
            .parse_usage_response(&serde_json::json!({
                "used_credits": null,
                "usage": 25,
                "credit_limit": null,
                "limit": 100,
                "plan": null,
                "subscription": "Team",
            }))
            .unwrap();
        assert!(!usage.primary.is_informational);
        assert_eq!(usage.primary.used_percent, 25.0);
        assert_eq!(usage.login_method.as_deref(), Some("Team"));
    }

    #[test]
    fn web_usage_empty_response_does_not_claim_connected_quota() {
        assert!(matches!(
            AugmentProvider::new().parse_usage_response(&serde_json::json!({})),
            Err(ProviderError::Parse(_))
        ));
    }

    #[test]
    fn web_usage_does_not_misclassify_server_failures_as_sign_in_required() {
        assert!(matches!(
            check_usage_http_status(reqwest::StatusCode::UNAUTHORIZED),
            Err(ProviderError::AuthRequired)
        ));
        assert!(matches!(
            check_usage_http_status(reqwest::StatusCode::SERVICE_UNAVAILABLE),
            Err(ProviderError::Other(message)) if message.contains("503")
        ));
        assert!(check_usage_http_status(reqwest::StatusCode::OK).is_ok());
    }

    #[test]
    fn cli_presence_maps_to_local_runtime_offline_but_config_stays_default() {
        // CLI-presence messages surface as an offline local runtime.
        assert_eq!(
            AugmentProvider::new().error_state_kind(&ProviderError::NotInstalled(
                "Augment CLI not found. Install from https://www.augmentcode.com".to_string(),
            )),
            crate::core::ProviderStateKind::LocalRuntimeOffline
        );
        assert_eq!(
            AugmentProvider::new().error_state_kind(&ProviderError::NotInstalled(
                "Augment not found. Install from https://www.augmentcode.com".to_string(),
            )),
            crate::core::ProviderStateKind::LocalRuntimeOffline
        );
        // The auth-flavored config message keeps the default mapping.
        assert_eq!(
            AugmentProvider::new().error_state_kind(&ProviderError::NotInstalled(
                "Augment config not found".to_string(),
            )),
            crate::core::ProviderStateKind::NeedsAuthentication
        );
    }
}
