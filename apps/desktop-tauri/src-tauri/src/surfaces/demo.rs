//! Temporary presentation-only fixture switch. Never stored in account/settings files.
use std::sync::{
    OnceLock,
    atomic::{AtomicBool, Ordering},
};
use tauri::Emitter;

fn mode() -> &'static AtomicBool {
    static MODE: OnceLock<AtomicBool> = OnceLock::new();
    MODE.get_or_init(|| {
        AtomicBool::new(std::env::var("QUOTAARC_SURFACE_DEMO").as_deref() == Ok("1"))
    })
}

#[tauri::command]
pub fn get_surface_demo_mode() -> bool {
    mode().load(Ordering::SeqCst)
}

#[tauri::command]
pub fn set_surface_demo_mode(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    mode().store(enabled, Ordering::SeqCst);
    app.emit("quotaarc:surface-demo", enabled)
        .map_err(|error| error.to_string())
}
