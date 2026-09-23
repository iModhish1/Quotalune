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
const MAX_BILLING_RESPONSE_BYTES: usize = 8 * 1024 * 1024;
const COOKIE_DOMAINS: [&str; 3] = ["admin.mistral.ai", "mistral.ai", "auth.mistral.ai"];
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

mod billing;

pub struct MistralProvider {
    metadata: ProviderMetadata,
    client: Option<Client>,
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
                .redirect(reqwest::redirect::Policy::none())
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .ok(),
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
            .as_ref()
            .ok_or_else(|| ProviderError::Other("Mistral HTTP client unavailable".into()))?
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
        Self::read_billing_response(response).await
    }

    async fn read_billing_response(
        mut response: reqwest::Response,
    ) -> Result<ProviderFetchResult, ProviderError> {
        let status = response.status();
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(ProviderError::AuthRequired);
        }
        if !status.is_success() {
            return Err(ProviderError::Other(format!(
                "Mistral API returned HTTP {}",
                status.as_u16(),
            )));
        }

        let too_large =
            || ProviderError::Parse("Mistral billing response size limit exceeded".into());
        if response
            .content_length()
            .is_some_and(|size| size > MAX_BILLING_RESPONSE_BYTES as u64)
        {
            return Err(too_large());
        }
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            if chunk.len() > MAX_BILLING_RESPONSE_BYTES.saturating_sub(body.len()) {
                return Err(too_large());
            }
            body.extend_from_slice(&chunk);
        }
        let body = std::str::from_utf8(&body).map_err(|_| {
            ProviderError::Parse("Mistral billing response has invalid encoding".into())
        })?;
        billing::parse_response(body)
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

    async fn response_fixture(status: &str, body: Vec<u8>, chunked: bool) -> reqwest::Response {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let headers = if chunked {
            "Transfer-Encoding: chunked".to_string()
        } else {
            format!("Content-Length: {}", body.len())
        };
        let head = format!("HTTP/1.1 {status}\r\n{headers}\r\nConnection: close\r\n\r\n");
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = [0u8; 2048];
            assert!(socket.read(&mut request).await.unwrap() > 0);
            let mut parts = vec![head.into_bytes()];
            if chunked {
                parts.push(format!("{:x}\r\n", body.len()).into_bytes());
            }
            parts.push(body);
            if chunked {
                parts.push(b"\r\n0\r\n\r\n".to_vec());
            }
            for part in parts {
                // The bounded reader can intentionally close before the
                // oversized fixture finishes sending; stop producing then.
                if socket.write_all(&part).await.is_err() {
                    break;
                }
            }
        });
        Client::builder()
            .no_proxy()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap()
            .get(format!("http://{address}/fixture"))
            .send()
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn billing_http_errors_never_echo_remote_body() {
        let response = response_fixture(
            "500 Internal Server Error",
            b"private@example.test session=fixture-secret".to_vec(),
            false,
        )
        .await;
        let error = MistralProvider::read_billing_response(response)
            .await
            .unwrap_err()
            .to_string();
        assert!(error.contains("500"));
        assert!(!error.contains("private@example.test"));
        assert!(!error.contains("fixture-secret"));
    }

    #[tokio::test]
    async fn billing_http_bounds_declared_and_streamed_bodies() {
        for chunked in [false, true] {
            let response =
                response_fixture("200 OK", vec![b' '; 8 * 1024 * 1024 + 1], chunked).await;
            let error = MistralProvider::read_billing_response(response)
                .await
                .unwrap_err()
                .to_string();
            assert!(error.contains("response size limit"), "{error}");
        }
    }

    #[tokio::test]
    async fn billing_http_preserves_auth_errors_and_valid_unknown_billing() {
        for status in ["401 Unauthorized", "403 Forbidden"] {
            let response = response_fixture(status, b"private fixture".to_vec(), false).await;
            assert!(matches!(
                MistralProvider::read_billing_response(response).await,
                Err(ProviderError::AuthRequired)
            ));
        }
        let response = response_fixture("200 OK", b"{}".to_vec(), true).await;
        let result = MistralProvider::read_billing_response(response)
            .await
            .unwrap();
        assert!(result.cost.is_none());
        assert!(result.usage.primary.is_informational);
        let response = response_fixture("200 OK", vec![0xff], false).await;
        assert!(
            MistralProvider::read_billing_response(response)
                .await
                .unwrap_err()
                .to_string()
                .contains("invalid encoding")
        );
    }

    #[tokio::test]
    async fn billing_http_client_failure_has_no_unrestricted_fallback() {
        let mut provider = MistralProvider::new();
        provider.client = None;
        let error = provider
            .fetch_with_cookies("session=fixture")
            .await
            .unwrap_err();
        assert_eq!(error.to_string(), "Mistral HTTP client unavailable");
    }

    #[test]
    fn extracts_csrf_token_from_cookie_header() {
        assert_eq!(
            MistralProvider::csrf_from_cookie_header("foo=bar; csrftoken=abc123; ory_session=x"),
            Some("abc123")
        );
    }
}
