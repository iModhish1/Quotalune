//! Provider onboarding commands: capability model, CLI dependency detection
//! and curated installation, single-flight connection verification, derived
//! connection status, and the Dev-only connection fixture.
use super::connection_operations::{IO_PERMITS, OPERATIONS, Operation, cancelled};
use super::*;
use chrono::Utc;
use quotalis_core::cli_dependencies::{
    CliDetection, CliSessionState, CliStatus, InstallOutcome, detect, run_install,
};
use quotalis_core::connection_capabilities::{
    ConnectionMethod, InstallPlan, capability_matrix_json, cli_dependency, connection_capabilities,
    install_plan,
};
use quotalis_core::connection_state::{ConnectionIssue, ConnectionState, classify_fetch_outcome};
#[cfg(test)]
use quotalis_core::{connection_state::TIMEOUT_ERROR, core::ProviderStateKind};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use tauri::Emitter;
use tokio::sync::watch;

/// Never let simulated onboarding reach a real credential store or network.
pub(crate) fn begin_live_connection(id: ProviderId) -> Result<Operation<'static>, String> {
    let operation = OPERATIONS.begin(id)?;
    if active_fixture(id).is_some() || Settings::load().demo_mode_enabled {
        return Err("Real connection changes are unavailable during simulation".into());
    }
    Ok(operation)
}

/// Reserve before choosing the transport: an explicit Dev fixture is captured
/// under the same exclusion as real work. Demo without a fixture still fails
/// closed. Simulated login must never fall through to a real transport.
pub(crate) fn begin_login_connection(
    id: ProviderId,
) -> Result<(Operation<'static>, Option<ProviderConnectionQaFixture>), String> {
    let operation = OPERATIONS.begin(id)?;
    let fixture = active_fixture(id);
    select_login_route(fixture, || Settings::load().demo_mode_enabled)
        .map(|fixture| (operation, fixture))
}

fn select_login_route(
    fixture: Option<ProviderConnectionQaFixture>,
    demo_mode: impl FnOnce() -> bool,
) -> Result<Option<ProviderConnectionQaFixture>, String> {
    if fixture.is_none() && demo_mode() {
        return Err("Real connection changes are unavailable during simulation".into());
    }
    Ok(fixture)
}

#[tauri::command]
pub fn cancel_provider_connection_operation(provider_id: String) -> Result<bool, String> {
    let id = provider(&provider_id)?;
    let canceled = OPERATIONS.cancel(id);
    let _ = cancel_provider_verification(provider_id.clone());
    let _ = cancel_cli_install(provider_id);
    Ok(canceled)
}

/// One key flow, using the credential store actually consumed by the adapter.
#[tauri::command]
pub fn save_provider_connection_key(provider_id: String, key: String) -> Result<(), String> {
    let id = provider(&provider_id)?;
    validate_single_line_secret(&key, "API key", MAX_API_KEY_LEN)?;
    if !connection_capabilities(id).supports(ConnectionMethod::ApiKey) {
        return Err("This provider does not accept an API key".into());
    }
    if active_fixture(id).is_some() {
        return Ok(());
    }
    let _operation = begin_live_connection(id)?;
    let token_store = quotalis_core::core::TokenAccountSupport::for_provider(id).is_some_and(|s| {
        matches!(
            s.injection,
            quotalis_core::core::TokenInjection::Environment { .. }
        )
    });
    if token_store {
        let store = TokenAccountStore::new();
        let mut data = store
            .load_provider(id)
            .map_err(|_| "Protected key storage unavailable")?;
        data.add_account(TokenAccount::new(id.display_name().to_string(), key.trim()));
        data.set_active(data.accounts.len() - 1);
        store
            .save_provider(id, &data)
            .map_err(|_| "Protected key storage unavailable")?;
    } else if quotalis_core::settings::get_api_key_providers()
        .iter()
        .any(|p| p.id == id)
    {
        let mut keys = ApiKeys::load();
        keys.set(id.cli_name(), key.trim(), None);
        keys.save()
            .map_err(|_| "Protected key storage unavailable")?;
    } else {
        return Err("No supported key storage for this provider".into());
    }
    Ok(())
}

fn provider(id: &str) -> Result<ProviderId, String> {
    ProviderId::from_cli_name(id)
        .filter(|p| p.cli_name() == id)
        .ok_or_else(|| "Unknown provider".to_string())
}

/// Rows of `docs/validation/PROVIDER_CONNECTION_CAPABILITY_MATRIX.json`,
/// straight from the live registry.
#[tauri::command]
pub fn get_provider_connection_capabilities() -> serde_json::Value {
    capability_matrix_json()["providers"].clone()
}

// ── Dev-only fixture ────────────────────────────────────────────────

pub const CONNECTION_QA_SCENARIOS: [&str; 19] = [
    "disconnected",
    "cliMissing",
    "cliOld",
    "cliReady",
    "cliUnauthenticated",
    "cookieMissing",
    "cookieValid",
    "cookieExpired",
    "apiKeyInvalid",
    "apiKeyValid",
    "oauthPending",
    "oauthSuccess",
    "oauthStateMismatch",
    "offline",
    "rateLimited",
    "timeout",
    "permissionDenied",
    "connected",
    "stale",
];

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConnectionQaFixture {
    pub provider_id: String,
    pub scenario: String,
}

static QA_FIXTURE: Mutex<Option<ProviderConnectionQaFixture>> = Mutex::new(None);

pub(crate) fn active_fixture(id: ProviderId) -> Option<ProviderConnectionQaFixture> {
    QA_FIXTURE
        .lock()
        .ok()
        .and_then(|f| f.clone())
        .filter(|f| f.provider_id == id.cli_name())
}

fn store_fixture(
    dev_channel: bool,
    fixture: Option<ProviderConnectionQaFixture>,
    target: &Mutex<Option<ProviderConnectionQaFixture>>,
) -> Result<(), String> {
    if !dev_channel {
        return Err("Provider connection QA fixture is Dev-channel only.".into());
    }
    if let Some(f) = &fixture {
        provider(&f.provider_id)?;
        if !CONNECTION_QA_SCENARIOS.contains(&f.scenario.as_str()) {
            return Err("Unknown connection QA scenario".into());
        }
    }
    *target.lock().map_err(|_| "Fixture unavailable")? = fixture;
    Ok(())
}

#[tauri::command]
pub fn get_provider_connection_qa_fixture() -> Option<ProviderConnectionQaFixture> {
    QA_FIXTURE.lock().ok().and_then(|f| f.clone())
}

#[tauri::command]
pub fn set_provider_connection_qa_fixture(
    app: tauri::AppHandle,
    fixture: Option<ProviderConnectionQaFixture>,
) -> Result<(), String> {
    let old = QA_FIXTURE
        .lock()
        .map_err(|_| "Fixture unavailable")?
        .clone();
    let changing = fixture
        .as_ref()
        .or(old.as_ref())
        .map(|f| provider(&f.provider_id))
        .transpose()?;
    let _operation = changing.map(|id| OPERATIONS.begin(id)).transpose()?;
    store_fixture(crate::build_info::CHANNEL == "dev", fixture, &QA_FIXTURE)?;
    let _ = app.emit("provider-updated", ());
    Ok(())
}

// ── CLI dependencies ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliDetectionBridge {
    pub provider_id: String,
    pub tool: &'static str,
    pub status: CliStatus,
    pub path: Option<String>,
    pub version: Option<String>,
    pub session: CliSessionState,
    pub install_available: bool,
    pub docs_url: &'static str,
    pub sign_in_hint: &'static str,
}

impl From<CliDetection> for CliDetectionBridge {
    fn from(d: CliDetection) -> Self {
        Self {
            provider_id: d.provider.cli_name().to_string(),
            tool: d.tool,
            status: d.status,
            path: d.path,
            version: d.version,
            session: d.session,
            install_available: d.install_available,
            docs_url: d.docs_url,
            sign_in_hint: d.sign_in_hint,
        }
    }
}

fn fixture_detection(id: ProviderId, scenario: &str) -> Option<CliDetectionBridge> {
    let dependency = cli_dependency(id)?;
    let (status, session) = match scenario {
        "cliMissing" => (CliStatus::Missing, CliSessionState::Unknown),
        "cliOld" => (
            CliStatus::TooOld {
                installed: "0.1.0".into(),
                required: dependency.min_version.unwrap_or("1.0.0"),
            },
            CliSessionState::Unknown,
        ),
        "cliUnauthenticated" => (CliStatus::Installed, CliSessionState::NotSignedIn),
        "cliReady" | "connected" | "stale" => {
            (CliStatus::Installed, CliSessionState::Authenticated)
        }
        _ => return None,
    };
    Some(CliDetectionBridge {
        provider_id: id.cli_name().to_string(),
        tool: dependency.tool,
        status,
        path: None,
        version: (scenario != "cliMissing").then_some("9.9.9".into()),
        session,
        install_available: install_plan(dependency).is_some(),
        docs_url: dependency.docs_url,
        sign_in_hint: dependency.sign_in_hint,
    })
}

/// Bounded concurrency for background CLI probes so 70 providers never fan
/// out into 70 child processes.
static DETECT_PERMITS: LazyLock<std::sync::Arc<tokio::sync::Semaphore>> =
    LazyLock::new(|| std::sync::Arc::new(tokio::sync::Semaphore::new(3)));

#[tauri::command]
pub async fn detect_cli_dependency(
    provider_id: String,
) -> Result<Option<CliDetectionBridge>, String> {
    let id = provider(&provider_id)?;
    if let Some(fixture) = active_fixture(id)
        && let Some(detection) = fixture_detection(id, &fixture.scenario)
    {
        return Ok(Some(detection));
    }
    if cli_dependency(id).is_none() {
        return Ok(None);
    }
    let operation = begin_live_connection(id)?;
    let mut cancel_rx = operation.cancellation();
    let _io = tokio::select! {
        permit = IO_PERMITS.acquire() => permit.map_err(|_| "Detection unavailable")?,
        () = cancelled(&mut cancel_rx) => return Err("Connection operation canceled".into()),
    };
    let _permit = DETECT_PERMITS
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| "Detection unavailable")?;
    Ok(detect(id, cancel_rx).await.map(CliDetectionBridge::from))
}

#[tauri::command]
pub fn get_cli_install_plan(provider_id: String) -> Result<Option<InstallPlan>, String> {
    let id = provider(&provider_id)?;
    Ok(cli_dependency(id).and_then(install_plan))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliInstallResult {
    pub outcome: InstallOutcome,
    pub detection: Option<CliDetectionBridge>,
}

static ACTIVE_INSTALLS: Mutex<Option<HashMap<ProviderId, watch::Sender<bool>>>> = Mutex::new(None);

fn begin_install(id: ProviderId) -> Result<watch::Receiver<bool>, String> {
    let mut guard = ACTIVE_INSTALLS
        .lock()
        .map_err(|_| "Install registry unavailable")?;
    let map = guard.get_or_insert_with(HashMap::new);
    if map.contains_key(&id) {
        return Err("An installation is already running for this provider".into());
    }
    let (tx, rx) = watch::channel(false);
    map.insert(id, tx);
    Ok(rx)
}

fn finish_install(id: ProviderId) {
    if let Ok(mut guard) = ACTIVE_INSTALLS.lock()
        && let Some(map) = guard.as_mut()
    {
        map.remove(&id);
    }
}

/// Installs a curated official CLI. `confirmed` must be true: the UI shows
/// the exact plan (package manager, package, admin expectation) first and the
/// backend refuses unconfirmed calls, so nothing is ever installed silently.
#[tauri::command]
pub async fn install_cli_dependency(
    provider_id: String,
    confirmed: bool,
) -> Result<CliInstallResult, String> {
    let id = provider(&provider_id)?;
    if !confirmed {
        return Err("Installation requires explicit confirmation".into());
    }
    let dependency = cli_dependency(id).ok_or("This provider has no CLI dependency")?;
    let plan = install_plan(dependency)
        .ok_or("No curated install source; open the official instructions")?;
    if let Some(fixture) = active_fixture(id) {
        let outcome = match fixture.scenario.as_str() {
            "cliMissing" => InstallOutcome::PackageManagerMissing,
            "offline" => InstallOutcome::NetworkError,
            "permissionDenied" => InstallOutcome::PermissionDenied,
            "timeout" => InstallOutcome::TimedOut,
            _ => InstallOutcome::Succeeded,
        };
        return Ok(CliInstallResult {
            outcome,
            detection: fixture_detection(id, "cliUnauthenticated"),
        });
    }
    let operation = begin_live_connection(id)?;
    let mut operation_cancel = operation.cancellation();
    let _io = tokio::select! {
        permit = IO_PERMITS.acquire() => permit.map_err(|_| "Installation unavailable")?,
        () = cancelled(&mut operation_cancel) => return Err("Connection operation canceled".into()),
    };
    let cancel = begin_install(id)?;
    let outcome = run_install(&plan, cancel.clone()).await;
    finish_install(id);
    let outcome = if outcome == InstallOutcome::Succeeded
        && quotalis_core::cli_dependencies::resolve_executable(dependency).is_none()
    {
        InstallOutcome::BinaryNotFound
    } else {
        outcome
    };
    let detection = detect(id, cancel).await.map(CliDetectionBridge::from);
    Ok(CliInstallResult { outcome, detection })
}

#[tauri::command]
pub fn cancel_cli_install(provider_id: String) -> Result<bool, String> {
    let id = provider(&provider_id)?;
    let guard = ACTIVE_INSTALLS
        .lock()
        .map_err(|_| "Install registry unavailable")?;
    Ok(guard
        .as_ref()
        .and_then(|map| map.get(&id))
        .is_some_and(|tx| tx.send(true).is_ok()))
}

// ── Verification ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionVerification {
    pub provider_id: String,
    pub simulated: bool,
    pub state: ConnectionState,
    pub issue: Option<ConnectionIssue>,
    pub method: Option<ConnectionMethod>,
    pub verified_at: Option<String>,
    pub plan: Option<String>,
    pub window_count: usize,
    pub resets_known: bool,
    pub duration_ms: Option<u128>,
}

fn missing_browser_session(id: ProviderId) -> ConnectionVerification {
    ConnectionVerification {
        provider_id: id.cli_name().to_string(),
        simulated: false,
        state: ConnectionState::ActionRequired,
        issue: Some(ConnectionIssue::BrowserSessionMissing),
        method: Some(ConnectionMethod::BrowserSession),
        verified_at: None,
        plan: None,
        window_count: 0,
        resets_known: false,
        duration_ms: None,
    }
}

/// "Connected via" is derived from the snapshot's own source evidence, never
/// from which credentials happen to be stored.
pub(crate) fn method_from_source_label(id: ProviderId, label: &str) -> Option<ConnectionMethod> {
    let capabilities = connection_capabilities(id);
    let lower = label.to_ascii_lowercase();
    let candidate = if id == ProviderId::Cursor && lower == "cursor-app" {
        ConnectionMethod::LocalScanner
    } else if lower.contains("web") || lower.contains("cookie") {
        ConnectionMethod::BrowserSession
    } else if lower.contains("cli") {
        ConnectionMethod::CliSession
    } else if lower.contains("oauth") {
        if capabilities.supports(ConnectionMethod::DeviceFlow) {
            ConnectionMethod::DeviceFlow
        } else if capabilities.supports(ConnectionMethod::CliSession) {
            ConnectionMethod::CliSession
        } else {
            ConnectionMethod::ApiKey
        }
    } else if lower.contains("api") || lower.contains("billing") || lower.contains("key") {
        ConnectionMethod::ApiKey
    } else if lower.contains("local") || lower.contains("scan") || lower.contains("file") {
        ConnectionMethod::LocalScanner
    } else if lower.contains("gateway") {
        ConnectionMethod::LocalGateway
    } else {
        return None;
    };
    capabilities.supports(candidate).then_some(candidate)
}

pub(crate) fn verification_from_snapshot(
    id: ProviderId,
    snapshot: &ProviderUsageSnapshot,
) -> ConnectionVerification {
    let method = method_from_source_label(id, &snapshot.source_label);
    let (state, issue) =
        classify_fetch_outcome(snapshot.error_state, snapshot.error.as_deref(), method);
    let windows = usize::from(!snapshot.primary.is_informational)
        + snapshot
            .secondary
            .iter()
            .filter(|w| !w.is_informational)
            .count()
        + snapshot
            .tertiary
            .iter()
            .filter(|w| !w.is_informational)
            .count()
        + snapshot
            .extra_rate_windows
            .iter()
            .filter(|w| !w.window.is_informational)
            .count();
    ConnectionVerification {
        provider_id: id.cli_name().to_string(),
        simulated: false,
        state,
        issue,
        method,
        verified_at: (state == ConnectionState::Connected).then(|| snapshot.updated_at.clone()),
        plan: snapshot
            .plan_name
            .clone()
            .filter(|_| state == ConnectionState::Connected),
        window_count: windows,
        resets_known: snapshot.primary.resets_at.is_some(),
        duration_ms: snapshot.fetch_duration_ms,
    }
}

fn fixture_verification(id: ProviderId, scenario: &str) -> ConnectionVerification {
    use ConnectionIssue as I;
    use ConnectionState as S;
    let caps = connection_capabilities(id);
    let method = caps.recommended();
    let (state, issue) = match scenario {
        "connected" | "cliReady" | "cookieValid" | "apiKeyValid" | "oauthSuccess" => {
            (S::Connected, None)
        }
        "stale" => (S::Connected, None),
        "cliMissing" => (S::RequirementsMissing, Some(I::CliMissing)),
        "cliOld" => (S::RequirementsMissing, Some(I::CliTooOld)),
        "cliUnauthenticated" => (S::ActionRequired, Some(I::CliUnauthenticated)),
        "cookieMissing" => (S::ActionRequired, Some(I::BrowserSessionMissing)),
        "cookieExpired" => (S::ActionRequired, Some(I::SessionExpired)),
        "apiKeyInvalid" => (S::ActionRequired, Some(I::CredentialsRejected)),
        "oauthPending" => (S::Authenticating, None),
        "oauthStateMismatch" => (S::Error, Some(I::Error)),
        "offline" => (S::Offline, Some(I::Offline)),
        "rateLimited" => (S::RateLimited, Some(I::RateLimited)),
        "timeout" => (S::TimedOut, Some(I::TimedOut)),
        "permissionDenied" => (S::ActionRequired, Some(I::PermissionDenied)),
        _ => (S::Idle, None),
    };
    ConnectionVerification {
        provider_id: id.cli_name().to_string(),
        simulated: true,
        state,
        issue,
        method: method.filter(|_| state != S::Idle),
        verified_at: (state == S::Connected).then(|| {
            let age = if scenario == "stale" {
                chrono::Duration::hours(6)
            } else {
                chrono::Duration::zero()
            };
            (Utc::now() - age).to_rfc3339()
        }),
        plan: (state == S::Connected).then(|| "QA Fixture Plan".to_string()),
        window_count: usize::from(state == S::Connected) * 2,
        resets_known: state == S::Connected,
        duration_ms: Some(12),
    }
}

static ACTIVE_VERIFICATIONS: Mutex<Option<HashMap<ProviderId, tokio::task::AbortHandle>>> =
    Mutex::new(None);

fn begin_verification(id: ProviderId, handle: tokio::task::AbortHandle) -> Result<(), String> {
    let mut guard = ACTIVE_VERIFICATIONS
        .lock()
        .map_err(|_| "Verification registry unavailable")?;
    let map = guard.get_or_insert_with(HashMap::new);
    if map.get(&id).is_some_and(|h| !h.is_finished()) {
        handle.abort();
        return Err("A connection check is already running for this provider".into());
    }
    map.insert(id, handle);
    Ok(())
}

fn finish_verification(id: ProviderId) {
    if let Ok(mut guard) = ACTIVE_VERIFICATIONS.lock()
        && let Some(map) = guard.as_mut()
    {
        map.remove(&id);
    }
}

/// Runs the provider's smallest read-only operation (its normal usage fetch)
/// once, single-flight per provider, under the refresh path's own timeout,
/// and stores the outcome in the provider cache so every surface agrees.
#[tauri::command]
pub async fn verify_provider_connection(
    app: tauri::AppHandle,
    provider_id: String,
    method: Option<ConnectionMethod>,
) -> Result<ConnectionVerification, String> {
    let id = provider(&provider_id)?;
    if method.is_some_and(|m| !connection_capabilities(id).supports(m)) {
        return Err("Unsupported connection method".into());
    }
    if let Some(fixture) = active_fixture(id) {
        let mut verification = fixture_verification(id, &fixture.scenario);
        if verification.state == ConnectionState::Connected && method.is_some() {
            verification.method = method;
        }
        return Ok(verification);
    }
    let operation = begin_live_connection(id)?;
    let mut cancellation = operation.cancellation();
    let _io = tokio::select! {
        permit = IO_PERMITS.acquire() => permit.map_err(|_| "Verification unavailable")?,
        () = cancelled(&mut cancellation) => return Err("Connection operation canceled".into()),
    };
    let mut settings = Settings::load();
    if let Some(method) = method {
        configure_source(&mut settings, id, method);
    }
    let mut accounts = TokenAccountStore::new()
        .load()
        .map_err(|_| "Credential store unavailable")?;
    if matches!(
        method,
        Some(
            ConnectionMethod::CliSession
                | ConnectionMethod::LocalScanner
                | ConnectionMethod::LocalGateway
                | ConnectionMethod::BrowserSession
        )
    ) {
        accounts.remove(&id);
    }
    // Manual browser onboarding never falls back to reading other profiles.
    let cookies = ManualCookies::load();
    if method == Some(ConnectionMethod::BrowserSession) && cookies.get(id.cli_name()).is_none() {
        return Ok(missing_browser_session(id));
    }
    let active_account = accounts
        .get(&id)
        .and_then(|data| data.active_account())
        .map(|a| a.id);
    let ctx = build_fetch_context(id, &settings, &cookies, &ApiKeys::load(), &accounts);
    let task = tokio::spawn(async move { fetch_provider_snapshot(id, ctx, active_account).await });
    begin_verification(id, task.abort_handle())?;
    let snapshot_result = tokio::select! {
        result = task => result,
        () = cancelled(&mut cancellation) => {
            let _ = cancel_provider_verification(id.cli_name().to_string());
            finish_verification(id);
            return Err("Connection operation canceled".into());
        }
    };
    let snapshot = match snapshot_result {
        Ok(snapshot) => snapshot,
        Err(_) => {
            finish_verification(id);
            return Ok(ConnectionVerification {
                provider_id: id.cli_name().to_string(),
                simulated: false,
                state: ConnectionState::Idle,
                issue: None,
                method: None,
                verified_at: None,
                plan: None,
                window_count: 0,
                resets_known: false,
                duration_ms: None,
            });
        }
    };
    finish_verification(id);
    if *cancellation.borrow() {
        return Err("Connection operation canceled".into());
    }
    let verification = verification_from_snapshot(id, &snapshot);
    // A successful automatic fallback is not proof of the selected method.
    if method.is_some()
        && verification.state == ConnectionState::Connected
        && verification.method != method
    {
        return Err(
            "The provider used a different source; select that connection method explicitly".into(),
        );
    }
    // Acquire settings before the commit/cancel lock to avoid lock inversion.
    let _settings_transaction = super::settings::SETTINGS_PATCH_LOCK
        .lock()
        .map_err(|_| "Settings unavailable")?;
    operation.commit_if_active(|| {
        if verification.state == ConnectionState::Connected {
            let mut current = Settings::load();
            if let Some(method) = method {
                configure_source(&mut current, id, method);
            }
            current.enabled_providers.insert(id.cli_name().to_string());
            current
                .save()
                .map_err(|_| "Connection preferences could not be saved")?;
            let _ = app.emit("codexbar:settings-updated", ());
        }
        if let Some(state) = app.try_state::<Mutex<AppState>>()
            && let Ok(mut guard) = state.lock()
        {
            if let Some(slot) = guard
                .provider_cache
                .iter_mut()
                .find(|s| s.provider_id == snapshot.provider_id)
            {
                *slot = snapshot;
            } else {
                guard.provider_cache.push(snapshot);
            }
        }
        let _ = app.emit("provider-updated", ());
        Ok(())
    })?;

    Ok(verification)
}

fn configure_source(settings: &mut Settings, id: ProviderId, method: ConnectionMethod) {
    let (source, cookie) = match method {
        ConnectionMethod::BrowserSession => ("web", "manual"),
        ConnectionMethod::ApiKey | ConnectionMethod::DeviceFlow => ("oauth", "off"),
        ConnectionMethod::CliSession => ("cli", "off"),
        ConnectionMethod::LocalScanner | ConnectionMethod::LocalGateway => ("auto", "off"),
    };
    settings.set_usage_source(id, source);
    settings.set_cookie_source(id, cookie);
}

/// Disconnect Quotalis' selected method only. Browser originals, CLI sessions,
/// other stored accounts, installations and usage history remain owned by their
/// original applications. Polling is disabled before deleting the owned copy.
#[tauri::command]
pub fn disconnect_provider_connection(
    app: tauri::AppHandle,
    provider_id: String,
    method: ConnectionMethod,
) -> Result<(), String> {
    let id = provider(&provider_id)?;
    if !connection_capabilities(id).supports(method) {
        return Err("Unsupported connection method".into());
    }
    if active_fixture(id).is_some() {
        store_fixture(
            crate::build_info::CHANNEL == "dev",
            Some(ProviderConnectionQaFixture {
                provider_id,
                scenario: "disconnected".into(),
            }),
            &QA_FIXTURE,
        )?;
        let _ = app.emit("provider-updated", ());
        return Ok(());
    }
    let _operation = begin_live_connection(id)?;
    let settings_transaction = super::settings::SETTINGS_PATCH_LOCK
        .lock()
        .map_err(|_| "Settings unavailable")?;
    let mut settings = Settings::load();
    settings.enabled_providers.remove(id.cli_name());
    settings.set_cookie_source(id, "off");
    settings
        .save()
        .map_err(|_| "Connection preferences could not be saved")?;
    drop(settings_transaction);
    // Disabling also prevents old in-flight refresh generations from publishing.
    let state = app.state::<Mutex<AppState>>();
    if let Ok(mut state) = state.lock() {
        state.provider_refresh_generation = state.provider_refresh_generation.wrapping_add(1);
        state
            .provider_cache
            .retain(|s| s.provider_id != id.cli_name());
    }
    match method {
        ConnectionMethod::ApiKey | ConnectionMethod::DeviceFlow => {
            let store = TokenAccountStore::new();
            let mut data = store
                .load_provider(id)
                .map_err(|_| "Protected credential storage unavailable")?;
            if let Some(account) = data.active_account().map(|a| a.id) {
                data.remove_account(account);
                store
                    .save_provider(id, &data)
                    .map_err(|_| "Protected credential deletion failed")?;
            } else if method == ConnectionMethod::ApiKey {
                let mut keys = ApiKeys::load();
                keys.remove(id.cli_name());
                keys.save()
                    .map_err(|_| "Protected credential deletion failed")?;
            }
        }
        ConnectionMethod::BrowserSession => {
            let mut cookies = ManualCookies::load();
            cookies.remove(id.cli_name());
            cookies
                .save()
                .map_err(|_| "Protected session deletion failed")?;
        }
        _ => {}
    }
    let _ = app.emit("provider-updated", ());
    let _ = app.emit("codexbar:settings-updated", ());
    Ok(())
}

#[tauri::command]
pub fn cancel_provider_verification(provider_id: String) -> Result<bool, String> {
    let id = provider(&provider_id)?;
    let guard = ACTIVE_VERIFICATIONS
        .lock()
        .map_err(|_| "Verification registry unavailable")?;
    Ok(guard
        .as_ref()
        .and_then(|map| map.get(&id))
        .is_some_and(|h| {
            h.abort();
            true
        }))
}

// ── Derived status for every provider ───────────────────────────────

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConnectionStatus {
    pub provider_id: String,
    pub enabled: bool,
    pub state: ConnectionState,
    pub issue: Option<ConnectionIssue>,
    pub method: Option<ConnectionMethod>,
    pub last_verified: Option<String>,
    pub stale: bool,
}

/// Cached data older than this is "connected but stale".
pub const STALE_AFTER_SECS: i64 = 3 * 60 * 60;

pub(crate) fn status_from_cache(
    id: ProviderId,
    enabled: bool,
    snapshot: Option<&ProviderUsageSnapshot>,
    now: chrono::DateTime<Utc>,
) -> ProviderConnectionStatus {
    let Some(snapshot) = snapshot.filter(|_| enabled) else {
        return ProviderConnectionStatus {
            provider_id: id.cli_name().to_string(),
            enabled,
            state: ConnectionState::Idle,
            issue: None,
            method: None,
            last_verified: None,
            stale: false,
        };
    };
    let v = verification_from_snapshot(id, snapshot);
    let age = chrono::DateTime::parse_from_rfc3339(&snapshot.updated_at)
        .ok()
        .map(|t| {
            now.signed_duration_since(t.with_timezone(&Utc))
                .num_seconds()
        });
    let stale = v.state == ConnectionState::Connected && age.is_some_and(|a| a > STALE_AFTER_SECS);
    ProviderConnectionStatus {
        provider_id: v.provider_id,
        enabled,
        state: v.state,
        issue: v.issue,
        method: v.method,
        last_verified: v.verified_at,
        stale,
    }
}

#[tauri::command]
pub fn get_provider_connection_status(
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<Vec<ProviderConnectionStatus>, String> {
    let settings = Settings::load();
    let cache = state
        .lock()
        .map_err(|_| "Provider state unavailable")?
        .provider_cache
        .clone();
    let now = Utc::now();
    Ok(ProviderId::all()
        .iter()
        .map(|id| {
            if let Some(fixture) = active_fixture(*id) {
                let v = fixture_verification(*id, &fixture.scenario);
                return ProviderConnectionStatus {
                    provider_id: v.provider_id,
                    enabled: true,
                    state: v.state,
                    issue: v.issue,
                    method: v.method,
                    last_verified: v.verified_at,
                    stale: fixture.scenario == "stale",
                };
            }
            let snapshot = cache.iter().find(|s| s.provider_id == id.cli_name());
            status_from_cache(
                *id,
                settings.enabled_providers.contains(id.cli_name()),
                snapshot,
                now,
            )
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn real_missing_cookie_is_not_a_simulated_observation() {
        let outcome = missing_browser_session(ProviderId::Perplexity);
        assert!(!outcome.simulated);
        assert_eq!(outcome.method, Some(ConnectionMethod::BrowserSession));
        assert_eq!(outcome.issue, Some(ConnectionIssue::BrowserSessionMissing));
        assert_eq!(outcome.verified_at, None);
        assert_eq!(outcome.duration_ms, None);
        assert!(fixture_verification(ProviderId::Perplexity, "cookieMissing").simulated);
    }

    #[test]
    fn login_route_is_fixture_first_and_demo_fails_closed() {
        let fixture = ProviderConnectionQaFixture {
            provider_id: "copilot".into(),
            scenario: "oauthSuccess".into(),
        };
        assert_eq!(
            select_login_route(Some(fixture.clone()), || panic!(
                "fixture must not read settings"
            ))
            .unwrap(),
            Some(fixture)
        );
        assert!(select_login_route(None, || true).is_err());
        assert_eq!(select_login_route(None, || false).unwrap(), None);
        let registry = super::super::connection_operations::OperationRegistry::default();
        {
            let _operation = registry.begin(ProviderId::Copilot).unwrap();
            assert!(select_login_route(None, || true).is_err());
            assert!(registry.begin(ProviderId::Copilot).is_err());
        }
        assert!(registry.begin(ProviderId::Copilot).is_ok());
    }

    fn snapshot(json: serde_json::Value) -> ProviderUsageSnapshot {
        serde_json::from_value(json).unwrap()
    }

    #[test]
    fn fixture_is_dev_only_validated_and_never_persisted() {
        let target = Mutex::new(None);
        let ok = ProviderConnectionQaFixture {
            provider_id: "claude".into(),
            scenario: "rateLimited".into(),
        };
        assert!(store_fixture(false, Some(ok.clone()), &target).is_err());
        assert!(target.lock().unwrap().is_none());
        assert!(store_fixture(true, Some(ok), &target).is_ok());
        for bad in [("invented", "connected"), ("claude", "sparkly")] {
            assert!(
                store_fixture(
                    true,
                    Some(ProviderConnectionQaFixture {
                        provider_id: bad.0.into(),
                        scenario: bad.1.into()
                    }),
                    &target
                )
                .is_err()
            );
        }
        assert!(store_fixture(true, None, &target).is_ok());
        assert!(target.lock().unwrap().is_none());
    }

    #[test]
    fn every_scenario_yields_a_consistent_state_issue_pair() {
        for scenario in CONNECTION_QA_SCENARIOS {
            for &id in ProviderId::all() {
                let v = fixture_verification(id, scenario);
                match v.state {
                    ConnectionState::Connected
                    | ConnectionState::Idle
                    | ConnectionState::Authenticating => {
                        assert!(v.issue.is_none(), "{scenario} {id:?}")
                    }
                    _ => assert!(v.issue.is_some(), "{scenario} {id:?}"),
                }
                if v.state != ConnectionState::Connected {
                    assert!(v.plan.is_none() && v.verified_at.is_none(), "{scenario}");
                }
            }
        }
        let d = fixture_detection(ProviderId::Codex, "cliOld").unwrap();
        assert!(matches!(d.status, CliStatus::TooOld { .. }));
        assert!(fixture_detection(ProviderId::OpenRouter, "cliOld").is_none());
    }

    #[test]
    fn connected_via_comes_from_snapshot_evidence_not_stored_credentials() {
        assert_eq!(
            method_from_source_label(ProviderId::Cursor, "cursor-app"),
            Some(ConnectionMethod::LocalScanner)
        );
        assert_eq!(
            method_from_source_label(ProviderId::Claude, "OAuth"),
            Some(ConnectionMethod::CliSession)
        );
        assert_eq!(
            method_from_source_label(ProviderId::Copilot, "OAuth"),
            Some(ConnectionMethod::DeviceFlow)
        );
        assert_eq!(
            method_from_source_label(ProviderId::Claude, "web"),
            Some(ConnectionMethod::BrowserSession)
        );
        assert_eq!(
            method_from_source_label(ProviderId::OpenRouter, "billing-api"),
            Some(ConnectionMethod::ApiKey)
        );
        assert_eq!(
            method_from_source_label(ProviderId::OpenRouter, "web"),
            None,
            "OpenRouter has no browser method"
        );
        assert_eq!(
            method_from_source_label(ProviderId::Codex, "unavailable"),
            None
        );
    }

    #[test]
    fn status_distinguishes_idle_connected_stale_and_every_problem() {
        let now = Utc::now();
        let fresh = snapshot(
            serde_json::json!({"providerId":"claude","sourceLabel":"OAuth","errorState":"ready","updatedAt":now.to_rfc3339(),"planName":"Max","primary":{"usedPercent":10.0,"remainingPercent":90.0,"resetsAt":now.to_rfc3339()}}),
        );
        let s = status_from_cache(ProviderId::Claude, true, Some(&fresh), now);
        assert_eq!(
            (s.state, s.stale, s.method),
            (
                ConnectionState::Connected,
                false,
                Some(ConnectionMethod::CliSession)
            )
        );
        let old = snapshot(
            serde_json::json!({"providerId":"claude","sourceLabel":"OAuth","errorState":"ready","updatedAt":(now - chrono::Duration::hours(5)).to_rfc3339(),"primary":{"usedPercent":10.0,"remainingPercent":90.0}}),
        );
        assert!(status_from_cache(ProviderId::Claude, true, Some(&old), now).stale);
        assert_eq!(
            status_from_cache(ProviderId::Claude, false, None, now).state,
            ConnectionState::Idle
        );
        for (state_kind, error, expected) in [
            ("needsAuthentication", None, ConnectionState::ActionRequired),
            ("expiredSession", None, ConnectionState::ActionRequired),
            ("localRuntimeOffline", Some("x"), ConnectionState::Offline),
            ("rateLimited", Some("429"), ConnectionState::RateLimited),
            (
                "permissionDenied",
                Some("403"),
                ConnectionState::ActionRequired,
            ),
            ("unknown", Some(TIMEOUT_ERROR), ConnectionState::TimedOut),
            ("unknown", Some("boom"), ConnectionState::Error),
        ] {
            let snap = snapshot(
                serde_json::json!({"providerId":"claude","sourceLabel":"OAuth","errorState":state_kind,"error":error,"updatedAt":now.to_rfc3339(),"primary":{"usedPercent":0.0,"remainingPercent":100.0}}),
            );
            let s = status_from_cache(ProviderId::Claude, true, Some(&snap), now);
            assert_eq!(s.state, expected, "{state_kind} {error:?}");
            assert!(s.last_verified.is_none());
        }
        let _ = ProviderStateKind::Ready;
    }

    #[test]
    fn verification_never_reports_plan_or_freshness_without_a_connection() {
        let now = Utc::now();
        let snap = snapshot(
            serde_json::json!({"providerId":"openrouter","sourceLabel":"billing-api","errorState":"needsAuthentication","error":"401","planName":"Leaked?","updatedAt":now.to_rfc3339(),"primary":{"usedPercent":0.0,"remainingPercent":100.0}}),
        );
        let v = verification_from_snapshot(ProviderId::OpenRouter, &snap);
        assert_eq!(v.issue, Some(ConnectionIssue::CredentialsRejected));
        assert!(v.plan.is_none() && v.verified_at.is_none());
    }

    #[tokio::test]
    async fn verification_and_install_registries_are_single_flight() {
        let handle =
            tokio::spawn(async { tokio::time::sleep(std::time::Duration::from_secs(5)).await });
        assert!(begin_verification(ProviderId::Zed, handle.abort_handle()).is_ok());
        let second = tokio::spawn(async {});
        assert!(begin_verification(ProviderId::Zed, second.abort_handle()).is_err());
        finish_verification(ProviderId::Zed);
        handle.abort();
        let third = tokio::spawn(async {});
        assert!(begin_verification(ProviderId::Zed, third.abort_handle()).is_ok());
        finish_verification(ProviderId::Zed);

        let rx = begin_install(ProviderId::Zed).unwrap();
        assert!(begin_install(ProviderId::Zed).is_err());
        assert!(cancel_cli_install("zed".into()).unwrap());
        assert!(*rx.borrow());
        finish_install(ProviderId::Zed);
        assert!(!cancel_cli_install("zed".into()).unwrap());
    }

    #[test]
    fn install_refuses_without_confirmation_and_unknown_providers() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        assert!(
            rt.block_on(install_cli_dependency("codex".into(), false))
                .is_err()
        );
        assert!(
            rt.block_on(install_cli_dependency("openrouter".into(), true))
                .is_err()
        );
        assert!(
            rt.block_on(install_cli_dependency("invented".into(), true))
                .is_err()
        );
        assert!(
            get_cli_install_plan("kiro".into()).unwrap().is_none(),
            "manual-only"
        );
        assert!(get_cli_install_plan("codex".into()).unwrap().is_some());
    }
}
