use super::*;

#[tauri::command]
pub fn get_app_info() -> AppInfoBridge {
    let settings = Settings::load();
    AppInfoBridge {
        name: "Quotalis".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        build_number: option_env!("BUILD_NUMBER").unwrap_or("dev").to_string(),
        update_channel: update_channel_label(settings.update_channel).to_string(),
        tagline: "May your tokens never run out—keep agent limits in view.".to_string(),
    }
}

pub(super) fn open_url_in_browser(url: &str) -> Result<(), String> {
    let url = validate_external_url(url)?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(windows_system_binary("rundll32.exe"))
            .arg("url.dll,FileProtocolHandler")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {e}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let opener = if cfg!(target_os = "macos") {
            "open"
        } else {
            "xdg-open"
        };
        std::process::Command::new(opener)
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {e}"))?;
    }
    Ok(())
}

pub(crate) fn validate_external_url(url: &str) -> Result<&str, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("URL is empty".to_string());
    }
    if trimmed.len() > 2048 || trimmed.chars().any(char::is_control) {
        return Err("URL is invalid".to_string());
    }
    if !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err("Only http and https URLs can be opened".to_string());
    }
    Ok(trimmed)
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    open_url_in_browser(&url)
}

#[cfg(target_os = "windows")]
fn windows_system_binary(name: &str) -> std::path::PathBuf {
    std::env::var_os("SystemRoot")
        .map(std::path::PathBuf::from)
        .map(|root| root.join("System32").join(name))
        .filter(|path| path.exists())
        .unwrap_or_else(|| std::path::PathBuf::from(name))
}

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 4 — Provider ordering, cookie source, region, credential detection,
// global shortcut capture, session/environment introspection, quick actions.
// ════════════════════════════════════════════════════════════════════════════════

/// Open a filesystem path in the OS file manager (Finder / Explorer /
/// xdg-open). Non-existent paths are rejected so the UI gets immediate
/// feedback instead of a silent no-op shell launch.
#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is empty".into());
    }
    let pb = std::path::PathBuf::from(trimmed);
    if !pb.is_absolute() {
        return Err("Path must be absolute".into());
    }
    if !pb.exists() {
        return Err(format!("Path not found: {trimmed}"));
    }
    // When given a file, open its parent directory so the file is highlighted
    // in a useful way across platforms without needing per-OS --select flags.
    let target = if pb.is_file() {
        pb.parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| pb.clone())
    } else {
        pb.clone()
    };
    let target_str = target.to_string_lossy().into_owned();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(windows_system_binary("explorer.exe"))
            .arg(&target_str)
            .spawn()
            .map_err(|e| format!("Failed to open path: {e}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let opener = if cfg!(target_os = "macos") {
            "open"
        } else {
            "xdg-open"
        };
        std::process::Command::new(opener)
            .arg(&target_str)
            .spawn()
            .map_err(|e| format!("Failed to open path: {e}"))?;
    }
    Ok(())
}

// ── Session / environment ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkAreaRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[tauri::command]
pub fn get_work_area_rect(app: tauri::AppHandle) -> Result<WorkAreaRect, String> {
    use tauri::Manager;

    // Prefer the OS-native probe on Windows because it reliably excludes the
    // taskbar; Tauri's monitor API forwards to the same APIs but we keep the
    // direct path to preserve parity with the egui build.
    if let Some(area) = quotalis_core::host::session::primary_work_area_pixels() {
        return Ok(WorkAreaRect {
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
        });
    }

    // Cross-platform fallback (macOS: NSScreen.visibleFrame; Linux: GTK /
    // X11 work-area) via Tauri's monitor wrapper. Require a window so tao's
    // screen backend is initialised.
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is not available".to_string())?;

    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or_else(|| "No monitor detected".to_string())?;

    let work_area = monitor.work_area();
    Ok(WorkAreaRect {
        x: work_area.position.x,
        y: work_area.position.y,
        width: work_area.size.width as i32,
        height: work_area.size.height as i32,
    })
}

// ── Misc UX ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn play_notification_sound(
    event: quotalis_core::sound::NotificationSoundEvent,
) -> Result<(), String> {
    // Preview through the same settings resolution path used by real notifications.
    let settings = Settings::load();
    quotalis_core::sound::play_alert(event, &settings).map_err(|error| error.to_string())
}

/// Reposition the flyout window so its bottom-right corner stays anchored to
/// the system-tray area. Called from the frontend after dynamic resize.
///
/// Retargeted from `main` to the dedicated `flyout` window — the flyout is no
/// longer a state of `main`'s surface-mode machine, so `reanchor_tray_panel`
/// (still exported under its historical name — the frontend command name is
/// unchanged) now anchors the flyout window directly. The anchor math itself
/// lives in `shell::flyout_window::reanchor`, which this delegates to.
#[tauri::command]
pub fn reanchor_tray_panel(app: tauri::AppHandle) -> Result<(), String> {
    crate::shell::flyout_window::reanchor(&app)
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    let settings = Settings::load();
    if settings.install_updates_on_quit
        && let Some(state) = app.try_state::<std::sync::Mutex<crate::state::AppState>>()
        && let Err(error) = super::updater::apply_ready_update(&state)
    {
        tracing::debug!("install-on-quit skipped: {error}");
    }
    app.exit(0);
}

fn dashboard_url_for_provider(provider_id: &str) -> Option<String> {
    if provider_id == ProviderId::MiniMax.cli_name() {
        let settings = Settings::load();
        return Some(
            quotalis_core::providers::MiniMaxProvider::dashboard_url_for_region(Some(
                settings.api_region(ProviderId::MiniMax),
            )),
        );
    }

    if let Some(url) = quotalis_core::settings::get_api_key_providers()
        .into_iter()
        .find(|p| p.id.cli_name() == provider_id)
        .and_then(|p| p.dashboard_url.map(|s| s.to_string()))
    {
        return Some(url);
    }

    let id = ProviderId::from_cli_name(provider_id)?;
    let provider = instantiate_provider(id);
    provider.metadata().dashboard_url.map(|s| s.to_string())
}

fn status_page_url_for_provider(provider_id: &str) -> Option<String> {
    let id = ProviderId::from_cli_name(provider_id)?;
    let provider = instantiate_provider(id);
    provider.metadata().status_page_url.map(|s| s.to_string())
}

#[tauri::command]
pub fn open_provider_dashboard(provider_id: String) -> Result<(), String> {
    let provider_id = canonical_provider_arg(&provider_id)?;
    let url = dashboard_url_for_provider(&provider_id)
        .ok_or_else(|| format!("No dashboard URL registered for provider '{provider_id}'"))?;
    open_url_in_browser(&url)
}

#[tauri::command]
pub fn open_provider_status_page(provider_id: String) -> Result<(), String> {
    let provider_id = canonical_provider_arg(&provider_id)?;
    let url = status_page_url_for_provider(&provider_id)
        .ok_or_else(|| format!("No status page URL registered for provider '{provider_id}'"))?;
    open_url_in_browser(&url)
}

#[tauri::command]
pub async fn trigger_provider_login(
    app: tauri::AppHandle,
    provider_id: String,
    login_request_id: Option<String>,
) -> Result<(), String> {
    let id = parse_provider_arg(&provider_id)?;
    let transport = provider_login_transport(id).ok_or_else(|| {
        format!(
            "Quotalis cannot start a sign-in flow for '{}'; configure its credentials in Provider settings or open its dashboard.",
            id.display_name()
        )
    })?;
    let request_id = validated_login_request_id(login_request_id)?;
    let registry = provider_login_registry();
    let control = match registry.start(id, &request_id) {
        Ok(control) => control,
        Err(error) => {
            emit_provider_login_phase(
                &app,
                id,
                &request_id,
                ProviderLoginPhase::Failed,
                Some(&error),
            );
            return Err(error);
        }
    };

    emit_provider_login_phase(&app, id, &request_id, ProviderLoginPhase::Starting, None);
    let result = match transport {
        ProviderLoginTransport::Device => {
            run_copilot_device_login(&app, &request_id, control.clone()).await
        }
        ProviderLoginTransport::Cli => {
            run_cli_provider_login(&app, id, &request_id, 120, control.cancellation()).await
        }
    };
    let result = control.finish_result(result);
    registry.finish(id, &request_id);

    let (phase, message) = match &result {
        ProviderLoginRunResult::Completed => (ProviderLoginPhase::Completed, None),
        ProviderLoginRunResult::Canceled => (ProviderLoginPhase::Canceled, None),
        ProviderLoginRunResult::TimedOut(message) => {
            (ProviderLoginPhase::TimedOut, Some(message.as_str()))
        }
        ProviderLoginRunResult::Failed(message) => {
            (ProviderLoginPhase::Failed, Some(message.as_str()))
        }
    };
    emit_provider_login_phase(&app, id, &request_id, phase, message);

    match result {
        ProviderLoginRunResult::Completed | ProviderLoginRunResult::Canceled => Ok(()),
        ProviderLoginRunResult::TimedOut(message) | ProviderLoginRunResult::Failed(message) => {
            Err(message)
        }
    }
}

#[tauri::command]
pub fn cancel_provider_login(
    provider_id: String,
    login_request_id: String,
) -> Result<bool, String> {
    let id = parse_provider_arg(&provider_id)?;
    validate_login_request_id(&login_request_id)?;
    provider_login_registry().cancel(id, &login_request_id)
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
enum ProviderLoginPhase {
    Starting,
    Waiting,
    Completed,
    Failed,
    TimedOut,
    Canceled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderLoginPhasePayload<'a> {
    provider_id: &'a str,
    request_id: &'a str,
    phase: ProviderLoginPhase,
    message: Option<&'a str>,
}

fn emit_provider_login_phase(
    app: &tauri::AppHandle,
    provider: ProviderId,
    request_id: &str,
    phase: ProviderLoginPhase,
    message: Option<&str>,
) {
    let _result = app.emit(
        "provider-login-phase",
        ProviderLoginPhasePayload {
            provider_id: provider.cli_name(),
            request_id,
            phase,
            message,
        },
    );
}

fn validated_login_request_id(request_id: Option<String>) -> Result<String, String> {
    let request_id = request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    validate_login_request_id(&request_id)?;
    Ok(request_id)
}

fn validate_login_request_id(request_id: &str) -> Result<(), String> {
    if request_id.is_empty()
        || request_id.len() > 128
        || !request_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err("Login request ID is invalid".to_string());
    }
    Ok(())
}

#[derive(Clone)]
struct ActiveProviderLogin {
    request_id: String,
    control: ProviderLoginControl,
}

const LOGIN_REQUEST_ACTIVE: u8 = 0;
const LOGIN_REQUEST_CANCELED: u8 = 1;
const LOGIN_REQUEST_COMMITTING: u8 = 2;

#[derive(Clone)]
struct ProviderLoginControl {
    state: std::sync::Arc<std::sync::atomic::AtomicU8>,
    cancellation: login::LoginCancellation,
}

impl ProviderLoginControl {
    fn new() -> Self {
        Self {
            state: std::sync::Arc::new(std::sync::atomic::AtomicU8::new(LOGIN_REQUEST_ACTIVE)),
            cancellation: login::LoginCancellation::new(),
        }
    }

    fn cancellation(&self) -> login::LoginCancellation {
        self.cancellation.clone()
    }

    fn cancel(&self) -> bool {
        if self
            .state
            .compare_exchange(
                LOGIN_REQUEST_ACTIVE,
                LOGIN_REQUEST_CANCELED,
                std::sync::atomic::Ordering::AcqRel,
                std::sync::atomic::Ordering::Acquire,
            )
            .is_err()
        {
            return false;
        }
        self.cancellation.cancel();
        true
    }

    /// Atomically choose persistence over cancellation. Once this succeeds,
    /// later cancel requests return false and cannot produce a canceled phase.
    fn begin_commit(&self) -> bool {
        self.state
            .compare_exchange(
                LOGIN_REQUEST_ACTIVE,
                LOGIN_REQUEST_COMMITTING,
                std::sync::atomic::Ordering::AcqRel,
                std::sync::atomic::Ordering::Acquire,
            )
            .is_ok()
    }

    fn commit_if_active<T>(&self, commit: impl FnOnce() -> T) -> Option<T> {
        self.begin_commit().then(commit)
    }

    /// Resolve terminal delivery and cancellation through the same atomic state.
    /// Device persistence may already own COMMITTING; CLI completion claims it here.
    fn finish_result(&self, result: ProviderLoginRunResult) -> ProviderLoginRunResult {
        if self.begin_commit()
            || self.state.load(std::sync::atomic::Ordering::Acquire) == LOGIN_REQUEST_COMMITTING
        {
            result
        } else {
            ProviderLoginRunResult::Canceled
        }
    }
}

#[derive(Default)]
struct ProviderLoginRegistry {
    active: std::sync::Mutex<HashMap<ProviderId, ActiveProviderLogin>>,
}

impl ProviderLoginRegistry {
    fn start(
        &self,
        provider: ProviderId,
        request_id: &str,
    ) -> Result<ProviderLoginControl, String> {
        let mut active = self
            .active
            .lock()
            .map_err(|_| "Provider login registry is unavailable".to_string())?;
        if active.contains_key(&provider) {
            return Err(format!(
                "A {} sign-in request is already running",
                provider.display_name()
            ));
        }
        let control = ProviderLoginControl::new();
        active.insert(
            provider,
            ActiveProviderLogin {
                request_id: request_id.to_string(),
                control: control.clone(),
            },
        );
        Ok(control)
    }

    fn cancel(&self, provider: ProviderId, request_id: &str) -> Result<bool, String> {
        let active = self
            .active
            .lock()
            .map_err(|_| "Provider login registry is unavailable".to_string())?;
        let Some(request) = active.get(&provider) else {
            return Ok(false);
        };
        if request.request_id != request_id {
            return Ok(false);
        }
        Ok(request.control.cancel())
    }

    fn finish(&self, provider: ProviderId, request_id: &str) {
        if let Ok(mut active) = self.active.lock()
            && active
                .get(&provider)
                .is_some_and(|request| request.request_id == request_id)
        {
            active.remove(&provider);
        }
    }
}

fn provider_login_registry() -> &'static ProviderLoginRegistry {
    static REGISTRY: std::sync::OnceLock<ProviderLoginRegistry> = std::sync::OnceLock::new();
    REGISTRY.get_or_init(ProviderLoginRegistry::default)
}

enum ProviderLoginRunResult {
    Completed,
    Failed(String),
    TimedOut(String),
    Canceled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ProviderLoginTransport {
    Cli,
    Device,
}

/// Prefer a provider-owned CLI OAuth flow over a generic usage dashboard.
/// Providers without a safely supported interactive flow still get the
/// metadata-owned dashboard route rather than an invented auth integration.
pub(super) fn provider_login_transport(id: ProviderId) -> Option<ProviderLoginTransport> {
    match id {
        ProviderId::Codex | ProviderId::Claude | ProviderId::Kiro | ProviderId::VertexAI => {
            Some(ProviderLoginTransport::Cli)
        }
        ProviderId::Copilot => Some(ProviderLoginTransport::Device),
        _ => None,
    }
}

/// Run a provider-owned CLI OAuth flow and emit phase events.
async fn run_cli_provider_login(
    app: &tauri::AppHandle,
    id: ProviderId,
    request_id: &str,
    timeout_secs: u64,
    cancellation: login::LoginCancellation,
) -> ProviderLoginRunResult {
    let app_handle = app.clone();
    let request_id_owned = request_id.to_string();
    let display_name = id.display_name();
    let emit_phase = move |phase| {
        let legacy_phase = match phase {
            LoginPhase::Idle => "idle",
            LoginPhase::Requesting => "requesting",
            LoginPhase::WaitingBrowser => "waiting-browser",
            LoginPhase::Complete => "complete",
        };
        events::emit_login_phase(&app_handle, id.cli_name(), legacy_phase, None);
        if phase == LoginPhase::WaitingBrowser {
            emit_provider_login_phase(
                &app_handle,
                id,
                &request_id_owned,
                ProviderLoginPhase::Waiting,
                None,
            );
        }
    };
    let result = match id {
        ProviderId::Codex => {
            login::run_codex_login_cancellable(timeout_secs, cancellation, emit_phase).await
        }
        ProviderId::Claude => {
            login::run_claude_login_cancellable(timeout_secs, cancellation, emit_phase).await
        }
        ProviderId::Kiro => {
            login::run_kiro_login_cancellable(timeout_secs, cancellation, emit_phase).await
        }
        ProviderId::VertexAI => {
            login::run_vertexai_login_cancellable(timeout_secs, cancellation, emit_phase).await
        }
        _ => {
            return ProviderLoginRunResult::Failed(format!(
                "No CLI login flow is registered for {display_name}"
            ));
        }
    };

    match result.outcome {
        LoginOutcome::Success => ProviderLoginRunResult::Completed,
        LoginOutcome::Canceled => ProviderLoginRunResult::Canceled,
        LoginOutcome::MissingBinary => ProviderLoginRunResult::Failed(format!(
            "{display_name} CLI not found. Install it and ensure it is on your PATH."
        )),
        LoginOutcome::LaunchFailed(e) => {
            ProviderLoginRunResult::Failed(format!("Failed to launch {display_name} login: {e}"))
        }
        LoginOutcome::TimedOut => {
            ProviderLoginRunResult::TimedOut(format!("{display_name} login timed out"))
        }
        LoginOutcome::Failed { status } => ProviderLoginRunResult::Failed(format!(
            "{display_name} login failed with exit code {status}"
        )),
    }
}

async fn run_copilot_device_login(
    app: &tauri::AppHandle,
    request_id: &str,
    control: ProviderLoginControl,
) -> ProviderLoginRunResult {
    let cancellation = control.cancellation();
    let flow = CopilotDeviceFlow::new();
    let device = tokio::select! {
        result = flow.start_flow() => match result {
            Ok(device) => device,
            Err(error) => return ProviderLoginRunResult::Failed(format!("GitHub device login failed: {error}")),
        },
        () = wait_for_login_cancellation(&cancellation) => return ProviderLoginRunResult::Canceled,
    };

    // Only the public user-facing challenge crosses IPC, never device_code/token.
    if let Err(error) = app.emit(
        "provider-login-challenge",
        serde_json::json!({
            "providerId": "copilot", "requestId": request_id,
            "userCode": device.user_code, "verificationUri": device.verification_uri,
        }),
    ) {
        return ProviderLoginRunResult::Failed(error.to_string());
    }
    emit_provider_login_phase(
        app,
        ProviderId::Copilot,
        request_id,
        ProviderLoginPhase::Waiting,
        None,
    );
    if cancellation.is_canceled() {
        return ProviderLoginRunResult::Canceled;
    }
    if let Err(error) = open_url_in_browser(device.verification_url_to_open()) {
        return ProviderLoginRunResult::Failed(error);
    }

    let token = tokio::select! {
        result = flow.wait_for_token(&device.device_code, device.interval, device.expires_in) => match result {
            Ok(token) => token,
            Err(quotalis_core::providers::copilot::device_flow::DeviceFlowError::ExpiredToken) => {
                return ProviderLoginRunResult::TimedOut("GitHub device login timed out".to_string());
            }
            Err(error) => return ProviderLoginRunResult::Failed(format!("GitHub device login failed: {error}")),
        },
        () = wait_for_login_cancellation(&cancellation) => return ProviderLoginRunResult::Canceled,
    };
    if cancellation.is_canceled() {
        return ProviderLoginRunResult::Canceled;
    }

    let api = CopilotApi::new();
    let identity = tokio::select! {
        result = api.fetch_identity_with_token(&token, None) => result.ok(),
        () = wait_for_login_cancellation(&cancellation) => return ProviderLoginRunResult::Canceled,
    };
    let plan = tokio::select! {
        result = api.fetch_usage_with_token(&token, None) => result.ok().and_then(|usage| usage.login_method),
        () = wait_for_login_cancellation(&cancellation) => return ProviderLoginRunResult::Canceled,
    };
    if cancellation.is_canceled() {
        return ProviderLoginRunResult::Canceled;
    }

    let login = identity.as_ref().map(|identity| identity.login.clone());
    let label = match (login.as_deref(), plan.as_deref()) {
        (Some(login), Some(plan)) => format!("{login} ({plan})"),
        (Some(login), None) => login.to_string(),
        (None, Some(plan)) => plan.to_string(),
        (None, None) => "GitHub Copilot".to_string(),
    };

    let store = TokenAccountStore::new();
    let mut data = match store.load_provider(ProviderId::Copilot) {
        Ok(data) => data,
        Err(error) => return ProviderLoginRunResult::Failed(error.to_string()),
    };
    let existing_index = login.as_deref().and_then(|login| {
        data.accounts.iter().position(|account| {
            account.label == login || account.label.starts_with(&format!("{login} ("))
        })
    });

    if let Some(index) = existing_index {
        data.accounts[index].token = token;
        data.accounts[index].label = label;
        data.set_active(index);
    } else {
        let mut account = TokenAccount::new(label, token);
        account.mark_used();
        data.add_account(account);
        data.set_active(data.accounts.len().saturating_sub(1));
    }

    match control.commit_if_active(|| store.save_provider(ProviderId::Copilot, &data)) {
        None => return ProviderLoginRunResult::Canceled,
        Some(Err(error)) => return ProviderLoginRunResult::Failed(error.to_string()),
        Some(Ok(())) => {}
    }

    let _ = app.emit(
        "provider-updated",
        serde_json::json!({ "providerId": "copilot" }),
    );
    ProviderLoginRunResult::Completed
}

async fn wait_for_login_cancellation(cancellation: &login::LoginCancellation) {
    while !cancellation.is_canceled() {
        tokio::time::sleep(std::time::Duration::from_millis(25)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Quotalis rebrand regression guard (owner spec section 30/31): the
    /// About screen renders whatever this bridge command returns verbatim
    /// -- it must never regress to the legacy "QuotaArc" name.
    #[test]
    fn app_info_reports_the_current_public_brand() {
        assert_eq!(get_app_info().name, "Quotalis");
    }

    #[test]
    fn dashboard_url_resolves_from_codex_provider_metadata() {
        assert_eq!(
            dashboard_url_for_provider("codex").as_deref(),
            Some("https://chatgpt.com/codex/settings/usage")
        );
    }

    #[test]
    fn all_registered_providers_have_an_explicit_safe_connection_decision() {
        let ids = ProviderId::all();
        assert_eq!(ids.len(), 70);
        let offered: Vec<_> = ids
            .iter()
            .filter(|id| provider_login_transport(**id).is_some())
            .map(|id| id.cli_name())
            .collect();
        assert_eq!(offered.len(), 5);
        for id in ids {
            assert_eq!(
                provider_login_transport(*id).is_some(),
                matches!(
                    id.cli_name(),
                    "codex" | "claude" | "copilot" | "kiro" | "vertexai"
                )
            );
        }
    }

    #[test]
    fn sign_in_uses_the_provider_cli_when_a_real_oauth_flow_exists() {
        assert_eq!(
            provider_login_transport(ProviderId::Codex),
            Some(ProviderLoginTransport::Cli)
        );
        assert_eq!(
            provider_login_transport(ProviderId::Claude),
            Some(ProviderLoginTransport::Cli)
        );
        assert_eq!(provider_login_transport(ProviderId::Gemini), None);
        assert_eq!(
            provider_login_transport(ProviderId::Copilot),
            Some(ProviderLoginTransport::Device)
        );
        assert_eq!(
            provider_login_transport(ProviderId::VertexAI),
            Some(ProviderLoginTransport::Cli)
        );
        assert_eq!(provider_login_transport(ProviderId::Mistral), None);
    }

    #[test]
    fn login_registry_rejects_duplicate_provider_and_ignores_stale_request() {
        let registry = ProviderLoginRegistry::default();
        let control = registry.start(ProviderId::Copilot, "request-one").unwrap();

        assert!(registry.start(ProviderId::Copilot, "request-two").is_err());
        assert!(!registry.cancel(ProviderId::Copilot, "stale").unwrap());
        assert!(!control.cancellation().is_canceled());
        assert!(registry.cancel(ProviderId::Copilot, "request-one").unwrap());
        assert!(control.cancellation().is_canceled());

        registry.finish(ProviderId::Copilot, "stale");
        assert!(registry.start(ProviderId::Copilot, "request-two").is_err());
        registry.finish(ProviderId::Copilot, "request-one");
        assert!(registry.start(ProviderId::Copilot, "request-two").is_ok());
    }

    #[test]
    fn device_commit_boundary_has_one_atomic_winner() {
        let canceled_first = ProviderLoginControl::new();
        assert!(canceled_first.cancel());
        let wrote_after_cancel = std::cell::Cell::new(false);
        assert!(
            canceled_first
                .commit_if_active(|| wrote_after_cancel.set(true))
                .is_none()
        );
        assert!(!wrote_after_cancel.get());

        let commit_first = ProviderLoginControl::new();
        let wrote_after_commit = std::cell::Cell::new(false);
        assert!(
            commit_first
                .commit_if_active(|| wrote_after_commit.set(true))
                .is_some()
        );
        assert!(wrote_after_commit.get());
        assert!(!commit_first.cancel());
        assert!(!commit_first.cancellation().is_canceled());
    }

    #[test]
    fn terminal_delivery_and_cancel_have_one_winner() {
        let canceled = ProviderLoginControl::new();
        assert!(canceled.cancel());
        assert!(matches!(
            canceled.finish_result(ProviderLoginRunResult::Completed),
            ProviderLoginRunResult::Canceled
        ));
        let completed = ProviderLoginControl::new();
        assert!(matches!(
            completed.finish_result(ProviderLoginRunResult::Completed),
            ProviderLoginRunResult::Completed
        ));
        assert!(!completed.cancel());
    }

    #[test]
    fn login_request_ids_are_bounded_and_transport_safe() {
        assert!(validate_login_request_id("87c4735e-3889-46a6-80ab").is_ok());
        assert!(validate_login_request_id("request_2").is_ok());
        assert!(validate_login_request_id("").is_err());
        assert!(validate_login_request_id("request with spaces").is_err());
        assert!(validate_login_request_id(&"a".repeat(129)).is_err());
    }
}
