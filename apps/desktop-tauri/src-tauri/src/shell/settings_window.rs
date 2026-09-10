//! Detached Settings window: opens Settings/About in a separate window
//! so the tray panel stays open.

use tauri::{Emitter, Manager, PhysicalPosition, WebviewUrl};

use crate::surface::{
    SETTINGS_WINDOW_HEIGHT, SETTINGS_WINDOW_MIN_HEIGHT, SETTINGS_WINDOW_MIN_WIDTH,
    SETTINGS_WINDOW_WIDTH,
};

const SETTINGS_LABEL: &str = "settings";
const SETTINGS_GEOMETRY_KEY: &str = "settings-window";

#[derive(Debug, Clone, Copy, PartialEq)]
struct ResolvedSettingsGeometry {
    x: i32,
    y: i32,
    width: f64,
    height: f64,
}

fn resolve_settings_geometry(
    stored: Option<crate::geometry_store::StoredGeometry>,
    area: tauri::PhysicalRect<i32, u32>,
    scale_factor: f64,
) -> ResolvedSettingsGeometry {
    let scale = if scale_factor.is_finite() && scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    };
    let area_width = (area.size.width as f64 / scale).max(1.0);
    let area_height = (area.size.height as f64 / scale).max(1.0);
    let max_width = (area_width - 64.0).max(area_width.min(320.0));
    let max_height = (area_height - 64.0).max(area_height.min(240.0));
    let width = stored
        .and_then(|value| value.width)
        .map_or(SETTINGS_WINDOW_WIDTH, f64::from)
        .clamp(SETTINGS_WINDOW_MIN_WIDTH.min(max_width), max_width);
    let height = stored
        .and_then(|value| value.height)
        .map_or(SETTINGS_WINDOW_HEIGHT, f64::from)
        .clamp(SETTINGS_WINDOW_MIN_HEIGHT.min(max_height), max_height);
    let physical_width = (width * scale).round() as i32;
    let physical_height = (height * scale).round() as i32;
    let max_x = area.position.x + area.size.width as i32 - physical_width;
    let max_y = area.position.y + area.size.height as i32 - physical_height;
    let centered_x = area.position.x + (area.size.width as i32 - physical_width) / 2;
    let centered_y = area.position.y + (area.size.height as i32 - physical_height) / 2;

    ResolvedSettingsGeometry {
        x: stored.map_or(centered_x, |value| value.x.clamp(area.position.x, max_x)),
        y: stored.map_or(centered_y, |value| value.y.clamp(area.position.y, max_y)),
        width,
        height,
    }
}

fn remember_geometry(window: &tauri::WebviewWindow) {
    if window.is_maximized().unwrap_or(false) || window.is_minimized().unwrap_or(false) {
        return;
    }
    let (Ok(position), Ok(size)) = (window.outer_position(), window.inner_size()) else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0).max(1.0);
    crate::geometry_store::save_entry(
        SETTINGS_GEOMETRY_KEY,
        crate::geometry_store::StoredGeometry {
            x: position.x,
            y: position.y,
            width: Some((size.width as f64 / scale).round().max(1.0) as u32),
            height: Some((size.height as f64 / scale).round().max(1.0) as u32),
        },
    );
}

fn repaired_settings_size(current: (f64, f64), available: (f64, f64)) -> Option<(f64, f64)> {
    let target = (
        current
            .0
            .max(SETTINGS_WINDOW_MIN_WIDTH.min(available.0.max(1.0)))
            .min(available.0.max(1.0)),
        current
            .1
            .max(SETTINGS_WINDOW_MIN_HEIGHT.min(available.1.max(1.0)))
            .min(available.1.max(1.0)),
    );
    ((target.0 - current.0).abs() >= 0.5 || (target.1 - current.1).abs() >= 0.5).then_some(target)
}

/// A second line of defence for WebView2/DWM paths that can bypass the
/// builder's minimum track size (programmatic resize, stale session restore,
/// or a frame-style transition). Ordinary user sizes are left untouched.
pub(crate) fn enforce_minimum_content_size(window: &tauri::WebviewWindow) {
    if window.is_maximized().unwrap_or(false)
        || window.is_minimized().unwrap_or(false)
        || window.is_fullscreen().unwrap_or(false)
    {
        return;
    }
    let Ok(size) = window.inner_size() else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0).max(1.0);
    let available = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
        .map(|monitor| {
            let area = monitor.work_area();
            (
                area.size.width as f64 / scale,
                area.size.height as f64 / scale,
            )
        })
        .unwrap_or((SETTINGS_WINDOW_MIN_WIDTH, SETTINGS_WINDOW_MIN_HEIGHT));
    let current = (size.width as f64 / scale, size.height as f64 / scale);
    if let Some((width, height)) = repaired_settings_size(current, available) {
        let _ = window.set_size(tauri::LogicalSize::new(width, height));
    }
}

/// Open the detached Settings window, or focus it if already open.
///
/// When the window already exists, emits `settings-change-tab` so the
/// frontend can switch to the requested tab without a full reload.
pub fn open_or_focus(app: &tauri::AppHandle, tab: &str) -> Result<(), String> {
    open_or_focus_provider(app, tab, None)
}

/// Typed provider targeting survives both cold URLs and warm-window events.
pub fn open_or_focus_provider(
    app: &tauri::AppHandle,
    tab: &str,
    provider: Option<quotalis_core::core::ProviderId>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(SETTINGS_LABEL) {
        window.unminimize().map_err(|e| e.to_string())?;
        enforce_minimum_content_size(&window);
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        app.emit_to(SETTINGS_LABEL, "settings-change-tab", tab)
            .map_err(|e| e.to_string())?;
        if let Some(provider) = provider {
            app.emit_to(
                SETTINGS_LABEL,
                "settings-focus-provider",
                provider.cli_name(),
            )
            .map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    let provider_query = provider
        .map(|p| format!("&provider={}", p.cli_name()))
        .unwrap_or_default();
    let url =
        WebviewUrl::App(format!("index.html?window=settings&tab={tab}{provider_query}").into());

    let win = tauri::WebviewWindowBuilder::new(app, SETTINGS_LABEL, url)
        .title("Quotalis Settings")
        .inner_size(SETTINGS_WINDOW_WIDTH, SETTINGS_WINDOW_HEIGHT)
        .min_inner_size(SETTINGS_WINDOW_MIN_WIDTH, SETTINGS_WINDOW_MIN_HEIGHT)
        .decorations(true)
        .shadow(true)
        .theme(Some(tauri::Theme::Dark))
        .resizable(true)
        .maximizable(true)
        .build()
        .map_err(|e| e.to_string())?;

    super::dwm::restore_native_caption(&win);

    // Restore a genuine user resize/move when possible. If its monitor is no
    // longer connected, the primary monitor supplies a safe fitted fallback.
    let stored = crate::geometry_store::load_entry(SETTINGS_GEOMETRY_KEY);
    let monitors = win.available_monitors().unwrap_or_default();
    let stored_monitor = stored.and_then(|geometry| {
        monitors.iter().find(|monitor| {
            let area = monitor.work_area();
            geometry.x >= area.position.x
                && geometry.y >= area.position.y
                && geometry.x < area.position.x + area.size.width as i32
                && geometry.y < area.position.y + area.size.height as i32
        })
    });
    let restore_monitor = stored_monitor
        .cloned()
        .or_else(|| win.current_monitor().ok().flatten())
        .or_else(|| win.primary_monitor().ok().flatten());
    if let Some(monitor) = restore_monitor {
        let area = monitor.work_area();
        let geometry = resolve_settings_geometry(stored, *area, monitor.scale_factor());
        win.set_min_size(Some(tauri::LogicalSize::new(
            SETTINGS_WINDOW_MIN_WIDTH.min(geometry.width),
            SETTINGS_WINDOW_MIN_HEIGHT.min(geometry.height),
        )))
        .map_err(|e| e.to_string())?;
        win.set_size(tauri::LogicalSize::new(geometry.width, geometry.height))
            .map_err(|e| e.to_string())?;
        win.set_position(PhysicalPosition::new(geometry.x, geometry.y))
            .map_err(|e| e.to_string())?;
    }

    let event_window = win.clone();
    win.on_window_event(move |event| match event {
        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
            enforce_minimum_content_size(&event_window);
            remember_geometry(&event_window);
        }
        tauri::WindowEvent::CloseRequested { api, .. } => {
            remember_geometry(&event_window);
            if event_window.hide().is_ok() {
                api.prevent_close();
            }
        }
        _ => {}
    });

    win.show().map_err(|e| e.to_string())?;
    win.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Dismiss Settings without exiting CodexBar.
///
/// The detached Settings window is hidden instead of closed so Tauri's
/// process/window lifecycle cannot interpret this as an app quit. If Settings
/// is rendered in the main shell surface, hide that surface back to tray.
pub fn dismiss(app: &tauri::AppHandle, window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == SETTINGS_LABEL {
        return window.hide().map_err(|e| e.to_string());
    }

    crate::shell::hide_to_tray_if_current(app, |mode| {
        mode == crate::surface::SurfaceMode::Settings
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn area(width: u32, height: u32) -> tauri::PhysicalRect<i32, u32> {
        tauri::PhysicalRect {
            position: tauri::PhysicalPosition::new(0, 0),
            size: tauri::PhysicalSize::new(width, height),
        }
    }

    #[test]
    fn default_settings_geometry_uses_roomy_studio_size() {
        let geometry = resolve_settings_geometry(None, area(1920, 1080), 1.0);
        assert_eq!(geometry.width, SETTINGS_WINDOW_WIDTH);
        assert_eq!(geometry.height, SETTINGS_WINDOW_HEIGHT);
        assert_eq!(geometry.x, 440);
        assert_eq!(geometry.y, 160);
    }

    #[test]
    fn restored_settings_geometry_keeps_user_size_and_position() {
        let geometry = resolve_settings_geometry(
            Some(crate::geometry_store::StoredGeometry {
                x: 120,
                y: 80,
                width: Some(1280),
                height: Some(820),
            }),
            area(1920, 1080),
            1.0,
        );
        assert_eq!(geometry.width, 1280.0);
        assert_eq!(geometry.height, 820.0);
        assert_eq!((geometry.x, geometry.y), (120, 80));
    }

    #[test]
    fn restored_geometry_is_fitted_and_clamped_to_current_work_area() {
        let geometry = resolve_settings_geometry(
            Some(crate::geometry_store::StoredGeometry {
                x: 1600,
                y: 900,
                width: Some(1600),
                height: Some(1000),
            }),
            area(1366, 728),
            1.0,
        );
        assert_eq!(geometry.width, 1302.0);
        assert_eq!(geometry.height, 664.0);
        assert_eq!((geometry.x, geometry.y), (64, 64));
    }

    #[test]
    fn exceptionally_small_work_area_never_produces_invalid_clamp_bounds() {
        let geometry = resolve_settings_geometry(
            Some(crate::geometry_store::StoredGeometry {
                x: 900,
                y: 900,
                width: Some(1040),
                height: Some(760),
            }),
            area(280, 200),
            1.0,
        );
        assert_eq!(geometry.width, 280.0);
        assert_eq!(geometry.height, 200.0);
        assert_eq!((geometry.x, geometry.y), (0, 0));
    }

    #[test]
    fn undersized_settings_window_is_repaired_without_growing_a_valid_window() {
        assert_eq!(
            repaired_settings_size((320.0, 240.0), (1280.0, 760.0)),
            Some((SETTINGS_WINDOW_MIN_WIDTH, SETTINGS_WINDOW_MIN_HEIGHT))
        );
        assert_eq!(
            repaired_settings_size((975.0, 725.0), (1280.0, 760.0)),
            None
        );
    }

    #[test]
    fn minimum_repair_respects_an_exceptionally_small_work_area() {
        assert_eq!(
            repaired_settings_size((200.0, 160.0), (280.0, 200.0)),
            Some((280.0, 200.0))
        );
    }
}
