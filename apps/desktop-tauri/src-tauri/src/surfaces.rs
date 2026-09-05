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
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{Emitter, LogicalPosition, Manager, WebviewUrl};

use crate::geometry_store::{self, StoredGeometry};
use crate::surface_kit::{
    EDGE_ARC_LABEL, TASKBAR_ARC_LABEL, TOP_ARC_LABEL, apply_always_on_top, apply_click_through,
    apply_interaction_mode, apply_no_activate, apply_opacity, foreground_is_content_fullscreen,
    monitor_work_area_logical, resize_surface,
};

/// Edge margin for the Top Arc from the top of the work area, logical px.
const TOP_ARC_MARGIN: f64 = 10.0;
const TOP_ARC_FREE_POSITION_KEY: &str = TOP_ARC_LABEL;

fn surface_states() -> &'static Mutex<HashMap<String, SurfaceState>> {
    static STATES: OnceLock<Mutex<HashMap<String, SurfaceState>>> = OnceLock::new();
    STATES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn set_surface_state(label: &str, state: SurfaceState) {
    if let Ok(mut states) = surface_states().lock() {
        states.insert(label.to_string(), state);
    }
}

fn current_surface_state(label: &str) -> SurfaceState {
    surface_states()
        .lock()
        .ok()
        .and_then(|states| states.get(label).copied())
        .unwrap_or(SurfaceState::Compact)
}

use codexbar::surface_layout::{
    AnchorEdge, LayoutInput, ResolvedSurfaceLayout, SurfaceKind, SurfaceState,
};

/// THE sizing path: resolve a surface layout through the authoritative
/// `codexbar::surface_layout` runtime using THIS window's monitor work area
/// and scale factor. The webview never computes window geometry; it only
/// sends state and provider-count data.
fn resolved_layout(
    window: &tauri::WebviewWindow,
    surface: SurfaceKind,
    state: SurfaceState,
    provider_count: u32,
) -> ResolvedSurfaceLayout {
    let settings = Settings::load();
    let user_scale_percent = match surface {
        SurfaceKind::Taskbar => settings.taskbar_arc_scale,
        SurfaceKind::Top => settings.top_arc_scale,
        SurfaceKind::Edge => settings.edge_arc_scale,
        _ => 100,
    };
    let work_area = monitor_work_area_logical(window)
        .map(|(_, _, w, h)| (w, h))
        .unwrap_or((1280.0, 752.0));
    let dpi = window.scale_factor().unwrap_or(1.0);
    let placement = match surface {
        SurfaceKind::Taskbar => AnchorEdge::Bottom,
        SurfaceKind::Top => AnchorEdge::Top,
        SurfaceKind::Edge => {
            let side = codexbar::settings::normalize_edge_arc_side(&settings.edge_arc_side);
            if side == "left" {
                AnchorEdge::Left
            } else {
                AnchorEdge::Right
            }
        }
        _ => AnchorEdge::None,
    };
    ResolvedSurfaceLayout::compute(LayoutInput::new(
        surface,
        state,
        work_area,
        dpi,
        user_scale_percent as f64 / 100.0,
        provider_count,
        placement,
    ))
}

/// Compute the authoritative layout and apply it to the native window
/// (resize + snap positioning in one place).
fn apply_surface_layout(
    window: &tauri::WebviewWindow,
    surface: SurfaceKind,
    state: SurfaceState,
    provider_count: u32,
) {
    if surface == SurfaceKind::Top {
        set_surface_state(TOP_ARC_LABEL, state);
    }
    let settings = Settings::load();
    let (w, h) = if surface == SurfaceKind::Top {
        flow_surface_bounds(window, &settings, state, provider_count)
    } else {
        resolved_layout(window, surface, state, provider_count).window_bounds_logical
    };
    let click_through = effective_click_through(&settings, surface, state);
    let _ = resize_surface(window, w, h, click_through);
    match surface {
        SurfaceKind::Edge => {
            let side = codexbar::settings::normalize_edge_arc_side(&settings.edge_arc_side);
            position_edge_arc(window, &side);
        }
        SurfaceKind::Top => {
            apply_top_arc_attrs(window, &settings, state);
            position_top_arc(window);
        }
        SurfaceKind::Taskbar => position_taskbar_arc(window),
        _ => {}
    }
}

/// The QuotaArc Flow Surface has its own small, form-aware envelope. The
/// generic V9 layout runtime remains authoritative for legacy/other surfaces;
/// this one window deliberately never inherits their old orbital dimensions.
fn flow_surface_bounds(
    window: &tauri::WebviewWindow,
    settings: &Settings,
    state: SurfaceState,
    provider_count: u32,
) -> (f64, f64) {
    let work_area = monitor_work_area_logical(window).map(|(_, _, width, height)| (width, height));
    flow_surface_size(
        &settings.top_arc_form,
        state,
        settings.top_arc_scale,
        work_area,
        provider_count,
    )
}

/// Pure sizing authority for the three Flow Surface structures. Keeping this
/// independent of Tauri makes the no-obstruction limits unit-testable.
fn flow_surface_size(
    form: &str,
    state: SurfaceState,
    scale_percent: u8,
    work_area: Option<(f64, f64)>,
    provider_count: u32,
) -> (f64, f64) {
    if state == SurfaceState::Hidden {
        return match form {
            "horizon" => (72.0, 10.0),
            "petal" => (18.0, 18.0),
            _ => (10.0, 56.0),
        };
    }
    if state == SurfaceState::Peek {
        return match form {
            "horizon" => (120.0, 16.0),
            "petal" => (32.0, 32.0),
            _ => (18.0, 72.0),
        };
    }
    let expanded = state == SurfaceState::Expanded && provider_count > 0;
    let compact_providers = provider_count.min(3);
    let base = match (form, expanded, compact_providers) {
        ("flowline", false, 0) => (56.0, 84.0),
        ("horizon", false, 0) => (138.0, 52.0),
        ("petal", false, 0) => (64.0, 64.0),
        ("flowline", false, providers) => (56.0, 76.0 + f64::from(providers) * 50.0),
        ("horizon", false, _) => (350.0, 58.0),
        ("horizon", true, _) => (350.0, 208.0),
        ("petal", false, _) => (170.0, 118.0),
        ("petal", true, _) => (300.0, 160.0),
        (_, true, _) => (330.0, 160.0),
        (_, false, _) => (56.0, 84.0),
    };
    let scale = f64::from(scale_percent.clamp(75, 125)) / 100.0;
    let (mut width, mut height) = (base.0 * scale, base.1 * scale);
    if let Some((work_width, work_height)) = work_area {
        let (width_cap, height_cap) = match form {
            "horizon" => (
                work_width * 0.30,
                work_height * if expanded { 0.30 } else { 0.10 },
            ),
            "petal" => (
                work_width * if expanded { 0.25 } else { 0.16 },
                work_height * 0.22,
            ),
            _ => (
                work_width * if expanded { 0.28 } else { 0.08 },
                work_height * 0.42,
            ),
        };
        width = width.min(width_cap.max(10.0));
        height = height.min(height_cap.max(56.0));
    }
    (width.round(), height.round())
}

fn effective_click_through(settings: &Settings, surface: SurfaceKind, state: SurfaceState) -> bool {
    match surface {
        SurfaceKind::Edge => settings.edge_arc_click_through,
        // An expanded/pinned island must always regain hit-testing so users
        // can select a provider, drag it, or close it. Click-through is an
        // intentionally locked compact-only presentation mode.
        SurfaceKind::Top => settings.top_arc_click_through && state == SurfaceState::Compact,
        SurfaceKind::Taskbar => settings.taskbar_arc_click_through,
        _ => false,
    }
}

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

    if let Some(window) = app.get_webview_window(EDGE_ARC_LABEL) {
        apply_edge_arc_attrs(&window, &settings);
        let _ = window.show();
        apply_always_on_top(&window);
        position_edge_arc(&window, &side);
        return Ok(());
    }

    let url = WebviewUrl::App("index.html?window=edge-arc".into());
    let builder = crate::surface_kit::base_builder(app, EDGE_ARC_LABEL, "QuotaArc Edge Arc", url)
        // Provisional only: the authoritative layout is applied before show.
        .inner_size(110.0, 480.0)
        .visible(false);

    let window = builder.build().map_err(|e| e.to_string())?;
    apply_edge_arc_attrs(&window, &settings);
    apply_surface_layout(&window, SurfaceKind::Edge, SurfaceState::Compact, 3);
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
    state: SurfaceState,
    provider_count: u32,
) -> Result<(), String> {
    apply_surface_layout(window, SurfaceKind::Edge, state, provider_count);
    Ok(())
}

// ── Top Arc ──────────────────────────────────────────────────────────────

/// A free placement is only restored when it remains on a connected display.
/// This prevents an unplugged monitor from making the island impossible to
/// find after restart.
fn saved_top_arc_position_is_visible(window: &tauri::WebviewWindow, x: i32, y: i32) -> bool {
    if x <= -10_000 || y <= -10_000 {
        return false;
    }
    let Ok(monitors) = window.available_monitors() else {
        return false;
    };
    monitors.iter().any(|monitor| {
        let scale = monitor.scale_factor().max(0.01);
        let work_area = monitor.work_area();
        let left = work_area.position.x as f64 / scale;
        let top = work_area.position.y as f64 / scale;
        let right = left + work_area.size.width as f64 / scale;
        let bottom = top + work_area.size.height as f64 / scale;
        let x = x as f64;
        let y = y as f64;
        x >= left && x < right && y >= top && y < bottom
    })
}

#[derive(Clone, Copy)]
struct PendingTopArcPosition {
    revision: u64,
    x: i32,
    y: i32,
}

fn pending_top_arc_position() -> &'static Mutex<Option<PendingTopArcPosition>> {
    static PENDING: OnceLock<Mutex<Option<PendingTopArcPosition>>> = OnceLock::new();
    PENDING.get_or_init(|| Mutex::new(None))
}

/// Persist only after a drag settles. Writing settings/geometry for every
/// Windows Moved event visibly fights the pointer on some WebView2 systems.
fn queue_top_arc_position(position: (i32, i32)) {
    let revision = {
        let mut pending = match pending_top_arc_position().lock() {
            Ok(pending) => pending,
            Err(_) => return,
        };
        let revision = pending
            .as_ref()
            .map_or(1, |current| current.revision.wrapping_add(1));
        *pending = Some(PendingTopArcPosition {
            revision,
            x: position.0,
            y: position.1,
        });
        revision
    };
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(180)).await;
        let position =
            pending_top_arc_position()
                .lock()
                .ok()
                .and_then(|mut pending| match *pending {
                    Some(current) if current.revision == revision => pending.take(),
                    _ => None,
                });
        if let Some(position) = position {
            geometry_store::save_entry(
                TOP_ARC_FREE_POSITION_KEY,
                StoredGeometry {
                    x: position.x,
                    y: position.y,
                    width: None,
                    height: None,
                },
            );
        }
    });
}

/// Preserve a native free drag. We only correct a genuinely off-screen
/// position; critically, we never snap the window back to its *previous*
/// saved position during the gesture.
fn retain_live_top_arc_position(window: &tauri::WebviewWindow) {
    let (Ok(position), Ok(size), Some(work_area)) = (
        window.outer_position(),
        window.outer_size(),
        monitor_work_area_logical(window),
    ) else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0).max(0.01);
    let current = (position.x as f64 / scale, position.y as f64 / scale);
    let bounded = clamp_top_arc_position_to_work_area(
        current,
        (size.width as f64 / scale, size.height as f64 / scale),
        work_area,
    );
    if (bounded.0 - current.0).abs() > 0.5 || (bounded.1 - current.1).abs() > 0.5 {
        let _ = window.set_position(LogicalPosition::new(bounded.0.round(), bounded.1.round()));
    }
    queue_top_arc_position((bounded.0.round() as i32, bounded.1.round() as i32));
}

fn clamp_top_arc_position_to_work_area(
    position: (f64, f64),
    size: (f64, f64),
    work_area: (f64, f64, f64, f64),
) -> (f64, f64) {
    let (x, y) = position;
    let (width, height) = size;
    let (work_x, work_y, work_width, work_height) = work_area;
    let max_x = (work_x + work_width - width).max(work_x);
    let max_y = (work_y + work_height - height).max(work_y);
    (x.clamp(work_x, max_x), y.clamp(work_y, max_y))
}

fn position_top_arc(window: &tauri::WebviewWindow) {
    let settings = Settings::load();
    if settings.top_arc_anchor == "free"
        && let Some(geometry) = geometry_store::load_entry(TOP_ARC_FREE_POSITION_KEY)
        && saved_top_arc_position_is_visible(window, geometry.x, geometry.y)
        && let (Some((work_x, work_y, work_w, work_h)), Ok(size)) =
            (monitor_work_area_logical(window), window.outer_size())
    {
        let scale = window.scale_factor().unwrap_or(1.0).max(0.01);
        let (x, y) = clamp_top_arc_position_to_work_area(
            (geometry.x as f64, geometry.y as f64),
            (size.width as f64 / scale, size.height as f64 / scale),
            (work_x, work_y, work_w, work_h),
        );
        let _ = window.set_position(LogicalPosition::new(x.round(), y.round()));
        return;
    }
    let Some((work_x, work_y, work_w, work_h)) = monitor_work_area_logical(window) else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0).max(0.01);
    let w = size.width as f64 / scale;
    let h = size.height as f64 / scale;
    let anchor = codexbar::settings::normalize_flow_surface_anchor(
        &settings.top_arc_form,
        &settings.top_arc_anchor,
    );
    let (x, y) = match settings.top_arc_form.as_str() {
        "horizon" => {
            let x = work_x + ((work_w - w) / 2.0).max(0.0);
            let y = if anchor == "bottom" {
                work_y + (work_h - h - TOP_ARC_MARGIN).max(0.0)
            } else {
                work_y + TOP_ARC_MARGIN
            };
            (x, y)
        }
        "petal" => match anchor.as_str() {
            "top-left" => (work_x + TOP_ARC_MARGIN, work_y + TOP_ARC_MARGIN),
            "top-right" => (
                work_x + (work_w - w - TOP_ARC_MARGIN).max(0.0),
                work_y + TOP_ARC_MARGIN,
            ),
            "bottom-left" => (
                work_x + TOP_ARC_MARGIN,
                work_y + (work_h - h - TOP_ARC_MARGIN).max(0.0),
            ),
            _ => (
                work_x + (work_w - w - TOP_ARC_MARGIN).max(0.0),
                work_y + (work_h - h - TOP_ARC_MARGIN).max(0.0),
            ),
        },
        _ => {
            let x = if anchor == "left" {
                work_x + TOP_ARC_MARGIN
            } else {
                work_x + (work_w - w - TOP_ARC_MARGIN).max(0.0)
            };
            let y = work_y + ((work_h - h) / 2.0).max(0.0);
            (x, y)
        }
    };
    let _ = window.set_position(LogicalPosition::new(x.round(), y.round()));
}

/// Show (or reapply attributes to) the Top Arc window.
pub fn show_top_arc(app: &tauri::AppHandle) -> Result<(), String> {
    let settings = Settings::load();
    if let Some(window) = app.get_webview_window(TOP_ARC_LABEL) {
        apply_top_arc_attrs(&window, &settings, current_surface_state(TOP_ARC_LABEL));
        let _ = window.show();
        apply_always_on_top(&window);
        position_top_arc(&window);
        return Ok(());
    }

    let url = WebviewUrl::App("index.html?window=top-arc".into());
    let builder = crate::surface_kit::base_builder(app, TOP_ARC_LABEL, "QuotaArc Top Arc", url)
        // Provisional only: the authoritative layout is applied before show.
        .inner_size(56.0, 310.0)
        .visible(false);

    let window = builder.build().map_err(|e| e.to_string())?;
    set_surface_state(TOP_ARC_LABEL, SurfaceState::Compact);
    apply_top_arc_attrs(&window, &settings, SurfaceState::Compact);
    apply_surface_layout(&window, SurfaceKind::Top, SurfaceState::Compact, 3);
    window.show().map_err(|e| e.to_string())?;
    apply_always_on_top(&window);
    Ok(())
}

fn apply_top_arc_attrs(window: &tauri::WebviewWindow, settings: &Settings, state: SurfaceState) {
    apply_opacity(window, settings.top_arc_opacity);
    apply_click_through(
        window,
        effective_click_through(settings, SurfaceKind::Top, state),
    );
    apply_interaction_mode(window, state == SurfaceState::Expanded);
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
    state: SurfaceState,
    provider_count: u32,
) -> Result<(), String> {
    apply_surface_layout(window, SurfaceKind::Top, state, provider_count);
    Ok(())
}

/// Mark the island as freely placed before the webview begins its native drag
/// gesture. The subsequent Moved event records the final logical position.
#[tauri::command]
pub fn begin_top_arc_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    // Start the OS gesture first. Disk writes ahead of start_dragging made the
    // island feel sticky and caused pointer movement to be lost.
    window.start_dragging().map_err(|error| error.to_string())?;
    let mut settings = Settings::load();
    settings.top_arc_placement = "free".to_string();
    settings.top_arc_anchor = "free".to_string();
    settings.save().map_err(|error| error.to_string())?;
    // The webview keeps its interaction model as React state. Notify it that
    // free placement is now authoritative as soon as the native drag starts.
    let _ = window.app_handle().emit("quotaarc:surfaces-changed", ());
    Ok(())
}

/// Restore the safe default top-center placement and discard any remembered
/// free-drag position.
#[tauri::command]
pub fn reset_top_arc_position(app: tauri::AppHandle) -> Result<(), String> {
    geometry_store::remove_entry(TOP_ARC_FREE_POSITION_KEY);
    let mut settings = Settings::load();
    settings.top_arc_placement = "top-center".to_string();
    settings.top_arc_anchor =
        codexbar::settings::normalize_flow_surface_anchor(&settings.top_arc_form, "right");
    settings.save().map_err(|error| error.to_string())?;
    if let Some(window) = app.get_webview_window(TOP_ARC_LABEL) {
        position_top_arc(&window);
    }
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
            // Provisional only: the authoritative layout is applied before show.
            .inner_size(440.0, 140.0)
            .visible(false);

    let window = builder.build().map_err(|e| e.to_string())?;
    apply_taskbar_arc_attrs(&window, &settings);
    apply_surface_layout(&window, SurfaceKind::Taskbar, SurfaceState::Compact, 3);
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
    state: SurfaceState,
    provider_count: u32,
) -> Result<(), String> {
    apply_surface_layout(window, SurfaceKind::Taskbar, state, provider_count);
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
        apply_top_arc_attrs(&w, settings, current_surface_state(TOP_ARC_LABEL));
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
                    // A freely dragged island owns its location. Re-anchor
                    // only the deliberate preset placements; re-sizing is
                    // caused by the webview state transition, not a request
                    // to snap the user back to the top center.
                    if matches!(event, tauri::WindowEvent::Moved(_)) {
                        if settings.top_arc_anchor == "free" {
                            retain_live_top_arc_position(&webview);
                        } else {
                            position_top_arc(&webview);
                        }
                    }
                    apply_top_arc_attrs(&webview, &settings, current_surface_state(TOP_ARC_LABEL));
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
    state: String,
    provider_count: Option<u32>,
) -> Result<(), String> {
    resize_edge_arc(
        &window,
        SurfaceState::from_token(&state),
        provider_count.unwrap_or(3),
    )
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
    state: String,
    provider_count: Option<u32>,
) -> Result<(), String> {
    resize_taskbar_arc(
        &window,
        SurfaceState::from_token(&state),
        provider_count.unwrap_or(3),
    )
}

#[tauri::command]
pub fn resize_top_arc_surface(
    window: tauri::WebviewWindow,
    state: String,
    provider_count: Option<u32>,
) -> Result<(), String> {
    resize_top_arc(
        &window,
        SurfaceState::from_token(&state),
        provider_count.unwrap_or(3),
    )
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
    if patch
        .top_arc_placement
        .as_deref()
        .is_some_and(|value| value != "free")
        || patch
            .top_arc_anchor
            .as_deref()
            .is_some_and(|value| value != "free")
    {
        geometry_store::remove_entry(TOP_ARC_FREE_POSITION_KEY);
    }
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
    pub top_arc_placement: String,
    pub top_arc_form: String,
    pub top_arc_anchor: String,
    pub top_arc_auto_hide: bool,
    pub top_arc_auto_hide_delay_ms: u16,
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
        top_arc_placement: s.top_arc_placement,
        top_arc_form: s.top_arc_form,
        top_arc_anchor: s.top_arc_anchor,
        top_arc_auto_hide: s.top_arc_auto_hide,
        top_arc_auto_hide_delay_ms: s.top_arc_auto_hide_delay_ms,
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
    pub top_arc_placement: Option<String>,
    pub top_arc_form: Option<String>,
    pub top_arc_anchor: Option<String>,
    pub top_arc_auto_hide: Option<bool>,
    pub top_arc_auto_hide_delay_ms: Option<u16>,
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
        if let Some(v) = &self.top_arc_placement {
            s.top_arc_placement = codexbar::settings::normalize_top_arc_placement(v);
        }
        if let Some(v) = &self.top_arc_form {
            s.top_arc_form = codexbar::settings::normalize_flow_surface_form(v);
            s.top_arc_anchor = codexbar::settings::normalize_flow_surface_anchor(
                &s.top_arc_form,
                &s.top_arc_anchor,
            );
        }
        if let Some(v) = &self.top_arc_anchor {
            s.top_arc_anchor =
                codexbar::settings::normalize_flow_surface_anchor(&s.top_arc_form, v);
        }
        if let Some(v) = self.top_arc_auto_hide {
            s.top_arc_auto_hide = v;
        }
        if let Some(v) = self.top_arc_auto_hide_delay_ms {
            s.top_arc_auto_hide_delay_ms =
                codexbar::settings::clamp_flow_surface_auto_hide_delay(v);
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
            top_arc_placement: Some("bottom-right".into()),
            top_arc_form: Some("horizon".into()),
            top_arc_anchor: Some("left".into()),
            top_arc_auto_hide_delay_ms: Some(9_000),
            ..Default::default()
        };
        patch.apply(&mut s);
        assert!(s.edge_arc_enabled);
        assert_eq!(s.edge_arc_side, "right");
        assert_eq!(s.edge_arc_opacity, 100);
        assert_eq!(s.edge_arc_scale, 75);
        assert_eq!(s.top_arc_opacity, 30);
        assert_eq!(s.top_arc_scale, 200);
        assert_eq!(s.top_arc_placement, "top-center");
        assert_eq!(s.top_arc_form, "horizon");
        assert_eq!(s.top_arc_anchor, "top");
        assert_eq!(s.top_arc_auto_hide_delay_ms, 3_000);
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
    fn quota_island_free_placement_is_preserved_by_surface_patch() {
        let mut s = Settings::default();
        SurfaceSettingsPatch {
            top_arc_placement: Some("free".into()),
            ..Default::default()
        }
        .apply(&mut s);
        assert_eq!(s.top_arc_placement, "free");
    }

    #[test]
    fn flow_surface_envelopes_stay_small_and_the_hidden_tab_stays_reachable() {
        let work_area = Some((1366.0, 768.0));
        assert_eq!(
            flow_surface_size("flowline", SurfaceState::Hidden, 100, work_area, 3),
            (10.0, 56.0),
        );
        assert_eq!(
            flow_surface_size("horizon", SurfaceState::Hidden, 100, work_area, 3),
            (72.0, 10.0),
        );
        assert_eq!(
            flow_surface_size("petal", SurfaceState::Hidden, 100, work_area, 3),
            (18.0, 18.0),
        );
        let flowline = flow_surface_size("flowline", SurfaceState::Compact, 100, work_area, 3);
        assert!(flowline.0 <= 1366.0 * 0.08 && flowline.1 <= 768.0 * 0.42);
        let horizon = flow_surface_size("horizon", SurfaceState::Compact, 100, work_area, 3);
        assert!(horizon.0 <= 1366.0 * 0.30 && horizon.1 <= 768.0 * 0.10);
        let petal = flow_surface_size("petal", SurfaceState::Compact, 100, work_area, 3);
        assert!(petal.0 <= 1366.0 * 0.16 && petal.1 <= 768.0 * 0.20);

        // A provider registry with no resolved readings must not reserve the
        // three-provider rail. This is the native counterpart to the React
        // truthfulness filter.
        assert_eq!(
            flow_surface_size("flowline", SurfaceState::Compact, 100, work_area, 0),
            (56.0, 84.0),
        );
    }

    #[test]
    fn free_island_position_stays_inside_the_monitor_work_area() {
        assert_eq!(
            clamp_top_arc_position_to_work_area(
                (-50.0, 2_000.0),
                (320.0, 56.0),
                (10.0, 40.0, 1_280.0, 720.0),
            ),
            (10.0, 704.0),
        );
        assert_eq!(
            clamp_top_arc_position_to_work_area(
                (1_000.0, 100.0),
                (520.0, 338.0),
                (10.0, 40.0, 1_280.0, 720.0),
            ),
            (770.0, 100.0),
        );
    }

    #[test]
    fn island_click_through_is_never_applied_to_expanded_details() {
        let mut settings = Settings::default();
        settings.top_arc_click_through = true;
        assert!(effective_click_through(
            &settings,
            SurfaceKind::Top,
            SurfaceState::Compact
        ));
        assert!(!effective_click_through(
            &settings,
            SurfaceKind::Top,
            SurfaceState::Hover
        ));
        assert!(!effective_click_through(
            &settings,
            SurfaceKind::Top,
            SurfaceState::Expanded
        ));
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
