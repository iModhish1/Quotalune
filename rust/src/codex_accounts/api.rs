//! Codex API client: identity, OAuth refresh, quota fetch and recovery.
//!
//! Port of `windows/.../codex_api.py` (MIT). Reads a Codex home's `auth.json`,
//! refreshes tokens via the OpenAI OAuth endpoint, fetches `wham/usage` (or a
//! configured custom base URL) and normalizes the quota windows.

use std::path::Path;

use base64::Engine;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use thiserror::Error;

use super::models::{
    AccountUsageSnapshot, CreditsBalanceSnapshot, UsageWindowSnapshot, WindowRole,
};
use crate::core::{
    BankedResetCard, BankedResetInventory, ProviderResetFacts, ResetDatum, ResetUnavailableReason,
    ScheduledReset, credentialed_http_client_builder,
};

pub const REFRESH_ENDPOINT: &str = "https://auth.openai.com/oauth/token";
pub const USAGE_DEFAULT_BASE: &str = "https://chatgpt.com/backend-api";
pub const REFRESH_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const REQUEST_TIMEOUT_SECONDS: u64 = 30;
const UNAUTHORIZED_MESSAGE: &str = "The Codex usage API request returned unauthorized.";
const RESET_CREDITS_PATH: &str = "/wham/rate-limit-reset-credits";

/// Friendly error surfaced to callers.
#[derive(Debug, Error)]
pub enum CodexApiError {
    #[error("{0}")]
    Message(String),
    #[error("network error: {0}")]
    Network(String),
    #[error("failed to parse Codex payload: {0}")]
    Parse(String),
}

/// Identity derived from a Codex account's credentials.
#[derive(Debug, Clone)]
pub struct AuthBackedIdentity {
    pub email: Option<String>,
    pub auth_subject: Option<String>,
    pub plan: Option<String>,
    pub provider_account_id: Option<String>,
}

/// Raw auth.json credentials.
#[derive(Debug, Clone)]
pub struct AuthCredentials {
    pub access_token: String,
    pub refresh_token: String,
    pub id_token: Option<String>,
    pub account_id: Option<String>,
    pub last_refresh: Option<DateTime<Utc>>,
}

impl AuthCredentials {
    pub fn needs_refresh(&self) -> bool {
        self.last_refresh
            .is_none_or(|last| Utc::now() - last > chrono::TimeDelta::days(8))
    }
}

/// Load the account identity from a Codex home's `auth.json`.
pub fn load_identity(codex_home_path: &Path) -> Result<AuthBackedIdentity, CodexApiError> {
    Ok(identity_from_credentials(&load_credentials(
        codex_home_path,
    )?))
}

/// Read and parse `auth.json`.
pub fn load_credentials(codex_home_path: &Path) -> Result<AuthCredentials, CodexApiError> {
    let auth_path = codex_home_path.join("auth.json");
    let content = std::fs::read_to_string(&auth_path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            CodexApiError::Message("No `auth.json` was found for this account.".to_string())
        } else {
            CodexApiError::Parse(format!("Failed to read the auth file: {e}"))
        }
    })?;
    parse_credentials_json(&content)
}

/// Parse `auth.json` contents, accepting `OPENAI_API_KEY` or a `tokens` object.
pub fn parse_credentials_json(content: &str) -> Result<AuthCredentials, CodexApiError> {
    let json: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| CodexApiError::Parse(format!("Failed to parse the auth file: {e}")))?;

    if let Some(api_key) = json
        .get("OPENAI_API_KEY")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return Ok(AuthCredentials {
            access_token: api_key.to_string(),
            refresh_token: String::new(),
            id_token: None,
            account_id: None,
            last_refresh: None,
        });
    }

    let tokens = json
        .get("tokens")
        .and_then(|v| v.as_object())
        .ok_or_else(|| {
            CodexApiError::Message(
                "The required token fields are missing from `auth.json`.".to_string(),
            )
        })?;

    let access_token = tokens
        .get("access_token")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            CodexApiError::Message(
                "The required token fields are missing from `auth.json`.".to_string(),
            )
        })?
        .to_string();

    let id_token = tokens
        .get("id_token")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let account_id = tokens
        .get("account_id")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or_else(|| account_id_from_id_token(id_token.as_deref()));

    Ok(AuthCredentials {
        access_token,
        refresh_token: tokens
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        id_token,
        account_id,
        last_refresh: json
            .get("last_refresh")
            .and_then(|v| v.as_str())
            .and_then(super::models::parse_datetime),
    })
}

/// Save (possibly refreshed) credentials back to `auth.json`.
pub fn save_credentials(
    codex_home_path: &Path,
    credentials: &AuthCredentials,
) -> std::io::Result<()> {
    let auth_path = codex_home_path.join("auth.json");
    let mut payload: serde_json::Value = std::fs::read_to_string(&auth_path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_else(|| serde_json::json!({}));

    let mut tokens = serde_json::Map::new();
    tokens.insert(
        "access_token".to_string(),
        serde_json::json!(credentials.access_token),
    );
    tokens.insert(
        "refresh_token".to_string(),
        serde_json::json!(credentials.refresh_token),
    );
    if let Some(id_token) = &credentials.id_token {
        tokens.insert("id_token".to_string(), serde_json::json!(id_token));
    }
    if let Some(account_id) = &credentials.account_id {
        tokens.insert("account_id".to_string(), serde_json::json!(account_id));
    }
    if let Some(obj) = payload.as_object_mut() {
        obj.insert("tokens".to_string(), serde_json::Value::Object(tokens));
        obj.insert(
            "last_refresh".to_string(),
            serde_json::json!(Utc::now().to_rfc3339_opts(chrono::SecondsFormat::AutoSi, true)),
        );
    }
    std::fs::write(&auth_path, serde_json::to_vec_pretty(&payload)?)
}

fn identity_from_credentials(credentials: &AuthCredentials) -> AuthBackedIdentity {
    let payload = credentials
        .id_token
        .as_deref()
        .and_then(jwt_payload)
        .unwrap_or_default();
    let auth = payload
        .get("https://api.openai.com/auth")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    let profile = payload
        .get("https://api.openai.com/profile")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    let email = normalize_string(payload.get("email").and_then(|v| v.as_str()))
        .or_else(|| normalize_string(profile.get("email").and_then(|v| v.as_str())));
    let auth_subject = normalize_string(payload.get("sub").and_then(|v| v.as_str()));
    let plan = normalize_string(auth.get("chatgpt_plan_type").and_then(|v| v.as_str()))
        .or_else(|| normalize_string(payload.get("chatgpt_plan_type").and_then(|v| v.as_str())));
    let provider_account_id = normalize_string(credentials.account_id.as_deref())
        .or_else(|| normalize_string(auth.get("chatgpt_account_id").and_then(|v| v.as_str())))
        .or_else(|| normalize_string(payload.get("chatgpt_account_id").and_then(|v| v.as_str())));

    AuthBackedIdentity {
        email,
        auth_subject,
        plan,
        provider_account_id,
    }
}

/// Minimal JWT payload extraction (base64url payload, no signature verification).
pub fn jwt_payload(token: &str) -> Option<serde_json::Map<String, serde_json::Value>> {
    let mut parts = token.split('.');
    let _header = parts.next()?;
    let payload = parts.next()?;
    let mut padded = payload.to_string();
    while padded.len() % 4 != 0 {
        padded.push('=');
    }
    let decoded = base64::engine::general_purpose::URL_SAFE
        .decode(padded.as_bytes())
        .ok()?;
    serde_json::from_slice::<serde_json::Value>(&decoded)
        .ok()?
        .as_object()
        .cloned()
}

fn account_id_from_id_token(id_token: Option<&str>) -> Option<String> {
    let payload = id_token.and_then(jwt_payload)?;
    let auth = payload
        .get("https://api.openai.com/auth")
        .and_then(|v| v.as_object())?;
    normalize_string(auth.get("chatgpt_account_id").and_then(|v| v.as_str()))
        .or_else(|| normalize_string(payload.get("chatgpt_account_id").and_then(|v| v.as_str())))
}

fn normalize_string(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn string_value(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

// ── Quota fetching ──────────────────────────────────────────────────────────

/// Client for live quota reads. Stateless per call; refresh decisions happen in
/// `CodexAccountApi::fetch_snapshot`.
pub struct CodexAccountApi {
    client: reqwest::Client,
}

impl CodexAccountApi {
    pub fn new() -> Self {
        let client = credentialed_http_client_builder()
            .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECONDS))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self { client }
    }

    /// Fetch a verified (or single) quota snapshot for the account at
    /// `codex_home_path`, refreshing credentials when needed.
    pub async fn fetch_snapshot(
        &self,
        codex_home_path: &Path,
        email_hint: Option<&str>,
        verify_live_data: bool,
    ) -> Result<AccountUsageSnapshot, CodexApiError> {
        let mut credentials = load_credentials(codex_home_path)?;

        if credentials.needs_refresh()
            && !credentials.refresh_token.is_empty()
            && let Ok(refreshed) = self.refresh(&credentials).await
        {
            // Best-effort credential persist: a write failure here cannot
            // block the in-memory refresh already in hand.
            let _saved_refreshed = save_credentials(codex_home_path, &refreshed);
            credentials = refreshed;
        }

        let result = self
            .fetch_once(codex_home_path, &credentials, email_hint, verify_live_data)
            .await;
        if !matches!(&result, Err(CodexApiError::Message(msg)) if msg == UNAUTHORIZED_MESSAGE)
            || credentials.refresh_token.is_empty()
        {
            return result;
        }

        if let Ok(refreshed) = self.refresh(&credentials).await {
            // Best-effort credential persist before the retry; a write error
            // cannot block the fetch already in progress.
            let _saved_retry = save_credentials(codex_home_path, &refreshed);
            return self
                .fetch_once(codex_home_path, &refreshed, email_hint, verify_live_data)
                .await;
        }
        result
    }

    async fn fetch_once(
        &self,
        codex_home_path: &Path,
        credentials: &AuthCredentials,
        email_hint: Option<&str>,
        verify_live_data: bool,
    ) -> Result<AccountUsageSnapshot, CodexApiError> {
        if verify_live_data {
            self.fetch_verified(codex_home_path, credentials, email_hint)
                .await
        } else {
            self.fetch_single(codex_home_path, credentials, email_hint)
                .await
        }
    }

    /// Fetch three reads and require equivalence (CodexControl accuracy model).
    async fn fetch_verified(
        &self,
        codex_home_path: &Path,
        credentials: &AuthCredentials,
        email_hint: Option<&str>,
    ) -> Result<AccountUsageSnapshot, CodexApiError> {
        let first = self
            .fetch_single(codex_home_path, credentials, email_hint)
            .await?;
        let second = self
            .fetch_single(codex_home_path, credentials, email_hint)
            .await?;
        if is_equivalent(&first, &second) {
            return Ok(second);
        }
        let third = self
            .fetch_single(codex_home_path, credentials, email_hint)
            .await?;
        if is_equivalent(&first, &third) || is_equivalent(&second, &third) {
            return Ok(third);
        }
        Err(CodexApiError::Message(
            "Live API responses were inconsistent. The data could not be verified.".to_string(),
        ))
    }

    async fn fetch_single(
        &self,
        codex_home_path: &Path,
        credentials: &AuthCredentials,
        fallback_email: Option<&str>,
    ) -> Result<AccountUsageSnapshot, CodexApiError> {
        let identity = identity_from_credentials(credentials);
        let response = self
            .fetch_usage(
                codex_home_path,
                &credentials.access_token,
                credentials.account_id.as_deref(),
            )
            .await?;
        let rate_limit = response.get("rate_limit").and_then(|v| v.as_object());
        let (primary_window, secondary_window) = make_normalized_windows(rate_limit);
        let credits = response
            .get("credits")
            .and_then(|v| v.as_object())
            .map(make_credits);

        let observed_at = Utc::now();
        let banked_reset_cards = self
            .fetch_reset_inventory(
                codex_home_path,
                &credentials.access_token,
                credentials.account_id.as_deref(),
            )
            .await;
        let reset_facts = Some(managed_reset_facts(
            primary_window.as_ref(),
            secondary_window.as_ref(),
            observed_at,
            banked_reset_cards,
        ));

        Ok(AccountUsageSnapshot {
            email: identity.email.or_else(|| normalize_string(fallback_email)),
            provider_account_id: identity
                .provider_account_id
                .or_else(|| credentials.account_id.clone()),
            plan: normalize_string(response.get("plan_type").and_then(|v| v.as_str()))
                .or(identity.plan),
            allowed: rate_limit
                .and_then(|r| r.get("allowed"))
                .and_then(|v| v.as_bool()),
            limit_reached: rate_limit
                .and_then(|r| r.get("limit_reached"))
                .and_then(|v| v.as_bool()),
            primary_window,
            secondary_window,
            credits,
            reset_facts,
            updated_at: observed_at,
        })
    }

    async fn fetch_reset_inventory(
        &self,
        codex_home_path: &Path,
        access_token: &str,
        account_id: Option<&str>,
    ) -> ResetDatum<BankedResetInventory> {
        let Some(url) = resolve_reset_credits_url(codex_home_path) else {
            return ResetDatum::Unsupported;
        };
        let mut request = self
            .client
            .get(url)
            .header("Authorization", format!("Bearer {access_token}"))
            .header("User-Agent", "codex-cli")
            .header("Accept", "application/json")
            .header("Cache-Control", "no-cache, no-store, max-age=0")
            .header("Pragma", "no-cache");
        if let Some(account_id) = account_id {
            request = request.header("ChatGPT-Account-Id", account_id);
        }

        let response = match request.send().await {
            Ok(response) => response,
            Err(_) => {
                return ResetDatum::unavailable(ResetUnavailableReason::FetchFailed);
            }
        };
        if !response.status().is_success() {
            return ResetDatum::unavailable(ResetUnavailableReason::FetchFailed);
        }
        let bytes = match response.bytes().await {
            Ok(bytes) => bytes,
            Err(_) => return ResetDatum::unavailable(ResetUnavailableReason::FetchFailed),
        };
        match decode_reset_credits(&bytes) {
            Ok(reset) => reset_credits_inventory(reset),
            Err(reason) => ResetDatum::unavailable(reason),
        }
    }

    async fn fetch_usage(
        &self,
        codex_home_path: &Path,
        access_token: &str,
        account_id: Option<&str>,
    ) -> Result<serde_json::Value, CodexApiError> {
        let url = resolve_usage_url(codex_home_path);
        let mut request = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {access_token}"))
            .header("User-Agent", "codex-cli")
            .header("Accept", "application/json")
            .header("Cache-Control", "no-cache, no-store, max-age=0")
            .header("Pragma", "no-cache");
        if let Some(account_id) = account_id {
            request = request.header("ChatGPT-Account-Id", account_id);
        }

        let response = request
            .send()
            .await
            .map_err(|e| CodexApiError::Network(e.to_string()))?;
        if !response.status().is_success() {
            let status = response.status();
            if status == reqwest::StatusCode::UNAUTHORIZED
                || status == reqwest::StatusCode::FORBIDDEN
            {
                return Err(CodexApiError::Message(UNAUTHORIZED_MESSAGE.to_string()));
            }
            let body = response.text().await.unwrap_or_default().trim().to_string();
            let msg = if body.is_empty() {
                format!("Codex API error {status}.")
            } else {
                format!("Codex API error {status}: {body}")
            };
            return Err(CodexApiError::Message(msg));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| CodexApiError::Parse(e.to_string()))?;
        if !json.is_object() {
            return Err(CodexApiError::Parse(
                "The Codex API response was not in the expected format.".to_string(),
            ));
        }
        Ok(json)
    }

    /// Refresh an expired access token via the OpenAI OAuth endpoint.
    pub async fn refresh(
        &self,
        credentials: &AuthCredentials,
    ) -> Result<AuthCredentials, CodexApiError> {
        if credentials.refresh_token.is_empty() {
            return Err(CodexApiError::Message(
                "No refresh token available for this account.".to_string(),
            ));
        }
        let body = serde_json::json!({
            "client_id": REFRESH_CLIENT_ID,
            "grant_type": "refresh_token",
            "refresh_token": credentials.refresh_token,
            "scope": "openid profile email",
        });
        let response = self
            .client
            .post(REFRESH_ENDPOINT)
            .json(&body)
            .header("Content-Type", "application/json")
            .header("Cache-Control", "no-cache, no-store, max-age=0")
            .header("Pragma", "no-cache")
            .send()
            .await
            .map_err(|e| CodexApiError::Network(e.to_string()))?;

        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let text = response.text().await.unwrap_or_default();
            let code = extract_error_code(&text).to_lowercase();
            let message = if code == "refresh_token_reused" {
                "The refresh token can no longer be reused. Sign in again for this account."
            } else if code == "refresh_token_invalidated" {
                "The refresh token was revoked. Sign in again for this account."
            } else {
                "The refresh token has expired. Sign in again for this account."
            };
            return Err(CodexApiError::Message(message.to_string()));
        }
        if !response.status().is_success() {
            return Err(CodexApiError::Message(
                "The Codex API response was not in the expected format.".to_string(),
            ));
        }
        let payload: serde_json::Value = response
            .json()
            .await
            .map_err(|e| CodexApiError::Parse(e.to_string()))?;
        if !payload.is_object() {
            return Err(CodexApiError::Message(
                "The Codex API response was not in the expected format.".to_string(),
            ));
        }
        let new_id_token = string_value(&payload, "id_token");
        Ok(AuthCredentials {
            access_token: string_value(&payload, "access_token")
                .unwrap_or_else(|| credentials.access_token.clone()),
            refresh_token: string_value(&payload, "refresh_token")
                .unwrap_or_else(|| credentials.refresh_token.clone()),
            id_token: new_id_token
                .clone()
                .or_else(|| credentials.id_token.clone()),
            account_id: credentials
                .account_id
                .clone()
                .or_else(|| account_id_from_id_token(new_id_token.as_deref())),
            last_refresh: Some(Utc::now()),
        })
    }
}

impl Default for CodexAccountApi {
    fn default() -> Self {
        Self::new()
    }
}

// ── URL resolution ──────────────────────────────────────────────────────────

/// Resolve the usage URL from `config.toml` (`chatgpt_base_url`) or the default.
pub fn resolve_usage_url(codex_home_path: &Path) -> String {
    let config_path = codex_home_path.join("config.toml");
    let configured_base = if config_path.exists() {
        std::fs::read_to_string(&config_path)
            .ok()
            .and_then(|raw| parse_chatgpt_base_url(&raw))
    } else {
        None
    };

    let mut base = configured_base.unwrap_or_else(|| USAGE_DEFAULT_BASE.to_string());
    while base.ends_with('/') {
        base.pop();
    }
    if base.starts_with("https://chatgpt.com") && !base.contains("/backend-api") {
        base.push_str("/backend-api");
    }
    if base.starts_with("https://chat.openai.com") && !base.contains("/backend-api") {
        base.push_str("/backend-api");
    }
    let path = if base.contains("/backend-api") {
        "/wham/usage"
    } else {
        "/api/codex/usage"
    };
    format!("{base}{path}")
}

/// Resolve reset inventory only for the authenticated ChatGPT `wham` API.
/// Custom Codex-compatible backends do not establish support for this endpoint.
pub fn resolve_reset_credits_url(codex_home_path: &Path) -> Option<String> {
    let usage = resolve_usage_url(codex_home_path);
    let url = reqwest::Url::parse(&usage).ok()?;
    let supported = url.scheme() == "https"
        && matches!(url.host_str(), Some("chatgpt.com" | "chat.openai.com"))
        && url.port_or_known_default() == Some(443)
        && url.username().is_empty()
        && url.password().is_none();
    // Unit tests exercise the actual authenticated request against a local
    // mock server. No loopback exception exists in production builds.
    #[cfg(test)]
    let supported = supported || (url.scheme() == "http" && url.host_str() == Some("127.0.0.1"));
    if !supported
        || url.path() != "/backend-api/wham/usage"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return None;
    }
    usage
        .strip_suffix("/wham/usage")
        .map(|base| format!("{base}{RESET_CREDITS_PATH}"))
}

/// Extract `chatgpt_base_url` from a Codex `config.toml`.
pub fn parse_chatgpt_base_url(contents: &str) -> Option<String> {
    for raw_line in contents.lines() {
        let line = raw_line.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }
        let mut parts = line.splitn(2, '=');
        let key = parts.next()?.trim();
        let value = parts.next()?.trim();
        if key != "chatgpt_base_url" {
            continue;
        }
        let value = value
            .strip_prefix('"')
            .and_then(|v| v.strip_suffix('"'))
            .or_else(|| value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')))
            .unwrap_or(value);
        return Some(value.to_string());
    }
    None
}

// ── Window normalization (session/weekly) ───────────────────────────────────

fn make_window(window: &serde_json::Map<String, serde_json::Value>) -> Option<UsageWindowSnapshot> {
    let used_percent = window
        .get("used_percent")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let reset_at = window
        .get("reset_at")
        .and_then(|v| v.as_i64())
        .and_then(|ts| DateTime::<Utc>::from_timestamp(ts, 0));
    let limit_window_seconds = window
        .get("limit_window_seconds")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    Some(UsageWindowSnapshot::new(
        used_percent,
        reset_at,
        limit_window_seconds,
    ))
}

/// Normalize the `rate_limit` object into (primary, secondary) windows with
/// roles assigned and `limit_reached` forced to 100%.
pub fn make_normalized_windows(
    rate_limit: Option<&serde_json::Map<String, serde_json::Value>>,
) -> (Option<UsageWindowSnapshot>, Option<UsageWindowSnapshot>) {
    let Some(rate_limit) = rate_limit else {
        return (None, None);
    };
    let mut primary = rate_limit
        .get("primary_window")
        .and_then(|v| v.as_object())
        .and_then(make_window);
    let mut secondary = rate_limit
        .get("secondary_window")
        .and_then(|v| v.as_object())
        .and_then(make_window);

    if rate_limit.get("limit_reached") == Some(&serde_json::Value::Bool(true)) {
        if let Some(p) = primary.as_mut() {
            p.used_percent = 100.0;
        }
        if let Some(s) = secondary.as_mut() {
            s.used_percent = 100.0;
        }
    }

    normalize_window_roles(primary, secondary)
}

/// Put the session window first and the weekly window second.
pub fn normalize_window_roles(
    primary: Option<UsageWindowSnapshot>,
    secondary: Option<UsageWindowSnapshot>,
) -> (Option<UsageWindowSnapshot>, Option<UsageWindowSnapshot>) {
    if let (Some(p), Some(s)) = (&primary, &secondary) {
        let (pr, sr) = (p.role(), s.role());
        if matches!(
            (pr, sr),
            (WindowRole::Weekly, WindowRole::Session) | (WindowRole::Weekly, WindowRole::Unknown)
        ) {
            return (secondary, primary);
        }
        return (primary, secondary);
    }
    if let Some(p) = &primary {
        if p.role() == WindowRole::Weekly {
            return (None, primary);
        }
        return (primary, None);
    }
    if let Some(s) = &secondary {
        if s.role() == WindowRole::Weekly {
            return (None, secondary);
        }
        return (secondary, None);
    }
    (None, None)
}

fn make_credits(credits: &serde_json::Map<String, serde_json::Value>) -> CreditsBalanceSnapshot {
    CreditsBalanceSnapshot {
        has_credits: credits
            .get("has_credits")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        unlimited: credits
            .get("unlimited")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        balance: credits.get("balance").and_then(|v| v.as_f64()),
    }
}

#[derive(Debug, Deserialize)]
struct ResetCreditResponse {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ResetCreditsResponse {
    #[serde(default)]
    credits: Vec<ResetCreditResponse>,
    available_count: Option<u32>,
}

fn decode_reset_credits(data: &[u8]) -> Result<ResetCreditsResponse, ResetUnavailableReason> {
    serde_json::from_slice(data).map_err(|_| ResetUnavailableReason::Malformed)
}

fn reset_credits_inventory(reset: ResetCreditsResponse) -> ResetDatum<BankedResetInventory> {
    let Some(available_count) = reset.available_count else {
        return ResetDatum::unavailable(ResetUnavailableReason::NotReported);
    };
    let cards = reset
        .credits
        .into_iter()
        .map(|credit| {
            BankedResetCard::from_reported(
                credit.id,
                credit.status.as_deref(),
                credit.expires_at.as_deref(),
            )
        })
        .collect();
    ResetDatum::known(BankedResetInventory::from_reported(available_count, cards))
}

fn managed_reset_facts(
    primary: Option<&UsageWindowSnapshot>,
    secondary: Option<&UsageWindowSnapshot>,
    observed_at: DateTime<Utc>,
    banked_reset_cards: ResetDatum<BankedResetInventory>,
) -> ProviderResetFacts {
    let next_weekly_reset = [("primary", primary), ("secondary", secondary)]
        .into_iter()
        .filter_map(|(window_key, window)| {
            let window = window?;
            (window.role() == WindowRole::Weekly)
                .then_some(window.reset_at)
                .flatten()
                .filter(|resets_at| *resets_at > observed_at)
                .map(|resets_at| ScheduledReset {
                    window_key: window_key.to_string(),
                    resets_at,
                })
        })
        .min_by_key(|scheduled| scheduled.resets_at)
        .map(ResetDatum::known)
        .unwrap_or_else(|| ResetDatum::unavailable(ResetUnavailableReason::NotReported));

    ProviderResetFacts {
        observed_at,
        provider_issued_resets: ResetDatum::unavailable(ResetUnavailableReason::NotReported),
        last_actual_reset: ResetDatum::unavailable(ResetUnavailableReason::NotObserved),
        next_weekly_reset,
        banked_reset_cards,
    }
}

fn extract_error_code(payload: &str) -> String {
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(payload) else {
        return String::new();
    };
    let error = parsed.get("error");
    if let Some(error) = error.and_then(|e| e.as_object()) {
        return error
            .get("code")
            .and_then(|c| c.as_str())
            .unwrap_or_default()
            .to_string();
    }
    if let Some(error) = error.and_then(|e| e.as_str()) {
        return error.to_string();
    }
    parsed
        .get("code")
        .and_then(|c| c.as_str())
        .unwrap_or_default()
        .to_string()
}

/// Whether two fetched snapshots are equivalent (CodexControl verification).
pub fn is_equivalent(left: &AccountUsageSnapshot, right: &AccountUsageSnapshot) -> bool {
    let email_eq = left.email.as_deref().map(str::to_lowercase)
        == right.email.as_deref().map(str::to_lowercase);
    email_eq
        && left.provider_account_id == right.provider_account_id
        && left.plan == right.plan
        && left.allowed == right.allowed
        && left.limit_reached == right.limit_reached
        && windows_equivalent(&left.primary_window, &right.primary_window)
        && windows_equivalent(&left.secondary_window, &right.secondary_window)
        && credits_equivalent(&left.credits, &right.credits)
}

fn windows_equivalent(
    left: &Option<UsageWindowSnapshot>,
    right: &Option<UsageWindowSnapshot>,
) -> bool {
    match (left, right) {
        (None, None) => true,
        (None, Some(_)) | (Some(_), None) => false,
        (Some(l), Some(r)) => {
            let reset_matches = match (l.reset_at, r.reset_at) {
                (None, None) => true,
                (Some(a), Some(b)) => (a - b).num_seconds().abs() <= 1,
                _ => false,
            };
            l.limit_window_seconds == r.limit_window_seconds
                && reset_matches
                && (l.used_percent - r.used_percent).abs() < 0.001
        }
    }
}

fn credits_equivalent(
    left: &Option<CreditsBalanceSnapshot>,
    right: &Option<CreditsBalanceSnapshot>,
) -> bool {
    match (left, right) {
        (None, None) => true,
        (None, Some(_)) | (Some(_), None) => false,
        (Some(l), Some(r)) => {
            let balance_matches = match (l.balance, r.balance) {
                (None, None) => true,
                (Some(a), Some(b)) => (a - b).abs() < 0.001,
                _ => false,
            };
            l.has_credits == r.has_credits && l.unlimited == r.unlimited && balance_matches
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_credentials_accepts_api_key() {
        let creds = parse_credentials_json(r#"{"OPENAI_API_KEY":"sk-test"}"#).unwrap();
        assert_eq!(creds.access_token, "sk-test");
        assert_eq!(creds.account_id, None);
    }

    #[test]
    fn parse_credentials_accepts_tokens() {
        let creds = parse_credentials_json(
            r#"{"tokens":{"access_token":"at","refresh_token":"rt","account_id":"42"},"last_refresh":"2026-01-01T00:00:00Z"}"#,
        )
        .unwrap();
        assert_eq!(creds.access_token, "at");
        assert_eq!(creds.refresh_token, "rt");
        assert_eq!(creds.account_id.as_deref(), Some("42"));
    }

    #[test]
    fn parse_credentials_missing_tokens_errors() {
        assert!(parse_credentials_json(r#"{"foo":1}"#).is_err());
    }

    #[test]
    fn reset_inventory_rejects_custom_backend_api_origins() {
        let dir = tempfile::tempdir().unwrap();
        for base in [
            "https://custom.example/backend-api",
            "https://chatgpt.com.evil.example/backend-api",
            "https://chatgpt.com:444/backend-api",
            "http://chatgpt.com/backend-api",
        ] {
            std::fs::write(
                dir.path().join("config.toml"),
                format!("chatgpt_base_url = \"{base}\"\n"),
            )
            .unwrap();
            assert_eq!(resolve_reset_credits_url(dir.path()), None, "{base}");
        }
        std::fs::write(
            dir.path().join("config.toml"),
            "chatgpt_base_url = \"https://chatgpt.com/backend-api\"\n",
        )
        .unwrap();
        assert_eq!(
            resolve_reset_credits_url(dir.path()).as_deref(),
            Some("https://chatgpt.com/backend-api/wham/rate-limit-reset-credits")
        );
    }

    #[test]
    fn jwt_payload_decodes() {
        let payload =
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(br#"{"email":"a@b.c"}"#);
        let token = format!("eyJhbGciOiJub25lIn0.{payload}.");
        let parsed = jwt_payload(&token).unwrap();
        assert_eq!(parsed.get("email").and_then(|v| v.as_str()), Some("a@b.c"));
    }

    #[test]
    fn normalize_window_roles_orders_session_first() {
        let weekly = UsageWindowSnapshot::new(10.0, None, 604_800);
        let session = UsageWindowSnapshot::new(10.0, None, 18_000);
        let (p, s) = normalize_window_roles(Some(weekly), Some(session));
        assert_eq!(p.unwrap().limit_window_seconds, 18_000);
        assert_eq!(s.unwrap().limit_window_seconds, 604_800);
    }

    #[test]
    fn limit_reached_forces_100() {
        let payload = make_rate_limit();
        let (p, s) = make_normalized_windows(Some(&payload));
        assert_eq!(p.as_ref().unwrap().used_percent, 100.0);
        assert_eq!(s.as_ref().unwrap().used_percent, 100.0);
    }

    fn make_rate_limit() -> serde_json::Map<String, serde_json::Value> {
        serde_json::from_str(
            r#"{"allowed":true,"limit_reached":true,"primary_window":{"used_percent":40,"reset_at":0,"limit_window_seconds":18000},"secondary_window":{"used_percent":20,"reset_at":0,"limit_window_seconds":604800}}"#,
        )
        .unwrap()
    }

    #[test]
    fn resolve_usage_url_default() {
        let dir = tempfile::tempdir().unwrap();
        let url = resolve_usage_url(dir.path());
        assert_eq!(url, "https://chatgpt.com/backend-api/wham/usage");
        assert_eq!(
            resolve_reset_credits_url(dir.path()).as_deref(),
            Some("https://chatgpt.com/backend-api/wham/rate-limit-reset-credits")
        );
    }

    #[test]
    fn reset_inventory_decoder_preserves_zero_multiple_and_unknown() {
        let zero = decode_reset_credits(br#"{"available_count":0,"credits":[]}"#).unwrap();
        let ResetDatum::Known { value: zero } = reset_credits_inventory(zero) else {
            panic!("explicit zero must remain known");
        };
        assert_eq!(zero.reported_available_count, 0);
        assert!(zero.details_complete);

        let multiple = decode_reset_credits(
            br#"{"available_count":1,"credits":[
                {"id":"a","status":"available","expires_at":"2026-10-01T00:00:00Z"},
                {"id":"b","status":"future-status","expires_at":"bad"}
            ]}"#,
        )
        .unwrap();
        let ResetDatum::Known { value: multiple } = reset_credits_inventory(multiple) else {
            panic!("reported count must remain known");
        };
        assert_eq!(multiple.cards.len(), 2);
        assert_eq!(multiple.cards[0].opaque_id.as_deref(), Some("a"));
        assert_eq!(
            multiple.cards[0].status,
            crate::core::ResetCardStatus::Available
        );
        assert_eq!(
            multiple.cards[1].status,
            crate::core::ResetCardStatus::Unknown
        );
        assert_eq!(
            multiple.cards[1].expires_at,
            ResetDatum::unavailable(ResetUnavailableReason::Malformed)
        );
        assert!(!multiple.details_complete);
    }

    #[test]
    fn reset_inventory_missing_count_is_unavailable() {
        let missing = decode_reset_credits(br#"{"credits":[]}"#).unwrap();
        assert_eq!(
            reset_credits_inventory(missing),
            ResetDatum::unavailable(ResetUnavailableReason::NotReported)
        );
        assert!(matches!(
            decode_reset_credits(br#"{"available_count":false}"#),
            Err(ResetUnavailableReason::Malformed)
        ));
    }

    #[test]
    fn managed_reset_facts_require_future_weekly_evidence() {
        let observed_at = DateTime::parse_from_rfc3339("2026-09-13T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let reset_at = observed_at + chrono::Duration::days(4);
        let weekly = UsageWindowSnapshot::new(25.0, Some(reset_at), 604_800);
        let facts = managed_reset_facts(
            None,
            Some(&weekly),
            observed_at,
            ResetDatum::known(BankedResetInventory::from_reported(0, vec![])),
        );
        assert_eq!(
            facts.next_weekly_reset,
            ResetDatum::known(ScheduledReset {
                window_key: "secondary".into(),
                resets_at: reset_at,
            })
        );
        assert_eq!(
            facts.provider_issued_resets,
            ResetDatum::unavailable(ResetUnavailableReason::NotReported)
        );
    }

    #[tokio::test]
    async fn managed_fetch_attaches_reset_inventory_to_the_requested_account() {
        let mut server = mockito::Server::new_async().await;
        let usage_mock = server
            .mock("GET", "/backend-api/wham/usage")
            .match_header("authorization", "Bearer managed-token")
            .match_header("chatgpt-account-id", "managed-account")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"plan_type":"plus","rate_limit":{"primary_window":{"used_percent":10,"limit_window_seconds":18000}}}"#,
            )
            .create_async()
            .await;
        let reset_mock = server
            .mock("GET", "/backend-api/wham/rate-limit-reset-credits")
            .match_header("authorization", "Bearer managed-token")
            .match_header("chatgpt-account-id", "managed-account")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"available_count":1,"credits":[{"id":"managed-card","status":"available","expires_at":"2026-12-01T00:00:00Z"}]}"#,
            )
            .create_async()
            .await;
        let home = tempfile::tempdir().unwrap();
        std::fs::write(
            home.path().join("config.toml"),
            format!("chatgpt_base_url = \"{}/backend-api\"", server.url()),
        )
        .unwrap();
        let credentials = AuthCredentials {
            access_token: "managed-token".into(),
            refresh_token: String::new(),
            id_token: None,
            account_id: Some("managed-account".into()),
            last_refresh: None,
        };

        let snapshot = CodexAccountApi::new()
            .fetch_single(home.path(), &credentials, None)
            .await
            .unwrap();

        usage_mock.assert_async().await;
        reset_mock.assert_async().await;
        assert_eq!(
            snapshot.provider_account_id.as_deref(),
            Some("managed-account")
        );
        let facts = snapshot.reset_facts.expect("typed reset facts");
        let ResetDatum::Known { value } = facts.banked_reset_cards else {
            panic!("inventory must remain known");
        };
        assert_eq!(value.reported_available_count, 1);
        assert_eq!(value.cards[0].opaque_id.as_deref(), Some("managed-card"));
    }

    #[test]
    fn parse_chatgpt_base_url_parses_quoted() {
        let url = parse_chatgpt_base_url(
            "# comment\nchatgpt_base_url = \"https://example.com/backend-api\"\n",
        )
        .unwrap();
        assert_eq!(url, "https://example.com/backend-api");
    }

    #[test]
    fn equivalent_snapshots_match() {
        let mk = || AccountUsageSnapshot {
            email: Some("a@b.c".to_string()),
            provider_account_id: Some("x".to_string()),
            plan: Some("pro".to_string()),
            allowed: Some(true),
            limit_reached: None,
            primary_window: Some(UsageWindowSnapshot::new(12.0, Some(Utc::now()), 18_000)),
            secondary_window: None,
            credits: None,
            reset_facts: None,
            updated_at: Utc::now(),
        };
        assert!(is_equivalent(&mk(), &mk()));
        let mut inventory_changed = mk();
        inventory_changed.reset_facts = Some(managed_reset_facts(
            None,
            None,
            Utc::now(),
            ResetDatum::known(BankedResetInventory::from_reported(3, vec![])),
        ));
        assert!(
            is_equivalent(&mk(), &inventory_changed),
            "optional inventory changes must not invalidate verified quota"
        );
        let mut different = mk();
        different.plan = Some("plus".to_string());
        assert!(!is_equivalent(&mk(), &different));
    }

    #[test]
    fn account_id_from_id_token_reads_auth() {
        let payload = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(br#"{"https://api.openai.com/auth":{"chatgpt_account_id":"acct-99"}}"#);
        let token = format!("h.{payload}.s");
        assert_eq!(
            account_id_from_id_token(Some(&token)).as_deref(),
            Some("acct-99")
        );
    }
}
