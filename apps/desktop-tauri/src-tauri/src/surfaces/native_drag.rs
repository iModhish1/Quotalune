//! Await the Windows move loop, not merely the request to start it.
//! Keeping this boundary explicit prevents snapping/resizing during a gesture.

#[cfg(windows)]
pub(super) async fn run(window: &tauri::WebviewWindow) -> Result<(), String> {
    #[repr(C)]
    #[derive(Default)]
    struct Point {
        x: i32,
        y: i32,
    }
    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetCursorPos(point: *mut Point) -> i32;
        fn GetAsyncKeyState(key: i32) -> i16;
        fn ReleaseCapture() -> i32;
        fn SendMessageW(hwnd: isize, message: u32, wparam: usize, lparam: isize) -> isize;
    }
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
                    ReleaseCapture();
                    let packed = ((point.y as u16 as u32) << 16) | point.x as u16 as u32;
                    SendMessageW(hwnd.0 as isize, 0x00A1, 2, packed as isize);
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
