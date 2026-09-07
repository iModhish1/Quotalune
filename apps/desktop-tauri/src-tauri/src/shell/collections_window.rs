//! Detached Collections window: the native counterpart to the
//! `collection_layout` a user saves in Settings → Collections. Until this
//! module existed, `collection_layout` was write-only from the desktop's
//! point of view — persisted and validated, but never rendered anywhere
//! outside the Settings editor's own live-preview canvas (see
//! `CollectionsStudio.tsx`'s own copy: "desktop collection rendering is not
//! enabled yet"). This window closes that gap: it is a real, resizable,
//! independently-positioned native window that renders the saved layout and
//! refreshes live when Settings saves a new one.
//!
//! Modeled directly on `settings_window.rs`'s simpler (non-tray-anchored)
//! geometry pattern: full x/y/width/height persisted via `geometry_store`,
//! restored against whichever monitor still contains it (falling back to the
//! primary monitor if that one is gone), hide-not-close so the WebView2
//! instance survives being reopened.

use tauri::{Manager, PhysicalPosition, WebviewUrl};

pub const COLLECTIONS_LABEL: &str = "collections";
const COLLECTIONS_GEOMETRY_KEY: &str = "collections-window";

const DEFAULT_WIDTH: f64 = 420.0;
const DEFAULT_HEIGHT: f64 = 360.0;
const MIN_WIDTH: f64 = 260.0;
const MIN_HEIGHT: f64 = 200.0;

#[derive(Debug, Clone, Copy, PartialEq)]
struct ResolvedGeometry {
    x: i32,
    y: i32,
    width: f64,
    height: f64,
}

fn resolve_geometry(
    stored: Option<crate::geometry_store::StoredGeometry>,
    area: tauri::PhysicalRect<i32, u32>,
    scale_factor: f64,
) -> ResolvedGeometry {
    let scale = if scale_factor.is_finite() && scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    };
    let area_width = (area.size.width as f64 / scale).max(1.0);
    let area_height = (area.size.height as f64 / scale).max(1.0);
    let max_width = (area_width - 32.0).max(area_width.min(MIN_WIDTH));
    let max_height = (area_height - 32.0).max(area_height.min(MIN_HEIGHT));
    let width = stored
        .and_then(|value| value.width)
        .map_or(DEFAULT_WIDTH, f64::from)
        .clamp(MIN_WIDTH.min(max_width), max_width);
    let height = stored
        .and_then(|value| value.height)
        .map_or(DEFAULT_HEIGHT, f64::from)
        .clamp(MIN_HEIGHT.min(max_height), max_height);
    let physical_width = (width * scale).round() as i32;
    let physical_height = (height * scale).round() as i32;
    let max_x = area.position.x + area.size.width as i32 - physical_width;
    let max_y = area.position.y + area.size.height as i32 - physical_height;
    let centered_x = area.position.x + (area.size.width as i32 - physical_width) / 2;
    let centered_y = area.position.y + (area.size.height as i32 - physical_height) / 2;

    ResolvedGeometry {
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
        COLLECTIONS_GEOMETRY_KEY,
        crate::geometry_store::StoredGeometry {
            x: position.x,
            y: position.y,
            width: Some((size.width as f64 / scale).round().max(1.0) as u32),
            height: Some((size.height as f64 / scale).round().max(1.0) as u32),
        },
    );
}

/// Whether the Collections window currently exists and is visible.
pub fn is_open(app: &tauri::AppHandle) -> bool {
    app.get_webview_window(COLLECTIONS_LABEL)
        .is_some_and(|w| w.is_visible().unwrap_or(false))
}

/// Open the detached Collections window, or focus it if already open.
///
/// `WebviewWindowBuilder::build` deadlocks when called synchronously from a
/// Tauri command on Windows (see `settings_window::open_or_focus` /
/// `flyout_window::open_or_focus` precedent) — callers must invoke this from
/// an async context.
pub fn open_or_focus(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(COLLECTIONS_LABEL) {
        window.unminimize().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = WebviewUrl::App("index.html?window=collections".into());

    let win = tauri::WebviewWindowBuilder::new(app, COLLECTIONS_LABEL, url)
        .title("Quotalis Collections")
        .inner_size(DEFAULT_WIDTH, DEFAULT_HEIGHT)
        .min_inner_size(MIN_WIDTH, MIN_HEIGHT)
        .decorations(true)
        .shadow(true)
        .theme(Some(tauri::Theme::Dark))
        .resizable(true)
        .disable_drag_drop_handler()
        .build()
        .map_err(|e| e.to_string())?;

    super::dwm::restore_native_caption(&win);

    let stored = crate::geometry_store::load_entry(COLLECTIONS_GEOMETRY_KEY);
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
        let geometry = resolve_geometry(stored, *area, monitor.scale_factor());
        win.set_min_size(Some(tauri::LogicalSize::new(
            MIN_WIDTH.min(geometry.width),
            MIN_HEIGHT.min(geometry.height),
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

/// Hide (never close) the Collections window — mirrors
/// `settings_window::dismiss`'s rationale: closing risks Tauri's
/// process/window lifecycle treating it as an app-relevant close.
pub fn hide(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(COLLECTIONS_LABEL) {
        window.hide().map_err(|e| e.to_string())?;
    }
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
    fn collections_label_is_stable() {
        assert_eq!(COLLECTIONS_LABEL, "collections");
    }

    #[test]
    fn geometry_key_is_distinct_from_settings_and_flyout() {
        assert_ne!(COLLECTIONS_GEOMETRY_KEY, "settings-window");
        assert_ne!(COLLECTIONS_GEOMETRY_KEY, "flyout");
    }

    #[test]
    fn defaults_to_centered_default_size_with_no_stored_geometry() {
        let geometry = resolve_geometry(None, area(1920, 1080), 1.0);
        assert_eq!(geometry.width, DEFAULT_WIDTH);
        assert_eq!(geometry.height, DEFAULT_HEIGHT);
        assert_eq!(geometry.x, ((1920.0 - DEFAULT_WIDTH) / 2.0).round() as i32);
    }

    #[test]
    fn honors_a_valid_stored_geometry_within_the_work_area() {
        let stored = crate::geometry_store::StoredGeometry {
            x: 100,
            y: 80,
            width: Some(500),
            height: Some(420),
        };
        let geometry = resolve_geometry(Some(stored), area(1920, 1080), 1.0);
        assert_eq!(geometry.x, 100);
        assert_eq!(geometry.y, 80);
        assert_eq!(geometry.width, 500.0);
        assert_eq!(geometry.height, 420.0);
    }

    #[test]
    fn clamps_a_stored_position_that_is_now_off_the_work_area() {
        // Simulates monitor-loss recovery: a position from a monitor that no
        // longer exists must not place the window off the fallback monitor.
        let stored = crate::geometry_store::StoredGeometry {
            x: 5000,
            y: 5000,
            width: Some(500),
            height: Some(420),
        };
        let geometry = resolve_geometry(Some(stored), area(1920, 1080), 1.0);
        assert!(geometry.x + 500 <= 1920);
        assert!(geometry.y + 420 <= 1080);
    }

    #[test]
    fn never_produces_a_size_below_the_minimum_even_on_a_tiny_work_area() {
        let geometry = resolve_geometry(None, area(240, 180), 1.0);
        assert!(geometry.width >= 1.0);
        assert!(geometry.height >= 1.0);
        assert!(geometry.width <= 240.0);
        assert!(geometry.height <= 180.0);
    }

    #[test]
    fn clamps_a_corrupt_negative_zero_scale_factor_to_one() {
        let geometry_negative = resolve_geometry(None, area(1920, 1080), -1.0);
        let geometry_zero = resolve_geometry(None, area(1920, 1080), 0.0);
        let geometry_nan = resolve_geometry(None, area(1920, 1080), f64::NAN);
        for geometry in [geometry_negative, geometry_zero, geometry_nan] {
            assert_eq!(geometry.width, DEFAULT_WIDTH);
            assert_eq!(geometry.height, DEFAULT_HEIGHT);
        }
    }
}
