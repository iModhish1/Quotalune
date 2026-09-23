//! Vertex AI provider registration.
//!
//! The former Cloud Resource Manager project lookup and CLI-presence probe
//! supplied no measured usage. Until a real usage source is verified, every
//! fetch fails closed without reading credentials or making a network request.

mod token_refresher;

// Retained as public types for existing callers; not used by the provider
// fetch path while Vertex AI usage is unsupported.
#[allow(
    unused_imports,
    reason = "public OAuth types are retained for source compatibility"
)]
pub use token_refresher::{RefreshError, VertexAIOAuthCredentials, VertexAITokenRefresher};

use async_trait::async_trait;

use crate::core::{
    FetchContext, Provider, ProviderError, ProviderFetchResult, ProviderId, ProviderMetadata,
    SourceMode,
};

/// Vertex AI provider with no verified usage source yet.
pub struct VertexAIProvider {
    metadata: ProviderMetadata,
}

impl VertexAIProvider {
    pub fn new() -> Self {
        Self {
            metadata: ProviderMetadata {
                id: ProviderId::VertexAI,
                display_name: "Vertex AI",
                session_label: "Usage",
                weekly_label: "Monthly",
                supports_opus: false,
                supports_credits: false,
                default_enabled: false,
                is_primary: false,
                dashboard_url: Some("https://console.cloud.google.com/vertex-ai"),
                status_page_url: Some("https://status.cloud.google.com"),
            },
        }
    }
}

impl Default for VertexAIProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for VertexAIProvider {
    fn id(&self) -> ProviderId {
        ProviderId::VertexAI
    }

    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    async fn fetch_usage(&self, _ctx: &FetchContext) -> Result<ProviderFetchResult, ProviderError> {
        Err(ProviderError::Other(
            "Vertex AI usage is unavailable: no verified usage source".into(),
        ))
    }

    fn available_sources(&self) -> Vec<SourceMode> {
        Vec::new()
    }

    fn supports_web(&self) -> bool {
        false
    }

    fn supports_cli(&self) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn all_source_modes_fail_closed_without_a_usage_source() {
        let provider = VertexAIProvider::new();
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
            assert!(
                matches!(
                    provider.fetch_usage(&ctx).await,
                    Err(ProviderError::Other(_))
                ),
                "{source_mode:?} cannot produce a measured quota"
            );
        }
        assert!(provider.available_sources().is_empty());
        assert!(!provider.supports_web());
        assert!(!provider.supports_cli());
    }
}
