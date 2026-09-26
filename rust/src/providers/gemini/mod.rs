//! Gemini provider registration.
//!
//! Google's Gemini CLI FAQ warns against third-party tools piggybacking on
//! its OAuth credentials to access backend services. The former adapter did
//! exactly that through undocumented `v1internal` endpoints. Until a
//! documented, plan-equivalent usage source exists, Gemini remains visible
//! but cannot return a measured quota or initiate a connection.

use async_trait::async_trait;

use crate::core::{
    FetchContext, Provider, ProviderError, ProviderFetchResult, ProviderId, ProviderMetadata,
    SourceMode,
};

pub struct GeminiProvider {
    metadata: ProviderMetadata,
}

impl GeminiProvider {
    pub fn new() -> Self {
        Self {
            metadata: ProviderMetadata {
                id: ProviderId::Gemini,
                display_name: "Gemini",
                session_label: "Daily",
                weekly_label: "Daily",
                supports_opus: false,
                supports_credits: false,
                default_enabled: false,
                is_primary: false,
                dashboard_url: None,
                status_page_url: Some("https://status.cloud.google.com"),
            },
        }
    }
}

impl Default for GeminiProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for GeminiProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Gemini
    }

    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    async fn fetch_usage(&self, _ctx: &FetchContext) -> Result<ProviderFetchResult, ProviderError> {
        Err(ProviderError::Other(
            "Gemini CLI quota is unavailable: no supported third-party usage source".into(),
        ))
    }

    fn available_sources(&self) -> Vec<SourceMode> {
        Vec::new()
    }

    fn supports_cli(&self) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn all_source_modes_fail_closed_without_reading_oauth_or_network() {
        let provider = GeminiProvider::new();
        for source_mode in [
            SourceMode::Auto,
            SourceMode::Web,
            SourceMode::Cli,
            SourceMode::OAuth,
        ] {
            let ctx = FetchContext {
                source_mode,
                ..FetchContext::default()
            };
            assert!(matches!(
                provider.fetch_usage(&ctx).await,
                Err(ProviderError::Other(_))
            ));
        }
        assert!(provider.available_sources().is_empty());
        assert!(!provider.supports_cli());
        assert!(provider.metadata().dashboard_url.is_none());
    }
}
