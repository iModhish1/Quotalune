//! Proof/debug harness for the Tauri desktop shell.
//!
//! Activated by the `CODEXBAR_PROOF_MODE` environment variable.  The value
//! specifies a target surface and optional settings tab to display on
//! startup, e.g.:
//!
//!   - `trayPanel`          — show the tray panel
//!   - `popOut`             — show the pop-out dashboard
//!   - `popOut:provider:codex` — show a provider pop-out
//!   - `settings`           — show settings (General tab)
//!   - `settings:menuBar`   — show settings on the Menu Bar tab
//!   - `settings:usageSpend` — show settings on the Usage & Spend tab
//!   - `settings:about`     — show settings on the About tab
//!
//! In proof mode the shell immediately transitions to the requested surface
//! and suppresses blur-dismiss so the window stays visible for automated
//! screenshot capture.
//!
//! `CODEXBAR_SEED_USAGE_JSON=<abs-path>` additionally seeds one synthetic,
//! bridge-shaped Codex [`ProviderUsageSnapshot`] into the provider cache at
//! launch (before the first event/WebView read) and pins it against refresh
//! eviction for the run. Malformed files log a warning and the shell
//! continues without seeding — proof runs must never crash on the seed.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::commands::{CostSnapshotBridge, ProviderUsageSnapshot, RateWindowSnapshot};
use crate::shell;
use crate::state::AppState;
use crate::surface::SurfaceMode;
use crate::surface_target::{SurfaceTarget, is_supported_provider_id, is_supported_settings_tab};

#[derive(Debug, Clone, PartialEq, Eq)]
struct NotificationProofPayload {
    title: String,
    body: String,
    destination: quotalis_core::notifications::NotificationDestination,
}

fn notification_proof_payload(
    kind: &str,
    provider: quotalis_core::core::ProviderId,
) -> Option<NotificationProofPayload> {
    use quotalis_core::notifications::NotificationDestination;

    let provider_name = provider.display_name();
    let (title, body, destination) = match kind {
        "normal" => (
            "Quotalis",
            "Notifications are ready.".to_string(),
            NotificationDestination::Dashboard,
        ),
        "highUsage" => (
            "High usage",
            format!("{provider_name} usage is high. Open its current limits."),
            NotificationDestination::Provider(provider),
        ),
        "reset" => (
            "Quota reset completed",
            format!("{provider_name} reported a quota reset."),
            NotificationDestination::Dashboard,
        ),
        "authRequired" => (
            "Connection required",
            format!("Connect {provider_name} to resume quota updates."),
            NotificationDestination::Providers(provider),
        ),
        _ => return None,
    };

    Some(NotificationProofPayload {
        title: title.to_string(),
        body,
        destination,
    })
}

/// Native notification proof hook. It is callable only from an explicit Dev
/// proof-mode process, so production UI cannot generate synthetic toasts.
#[tauri::command]
pub fn show_notification_proof(
    app: AppHandle,
    kind: String,
    provider_id: String,
) -> Result<(), String> {
    if !quotalis_core::paths::is_dev_channel() || !is_proof_mode(&app) {
        return Err("notification proof is available only in Dev proof mode".to_string());
    }
    let provider = quotalis_core::core::ProviderId::from_cli_name(&provider_id)
        .ok_or_else(|| "unknown provider for notification proof".to_string())?;
    let payload = notification_proof_payload(&kind, provider)
        .ok_or_else(|| "unsupported notification proof kind".to_string())?;
    if kind == "reset" {
        quotalis_core::notifications::show_provider_notification_to(
            &payload.title,
            &payload.body,
            provider,
            payload.destination,
        );
    } else {
        quotalis_core::notifications::show_notification_to(
            &payload.title,
            &payload.body,
            payload.destination,
        );
    }
    Ok(())
}

/// Read-only native registration evidence, restricted to the isolated Dev proof process.
#[tauri::command]
pub fn get_provider_tray_proof(app: AppHandle) -> Result<Vec<(String, bool)>, String> {
    if !quotalis_core::paths::is_dev_channel() || !is_proof_mode(&app) {
        return Err("tray proof requires Dev proof mode".into());
    }
    Ok(crate::provider_tray::registered_icons(&app))
}

/// Proof configuration parsed from `CODEXBAR_PROOF_MODE`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProofConfig {
    /// The surface to show on startup (serialized as the camelCase id).
    pub target_surface: String,
    /// Optional settings tab id (e.g. `"menuBar"`, `"usageSpend"`).
    pub settings_tab: Option<String>,
    /// Optional target payload for richer proof routing, such as
    /// `"provider:codex"` for pop-out provider views.
    pub target_payload: Option<String>,
}

impl ProofConfig {
    /// Read proof configuration from the environment.
    ///
    /// Returns `None` when `CODEXBAR_PROOF_MODE` is unset or empty.
    pub fn from_env() -> Option<Self> {
        let raw = std::env::var("CODEXBAR_PROOF_MODE").ok()?;
        let raw = raw.trim();
        if raw.is_empty() {
            return None;
        }

        let (surface_str, payload) = if let Some((s, t)) = raw.split_once(':') {
            (s, Some(t.to_string()))
        } else {
            (raw, None)
        };

        let Some(surface_mode) = SurfaceMode::parse(surface_str) else {
            tracing::warn!("CODEXBAR_PROOF_MODE: unknown surface '{surface_str}', ignoring");
            return None;
        };

        if !proof_payload_is_supported(surface_mode, payload.as_deref()) {
            tracing::warn!("CODEXBAR_PROOF_MODE: unsupported target '{raw}', ignoring");
            return None;
        }

        Some(ProofConfig {
            target_surface: surface_str.to_string(),
            settings_tab: (surface_str == SurfaceMode::Settings.as_str())
                .then_some(payload.clone())
                .flatten(),
            target_payload: payload,
        })
    }

    /// Resolve the target `SurfaceMode` enum value.
    pub fn surface_mode(&self) -> SurfaceMode {
        SurfaceMode::parse(&self.target_surface).unwrap_or(SurfaceMode::TrayPanel)
    }

    pub fn surface_target(&self) -> SurfaceTarget {
        match self.surface_mode() {
            SurfaceMode::Hidden | SurfaceMode::TrayPanel => SurfaceTarget::Summary,
            SurfaceMode::PopOut => self
                .target_payload
                .as_deref()
                .and_then(SurfaceTarget::parse)
                .filter(|target| target.mode() == SurfaceMode::PopOut)
                .unwrap_or(SurfaceTarget::Dashboard),
            SurfaceMode::Settings => SurfaceTarget::Settings {
                tab: self
                    .settings_tab
                    .clone()
                    .unwrap_or_else(|| "general".into()),
            },
        }
    }
}

/// Immediately transition to the proof-mode target surface.
///
/// Called from the Tauri `setup` closure when proof mode is active.
pub fn activate(app: &AppHandle) {
    let config = {
        let st = app.state::<Mutex<AppState>>();
        st.lock().unwrap().proof_config.clone()
    };

    let Some(config) = config else { return };
    let target = config.surface_mode();
    let position = match target {
        // Detached surfaces are larger than tray panels. Let their normal
        // positioning paths center/clamp them instead of reusing tray coords.
        SurfaceMode::Settings | SurfaceMode::PopOut => None,
        _ => proof_window_position(app),
    };
    tracing::info!(
        "proof-harness: activating surface={} tab={:?} position={:?}",
        config.target_surface,
        config.settings_tab,
        position,
    );

    match shell::transition_to_target(app, target, config.surface_target(), position) {
        Ok(mode) => tracing::info!("proof-harness: transition succeeded → {mode:?}"),
        Err(err) => tracing::error!("proof-harness: transition FAILED: {err}"),
    }
}

/// Bottom inset (physical px) kept between the proof panel's bottom edge and
/// the monitor work-area bottom (#265).
const PROOF_BOTTOM_INSET_PX: i32 = 8;

/// Mirror of the frontend auto-fit ceiling (`TRAY_MAX_MEASURE_HEIGHT`,
/// logical px in `useTrayPanelLayout.ts`): the proof panel can settle
/// anywhere up to this height.
const PROOF_MAX_SETTLE_HEIGHT_LOGICAL: f64 = 920.0;

/// Justified proof-panel anchor (#265). The harness anchors `main` once and
/// never re-anchors (the flyout-only `reanchor_tray_panel` path is a no-op
/// here, and Win32 ignores `set_max_size` for programmatic resizes), so an
/// anchor computed from the DEFAULT initial size lets a tall auto-fit settle
/// (up to the frontend's 920px cap) push the bottom edge under the taskbar.
/// When `anchor_y + max settle` would exceed `work_bottom - inset`, move the
/// anchor up just enough that even the tallest settle stays fully on screen;
/// otherwise keep the historical anchor unchanged.
fn proof_anchor_y(anchor_y: i32, work_bottom: i32, max_settle_height_px: i32) -> i32 {
    let justified = work_bottom - PROOF_BOTTOM_INSET_PX - max_settle_height_px;
    anchor_y.min(justified)
}

/// Bottom edge of a settled panel anchored via [`proof_anchor_y`].
#[cfg(test)]
fn proof_settled_bottom(
    anchor_y: i32,
    settled_height: i32,
    work_bottom: i32,
    max_settle_height_px: i32,
) -> i32 {
    proof_anchor_y(anchor_y, work_bottom, max_settle_height_px) + settled_height
}

/// Calculate a predictable window position for proof captures.
///
/// Proof mode needs a reliable on-screen position. We skip
/// `inferred_tray_panel_position` because its DPI-scaled maths can
/// produce off-screen coords on high-DPI setups.
fn proof_window_position(app: &AppHandle) -> Option<(i32, i32)> {
    let (x, y) = proof_window_position_unjustified(app)?;

    // #265: justify above the taskbar when the tallest legitimate auto-fit
    // settle (the frontend's 920px cap) would otherwise push the bottom edge
    // under it — the harness anchors `main` once and never re-anchors, so
    // the anchor itself must reserve the settle room.
    let Some(window) = app.get_webview_window("main") else {
        return Some((x, y));
    };
    let Some(m) = window
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| window.available_monitors().ok()?.into_iter().next())
    else {
        return Some((x, y));
    };
    let work_area = m.work_area();
    // Monitor physical dimensions are bounded well below i32::MAX on Windows.
    let work_bottom = work_area.position.y + work_area.size.height as i32;
    let scale = m.scale_factor().max(1.0);
    // 920px logical * scale is a whole pixel count by design.
    let max_settle = (PROOF_MAX_SETTLE_HEIGHT_LOGICAL * scale) as i32;
    let justified_y = proof_anchor_y(y, work_bottom, max_settle);
    if justified_y != y {
        tracing::info!(
            "proof-pos: #265 justified anchor y={y} → {justified_y} \
             (work_bottom={work_bottom} max_settle={max_settle})"
        );
    }
    Some((x, justified_y))
}

/// Raw proof-capture anchor, before the #265 above-taskbar justification.
fn proof_window_position_unjustified(app: &AppHandle) -> Option<(i32, i32)> {
    if let Some(pos) = shell::tray_panel_position(app) {
        return Some(pos);
    }
    let window = app.get_webview_window("main")?;
    let monitor = window
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| window.available_monitors().ok()?.into_iter().next());
    if let Some(m) = monitor {
        // Return coordinates in Tauri physical space (same as
        // monitor.size/work_area). transition.rs divides by scale before
        // calling set_position.
        // Monitor physical dimensions are bounded well below i32::MAX.
        let screen_w = m.size().width as i32;
        let work_area = m.work_area();
        let work_bottom = work_area.position.y + work_area.size.height as i32;
        let scale = m.scale_factor().max(1.0);
        let props = SurfaceMode::TrayPanel.window_properties();
        // Layout dimensions in whole physical px by design.
        let panel_w = (props.width * scale) as i32;
        let panel_h = (props.height * scale) as i32;
        let margin = (12.0 * scale) as i32;
        let x = screen_w - panel_w - margin;
        let y = work_bottom - panel_h - margin;
        tracing::info!(
            "proof-pos: screen_w={screen_w} work_bottom={work_bottom} \
             panel={}x{} scale={scale} → ({x},{y})",
            panel_w,
            panel_h,
        );
        return Some((x, y));
    }
    Some((800, 25))
}

/// Returns `true` when proof mode is active in the shared state.
pub fn is_proof_mode(app: &AppHandle) -> bool {
    app.try_state::<Mutex<AppState>>()
        .map(|st| st.lock().unwrap().proof_config.is_some())
        .unwrap_or(false)
}

// ── Provider-usage seed (CODEXBAR_SEED_USAGE_JSON) ───────────────────

/// Environment variable pointing at a JSON file with one synthetic,
/// bridge-shaped `ProviderUsageSnapshot` for the codex provider.
pub const SEED_USAGE_ENV_VAR: &str = "CODEXBAR_SEED_USAGE_JSON";

/// Whether a seed path was configured at launch. While set, the provider
/// cache is pinned fresh so the synthetic snapshot is never evicted by an
/// automatic refresh during a proof/capture run.
pub fn seed_usage_json_active() -> bool {
    std::env::var_os(SEED_USAGE_ENV_VAR).is_some()
}

/// Whether the multi-provider proof bundle is configured for this run.
pub fn seed_providers_json_active() -> bool {
    std::env::var_os(SEED_PROVIDERS_ENV_VAR).is_some()
}

/// Keep either proof fixture stable across every passive refresh-if-stale
/// request. Manual refreshes remain explicit and are never swallowed here.
pub fn provider_seed_active() -> bool {
    seed_usage_json_active() || seed_providers_json_active()
}

/// Read and validate the seed file referenced by `CODEXBAR_SEED_USAGE_JSON`.
///
/// Returns `None` (with a warn, never a crash) when the variable is unset,
/// the file is unreadable, the JSON is malformed, or the snapshot is not
/// for the `codex` provider.
pub fn seed_usage_snapshot_from_env() -> Option<ProviderUsageSnapshot> {
    let path = std::env::var_os(SEED_USAGE_ENV_VAR)?;
    let path = std::path::PathBuf::from(path);
    let raw = match std::fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(err) => {
            tracing::warn!(
                "{SEED_USAGE_ENV_VAR}: cannot read {}: {err}",
                path.display()
            );
            return None;
        }
    };
    match parse_seed_usage_snapshot(&raw) {
        Ok(snapshot) => Some(snapshot),
        Err(msg) => {
            tracing::warn!("{SEED_USAGE_ENV_VAR}: {msg} in {}", path.display());
            None
        }
    }
}

/// Proof-only multi-provider bundle (`CODEXBAR_SEED_PROVIDERS_JSON`).
///
/// Development/proof mode input for several deterministic synthetic
/// providers. Validation is strict: version must be 1, provider IDs must
/// resolve, stable IDs must be unique, fractions must stay in 0..=100 and
/// agree, and any failure warns and disables the whole bundle (never a
/// partial seed, never a crash).
pub const SEED_PROVIDERS_ENV_VAR: &str = "CODEXBAR_SEED_PROVIDERS_JSON";

#[derive(serde::Deserialize)]
struct ProvidersBundleFile {
    version: u32,
    providers: Vec<ProviderBundleEntry>,
}

#[derive(serde::Deserialize)]
struct ProviderBundleEntry {
    provider: String,
    #[serde(default)]
    account_id: Option<String>,
    #[serde(default)]
    display_name: Option<String>,
    used_percent: f64,
    #[serde(default)]
    reset_description: Option<String>,
    #[serde(default)]
    status: Option<String>,
}

/// Parse + validate a multi-provider proof bundle. Pure.
pub fn parse_providers_bundle(json: &str) -> Result<Vec<ProviderUsageSnapshot>, String> {
    let bundle: ProvidersBundleFile =
        serde_json::from_str(json).map_err(|e| format!("malformed bundle JSON: {e}"))?;
    if bundle.version != 1 {
        return Err(format!("unsupported bundle version {}", bundle.version));
    }
    if bundle.providers.is_empty() {
        return Err("bundle contains no providers".to_string());
    }
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::with_capacity(bundle.providers.len());
    for entry in &bundle.providers {
        let provider_id = quotalis_core::core::ProviderId::from_cli_name(entry.provider.trim())
            .ok_or_else(|| format!("unknown provider '{}'", entry.provider))?;
        let stable_id = entry
            .account_id
            .as_deref()
            .unwrap_or(entry.provider.as_str());
        if !seen.insert(stable_id.to_string()) {
            return Err(format!("duplicate stable id '{}'", stable_id));
        }
        if !(0.0..=100.0).contains(&entry.used_percent) {
            return Err(format!("used_percent {} out of range", entry.used_percent));
        }
        if !entry.used_percent.is_finite() {
            return Err("used_percent not finite".to_string());
        }
        let (error, error_state) = match entry.status.as_deref() {
            None | Some("ok" | "ready" | "attention") => {
                (None, quotalis_core::core::ProviderStateKind::Ready)
            }
            Some("offline" | "unavailable") => (
                Some("Proof fixture: usage unavailable".to_string()),
                quotalis_core::core::ProviderStateKind::LocalRuntimeOffline,
            ),
            Some(other) => return Err(format!("unknown status '{other}'")),
        };
        let remaining = 100.0 - entry.used_percent;
        let window = |used: f64, remaining: f64| crate::commands::RateWindowSnapshot {
            used_percent: used,
            remaining_percent: remaining,
            window_minutes: None,
            resets_at: None,
            reset_description: entry.reset_description.clone(),
            is_exhausted: remaining <= 0.0,
            is_informational: false,
            reserve_percent: None,
            reserve_description: None,
            reserve_eta_seconds: None,
            reserve_will_last_to_reset: false,
        };
        let display = entry
            .display_name
            .clone()
            .unwrap_or_else(|| entry.provider.clone());
        let snapshot = ProviderUsageSnapshot {
            provider_id: provider_id.cli_name().to_string(),
            display_name: display.clone(),
            primary: window(entry.used_percent, remaining),
            primary_label: None,
            secondary: None,
            secondary_label: None,
            model_specific: None,
            tertiary: None,
            extra_rate_windows: Vec::new(),
            reset_facts: None,
            cost: None,
            plan_name: Some("Proof".to_string()),
            account_email: None,
            source_label: "proof-bundle".to_string(),
            updated_at: "2026-09-03T12:00:00Z".to_string(),
            error,
            error_state,
            pace: None,
            account_organization: None,
            tray_status_label: None,
            tertiary_label: None,
            session_equivalent_forecast: None,
            wayfinder_usage: None,
            fetch_duration_ms: None,
        };
        out.push(snapshot);
    }
    // Deterministic ordering: by provider id.
    out.sort_by(|a, b| a.provider_id.cmp(&b.provider_id));
    Ok(out)
}

/// Read + parse the bundle from `CODEXBAR_SEED_PROVIDERS_JSON`. Warn + None
/// on any failure; never crashes, never partially seeds.
pub fn providers_bundle_from_env() -> Vec<ProviderUsageSnapshot> {
    let path = match std::env::var_os(SEED_PROVIDERS_ENV_VAR) {
        Some(p) => std::path::PathBuf::from(p),
        None => return Vec::new(),
    };
    let raw = match std::fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(err) => {
            tracing::warn!(
                "{SEED_PROVIDERS_ENV_VAR}: cannot read {}: {err}",
                path.display()
            );
            return Vec::new();
        }
    };
    match parse_providers_bundle(&raw) {
        Ok(snapshots) => snapshots,
        Err(msg) => {
            tracing::warn!("{SEED_PROVIDERS_ENV_VAR}: {msg} in {}", path.display());
            Vec::new()
        }
    }
}

/// Parse a seed-usage JSON string directly into a canonical
/// [`ProviderUsageSnapshot`].
///
/// The canonical bridge types carry `#[serde(default)]` on optional/derived
/// fields so the seed JSON can omit them. This function fills in the
/// computed defaults that serde cannot express from sibling fields
/// (`remainingPercent` from `usedPercent`, `formattedUsed` from `used`,
/// `updatedAt` from the current time) and validates that the snapshot is
/// for the `codex` provider.
///
/// Pure: no env vars, no files, no global state.
pub fn parse_seed_usage_snapshot(json: &str) -> Result<ProviderUsageSnapshot, String> {
    let mut snapshot: ProviderUsageSnapshot =
        serde_json::from_str(json).map_err(|e| format!("malformed JSON: {e}"))?;

    if snapshot.provider_id != "codex" {
        return Err(format!(
            "snapshot providerId '{}' is not 'codex', ignoring",
            snapshot.provider_id
        ));
    }

    normalize_rate_window(&mut snapshot.primary);
    snapshot.secondary.as_mut().map(normalize_rate_window);
    snapshot.model_specific.as_mut().map(normalize_rate_window);
    snapshot.tertiary.as_mut().map(normalize_rate_window);
    for extra in &mut snapshot.extra_rate_windows {
        normalize_rate_window(&mut extra.window);
    }
    snapshot.cost.as_mut().map(normalize_cost);

    if snapshot.updated_at.is_empty() {
        snapshot.updated_at = chrono::Utc::now().to_rfc3339();
    }

    Ok(snapshot)
}

/// Recompute `remaining_percent` from `used_percent` (matching the canonical
/// [`RateWindowSnapshot::from_rate_window`] behaviour) so the seed JSON can
/// omit it.
fn normalize_rate_window(w: &mut RateWindowSnapshot) {
    w.remaining_percent = 100.0 - w.used_percent.clamp(0.0, 100.0);
}

/// Fill `formatted_used` from `used` when the seed JSON omits it.
fn normalize_cost(c: &mut CostSnapshotBridge) {
    if c.formatted_used.is_empty() {
        c.formatted_used = format!("${:.2}", c.used);
    }
}

fn proof_payload_is_supported(surface_mode: SurfaceMode, payload: Option<&str>) -> bool {
    match (surface_mode, payload) {
        (SurfaceMode::Hidden | SurfaceMode::TrayPanel, None) => true,
        (SurfaceMode::Hidden | SurfaceMode::TrayPanel, Some(_)) => false,
        (SurfaceMode::Settings, None) => true,
        (SurfaceMode::Settings, Some(tab)) => is_supported_settings_tab(tab),
        (SurfaceMode::PopOut, None) => true,
        (SurfaceMode::PopOut, Some(raw_target)) => {
            let Some(target) = SurfaceTarget::parse(raw_target) else {
                return false;
            };

            match target {
                SurfaceTarget::Dashboard => true,
                SurfaceTarget::Provider { provider_id } => is_supported_provider_id(&provider_id),
                _ => false,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::LazyLock;

    static ENV_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

    #[test]
    fn notification_proof_kinds_have_bounded_routes_and_current_brand() {
        use quotalis_core::core::ProviderId;
        use quotalis_core::notifications::NotificationDestination;

        let normal = notification_proof_payload("normal", ProviderId::Codex).unwrap();
        assert_eq!(normal.title, "Quotalis");
        assert_eq!(normal.destination, NotificationDestination::Dashboard);

        let high = notification_proof_payload("highUsage", ProviderId::Codex).unwrap();
        assert_eq!(
            high.destination,
            NotificationDestination::Provider(ProviderId::Codex)
        );

        let auth = notification_proof_payload("authRequired", ProviderId::Claude).unwrap();
        assert_eq!(
            auth.destination,
            NotificationDestination::Providers(ProviderId::Claude)
        );

        assert!(notification_proof_payload("arbitrary", ProviderId::Codex).is_none());
    }

    #[test]
    fn tall_panel_bottom_edge_never_passes_work_bottom_minus_inset() {
        // 1920x1080 proof rig at 100% display scale: historical anchor y=252
        // (1040 work bottom - 776 default height - 12 margin); the tallest
        // legitimate settle is the frontend auto-fit cap, 920px.
        let max_settle = 920;
        // y is justified up to 112 so the capped settle bottoms out exactly
        // on the inset boundary...
        assert_eq!(proof_anchor_y(252, 1040, max_settle), 112);
        let bottom = proof_settled_bottom(252, max_settle, 1040, max_settle);
        assert!(bottom <= 1040 - PROOF_BOTTOM_INSET_PX);
        assert_eq!(bottom, 1032);
        // ...and any shorter settle keeps its bottom edge on screen too.
        assert!(proof_settled_bottom(252, 780, 1040, max_settle) <= 1040 - PROOF_BOTTOM_INSET_PX);
        assert!(proof_settled_bottom(252, 568, 1040, max_settle) <= 1040 - PROOF_BOTTOM_INSET_PX);
        // Tall displays where even the capped settle already fits keep the
        // historical anchor unchanged.
        assert_eq!(proof_anchor_y(252, 2000, max_settle), 252);
        // Degenerate anchors below the work bottom move fully above it.
        assert_eq!(proof_anchor_y(1500, 1040, max_settle), 112);
    }

    fn with_proof_mode_env(value: Option<&str>, test: impl FnOnce()) {
        let _guard = ENV_LOCK.lock().unwrap();
        let prev = std::env::var("CODEXBAR_PROOF_MODE").ok();

        match value {
            // SAFETY: `ENV_LOCK` is held for the whole `with_proof_mode_env`
            // scope, serializing this env mutation against other proof-mode
            // tests so no other thread reads or writes `CODEXBAR_PROOF_MODE`.
            Some(value) => unsafe { std::env::set_var("CODEXBAR_PROOF_MODE", value) },
            // SAFETY: same `ENV_LOCK` guard; the variable is unset only here.
            None => unsafe { std::env::remove_var("CODEXBAR_PROOF_MODE") },
        }

        test();

        match prev {
            // SAFETY: `ENV_LOCK` is still held, restoring the prior value so
            // no other proof-mode test observes the temporary mutation.
            Some(prev) => unsafe { std::env::set_var("CODEXBAR_PROOF_MODE", prev) },
            // SAFETY: same `ENV_LOCK` guard; restores the unset state.
            None => unsafe { std::env::remove_var("CODEXBAR_PROOF_MODE") },
        }
    }

    #[test]
    fn parse_simple_surface() {
        with_proof_mode_env(Some("trayPanel"), || {
            let cfg = ProofConfig::from_env().unwrap();
            assert_eq!(cfg.target_surface, "trayPanel");
            assert!(cfg.settings_tab.is_none());
            assert_eq!(cfg.surface_mode(), SurfaceMode::TrayPanel);
        });
    }

    #[test]
    fn parse_settings_with_tab() {
        with_proof_mode_env(Some("settings:menuBar"), || {
            let cfg = ProofConfig::from_env().unwrap();
            assert_eq!(cfg.target_surface, "settings");
            assert_eq!(cfg.settings_tab.as_deref(), Some("menuBar"));
            assert_eq!(cfg.surface_mode(), SurfaceMode::Settings);
            assert_eq!(
                cfg.surface_target(),
                SurfaceTarget::Settings {
                    tab: "menuBar".into()
                }
            );
        });
    }

    #[test]
    fn parse_settings_about_proof_target() {
        with_proof_mode_env(Some("settings:about"), || {
            let cfg = ProofConfig::from_env().unwrap();
            assert_eq!(cfg.target_surface, "settings");
            assert_eq!(cfg.settings_tab.as_deref(), Some("about"));
        });
    }

    #[test]
    fn parse_provider_popout_proof_target() {
        with_proof_mode_env(Some("popOut:provider:codex"), || {
            let cfg = ProofConfig::from_env().unwrap();
            assert_eq!(cfg.target_surface, "popOut");
            assert_eq!(cfg.target_payload.as_deref(), Some("provider:codex"));
            assert_eq!(
                cfg.surface_target(),
                SurfaceTarget::Provider {
                    provider_id: "codex".into()
                }
            );
        });
    }

    #[test]
    fn empty_env_returns_none() {
        with_proof_mode_env(Some(""), || {
            assert!(ProofConfig::from_env().is_none());
        });
    }

    #[test]
    fn unset_env_returns_none() {
        with_proof_mode_env(None, || {
            assert!(ProofConfig::from_env().is_none());
        });
    }

    #[test]
    fn invalid_surface_returns_none() {
        with_proof_mode_env(Some("bogus"), || {
            assert!(ProofConfig::from_env().is_none());
        });
    }

    #[test]
    fn invalid_settings_tab_returns_none() {
        with_proof_mode_env(Some("settings:security"), || {
            assert!(ProofConfig::from_env().is_none());
        });
    }

    #[test]
    fn invalid_provider_target_returns_none() {
        with_proof_mode_env(Some("popOut:provider:not-a-provider"), || {
            assert!(ProofConfig::from_env().is_none());
        });
    }

    #[test]
    fn pop_out_surface() {
        with_proof_mode_env(Some("popOut"), || {
            let cfg = ProofConfig::from_env().unwrap();
            assert_eq!(cfg.surface_mode(), SurfaceMode::PopOut);
            assert_eq!(cfg.surface_target(), SurfaceTarget::Dashboard);
        });
    }

    #[test]
    fn parse_seed_snapshot_decodes_codex_usage() {
        let json = serde_json::json!({
            "providerId": "codex",
            "displayName": "Codex",
            "primary": {
                "usedPercent": 61.0,
                "windowMinutes": 300,
                "resetsAt": "2099-01-02T03:04:05Z",
                "resetDescription": "seeded 5h",
            },
            "primaryLabel": "Session",
            "secondary": { "usedPercent": 74.0, "windowMinutes": 10080 },
            "secondaryLabel": "Weekly",
            "extraRateWindows": [
                {
                    "id": "reset-credits",
                    "title": "Reset Credits",
                    "window": {
                        "usedPercent": 0.0,
                        "resetsAt": "2099-01-09T00:00:00Z",
                        "resetDescription": "2 reset credits available",
                        "isInformational": true,
                    },
                },
            ],
        })
        .to_string();

        let snapshot = parse_seed_usage_snapshot(&json).expect("seed parses into a snapshot");
        assert_eq!(snapshot.provider_id, "codex");
        assert_eq!(snapshot.primary.used_percent, 61.0);
        assert_eq!(
            snapshot.primary.resets_at.as_deref(),
            Some("2099-01-02T03:04:05Z")
        );
        assert_eq!(snapshot.primary.remaining_percent, 39.0);
        assert_eq!(snapshot.primary_label.as_deref(), Some("Session"));
        assert_eq!(
            snapshot.secondary.as_ref().map(|s| s.used_percent),
            Some(74.0)
        );
        assert_eq!(
            snapshot.secondary.as_ref().map(|s| s.remaining_percent),
            Some(26.0)
        );
        assert_eq!(snapshot.extra_rate_windows.len(), 1);
        assert_eq!(snapshot.extra_rate_windows[0].id, "reset-credits");
        assert!(snapshot.extra_rate_windows[0].window.is_informational);
        // Defaults applied: displayName, sourceLabel, updatedAt
        assert_eq!(snapshot.display_name, "Codex");
        assert_eq!(snapshot.source_label, "seed");
        assert!(!snapshot.updated_at.is_empty());
    }

    #[test]
    fn parse_seed_snapshot_rejects_non_codex_provider() {
        let json = r#"{"providerId": "claude", "primary": {"usedPercent": 10.0}}"#;
        assert!(parse_seed_usage_snapshot(json).is_err());
    }

    #[test]
    fn parse_seed_snapshot_rejects_malformed_json() {
        assert!(parse_seed_usage_snapshot("{not json}").is_err());
    }

    #[test]
    fn parse_seed_snapshot_fills_cost_defaults() {
        let json = r#"{
            "providerId": "codex",
            "primary": {"usedPercent": 50.0},
            "cost": {"used": 12.5, "limit": 100.0}
        }"#;
        let snapshot = parse_seed_usage_snapshot(json).unwrap();
        let cost = snapshot.cost.expect("cost present");
        assert_eq!(cost.used, 12.5);
        assert_eq!(cost.limit, Some(100.0));
        assert_eq!(cost.currency_code, "USD");
        assert_eq!(cost.period, "month");
        assert_eq!(cost.formatted_used, "$12.50");
    }
}

#[cfg(test)]
mod bundle_tests {
    use super::*;
    use std::sync::{LazyLock, Mutex};

    static BUNDLE_ENV_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

    const VALID: &str = r#"{
        "version": 1,
        "providers": [
            {"provider": "claude", "account_id": "proof-claude", "display_name": "Claude", "used_percent": 73.0, "reset_description": "4h 12m"},
            {"provider": "openai", "account_id": "proof-openai", "used_percent": 21.0, "reset_description": "79% left"},
            {"provider": "gemini", "account_id": "proof-gemini", "used_percent": 58.0, "status": "attention"}
        ]
    }"#;

    #[test]
    fn valid_three_provider_bundle_parses() {
        let out = parse_providers_bundle(VALID).expect("parses");
        assert_eq!(out.len(), 3);
        assert_eq!(out[0].provider_id, "claude");
        // "openai" resolves to the Codex provider (registered alias in the
        // provider map — OpenAI IS Codex in this product's terms), hence
        // alphabetical order [claude, codex, gemini].
        assert_eq!(out[1].provider_id, "codex");
        assert_eq!(out[2].provider_id, "gemini");
        assert_eq!(out[0].display_name, "Claude");
        assert_eq!(out[0].primary.used_percent, 73.0);
        assert_eq!(out[0].primary.remaining_percent, 27.0);
    }

    #[test]
    fn offline_status_produces_an_honest_unavailable_snapshot() {
        let json = r#"{"version": 1, "providers": [
            {"provider": "deepseek", "account_id": "proof-offline", "used_percent": 0, "status": "offline"}
        ]}"#;
        let out = parse_providers_bundle(json).expect("offline fixture parses");
        assert_eq!(out.len(), 1);
        assert!(out[0].error.is_some());
        assert_eq!(
            out[0].error_state,
            quotalis_core::core::ProviderStateKind::LocalRuntimeOffline
        );
    }

    #[test]
    fn unknown_status_is_rejected_instead_of_silently_ignored() {
        let json = r#"{"version": 1, "providers": [
            {"provider": "claude", "used_percent": 10, "status": "mystery"}
        ]}"#;
        assert!(parse_providers_bundle(json).is_err());
    }

    #[test]
    fn malformed_json_is_rejected() {
        assert!(parse_providers_bundle("{not json").is_err());
    }

    #[test]
    fn unknown_schema_version_is_rejected() {
        assert!(parse_providers_bundle(r#"{"version": 2, "providers": []}"#).is_err());
    }

    #[test]
    fn unknown_provider_is_rejected() {
        let json =
            r#"{"version": 1, "providers": [{"provider": "not-a-provider", "used_percent": 10}]}"#;
        assert!(parse_providers_bundle(json).is_err());
    }

    #[test]
    fn duplicate_stable_id_is_rejected() {
        let json = r#"{"version": 1, "providers": [
            {"provider": "claude", "account_id": "same", "used_percent": 10},
            {"provider": "codex", "account_id": "same", "used_percent": 20}
        ]}"#;
        assert!(parse_providers_bundle(json).is_err());
    }

    #[test]
    fn negative_used_percent_is_rejected() {
        let json = r#"{"version": 1, "providers": [{"provider": "claude", "used_percent": -5}]}"#;
        assert!(parse_providers_bundle(json).is_err());
    }

    #[test]
    fn empty_bundle_is_rejected() {
        assert!(parse_providers_bundle(r#"{"version": 1, "providers": []}"#).is_err());
    }

    #[test]
    fn no_secret_bearing_fields_accepted_into_output() {
        let out = parse_providers_bundle(VALID).expect("parses");
        let json = serde_json::to_string(&out).unwrap().to_lowercase();
        assert!(!json.contains("token"));
        assert!(!json.contains("cookie"));
        assert!(!json.contains("secret"));
        assert!(!json.contains("password"));
    }

    #[test]
    fn multi_provider_bundle_marks_the_provider_cache_as_pinned() {
        let _guard = BUNDLE_ENV_LOCK.lock().unwrap();
        let previous = std::env::var_os(SEED_PROVIDERS_ENV_VAR);

        // SAFETY: this test serializes access to the bundle environment
        // variable and restores its previous value before releasing the lock.
        unsafe { std::env::set_var(SEED_PROVIDERS_ENV_VAR, "proof-bundle.json") };
        assert!(seed_providers_json_active());
        assert!(provider_seed_active());

        match previous {
            // SAFETY: BUNDLE_ENV_LOCK is still held while restoring state.
            Some(value) => unsafe { std::env::set_var(SEED_PROVIDERS_ENV_VAR, value) },
            // SAFETY: BUNDLE_ENV_LOCK is still held while restoring state.
            None => unsafe { std::env::remove_var(SEED_PROVIDERS_ENV_VAR) },
        }
    }
}
