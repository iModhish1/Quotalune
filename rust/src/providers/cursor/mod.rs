//! Cursor provider implementation
//!
//! Fetches usage data from Cursor's API using its local app session or browser cookies.

mod api;
mod app_auth;
pub mod local_csv;
mod token_cost;

use async_trait::async_trait;

use crate::core::{
    CostSnapshot, FetchContext, Provider, ProviderError, ProviderFetchResult, ProviderId,
    ProviderMetadata, RateWindow, SourceMode, UsageSnapshot,
};

pub use api::CursorApi;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum CursorSessionSource {
    App,
    Browser,
}

impl CursorSessionSource {
    fn label(self) -> &'static str {
        match self {
            Self::App => "cursor-app",
            Self::Browser => "web",
        }
    }
}

/// Keep source selection injectable so tests never open the owner's browser or
/// Cursor profile. A source label describes the credential actually accepted.
async fn fetch_selected_session<T, L, W>(
    mode: SourceMode,
    has_manual_cookie: bool,
    local: impl FnOnce() -> L,
    web: impl FnOnce() -> W,
) -> Result<(T, CursorSessionSource), ProviderError>
where
    L: std::future::Future<Output = Result<Option<T>, ProviderError>>,
    W: std::future::Future<Output = Result<T, ProviderError>>,
{
    // Cookie-off/local onboarding is represented as Cli by the existing shell
    // settings contract. It must never open a browser or use manual cookies.
    if mode == SourceMode::Cli {
        return local()
            .await?
            .map(|value| (value, CursorSessionSource::App))
            .ok_or(ProviderError::AuthRequired);
    }
    if mode == SourceMode::Auto
        && !has_manual_cookie
        && let Ok(Some(value)) = local().await
    {
        return Ok((value, CursorSessionSource::App));
    }
    web()
        .await
        .map(|value| (value, CursorSessionSource::Browser))
}

/// Cursor provider for fetching AI usage limits
pub struct CursorProvider {
    metadata: ProviderMetadata,
    api: CursorApi,
}

impl CursorProvider {
    pub fn new() -> Self {
        Self {
            metadata: ProviderMetadata {
                id: ProviderId::Cursor,
                display_name: "Cursor",
                session_label: "Plan",
                weekly_label: "Cursor",
                supports_opus: false,
                // Upstream #2338: Cursor has no account credit balance to advertise.
                supports_credits: false,
                default_enabled: true,
                is_primary: false,
                dashboard_url: Some("https://cursor.com/dashboard/usage"),
                status_page_url: None,
            },
            api: CursorApi::new(),
        }
    }

    async fn fetch_web_usage(
        &self,
        ctx: &FetchContext,
    ) -> Result<
        (
            (
                api::CursorUsageResult,
                Option<token_cost::CursorTokenCostReport>,
            ),
            CursorSessionSource,
        ),
        ProviderError,
    > {
        fetch_selected_session(
            ctx.source_mode,
            ctx.manual_cookie_header.is_some(),
            || self.fetch_via_app_session(),
            || async {
                let cookie_header = if let Some(cookie_header) = ctx.manual_cookie_header.as_deref()
                {
                    cookie_header.to_string()
                } else {
                    crate::providers::browser_cookie_header(&["cursor.com", "cursor.sh"])?
                };
                self.fetch_usage_and_token_report(&cookie_header).await
            },
        )
        .await
    }

    /// One usage pass with the app's local session. Absence is separate from
    /// rejection, transport and response errors; only Auto may try cookies.
    async fn fetch_via_app_session(
        &self,
    ) -> Result<
        Option<(
            api::CursorUsageResult,
            Option<token_cost::CursorTokenCostReport>,
        )>,
        ProviderError,
    > {
        let Some(app_cookie) = app_auth::preferred_auto_cookie_header() else {
            return Ok(None);
        };
        let usage = self.api.fetch_usage_with_cookie_header(&app_cookie).await?;
        app_auth::store_validated_app_session(&app_cookie);
        let token_report = self.fetch_token_report_best_effort(&app_cookie).await;
        Ok(Some((usage, token_report)))
    }

    async fn fetch_usage_and_token_report(
        &self,
        cookie_header: &str,
    ) -> Result<
        (
            api::CursorUsageResult,
            Option<token_cost::CursorTokenCostReport>,
        ),
        ProviderError,
    > {
        let usage = self
            .api
            .fetch_usage_with_cookie_header(cookie_header)
            .await?;
        let token_report = self.fetch_token_report_best_effort(cookie_header).await;
        Ok((usage, token_report))
    }

    /// Best-effort token-cost page; never fail the main usage fetch.
    async fn fetch_token_report_best_effort(
        &self,
        cookie_header: &str,
    ) -> Option<token_cost::CursorTokenCostReport> {
        match token_cost::fetch_token_cost_report(
            self.api.client(),
            cookie_header,
            Some(token_cost::default_since()),
            Some(chrono::Utc::now()),
        )
        .await
        {
            Ok(report) => Some(report),
            Err(err) => {
                tracing::debug!("Cursor token-cost events unavailable: {err}");
                None
            }
        }
    }

    fn build_usage_snapshot(
        primary: RateWindow,
        secondary: Option<RateWindow>,
        model_specific: Option<RateWindow>,
        email: Option<String>,
        plan_type: Option<String>,
        token_report: Option<&token_cost::CursorTokenCostReport>,
    ) -> UsageSnapshot {
        let mut usage = UsageSnapshot::new(primary);
        if let Some(sec) = secondary {
            usage = usage.with_secondary(sec);
        }
        if let Some(ms) = model_specific {
            usage = usage.with_model_specific(ms);
        }
        if let Some(e) = email {
            usage = usage.with_email(e);
        }
        if let Some(plan) = plan_type {
            usage = usage.with_login_method(plan);
        }
        if let Some(report) = token_report {
            for window in report.to_extra_windows() {
                usage.extra_rate_windows.push(window);
            }
        }
        usage
    }

    fn build_fetch_result(
        usage: UsageSnapshot,
        cost: Option<CostSnapshot>,
        token_report: Option<&token_cost::CursorTokenCostReport>,
        include_credits: bool,
        source: CursorSessionSource,
    ) -> ProviderFetchResult {
        // On-demand / plan cost follows the shared optional-usage setting
        // (`FetchContext.include_credits` ↔ upstream showOptionalCreditsAndExtraUsage).
        let cost = if include_credits {
            token_report
                .and_then(|r| r.merge_into_cost(cost.clone()))
                .or(cost)
        } else {
            None
        };
        let mut result = ProviderFetchResult::new(usage, source.label());
        if let Some(c) = cost {
            result = result.with_cost(c);
        }
        result
    }
}

impl Default for CursorProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for CursorProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Cursor
    }

    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    async fn fetch_usage(&self, ctx: &FetchContext) -> Result<ProviderFetchResult, ProviderError> {
        tracing::debug!("Fetching Cursor usage via web API");

        match ctx.source_mode {
            // Cli represents the shell's cookie-off/local selection. Missing
            // local auth returns AuthRequired, without browser discovery.
            SourceMode::Auto | SourceMode::Web | SourceMode::Cli => {
                match self.fetch_web_usage(ctx).await {
                    Ok(((result, token_report), source)) => {
                        let api::CursorUsageResult {
                            primary,
                            secondary,
                            model_specific,
                            cost,
                            email,
                            plan_type,
                            grok_bot,
                        } = result;
                        let mut usage = Self::build_usage_snapshot(
                            primary,
                            secondary,
                            model_specific,
                            email,
                            plan_type,
                            token_report.as_ref(),
                        );
                        if let Some(grok_bot) = grok_bot {
                            usage.extra_rate_windows.push(grok_bot);
                        }
                        Ok(Self::build_fetch_result(
                            usage,
                            cost,
                            token_report.as_ref(),
                            ctx.include_credits,
                            source,
                        ))
                    }
                    Err(e) => {
                        tracing::warn!("Cursor API fetch failed: {}", e);
                        Err(e)
                    }
                }
            }
            SourceMode::OAuth => Err(ProviderError::UnsupportedSource(ctx.source_mode)),
        }
    }

    fn available_sources(&self) -> Vec<SourceMode> {
        vec![SourceMode::Auto, SourceMode::Web]
    }

    fn supports_web(&self) -> bool {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::FetchContext;

    #[tokio::test]
    async fn local_selection_never_reads_browser_or_manual_cookies() {
        for has_manual_cookie in [false, true] {
            let result = fetch_selected_session(
                SourceMode::Cli,
                has_manual_cookie,
                || async { Ok(Some("local-fixture")) },
                || async { panic!("explicit local selection may not read browser cookies") },
            )
            .await
            .unwrap();
            assert_eq!(result, ("local-fixture", CursorSessionSource::App));
        }
        let err = fetch_selected_session::<&str, _, _>(
            SourceMode::Cli,
            false,
            || async { Ok(None) },
            || async { panic!("missing/rejected local session may not fall back to browser") },
        )
        .await
        .unwrap_err();
        assert!(matches!(err, ProviderError::AuthRequired));
    }

    #[tokio::test]
    async fn automatic_selection_reports_the_source_that_actually_succeeded() {
        let local = fetch_selected_session(
            SourceMode::Auto,
            false,
            || async { Ok(Some("local-fixture")) },
            || async { panic!("valid local session needs no browser fallback") },
        )
        .await
        .unwrap();
        assert_eq!(local, ("local-fixture", CursorSessionSource::App));
        let fallback = fetch_selected_session(
            SourceMode::Auto,
            false,
            || async { Ok(None) },
            || async { Ok("browser-fixture") },
        )
        .await
        .unwrap();
        assert_eq!(fallback, ("browser-fixture", CursorSessionSource::Browser));
    }

    #[tokio::test]
    async fn explicit_local_selection_preserves_failures_without_browser_fallback() {
        // A builder error exercises the Network variant without network I/O.
        let network_error = reqwest::Client::new()
            .get("invalid URL")
            .build()
            .unwrap_err();
        for error in [
            ProviderError::Network(network_error),
            ProviderError::Other("Cursor API returned 503".into()),
            ProviderError::Parse("fixture malformed response".into()),
            ProviderError::AuthRequired,
        ] {
            let expected = std::mem::discriminant(&error);
            let result = fetch_selected_session::<&str, _, _>(
                SourceMode::Cli,
                false,
                || async { Err(error) },
                || async { panic!("local failure must not read browser cookies") },
            )
            .await
            .unwrap_err();
            assert_eq!(std::mem::discriminant(&result), expected);
        }
    }

    #[tokio::test]
    async fn automatic_selection_retains_browser_fallback_after_local_failure() {
        let result = fetch_selected_session(
            SourceMode::Auto,
            false,
            || async { Err(ProviderError::Other("Cursor API returned 503".into())) },
            || async { Ok("browser-fixture") },
        )
        .await
        .unwrap();
        assert_eq!(result, ("browser-fixture", CursorSessionSource::Browser));
    }

    #[tokio::test]
    async fn browser_and_manual_selections_do_not_read_local_profile() {
        for (mode, has_manual_cookie) in [
            (SourceMode::Web, false),
            (SourceMode::Web, true),
            (SourceMode::Auto, true),
        ] {
            let result = fetch_selected_session(
                mode,
                has_manual_cookie,
                || async { panic!("browser selection must not read local profile") },
                || async { Ok("browser-fixture") },
            )
            .await
            .unwrap();
            assert_eq!(result, ("browser-fixture", CursorSessionSource::Browser));
        }
    }

    #[tokio::test]
    async fn oauth_mode_still_unsupported() {
        let provider = CursorProvider::new();
        let ctx = FetchContext {
            source_mode: SourceMode::OAuth,
            ..FetchContext::default()
        };
        let err = provider
            .fetch_usage(&ctx)
            .await
            .expect_err("oauth unsupported");
        assert!(matches!(
            err,
            ProviderError::UnsupportedSource(SourceMode::OAuth)
        ));
    }

    #[test]
    fn does_not_advertise_unsupported_credits() {
        let provider = CursorProvider::new();
        assert!(!provider.metadata().supports_credits);
    }

    #[test]
    fn on_demand_cost_follows_include_credits_setting() {
        let usage = UsageSnapshot::new(RateWindow::new(16.0));
        let cost = CostSnapshot::new(3.5, "USD", "On-demand (billing cycle)").with_limit(10.0);

        let shown = CursorProvider::build_fetch_result(
            usage.clone(),
            Some(cost.clone()),
            None,
            true,
            CursorSessionSource::App,
        );
        assert_eq!(shown.source_label, "cursor-app");
        assert!(
            shown.cost.is_some(),
            "include_credits=true keeps on-demand cost"
        );

        let hidden = CursorProvider::build_fetch_result(
            usage,
            Some(cost),
            None,
            false,
            CursorSessionSource::Browser,
        );
        assert_eq!(hidden.source_label, "web");
        assert!(
            hidden.cost.is_none(),
            "include_credits=false hides on-demand extra usage"
        );
    }
}
