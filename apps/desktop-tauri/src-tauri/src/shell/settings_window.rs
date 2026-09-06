//! Detached Settings window: opens Settings/About in a separate window
//! so the tray panel stays open.

use tauri::{Emitter, Manager, PhysicalPosition, WebviewUrl};

use crate::surface::{
    SETTINGS_WINDOW_HEIGHT, SETTINGS_WINDOW_MIN_HEIGHT, SETTINGS_WINDOW_MIN_WIDTH,
    SETTINGS_WINDOW_WIDTH,
};

const SETTINGS_LABEL: &str = "settings";

/// Open the detached Settings window, or focus it if already open.
///
/// When the window already exists, emits `settings-change-tab` so the
/// frontend can switch to the requested tab without a full reload.
pub fn open_or_focus(app: &tauri::AppHandle, tab: &str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(SETTINGS_LABEL) {
        window.unminimize().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        app.emit_to(SETTINGS_LABEL, "settings-change-tab", tab)
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = WebviewUrl::App(format!("index.html?window=settings&tab={tab}").into());

    let win = tauri::WebviewWindowBuilder::new(app, SETTINGS_LABEL, url)
        .title("QuotaArc Settings")
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

    // Manually center: Tauri's .center() is unreliable on Windows when
    // called from async commands. Compute position from the primary monitor.
    if let Some(monitor) = win
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| win.primary_monitor().ok().flatten())
    {
        let area = monitor.work_area();
        let scale = monitor.scale_factor();
        let width = SETTINGS_WINDOW_WIDTH.min((area.size.width as f64 / scale - 64.0).max(320.0));
        let height =
            SETTINGS_WINDOW_HEIGHT.min((area.size.height as f64 / scale - 64.0).max(240.0));
        win.set_min_size(Some(tauri::LogicalSize::new(
            SETTINGS_WINDOW_MIN_WIDTH.min(width),
            SETTINGS_WINDOW_MIN_HEIGHT.min(height),
        )))
        .map_err(|e| e.to_string())?;
        win.set_size(tauri::LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
        let outer = win.outer_size().map_err(|e| e.to_string())?;
        let x = area.position.x + (area.size.width.saturating_sub(outer.width) / 2) as i32;
        let y = area.position.y + (area.size.height.saturating_sub(outer.height) / 2) as i32;
        win.set_position(PhysicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
    }

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
