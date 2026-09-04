//! Shared native-window toolkit for QuotaArc surfaces (Edge Arc, Top Arc).
//!
//! Self-contained by design: these helpers intentionally do not reach into
//! the upstream floatbar module so QuotaArc surfaces can evolve (and upstream
//! floatbar fixes can be ported) independently. The Win32 recipes mirror the
//! proven patterns from `floatbar::window` (no-activate, layered alpha,
//! click-through, topmost reassertion).

use tauri::WebviewWindow;

pub const EDGE_ARC_LABEL: &str = "edge-arc";
pub const TOP_ARC_LABEL: &str = "top-arc";
pub const TASKBAR_ARC_LABEL: &str = "taskbar-arc";

/// Build the common auxiliary-surface window: borderless, transparent,
/// non-resizable, skip-taskbar, always-on-top, theme-pinned dark (WebView2
/// resolves prefers-color-scheme per shared process profile; an unpinned
/// webview flips other windows' auto theme — see upstream issue #240).
pub(crate) fn base_builder<'a>(
    app: &'a tauri::AppHandle,
    label: &str,
    title: &str,
    url: tauri::WebviewUrl,
) -> tauri::WebviewWindowBuilder<'a, tauri::Wry, tauri::AppHandle<tauri::Wry>> {
    let builder = tauri::WebviewWindowBuilder::new(app, label, url)
        .title(title)
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .theme(Some(tauri::Theme::Dark));
    #[cfg(windows)]
    {
        builder
            .transparent(true)
            .background_color(tauri::utils::config::Color(0, 0, 0, 0))
    }
    #[cfg(not(windows))]
    builder
}

/// Re-assert native topmost z-order without activating the window.
pub fn apply_always_on_top(window: &WebviewWindow) {
    #[cfg(windows)]
    {
        use raw_window_handle::HasWindowHandle;
        let Ok(handle) = window.window_handle() else {
            return;
        };
        let raw_window_handle::RawWindowHandle::Win32(h) = handle.as_raw() else {
            return;
        };
        unsafe {
            const HWND_TOPMOST: isize = -1;
            const SWP_NOSIZE: u32 = 0x0001;
            const SWP_NOMOVE: u32 = 0x0002;
            const SWP_NOACTIVATE: u32 = 0x0010;
            if SetWindowPos(
                h.hwnd.get(),
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE,
            ) == 0
            {
                tracing::warn!(error = %std::io::Error::last_os_error(), "failed to assert surface topmost z-order");
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = window;
    }
}

/// Keep the surface from activating on show/click (desktop-widget behavior).
pub fn apply_no_activate(window: &WebviewWindow) {
    #[cfg(windows)]
    {
        use raw_window_handle::HasWindowHandle;
        let Ok(handle) = window.window_handle() else {
            return;
        };
        let raw_window_handle::RawWindowHandle::Win32(h) = handle.as_raw() else {
            return;
        };
        unsafe {
            const WS_EX_NOACTIVATE: isize = 0x0800_0000;
            let ex = GetWindowLongPtrW(h.hwnd.get(), GWL_EXSTYLE);
            if ex & WS_EX_NOACTIVATE == 0 {
                set_extended_style(h.hwnd.get(), ex | WS_EX_NOACTIVATE);
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = window;
    }
}

/// Switch between a passive desktop widget and an interactive panel. Compact
/// overlays stay no-activate; expanded details must accept keyboard focus so
/// Escape, Tab and provider navigation work like a normal Windows panel.
pub fn apply_interaction_mode(window: &WebviewWindow, interactive: bool) {
    #[cfg(windows)]
    {
        use raw_window_handle::HasWindowHandle;
        let Ok(handle) = window.window_handle() else {
            return;
        };
        let raw_window_handle::RawWindowHandle::Win32(h) = handle.as_raw() else {
            return;
        };
        unsafe {
            const WS_EX_NOACTIVATE: isize = 0x0800_0000;
            let ex = GetWindowLongPtrW(h.hwnd.get(), GWL_EXSTYLE);
            let new_ex = if interactive {
                ex & !WS_EX_NOACTIVATE
            } else {
                ex | WS_EX_NOACTIVATE
            };
            if new_ex != ex {
                set_extended_style(h.hwnd.get(), new_ex);
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (window, interactive);
    }
}

/// Toggle full click-through (`WS_EX_TRANSPARENT`) overlay mode.
pub fn apply_click_through(window: &WebviewWindow, click_through: bool) {
    #[cfg(windows)]
    {
        use raw_window_handle::HasWindowHandle;
        let Ok(handle) = window.window_handle() else {
            return;
        };
        let raw_window_handle::RawWindowHandle::Win32(h) = handle.as_raw() else {
            return;
        };
        unsafe {
            const WS_EX_LAYERED: isize = 0x0008_0000;
            const WS_EX_TRANSPARENT: isize = 0x0000_0020;
            let ex = GetWindowLongPtrW(h.hwnd.get(), GWL_EXSTYLE);
            let mut new_ex = ex | WS_EX_LAYERED;
            if click_through {
                new_ex |= WS_EX_TRANSPARENT;
            } else {
                new_ex &= !WS_EX_TRANSPARENT;
            }
            if new_ex != ex {
                set_extended_style(h.hwnd.get(), new_ex);
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (window, click_through);
    }
}

/// Apply window opacity (0-100 percent) via layered-window alpha.
pub fn apply_opacity(window: &WebviewWindow, opacity: u8) {
    let alpha = opacity_to_alpha(opacity);
    #[cfg(windows)]
    {
        use raw_window_handle::HasWindowHandle;
        let Ok(handle) = window.window_handle() else {
            return;
        };
        let raw_window_handle::RawWindowHandle::Win32(h) = handle.as_raw() else {
            return;
        };
        unsafe {
            const WS_EX_LAYERED: isize = 0x0008_0000;
            let ex = GetWindowLongPtrW(h.hwnd.get(), GWL_EXSTYLE);
            if ex & WS_EX_LAYERED == 0 {
                set_extended_style(h.hwnd.get(), ex | WS_EX_LAYERED);
            }
            const LWA_ALPHA: u32 = 0x0000_0002;
            SetLayeredWindowAttributes(h.hwnd.get(), 0, alpha, LWA_ALPHA);
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (window, alpha);
    }
}

/// Map a 0-100 opacity percent to a 0-255 alpha with a 30% floor.
pub fn opacity_to_alpha(opacity: u8) -> u8 {
    let clamped = opacity.clamp(30, 100);
    ((u16::from(clamped) * 255) / 100) as u8
}

/// Resize + reassert the native interaction invariants in one step.
pub fn resize_surface(
    window: &WebviewWindow,
    width: f64,
    height: f64,
    click_through: bool,
) -> Result<(), String> {
    // The webview reports CSS/logical pixels. Passing those values as a
    // PhysicalSize shrinks the viewport by the monitor scale factor (820 CSS
    // px became 328 CSS px at 250% DPI), clipping most of every orbital stage.
    // Keep the contract logical end-to-end; Tauri performs the DPI conversion.
    let width = width.ceil().clamp(1.0, u32::MAX as f64);
    let height = height.ceil().clamp(1.0, u32::MAX as f64);
    window
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    apply_no_activate(window);
    apply_click_through(window, click_through);
    apply_always_on_top(window);
    Ok(())
}

/// True when the FOREGROUND window is a content-fullscreen surface (game,
/// video player): popup/borderless style covering ~the whole monitor.
/// Deliberately excludes normal maximized windows and browser F11 (which
/// keep a caption). Mirrors the PILLAR heuristic at a coarse level.
#[cfg(windows)]
pub fn foreground_is_content_fullscreen() -> bool {
    // Probe via GetForegroundWindow + monitor coverage + window styles.
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 {
            return false;
        }
        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return false;
        }
        let w = (rect.right - rect.left) as i64;
        let h = (rect.bottom - rect.top) as i64;
        if w <= 0 || h <= 0 {
            return false;
        }
        // Coverage check against the monitor the window is on.
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(monitor, &mut mi) == 0 {
            return false;
        }
        let mw = (mi.rcMonitor.right - mi.rcMonitor.left) as i64;
        let mh = (mi.rcMonitor.bottom - mi.rcMonitor.top) as i64;
        if mw <= 0 || mh <= 0 {
            return false;
        }
        let coverage = (w * h) as f64 / ((mw * mh) as f64);
        if coverage < 0.92 {
            return false;
        }
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        const WS_CAPTION: isize = 0x00C0_0000;
        const WS_POPUP: isize = 0x8000_0000isize;
        let has_caption = style & WS_CAPTION != 0;
        let is_popup = style & WS_POPUP != 0;
        is_popup || !has_caption
    }
}

#[cfg(not(windows))]
pub fn foreground_is_content_fullscreen() -> bool {
    false
}

/// Monitor work area (excludes the taskbar) for a window's monitor, in
/// logical units: `(x, y, width, height)`. Falls back to the full monitor
/// bounds where the work area cannot be read.
pub fn monitor_work_area_logical(window: &WebviewWindow) -> Option<(f64, f64, f64, f64)> {
    #[cfg(windows)]
    {
        use raw_window_handle::HasWindowHandle;
        let handle = window.window_handle().ok()?;
        let raw_window_handle::RawWindowHandle::Win32(h) = handle.as_raw() else {
            return None;
        };
        let scale = window.scale_factor().unwrap_or(1.0).max(0.01);
        unsafe {
            let hwnd = h.hwnd.get();
            let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
            let mut mi: MONITORINFO = std::mem::zeroed();
            mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
            if GetMonitorInfoW(monitor, &mut mi) == 0 {
                return None;
            }
            let x = f64::from(mi.rcWork.left) / scale;
            let y = f64::from(mi.rcWork.top) / scale;
            let w = f64::from(mi.rcWork.right - mi.rcWork.left) / scale;
            let h = f64::from(mi.rcWork.bottom - mi.rcWork.top) / scale;
            Some((x, y, w, h))
        }
    }
    #[cfg(not(windows))]
    {
        let monitor = window.current_monitor().ok()??;
        let scale = window.scale_factor().unwrap_or(1.0).max(0.01);
        let pos = monitor.position();
        let size = monitor.size();
        Some((
            f64::from(pos.x) / scale,
            f64::from(pos.y) / scale,
            f64::from(size.width) / scale,
            f64::from(size.height) / scale,
        ))
    }
}

#[cfg(windows)]
const GWL_EXSTYLE: i32 = -20;
#[cfg(windows)]
const GWL_STYLE: i32 = -16;

#[cfg(windows)]
#[repr(C)]
#[allow(clippy::upper_case_acronyms)]
struct RECT {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[cfg(windows)]
#[repr(C)]
#[allow(non_snake_case, clippy::upper_case_acronyms)]
struct MONITORINFO {
    cbSize: u32,
    rcMonitor: RECT,
    rcWork: RECT,
    dwFlags: u32,
}

#[cfg(windows)]
const MONITOR_DEFAULTTONEAREST: u32 = 2;

#[cfg(windows)]
unsafe fn set_extended_style(hwnd: isize, ex_style: isize) {
    unsafe {
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);
        const SWP_NOSIZE: u32 = 0x0001;
        const SWP_NOMOVE: u32 = 0x0002;
        const SWP_NOZORDER: u32 = 0x0004;
        const SWP_NOACTIVATE: u32 = 0x0010;
        const SWP_FRAMECHANGED: u32 = 0x0020;
        SetWindowPos(
            hwnd,
            0,
            0,
            0,
            0,
            0,
            SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}

#[cfg(windows)]
#[link(name = "user32")]
unsafe extern "system" {
    fn GetWindowLongPtrW(hwnd: isize, index: i32) -> isize;
    fn SetWindowLongPtrW(hwnd: isize, index: i32, new: isize) -> isize;
    fn SetLayeredWindowAttributes(hwnd: isize, color_key: u32, alpha: u8, flags: u32) -> i32;
    fn SetWindowPos(
        hwnd: isize,
        hwnd_insert_after: isize,
        x: i32,
        y: i32,
        cx: i32,
        cy: i32,
        flags: u32,
    ) -> i32;
    fn GetForegroundWindow() -> isize;
    fn GetWindowRect(hwnd: isize, rect: *mut RECT) -> i32;
    fn MonitorFromWindow(hwnd: isize, flags: u32) -> isize;
    fn GetMonitorInfoW(monitor: isize, info: *mut MONITORINFO) -> i32;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opacity_to_alpha_matches_floatbar_semantics() {
        assert_eq!(opacity_to_alpha(0), opacity_to_alpha(30));
        assert_eq!(opacity_to_alpha(100), 255);
        assert!(opacity_to_alpha(50) > opacity_to_alpha(40));
    }
}
