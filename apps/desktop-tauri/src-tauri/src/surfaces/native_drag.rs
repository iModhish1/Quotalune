//! Await the Windows move loop, not merely the request to start it.
//! Keeping this boundary explicit prevents snapping/resizing during a gesture.

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct DragRect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

impl DragRect {
    const fn new(left: i32, top: i32, right: i32, bottom: i32) -> Self {
        Self {
            left,
            top,
            right,
            bottom,
        }
    }
}

/// Magnetise a moving window without changing its footprint. Each axis is
/// independent, so entering two attraction zones produces a true corner dock.
fn magnetize_drag_rect(mut rect: DragRect, work: DragRect, threshold: i32) -> DragRect {
    let width = rect.right - rect.left;
    let height = rect.bottom - rect.top;
    if (rect.left - work.left).abs() <= threshold {
        rect.left = work.left;
        rect.right = rect.left + width;
    } else if (rect.right - work.right).abs() <= threshold {
        rect.right = work.right;
        rect.left = rect.right - width;
    }
    if (rect.top - work.top).abs() <= threshold {
        rect.top = work.top;
        rect.bottom = rect.top + height;
    } else if (rect.bottom - work.bottom).abs() <= threshold {
        rect.bottom = work.bottom;
        rect.top = rect.bottom - height;
    }
    rect
}

#[cfg(windows)]
#[repr(C)]
struct MonitorInfo {
    size: u32,
    monitor: DragRect,
    work: DragRect,
    flags: u32,
}

#[cfg(windows)]
const MAGNETIC_SUBCLASS_ID: usize = 0x5141_5243;

#[cfg(windows)]
unsafe extern "system" fn magnetic_move_proc(
    hwnd: isize,
    message: u32,
    wparam: usize,
    lparam: isize,
    _subclass_id: usize,
    _reference_data: usize,
) -> isize {
    const WM_MOVING: u32 = 0x0216;
    if message == WM_MOVING && lparam != 0 {
        // SAFETY: WM_MOVING guarantees a writable RECT for the duration of
        // this synchronous callback. We preserve its width and height.
        let rect = unsafe { &mut *(lparam as *mut DragRect) };
        let monitor = unsafe { MonitorFromRect(rect, 2) };
        if monitor != 0 {
            let mut info = MonitorInfo {
                size: std::mem::size_of::<MonitorInfo>() as u32,
                monitor: DragRect::new(0, 0, 0, 0),
                work: DragRect::new(0, 0, 0, 0),
                flags: 0,
            };
            if unsafe { GetMonitorInfoW(monitor, &mut info) } != 0 {
                let dpi = unsafe { GetDpiForWindow(hwnd) };
                let threshold = ((44 * dpi.max(96)) / 96) as i32;
                *rect = magnetize_drag_rect(*rect, info.work, threshold);
            }
        }
    }
    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

#[cfg(windows)]
#[link(name = "user32")]
unsafe extern "system" {
    fn GetAsyncKeyState(key: i32) -> i16;
    fn GetCursorPos(point: *mut Point) -> i32;
    fn GetDpiForWindow(hwnd: isize) -> u32;
    fn GetMonitorInfoW(monitor: isize, info: *mut MonitorInfo) -> i32;
    fn MonitorFromRect(rect: *const DragRect, flags: u32) -> isize;
    fn ReleaseCapture() -> i32;
    fn SendMessageW(hwnd: isize, message: u32, wparam: usize, lparam: isize) -> isize;
}

#[cfg(windows)]
#[link(name = "comctl32")]
unsafe extern "system" {
    fn DefSubclassProc(hwnd: isize, message: u32, wparam: usize, lparam: isize) -> isize;
    fn RemoveWindowSubclass(
        hwnd: isize,
        proc: unsafe extern "system" fn(isize, u32, usize, isize, usize, usize) -> isize,
        id: usize,
    ) -> i32;
    fn SetWindowSubclass(
        hwnd: isize,
        proc: unsafe extern "system" fn(isize, u32, usize, isize, usize, usize) -> isize,
        id: usize,
        reference_data: usize,
    ) -> i32;
}

#[cfg(windows)]
#[repr(C)]
#[derive(Default)]
struct Point {
    x: i32,
    y: i32,
}

#[cfg(windows)]
pub(super) async fn run(window: &tauri::WebviewWindow) -> Result<(), String> {
    let target = window.clone();
    let (send, receive) = tokio::sync::oneshot::channel();
    window
        .run_on_main_thread(move || {
            let result = (|| {
                let hwnd = target.hwnd().map_err(|error| error.to_string())?;
                let mut point = Point::default();
                // SAFETY: All Win32 calls run on the live window's owning thread.
                // The POINT is caller-owned; no pointer escapes this scope. The
                // synchronous caption message returns when the OS move loop ends.
                unsafe {
                    if GetAsyncKeyState(0x01) >= 0 {
                        return Ok(());
                    }
                    if GetCursorPos(&mut point) == 0 {
                        return Err("Cannot read drag pointer".into());
                    }
                    let magnetic_docking = SetWindowSubclass(
                        hwnd.0 as isize,
                        magnetic_move_proc,
                        MAGNETIC_SUBCLASS_ID,
                        0,
                    ) != 0;
                    ReleaseCapture();
                    let packed = ((point.y as u16 as u32) << 16) | point.x as u16 as u32;
                    SendMessageW(hwnd.0 as isize, 0x00A1, 2, packed as isize);
                    if magnetic_docking {
                        RemoveWindowSubclass(
                            hwnd.0 as isize,
                            magnetic_move_proc,
                            MAGNETIC_SUBCLASS_ID,
                        );
                    }
                }
                Ok(())
            })();
            let _ = send.send(result);
        })
        .map_err(|error| error.to_string())?;
    receive.await.map_err(|error| error.to_string())?
}

#[cfg(not(windows))]
pub(super) async fn run(_window: &tauri::WebviewWindow) -> Result<(), String> {
    Err("Native surface dragging is currently supported on Windows only".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn magnetic_snap_covers_every_wall_and_corner_without_resizing() {
        let work = DragRect::new(0, 0, 1920, 1040);
        let cases = [
            (
                DragRect::new(31, 300, 151, 500),
                DragRect::new(0, 300, 120, 500),
            ),
            (
                DragRect::new(1760, 300, 1880, 500),
                DragRect::new(1800, 300, 1920, 500),
            ),
            (
                DragRect::new(700, 27, 820, 227),
                DragRect::new(700, 0, 820, 200),
            ),
            (
                DragRect::new(700, 858, 820, 1058),
                DragRect::new(700, 840, 820, 1040),
            ),
            (
                DragRect::new(28, 30, 148, 230),
                DragRect::new(0, 0, 120, 200),
            ),
            (
                DragRect::new(1772, 29, 1892, 229),
                DragRect::new(1800, 0, 1920, 200),
            ),
            (
                DragRect::new(30, 850, 150, 1050),
                DragRect::new(0, 840, 120, 1040),
            ),
            (
                DragRect::new(1774, 854, 1894, 1054),
                DragRect::new(1800, 840, 1920, 1040),
            ),
        ];
        for (input, expected) in cases {
            assert_eq!(magnetize_drag_rect(input, work, 44), expected);
        }
    }

    #[test]
    fn magnetic_snap_leaves_a_free_drop_untouched() {
        let rect = DragRect::new(640, 360, 760, 560);
        assert_eq!(
            magnetize_drag_rect(rect, DragRect::new(0, 0, 1920, 1040), 44),
            rect
        );
    }
}
