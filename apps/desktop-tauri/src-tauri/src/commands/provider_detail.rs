use super::*;

// ── Provider detail pane (Phase 6b) ──────────────────────────────────

/// DTO for the provider detail pane in the Settings Providers tab.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProviderAuthCapability {
    NoAuthRequired,
    CredentialInput,
    DeviceFlow,
    SupervisedCli,
    ExternalDashboard,
    DetectionOnly,
    Unsupported,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderDetail {
    pub id: String,
    pub display_name: String,
    pub enabled: bool,

    // Identity
    pub email: Option<String>,
    pub plan: Option<String>,
    pub auth_type: Option<String>,
    pub source_label: Option<String>,
    pub organization: Option<String>,
    pub last_updated: Option<String>,

    // Usage windows — reuse existing RateWindowSnapshot shape.
    pub session_label: Option<String>,
    pub weekly_label: Option<String>,
    pub session: Option<RateWindowSnapshot>,
    pub weekly: Option<RateWindowSnapshot>,
    pub model_specific: Option<RateWindowSnapshot>,
    pub tertiary: Option<RateWindowSnapshot>,
    pub extra_rate_windows: Vec<NamedRateWindowSnapshot>,
    #[serde(default)]
    pub reset_facts: Option<quotalis_core::core::ProviderResetFacts>,

    // Cost / pace.
    pub cost: Option<CostSnapshotBridge>,
    pub pace: Option<PaceSnapshot>,

    // Error / state.
    pub last_error: Option<String>,
    /// Backend-classified availability state for the latest refresh.
    pub error_state: Option<quotalis_core::core::ProviderStateKind>,

    // URLs for quick-actions (button visibility).
    pub dashboard_url: Option<String>,
    pub status_page_url: Option<String>,
    pub buy_credits_url: Option<String>,
    /// Whether QuotaArc can initiate a sign-in or connection flow for this
    /// provider. Kept separate from `dashboard_url`: Copilot and Kiro use
    /// their own device/CLI flows.
    pub can_connect: bool,
    /// One audited primary authentication capability for action selection.
    pub auth_capability: ProviderAuthCapability,

    // True if the shared backend has produced any snapshot yet.
    pub has_snapshot: bool,

    // Phase 6c — currently-persisted cookie source & region for round-tripping
    // into the settings UI pickers. `None` for providers that do not support
    // one of the pickers.
    pub usage_source: Option<String>,
    pub cookie_source: Option<String>,
    pub region: Option<String>,
}

pub(crate) fn build_provider_detail(provider_id: &str) -> Result<ProviderDetail, String> {
    let id = parse_provider_arg(provider_id)?;

    let settings = Settings::load();
    let enabled = settings
        .enabled_providers
        .iter()
        .any(|p| p == id.cli_name());

    let provider = instantiate_provider(id);
    let metadata = provider.metadata();
    let dashboard_url = if id == quotalis_core::core::ProviderId::MiniMax {
        Some(
            quotalis_core::providers::MiniMaxProvider::dashboard_url_for_region(Some(
                settings.api_region(id),
            )),
        )
    } else {
        metadata.dashboard_url.map(|s| s.to_string())
    };
    let can_connect = super::system::provider_login_transport(id).is_some();
    let auth_capability = provider_auth_capability_for(id, dashboard_url.as_deref());

    Ok(ProviderDetail {
        id: id.cli_name().to_string(),
        display_name: id.display_name().to_string(),
        enabled,
        email: None,
        plan: None,
        auth_type: None,
        source_label: None,
        organization: None,
        last_updated: None,
        session_label: Some(metadata.session_label.to_string()),
        weekly_label: Some(metadata.weekly_label.to_string()),
        session: None,
        weekly: None,
        model_specific: None,
        tertiary: None,
        extra_rate_windows: Vec::new(),
        reset_facts: None,
        cost: None,
        pace: None,
        last_error: None,
        error_state: None,
        dashboard_url: dashboard_url.clone(),
        status_page_url: metadata.status_page_url.map(|s| s.to_string()),
        // No verified dedicated purchase URL is available. Dashboard remains separate.
        buy_credits_url: None,
        can_connect,
        auth_capability,
        has_snapshot: false,
        usage_source: provider_usage_source_lookup(&settings, id.cli_name()),
        cookie_source: provider_cookie_source_lookup(&settings, id.cli_name()),
        region: provider_region_lookup(&settings, id.cli_name()),
    })
}

/// Resolve one primary capability from existing, concrete support registries.
/// Managed transports take precedence over credential extension slots, and an
/// external dashboard is offered only when Quotalis has no stronger action.
fn provider_auth_capability_for(
    id: ProviderId,
    dashboard_url: Option<&str>,
) -> ProviderAuthCapability {
    match super::system::provider_login_transport(id) {
        Some(super::system::ProviderLoginTransport::Device) => {
            return ProviderAuthCapability::DeviceFlow;
        }
        Some(super::system::ProviderLoginTransport::Cli) => {
            return ProviderAuthCapability::SupervisedCli;
        }
        None => {}
    }

    // Wayfinder's provider contract is an unauthenticated loopback gateway.
    if id == ProviderId::Wayfinder {
        return ProviderAuthCapability::NoAuthRequired;
    }

    let has_api_key_input = quotalis_core::settings::get_api_key_providers()
        .iter()
        .any(|provider| provider.id == id);
    let has_cookie_input = id.cookie_domain().is_some();
    let has_token_input = quotalis_core::core::TokenAccountSupport::is_supported(id);
    if has_api_key_input || has_cookie_input || has_token_input {
        return ProviderAuthCapability::CredentialInput;
    }

    // This is the only provider whose connection surface is backed solely by
    // an installed-IDE detection command and path override.
    if id == ProviderId::JetBrains {
        return ProviderAuthCapability::DetectionOnly;
    }

    if dashboard_url.is_some() {
        ProviderAuthCapability::ExternalDashboard
    } else {
        ProviderAuthCapability::Unsupported
    }
}

#[tauri::command]
pub fn get_provider_detail(
    app: tauri::AppHandle,
    provider_id: String,
) -> Result<ProviderDetail, String> {
    let mut detail = build_provider_detail(&provider_id)?;

    // Merge the latest cached snapshot, if any.
    let state = app.state::<Mutex<AppState>>();
    if let Ok(guard) = state.lock()
        && let Some(snap) = guard
            .provider_cache
            .iter()
            .find(|s| s.provider_id == detail.id)
    {
        let mut snapshot = snap.clone();
        super::filter_hidden_codex_spark_rows(
            &mut snapshot,
            Settings::load().codex_spark_usage_visible(),
        );
        detail.reset_facts = snapshot.reset_facts.clone();
        detail.email = snapshot.account_email.clone();
        detail.plan = snapshot.plan_name.clone();
        detail.organization = snapshot.account_organization.clone();
        detail.source_label = if snapshot.source_label.is_empty() {
            None
        } else {
            Some(snapshot.source_label.clone())
        };
        detail.last_updated = Some(snapshot.updated_at.clone());
        detail.session_label = snapshot.primary_label.clone().or(detail.session_label);
        detail.weekly_label = snapshot.secondary_label.clone().or(detail.weekly_label);
        if snapshot.error.is_none()
            && snapshot.error_state == quotalis_core::core::ProviderStateKind::Ready
        {
            detail.session = Some(snapshot.primary.clone());
            detail.weekly = snapshot.secondary.clone();
            detail.model_specific = snapshot.model_specific.clone();
            detail.tertiary = snapshot.tertiary.clone();
            detail.extra_rate_windows = snapshot.extra_rate_windows.clone();
            detail.cost = snapshot.cost.clone();
            detail.pace = snapshot.pace.clone();
        }
        detail.last_error = snapshot.error.clone();
        detail.error_state = Some(snapshot.error_state);
        detail.has_snapshot = true;
    }

    Ok(detail)
}

#[tauri::command]
pub fn revoke_provider_credentials(provider_id: String) -> Result<(), String> {
    // Best-effort: drop every app-managed credential for this provider so the
    // caller can follow up with a fresh login or import. Missing entries are
    // silently ignored; only I/O errors propagate.
    let id = parse_provider_arg(&provider_id)?;
    let provider_id = id.cli_name();

    let mut keys = ApiKeys::load();
    keys.remove(provider_id);
    keys.save().map_err(|e| e.to_string())?;

    let mut cookies = ManualCookies::load();
    cookies.remove(provider_id);
    cookies.save().map_err(|e| e.to_string())?;

    let token_store = TokenAccountStore::new();
    let mut token_accounts = token_store.load().map_err(|e| e.to_string())?;
    if token_accounts.remove(&id).is_some() {
        token_store
            .save(&token_accounts)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialStorageStatusBridge {
    pub manual_cookies: String,
    pub api_keys: String,
    pub token_accounts: String,
}

pub(crate) fn credential_file_status_label(status: SecureFileStatus) -> String {
    match status {
        SecureFileStatus::Missing => "missing".to_string(),
        SecureFileStatus::Plaintext => "plaintext".to_string(),
        SecureFileStatus::Protected(protection) => format!("protected:{protection}"),
        SecureFileStatus::Unreadable(_) => "unreadable".to_string(),
    }
}

fn optional_credential_status(path: Option<std::path::PathBuf>) -> String {
    path.map(|path| credential_file_status_label(secure_file::status(&path)))
        .unwrap_or_else(|| "unavailable".to_string())
}

#[tauri::command]
pub fn get_credential_storage_status() -> CredentialStorageStatusBridge {
    CredentialStorageStatusBridge {
        manual_cookies: optional_credential_status(ManualCookies::cookies_path()),
        api_keys: optional_credential_status(ApiKeys::keys_path()),
        token_accounts: credential_file_status_label(secure_file::status(
            &TokenAccountStore::default_path(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn connection_capability_comes_from_the_login_registry() {
        assert!(build_provider_detail("codex").unwrap().can_connect);
        assert!(build_provider_detail("copilot").unwrap().can_connect);
        assert!(build_provider_detail("vertexai").unwrap().can_connect);
        assert!(!build_provider_detail("mistral").unwrap().can_connect);
        assert!(!build_provider_detail("sub2api").unwrap().can_connect);
    }

    #[test]
    fn auth_capability_uses_only_audited_support_surfaces() {
        assert_eq!(
            build_provider_detail("codex").unwrap().auth_capability,
            ProviderAuthCapability::SupervisedCli
        );
        assert_eq!(
            build_provider_detail("copilot").unwrap().auth_capability,
            ProviderAuthCapability::DeviceFlow
        );
        assert_eq!(
            build_provider_detail("openrouter").unwrap().auth_capability,
            ProviderAuthCapability::CredentialInput
        );
        assert_eq!(
            build_provider_detail("jetbrains").unwrap().auth_capability,
            ProviderAuthCapability::DetectionOnly
        );
        assert_eq!(
            build_provider_detail("wayfinder").unwrap().auth_capability,
            ProviderAuthCapability::NoAuthRequired
        );
        assert_eq!(
            build_provider_detail("windsurf").unwrap().auth_capability,
            ProviderAuthCapability::ExternalDashboard
        );
        assert_eq!(
            build_provider_detail("litellm").unwrap().auth_capability,
            ProviderAuthCapability::CredentialInput
        );
    }

    #[test]
    fn every_registered_provider_has_one_explicit_auth_capability() {
        for id in ProviderId::all() {
            let detail = build_provider_detail(id.cli_name()).unwrap();
            assert_eq!(
                detail.can_connect,
                matches!(
                    detail.auth_capability,
                    ProviderAuthCapability::DeviceFlow | ProviderAuthCapability::SupervisedCli
                )
            );
        }
    }

    /// `provider_auth_capability_for` is a fallthrough `if`/`else` chain over
    /// several independent lookup tables (login registry, cookie domains, API
    /// key list, token-account support, JetBrains special-case, dashboard
    /// URL), not a `match ProviderId { .. }` — so rustc's exhaustiveness check
    /// gives no guarantee a newly added `ProviderId` gets a real, audited
    /// capability rather than silently landing on the generic
    /// `ExternalDashboard`/`Unsupported` tail of the chain. This test is the
    /// substitute gate: it fails loudly the moment any registered provider
    /// resolves to `Unsupported`, and pins today's exact count (70) so a
    /// newly added `ProviderId` forces this file to be revisited rather than
    /// silently inheriting a fallback classification.
    #[test]
    fn no_registered_provider_falls_back_to_unsupported() {
        let all = ProviderId::all();
        assert_eq!(
            all.len(),
            70,
            "ProviderId::all() count changed — re-audit provider_auth_capability_for \
             for the new/removed provider(s) before updating this count"
        );

        let unsupported: Vec<&str> = all
            .iter()
            .filter(|id| {
                build_provider_detail(id.cli_name())
                    .unwrap()
                    .auth_capability
                    == ProviderAuthCapability::Unsupported
            })
            .map(|id| id.cli_name())
            .collect();

        assert!(
            unsupported.is_empty(),
            "provider(s) fell through to the generic Unsupported auth capability \
             with no verified auth mechanism: {unsupported:?}"
        );
    }
}
