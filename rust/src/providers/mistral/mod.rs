//! Mistral provider implementation
//!
//! Fetches monthly spend from the Mistral admin billing API using browser
//! cookies or a manual Cookie header.

use async_trait::async_trait;
use chrono::{Datelike, Utc};
use reqwest::Client;

use crate::core::{
    FetchContext, Provider, ProviderError, ProviderFetchResult, ProviderId, ProviderMetadata,
    SourceMode,
};

const BASE_URL: &str = "https://admin.mistral.ai";
const COOKIE_DOMAINS: [&str; 3] = ["admin.mistral.ai", "mistral.ai", "auth.mistral.ai"];
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

mod billing;

pub struct MistralProvider {
    metadata: ProviderMetadata,
    client: Client,
}

impl MistralProvider {
    pub fn new() -> Self {
        Self {
            metadata: ProviderMetadata {
                id: ProviderId::Mistral,
                display_name: "Mistral",
                session_label: "Monthly",
                weekly_label: "",
                supports_opus: false,
                supports_credits: true,
                default_enabled: false,
                is_primary: false,
                dashboard_url: Some("https://admin.mistral.ai/organization/usage"),
                status_page_url: Some("https://status.mistral.ai"),
            },
            client: crate::core::credentialed_http_client_builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_else(|_| Client::new()),
        }
    }

    fn csrf_from_cookie_header(cookie_header: &str) -> Option<&str> {
        cookie_header.split(';').find_map(|part| {
            let (name, value) = part.trim().split_once('=')?;
            (name == "csrftoken").then_some(value.trim())
        })
    }

    async fn fetch_with_cookies(
        &self,
        cookie_header: &str,
    ) -> Result<ProviderFetchResult, ProviderError> {
        let now = Utc::now();
        let url = format!(
            "{BASE_URL}/api/billing/v2/usage?month={}&year={}",
            now.month(),
            now.year()
        );

        let mut request = self
            .client
            .get(url)
            .header("Accept", "*/*")
            .header("Cookie", cookie_header)
            .header("Origin", BASE_URL)
            .header("Referer", "https://admin.mistral.ai/organization/usage")
            .header("User-Agent", USER_AGENT);

        if let Some(csrf) = Self::csrf_from_cookie_header(cookie_header) {
            request = request.header("X-CSRFTOKEN", csrf);
        }

        let response = request.send().await?;
        let status = response.status();
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(ProviderError::AuthRequired);
        }
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(ProviderError::Other(format!(
                "Mistral API returned {}: {}",
                status,
                body.chars().take(200).collect::<String>()
            )));
        }

        let body = response.text().await?;
        billing::parse_response(&body)
    }
}

impl Default for MistralProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for MistralProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Mistral
    }

    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    async fn fetch_usage(&self, ctx: &FetchContext) -> Result<ProviderFetchResult, ProviderError> {
        match ctx.source_mode {
            SourceMode::Auto | SourceMode::Web => {
                if let Some(ref cookie_header) = ctx.manual_cookie_header {
                    return self.fetch_with_cookies(cookie_header).await;
                }

                match crate::providers::browser_cookie_header(&COOKIE_DOMAINS) {
                    Ok(header) => match self.fetch_with_cookies(&header).await {
                        Ok(result) => return Ok(result),
                        Err(ProviderError::AuthRequired) => {}
                        Err(err) => return Err(err),
                    },
                    Err(ProviderError::NoCookies) => {}
                    Err(err) => return Err(err),
                }

                Err(ProviderError::NoCookies)
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_csrf_token_from_cookie_header() {
        assert_eq!(
            MistralProvider::csrf_from_cookie_header("foo=bar; csrftoken=abc123; ory_session=x"),
            Some("abc123")
        );
    }
}
