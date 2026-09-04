//! QuotaArc Surface Engine: Edge Arc and Top Arc auxiliary windows.
//!
//! Both surfaces are transparent, always-on-top, no-activate overlay windows
//! built on [`crate::surface_kit`]. They are QuotaArc-owned code (not upstream
//! floatbar) so the premium surface experience can evolve independently while
//! floatbar keeps its upstream-compatible shape.
//!
//! Fullscreen behavior: while a content-fullscreen app (game/video) is in the
//! foreground and the surface's `hide_fullscreen` setting is on, the watcher
//! hides the surface and restores it afterwards. The watcher runs only while
//! at least one surface is visible.

use codexbar::settings::Settings;
use tauri::{LogicalPosition, Manager, WebviewUrl};

use crate::surface_kit::{
    EDGE_ARC_LABEL, TASKBAR_ARC_LABEL, TOP_ARC_LABEL, apply_always_on_top, apply_click_through,
    apply_no_activate, apply_opacity, foreground_is_content_fullscreen, monitor_work_area_logical,
    resize_surface,
};

/// Default logical size of the Edge Arc before the webview requests its
/// provider-driven size. Height grows with provider count via `resize`.
pub const EDGE_ARC_DEFAULT_WIDTH: f64 = 76.0;
pub const EDGE_ARC_DEFAULT_HEIGHT: f64 = 420.0;

/// Default logical size of the Top Arc compact pill.
pub const TOP_ARC_DEFAULT_WIDTH: f64 = 380.0;
pub const TOP_ARC_DEFAULT_HEIGHT: f64 = 52.0;

/// Default logical size of the Taskbar Arc strip.
pub const TASKBAR_ARC_DEFAULT_WIDTH: f64 = 320.0;
pub const TASKBAR_ARC_DEFAULT_HEIGHT: f64 = 40.0;

/// Edge margin for the Top Arc from the top of the work area, logical px.
const TOP_ARC_MARGIN: f64 = 10.0;

// ── Edge Arc ─────────────────────────────────────────────────────────────

/// Position the Edge Arc window snapped to its monitor edge, vertically
/// centered, on the given window's current monitor (or primary).
fn position_edge_arc(window: &tauri::WebviewWindow, side: &str) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let Ok(scale) = window.scale_factor() else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let mon = monitor.position();
    let mon_size = monitor.size();
    let w = size.width as f64 / scale;
    let h = size.height as f64 / scale;
    let mon_x = mon.x as f64 / scale;
    let mon_y = mon.y as f64 / scale;
    let mon_w = mon_size.width as f64 / scale;
    let mon_h = mon_size.height as f64 / scale;
    let x = if side == "left" {
        mon_x
    } else {
        mon_x + mon_w - w
    };
    let y = mon_y + ((mon_h - h) / 2.0).max(0.0);
    let _ = window.set_position(LogicalPosition::new(x.round(), y.round()));
}

/// Show (or reapply attributes to) the Edge Arc window.
pub fn show_edge_arc(app: &tauri::AppHandle) -> Result<(), String> {
    let settings = Settings::load();
    let side = codexbar::settings::normalize_edge_arc_side(&settings.edge_arc_side);
    let scale = codexbar::settings::clamp_surface_scale(settings.edge_arc_scale) as f64 / 100.0;

    if let Some(window) = app.get_webview_window(EDGE_ARC_LABEL) {
        apply_edge_arc_attrs(&window, &settings);
        let _ = window.show();
        apply_always_on_top(&window);
        position_edge_arc(&window, &side);
        return Ok(());
    }

    let url = WebviewUrl::App("index.html?window=edge-arc".into());
    let builder = crate::surface_kit::base_builder(app, EDGE_ARC_LABEL, "QuotaArc Edge Arc", url)
        .inner_size(
            EDGE_ARC_DEFAULT_WIDTH * scale,
            EDGE_ARC_DEFAULT_HEIGHT * scale,
        )
        .visible(false);

    let window = builder.build().map_err(|e| e.to_string())?;
    apply_edge_arc_attrs(&window, &settings);
    position_edge_arc(&window, &side);
    window.show().map_err(|e| e.to_string())?;
    apply_always_on_top(&window);
    Ok(())
}

fn apply_edge_arc_attrs(window: &tauri::WebviewWindow, settings: &Settings) {
    apply_opacity(window, settings.edge_arc_opacity);
    apply_click_through(window, settings.edge_arc_click_through);
    apply_no_activate(window);
}

/// Hide (destroy) the Edge Arc.
pub fn hide_edge_arc(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(EDGE_ARC_LABEL) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Resize the Edge Arc to a logical size requested by the webview, keeping
/// the edge snap and interaction invariants.
pub fn resize_edge_arc(
    window: &tauri::WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let settings = Settings::load();
    resize_surface(window, width, height, settings.edge_arc_click_through)?;
    let side = codexbar::settings::normalize_edge_arc_side(&settings.edge_arc_side);
    position_edge_arc(window, &side);
    Ok(())
}

// ── Top Arc ──────────────────────────────────────────────────────────────

fn position_top_arc(window: &tauri::WebviewWindow) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let Ok(scale) = window.scale_factor() else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let mon = monitor.position();
    let mon_size = monitor.size();
    let w = size.width as f64 / scale;
    let mon_x = mon.x as f64 / scale;
    let mon_y = mon.y as f64 / scale;
    let mon_w = mon_size.width as f64 / scale;
    let x = mon_x + ((mon_w - w) / 2.0).max(0.0);
    let _ = window.set_position(LogicalPosition::new(
        x.round(),
        (mon_y + TOP_ARC_MARGIN).round(),
    ));
}

/// Show (or reapply attributes to) the Top Arc window.
pub fn show_top_arc(app: &tauri::AppHandle) -> Result<(), String> {
    let settings = Settings::load();
    let scale = codexbar::settings::clamp_surface_scale(settings.top_arc_scale) as f64 / 100.0;

    if let Some(window) = app.get_webview_window(TOP_ARC_LABEL) {
        apply_top_arc_attrs(&window, &settings);
        let _ = window.show();
        apply_always_on_top(&window);
        position_top_arc(&window);
        return Ok(());
    }

    let url = WebviewUrl::App("index.html?window=top-arc".into());
    let builder = crate::surface_kit::base_builder(app, TOP_ARC_LABEL, "QuotaArc Top Arc", url)
        .inner_size(
            TOP_ARC_DEFAULT_WIDTH * scale,
            TOP_ARC_DEFAULT_HEIGHT * scale,
        )
        .visible(false);

    let window = builder.build().map_err(|e| e.to_string())?;
    apply_top_arc_attrs(&window, &settings);
    position_top_arc(&window);
    window.show().map_err(|e| e.to_string())?;
    apply_always_on_top(&window);
    Ok(())
}

fn apply_top_arc_attrs(window: &tauri::WebviewWindow, settings: &Settings) {
    apply_opacity(window, settings.top_arc_opacity);
    apply_click_through(window, settings.top_arc_click_through);
    apply_no_activate(window);
}

/// Hide (destroy) the Top Arc.
pub fn hide_top_arc(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(TOP_ARC_LABEL) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Resize the Top Arc (webview-driven morphs between compact/expanded).
pub fn resize_top_arc(
    window: &tauri::WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let settings = Settings::load();
    resize_surface(window, width, height, settings.top_arc_click_through)?;
    position_top_arc(window);
    Ok(())
}

// ── Lifecycle ────────────────────────────────────────────────────────────

// ── Taskbar Arc ──────────────────────────────────────────────────────────

/// Position the Taskbar Arc centered on the work-area bottom edge of its
/// monitor (sits just above the Windows taskbar, following auto-hide).
fn position_taskbar_arc(window: &tauri::WebviewWindow) {
    let Some((wx, wy, ww, wh)) = monitor_work_area_logical(window) else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0).max(0.01);
    let w = size.width as f64 / scale;
    let h = size.height as f64 / scale;
    let x = wx + ((ww - w) / 2.0).max(0.0);
    // Flush against the work-area bottom edge: the slab RISES OUT of the
    // taskbar (Edge Object geometry — no floating gap).
    let y = wy + (wh - h).max(0.0);
    let _ = window.set_position(tauri::LogicalPosition::new(x.round(), y.round()));
}

/// Show (or reapply attributes to) the Taskbar Arc window.
pub fn show_taskbar_arc(app: &tauri::AppHandle) -> Result<(), String> {
    let settings = Settings::load();
    let scale = codexbar::settings::clamp_surface_scale(settings.top_arc_scale) as f64 / 100.0;

    if let Some(window) = app.get_webview_window(TASKBAR_ARC_LABEL) {
        apply_taskbar_arc_attrs(&window, &settings);
        let _ = window.show();
        apply_always_on_top(&window);
        position_taskbar_arc(&window);
        return Ok(());
    }

    let url = WebviewUrl::App("index.html?window=taskbar-arc".into());
    let builder =
        crate::surface_kit::base_builder(app, TASKBAR_ARC_LABEL, "QuotaArc Taskbar Arc", url)
            .inner_size(
                TASKBAR_ARC_DEFAULT_WIDTH * scale,
                TASKBAR_ARC_DEFAULT_HEIGHT * scale,
            )
            .visible(false);

    let window = builder.build().map_err(|e| e.to_string())?;
    apply_taskbar_arc_attrs(&window, &settings);
    position_taskbar_arc(&window);
    window.show().map_err(|e| e.to_string())?;
    apply_always_on_top(&window);
    Ok(())
}

fn apply_taskbar_arc_attrs(window: &tauri::WebviewWindow, settings: &Settings) {
    apply_opacity(window, settings.taskbar_arc_opacity);
    apply_click_through(window, settings.taskbar_arc_click_through);
    apply_no_activate(window);
}

/// Hide (destroy) the Taskbar Arc.
pub fn hide_taskbar_arc(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(TASKBAR_ARC_LABEL) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Resize the Taskbar Arc (webview-driven) keeping the bottom-center snap.
pub fn resize_taskbar_arc(
    window: &tauri::WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let settings = Settings::load();
    resize_surface(window, width, height, settings.taskbar_arc_click_through)?;
    position_taskbar_arc(window);
    Ok(())
}

/// Restore enabled surfaces at startup and start the fullscreen watcher.
pub fn install(app: &tauri::AppHandle) {
    let settings = Settings::load();
    tracing::info!(
        edge = settings.edge_arc_enabled,
        top = settings.top_arc_enabled,
        taskbar = settings.taskbar_arc_enabled,
        "restoring QuotaArc surfaces at startup"
    );
    // WebView2 window creation must happen after the synchronous Tauri setup
    // callback returns. Building several windows inline here can leave a later
    // surface (most often Top Arc) absent even though its setting is enabled.
    reconcile_persisted_state_async(app.clone());
    spawn_fullscreen_watcher(app.clone());
}

/// Bring both surfaces in line with persisted settings (after a settings save).
pub fn apply_state(app: &tauri::AppHandle, settings: &Settings) -> Result<(), String> {
    let fullscreen_active = foreground_is_content_fullscreen();
    let mut errors = Vec::new();
    let edge_open = app.get_webview_window(EDGE_ARC_LABEL).is_some();
    if settings.edge_arc_enabled && !edge_open {
        if let Err(error) = show_edge_arc(app) {
            errors.push(format!("edge: {error}"));
        }
    } else if !settings.edge_arc_enabled && edge_open {
        if let Err(error) = hide_edge_arc(app) {
            errors.push(format!("edge: {error}"));
        }
    } else if let Some(w) = app.get_webview_window(EDGE_ARC_LABEL) {
        apply_edge_arc_attrs(&w, settings);
        let side = codexbar::settings::normalize_edge_arc_side(&settings.edge_arc_side);
        position_edge_arc(&w, &side);
        apply_always_on_top(&w);
    }
    if let Some(w) = app.get_webview_window(EDGE_ARC_LABEL) {
        reconcile_surface_visibility(
            &w,
            surface_should_be_visible(
                settings.edge_arc_enabled,
                settings.edge_arc_hide_fullscreen,
                fullscreen_active,
            ),
        );
    }

    let top_open = app.get_webview_window(TOP_ARC_LABEL).is_some();
    if settings.top_arc_enabled && !top_open {
        if let Err(error) = show_top_arc(app) {
            errors.push(format!("top: {error}"));
        }
    } else if !settings.top_arc_enabled && top_open {
        if let Err(error) = hide_top_arc(app) {
            errors.push(format!("top: {error}"));
        }
    } else if let Some(w) = app.get_webview_window(TOP_ARC_LABEL) {
        apply_top_arc_attrs(&w, settings);
        position_top_arc(&w);
        apply_always_on_top(&w);
    }
    if let Some(w) = app.get_webview_window(TOP_ARC_LABEL) {
        reconcile_surface_visibility(
            &w,
            surface_should_be_visible(
                settings.top_arc_enabled,
                settings.top_arc_hide_fullscreen,
                fullscreen_active,
            ),
        );
    }

    let taskbar_open = app.get_webview_window(TASKBAR_ARC_LABEL).is_some();
    if settings.taskbar_arc_enabled && !taskbar_open {
        if let Err(error) = show_taskbar_arc(app) {
            errors.push(format!("taskbar: {error}"));
        }
    } else if !settings.taskbar_arc_enabled && taskbar_open {
        if let Err(error) = hide_taskbar_arc(app) {
            errors.push(format!("taskbar: {error}"));
        }
    } else if let Some(w) = app.get_webview_window(TASKBAR_ARC_LABEL) {
        apply_taskbar_arc_attrs(&w, settings);
        position_taskbar_arc(&w);
        apply_always_on_top(&w);
    }
    if let Some(w) = app.get_webview_window(TASKBAR_ARC_LABEL) {
        reconcile_surface_visibility(
            &w,
            surface_should_be_visible(
                settings.taskbar_arc_enabled,
                settings.taskbar_arc_hide_fullscreen,
                fullscreen_active,
            ),
        );
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

/// Reconcile persisted surfaces outside a synchronous Tauri command.
///
/// On Windows, dynamically building a WebView2 window from a synchronous IPC
/// handler deadlocks. Profile commands must remain synchronous for tray-menu
/// callers, so they schedule this bounded follow-up on Tauri's async runtime.
pub fn reconcile_persisted_state_async(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let settings = Settings::load();
        if let Err(error) = apply_state(&app, &settings) {
            tracing::warn!(%error, "failed to reconcile QuotaArc surfaces");
        }
    });
}

/// Handle window events for surface windows. Returns true when handled.
pub fn handle_window_event(window: &tauri::Window, event: &tauri::WindowEvent) -> bool {
    let label = window.label();
    if label != EDGE_ARC_LABEL && label != TOP_ARC_LABEL && label != TASKBAR_ARC_LABEL {
        return false;
    }
    match event {
        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
            if let Some(webview) = window.app_handle().get_webview_window(label) {
                let settings = Settings::load();
                if label == EDGE_ARC_LABEL {
                    let side = codexbar::settings::normalize_edge_arc_side(&settings.edge_arc_side);
                    position_edge_arc(&webview, &side);
                    apply_edge_arc_attrs(&webview, &settings);
                } else if label == TOP_ARC_LABEL {
                    position_top_arc(&webview);
                    apply_top_arc_attrs(&webview, &settings);
                } else {
                    position_taskbar_arc(&webview);
                    apply_taskbar_arc_attrs(&webview, &settings);
                }
                apply_always_on_top(&webview);
            }
        }
        tauri::WindowEvent::Focused(false) => {
            if let Some(webview) = window.app_handle().get_webview_window(label) {
                apply_always_on_top(&webview);
            }
        }
        _ => {}
    }
    true
}

// ── Fullscreen watcher ───────────────────────────────────────────────────

const FULLSCREEN_POLL_MS: u64 = 3_000;

fn surface_should_be_visible(
    enabled: bool,
    hide_during_fullscreen: bool,
    fullscreen_active: bool,
) -> bool {
    enabled && !(hide_during_fullscreen && fullscreen_active)
}

fn reconcile_surface_visibility(window: &tauri::WebviewWindow, should_be_visible: bool) {
    let is_visible = window.is_visible().unwrap_or(false);
    if should_be_visible && !is_visible {
        let _ = window.show();
        apply_always_on_top(window);
    } else if !should_be_visible && is_visible {
        let _ = window.hide();
    }
}

/// Periodically hide/show surfaces based on foreground fullscreen detection.
/// Only runs while at least one surface window exists (visible or hidden-by-
/// fullscreen); the task parks itself when none do.
fn spawn_fullscreen_watcher(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(FULLSCREEN_POLL_MS)).await;
            let settings = Settings::load();
            let edge = app.get_webview_window(EDGE_ARC_LABEL);
            let top = app.get_webview_window(TOP_ARC_LABEL);
            let taskbar = app.get_webview_window(TASKBAR_ARC_LABEL);
            if edge.is_none() && top.is_none() && taskbar.is_none() {
                // No surfaces alive; park cheaply.
                continue;
            }
            let fullscreen_active = foreground_is_content_fullscreen();

            if let Some(w) = &edge {
                reconcile_surface_visibility(
                    w,
                    surface_should_be_visible(
                        settings.edge_arc_enabled,
                        settings.edge_arc_hide_fullscreen,
                        fullscreen_active,
                    ),
                );
            }
            if let Some(w) = &top {
                reconcile_surface_visibility(
                    w,
                    surface_should_be_visible(
                        settings.top_arc_enabled,
                        settings.top_arc_hide_fullscreen,
                        fullscreen_active,
                    ),
                );
            }
            if let Some(w) = &taskbar {
                reconcile_surface_visibility(
                    w,
                    surface_should_be_visible(
                        settings.taskbar_arc_enabled,
                        settings.taskbar_arc_hide_fullscreen,
                        fullscreen_active,
                    ),
                );
            }
        }
    });
}

// ── Tauri commands ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn show_edge_arc_surface(app: tauri::AppHandle) -> Result<(), String> {
    show_edge_arc(&app)
}

#[tauri::command]
pub fn hide_edge_arc_surface(app: tauri::AppHandle) -> Result<(), String> {
    hide_edge_arc(&app)
}

#[tauri::command]
pub async fn show_top_arc_surface(app: tauri::AppHandle) -> Result<(), String> {
    show_top_arc(&app)
}

#[tauri::command]
pub fn hide_top_arc_surface(app: tauri::AppHandle) -> Result<(), String> {
    hide_top_arc(&app)
}

#[tauri::command]
pub fn resize_edge_arc_surface(
    window: tauri::WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), String> {
    resize_edge_arc(&window, width, height)
}

#[tauri::command]
pub async fn show_taskbar_arc_surface(app: tauri::AppHandle) -> Result<(), String> {
    show_taskbar_arc(&app)
}

#[tauri::command]
pub fn hide_taskbar_arc_surface(app: tauri::AppHandle) -> Result<(), String> {
    hide_taskbar_arc(&app)
}

#[tauri::command]
pub fn resize_taskbar_arc_surface(
    window: tauri::WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), String> {
    resize_taskbar_arc(&window, width, height)
}

#[tauri::command]
pub fn resize_top_arc_surface(
    window: tauri::WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), String> {
    resize_top_arc(&window, width, height)
}

/// Apply a QuotaArc surface settings patch (typed, from the Surfaces settings
/// section) and reconcile window state.
#[tauri::command]
pub async fn update_surface_settings(
    app: tauri::AppHandle,
    patch: SurfaceSettingsPatch,
) -> Result<(), String> {
    let mut settings = Settings::load();
    patch.apply(&mut settings);
    settings.save().map_err(|e| e.to_string())?;
    apply_state(&app, &settings)?;
    // Surfaces read settings on their next config event too.
    use tauri::Emitter;
    let _ = app.emit("quotaarc:surfaces-changed", ());
    Ok(())
}

/// Current QuotaArc surface settings (read side of [`SurfaceSettingsPatch`]).
#[derive(serde::Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceSettingsDto {
    pub edge_arc_enabled: bool,
    pub edge_arc_side: String,
    pub edge_arc_opacity: u8,
    pub edge_arc_scale: u8,
    pub edge_arc_click_through: bool,
    pub edge_arc_hide_fullscreen: bool,
    pub top_arc_enabled: bool,
    pub top_arc_opacity: u8,
    pub top_arc_scale: u8,
    pub top_arc_click_through: bool,
    pub top_arc_hide_fullscreen: bool,
    pub taskbar_arc_enabled: bool,
    pub taskbar_arc_opacity: u8,
    pub taskbar_arc_click_through: bool,
    pub taskbar_arc_hide_fullscreen: bool,
}

#[tauri::command]
pub fn get_surface_settings() -> SurfaceSettingsDto {
    let s = Settings::load();
    SurfaceSettingsDto {
        edge_arc_enabled: s.edge_arc_enabled,
        edge_arc_side: s.edge_arc_side,
        edge_arc_opacity: s.edge_arc_opacity,
        edge_arc_scale: s.edge_arc_scale,
        edge_arc_click_through: s.edge_arc_click_through,
        edge_arc_hide_fullscreen: s.edge_arc_hide_fullscreen,
        top_arc_enabled: s.top_arc_enabled,
        top_arc_opacity: s.top_arc_opacity,
        top_arc_scale: s.top_arc_scale,
        top_arc_click_through: s.top_arc_click_through,
        top_arc_hide_fullscreen: s.top_arc_hide_fullscreen,
        taskbar_arc_enabled: s.taskbar_arc_enabled,
        taskbar_arc_opacity: s.taskbar_arc_opacity,
        taskbar_arc_click_through: s.taskbar_arc_click_through,
        taskbar_arc_hide_fullscreen: s.taskbar_arc_hide_fullscreen,
    }
}

/// Typed patch for QuotaArc surface settings. `None` = leave unchanged.
#[derive(serde::Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct SurfaceSettingsPatch {
    pub edge_arc_enabled: Option<bool>,
    pub edge_arc_side: Option<String>,
    pub edge_arc_opacity: Option<u8>,
    pub edge_arc_scale: Option<u8>,
    pub edge_arc_click_through: Option<bool>,
    pub edge_arc_hide_fullscreen: Option<bool>,
    pub top_arc_enabled: Option<bool>,
    pub top_arc_opacity: Option<u8>,
    pub top_arc_scale: Option<u8>,
    pub top_arc_click_through: Option<bool>,
    pub top_arc_hide_fullscreen: Option<bool>,
    pub taskbar_arc_enabled: Option<bool>,
    pub taskbar_arc_opacity: Option<u8>,
    pub taskbar_arc_click_through: Option<bool>,
    pub taskbar_arc_hide_fullscreen: Option<bool>,
}

impl SurfaceSettingsPatch {
    fn apply(&self, s: &mut Settings) {
        if let Some(v) = self.edge_arc_enabled {
            s.edge_arc_enabled = v;
        }
        if let Some(v) = &self.edge_arc_side {
            s.edge_arc_side = codexbar::settings::normalize_edge_arc_side(v);
        }
        if let Some(v) = self.edge_arc_opacity {
            s.edge_arc_opacity = codexbar::settings::clamp_surface_opacity(v);
        }
        if let Some(v) = self.edge_arc_scale {
            s.edge_arc_scale = codexbar::settings::clamp_surface_scale(v);
        }
        if let Some(v) = self.edge_arc_click_through {
            s.edge_arc_click_through = v;
        }
        if let Some(v) = self.edge_arc_hide_fullscreen {
            s.edge_arc_hide_fullscreen = v;
        }
        if let Some(v) = self.top_arc_enabled {
            s.top_arc_enabled = v;
        }
        if let Some(v) = self.top_arc_opacity {
            s.top_arc_opacity = codexbar::settings::clamp_surface_opacity(v);
        }
        if let Some(v) = self.top_arc_scale {
            s.top_arc_scale = codexbar::settings::clamp_surface_scale(v);
        }
        if let Some(v) = self.top_arc_click_through {
            s.top_arc_click_through = v;
        }
        if let Some(v) = self.top_arc_hide_fullscreen {
            s.top_arc_hide_fullscreen = v;
        }
        if let Some(v) = self.taskbar_arc_enabled {
            s.taskbar_arc_enabled = v;
        }
        if let Some(v) = self.taskbar_arc_opacity {
            s.taskbar_arc_opacity = codexbar::settings::clamp_surface_opacity(v);
        }
        if let Some(v) = self.taskbar_arc_click_through {
            s.taskbar_arc_click_through = v;
        }
        if let Some(v) = self.taskbar_arc_hide_fullscreen {
            s.taskbar_arc_hide_fullscreen = v;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::future::Future;

    fn assert_async_show_command<F, Fut>(_command: F)
    where
        F: FnOnce(tauri::AppHandle) -> Fut,
        Fut: Future<Output = Result<(), String>>,
    {
    }

    fn assert_async_update_command<F, Fut>(_command: F)
    where
        F: FnOnce(tauri::AppHandle, SurfaceSettingsPatch) -> Fut,
        Fut: Future<Output = Result<(), String>>,
    {
    }

    #[test]
    fn window_building_commands_remain_async_on_windows() {
        assert_async_show_command(show_edge_arc_surface);
        assert_async_show_command(show_top_arc_surface);
        assert_async_show_command(show_taskbar_arc_surface);
        assert_async_update_command(update_surface_settings);
    }

    #[test]
    fn surface_patch_clamps_and_normalizes() {
        let mut s = Settings::default();
        let patch = SurfaceSettingsPatch {
            edge_arc_enabled: Some(true),
            edge_arc_side: Some("diagonal".into()),
            edge_arc_opacity: Some(250),
            edge_arc_scale: Some(20),
            top_arc_opacity: Some(10),
            top_arc_scale: Some(250),
            ..Default::default()
        };
        patch.apply(&mut s);
        assert!(s.edge_arc_enabled);
        assert_eq!(s.edge_arc_side, "right");
        assert_eq!(s.edge_arc_opacity, 100);
        assert_eq!(s.edge_arc_scale, 75);
        assert_eq!(s.top_arc_opacity, 30);
        assert_eq!(s.top_arc_scale, 200);
    }

    #[test]
    fn edge_arc_left_side_is_preserved() {
        let mut s = Settings::default();
        SurfaceSettingsPatch {
            edge_arc_side: Some("left".into()),
            ..Default::default()
        }
        .apply(&mut s);
        assert_eq!(s.edge_arc_side, "left");
    }

    #[test]
    fn default_sizes_are_sane() {
        const { assert!(TASKBAR_ARC_DEFAULT_WIDTH > TOP_ARC_DEFAULT_WIDTH / 2.0) };
        const { assert!(TASKBAR_ARC_DEFAULT_HEIGHT < TOP_ARC_DEFAULT_HEIGHT) };
    }

    #[test]
    fn enabled_surface_stays_visible_in_fullscreen_when_hiding_is_disabled() {
        assert!(surface_should_be_visible(true, false, true));
    }

    #[test]
    fn enabled_surface_hides_only_when_fullscreen_hiding_is_enabled() {
        assert!(!surface_should_be_visible(true, true, true));
        assert!(surface_should_be_visible(true, true, false));
    }

    #[test]
    fn disabled_surface_is_never_visible() {
        assert!(!surface_should_be_visible(false, false, false));
        assert!(!surface_should_be_visible(false, false, true));
    }

    #[test]
    fn every_detached_arc_has_event_listener_capability() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/default.json"))
                .expect("default capability JSON");
        let windows = capability["windows"]
            .as_array()
            .expect("capability windows array");
        for label in [EDGE_ARC_LABEL, TOP_ARC_LABEL, TASKBAR_ARC_LABEL] {
            assert!(
                windows.iter().any(|window| window.as_str() == Some(label)),
                "{label} must be covered by the default capability"
            );
        }
        let permissions = capability["permissions"]
            .as_array()
            .expect("capability permissions array");
        for permission in ["core:event:allow-listen", "core:event:allow-unlisten"] {
            assert!(
                permissions
                    .iter()
                    .any(|entry| entry.as_str() == Some(permission)),
                "{permission} is required for live settings updates"
            );
        }
    }
}
