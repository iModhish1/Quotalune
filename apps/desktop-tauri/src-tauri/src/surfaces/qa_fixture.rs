//! Wave 1F §22-30: the Dev-only Structure QA fixture controller. Drives
//! the REAL native Flow Surface window (`TopArc.tsx`) through the full
//! provider-count/name/reset/windows/data-state matrix the browser-only
//! `demo/ReelPreview.tsx` harness (Wave 1E) already covers, but for the
//! actual compositor/DPI/monitor-work-area-placed window instead of a
//! plain-browser render.
//!
//! Hard invariants, each backed by a test below:
//! - **In-memory only, exactly like `surfaces::demo`'s existing
//!   `get_surface_demo_mode`/`set_surface_demo_mode`** (the closest
//!   precedent this crate already has): a `Mutex<Option<...>>` behind a
//!   `OnceLock`, never touched by `Settings`/`RawSettings` or written to
//!   `settings.json`, `history.db`, or any account/credential store.
//!   Process restart clears it -- there is no "leftover fixture state"
//!   across launches to worry about.
//! - **Refused outside the Dev channel by the backend itself**, not just
//!   hidden in the UI: `set_structure_qa_fixture`/
//!   `reset_structure_qa_fixture` check `build_info::CHANNEL` directly
//!   (the same constant `is_dev_channel()`/`channel_launch_is_safe`
//!   already use -- no second notion of "is this Dev" introduced here)
//!   and return `Err` in a Personal/stable build, before ever touching
//!   the fixture state.
//! - **Resettable**: `reset_structure_qa_fixture` is just
//!   `set_structure_qa_fixture(None)` under the hood -- returning to "no
//!   fixture active, real production data resumes" is the same code path
//!   as setting any other fixture, not a special case that could drift.

use std::sync::{Mutex, OnceLock};
use tauri::Emitter;

/// A Dev-only synthetic provider matrix, mirroring
/// `demo/ReelPreview.tsx`'s own fixture-state shape (Wave 1E) so the two
/// panels (browser-lane and native-lane) describe the same dimensions.
/// Free-text `String` fields (not closed enums) deliberately match the
/// existing `lib/structureFixtures.ts` generator API on the frontend,
/// which is the single place that actually turns these into
/// `StageProvider[]` -- this struct only carries the selection across the
/// IPC boundary.
#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructureQaFixture {
    pub provider_count: u8,
    pub name_length: String,
    pub reset_length: String,
    pub windows: u8,
    pub data_state: String,
    pub pinned: bool,
}

fn state() -> &'static Mutex<Option<StructureQaFixture>> {
    static STATE: OnceLock<Mutex<Option<StructureQaFixture>>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(None))
}

fn dev_channel_active() -> bool {
    crate::build_info::CHANNEL == "dev"
}

/// Readable in any channel (a Personal build always reads back `None`
/// here since nothing can ever set it there -- see below), matching
/// `get_surface_demo_mode`'s own unconditionally-readable shape.
#[tauri::command]
pub fn get_structure_qa_fixture() -> Option<StructureQaFixture> {
    state()
        .lock()
        .expect("qa_fixture state mutex poisoned")
        .clone()
}

/// Pure gate-and-store logic, factored out of the `#[tauri::command]`
/// wrapper below so it is unit-testable without constructing a real
/// `tauri::AppHandle` (this crate has no mock-app test harness) AND
/// without every test racing the same process-global state (`target` lets
/// each test use its own local `Mutex`, since `cargo test` runs test
/// functions in parallel by default). Returns `Err` without writing
/// anything when `dev_channel` is false.
fn store_fixture(
    dev_channel: bool,
    fixture: Option<StructureQaFixture>,
    target: &Mutex<Option<StructureQaFixture>>,
) -> Result<(), String> {
    if !dev_channel {
        return Err("Structure QA fixture is Dev-channel only.".to_string());
    }
    *target.lock().expect("qa_fixture state mutex poisoned") = fixture;
    Ok(())
}

#[tauri::command]
pub fn set_structure_qa_fixture(
    app: tauri::AppHandle,
    fixture: Option<StructureQaFixture>,
) -> Result<(), String> {
    store_fixture(dev_channel_active(), fixture.clone(), state())?;
    app.emit("quotalis:structure-qa-fixture", fixture)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn reset_structure_qa_fixture(app: tauri::AppHandle) -> Result<(), String> {
    set_structure_qa_fixture(app, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> StructureQaFixture {
        StructureQaFixture {
            provider_count: 12,
            name_length: "long".to_string(),
            reset_length: "normal".to_string(),
            windows: 2,
            data_state: "refreshing".to_string(),
            pinned: true,
        }
    }

    #[test]
    fn dev_channel_active_reads_the_same_build_info_channel_constant_every_other_gate_uses() {
        assert_eq!(dev_channel_active(), crate::build_info::CHANNEL == "dev");
    }

    #[test]
    fn round_trips_a_fixture_through_get_after_a_direct_state_write() {
        // The ONE test allowed to touch the real process-global `state()`
        // (get_structure_qa_fixture always reads it, so there is no local-
        // mutex alternative) -- every other test below exercises
        // store_fixture against its own local Mutex instead, so they
        // cannot race this one under cargo test's default parallelism.
        let fixture = sample();
        *state().lock().unwrap() = Some(fixture.clone());
        assert_eq!(get_structure_qa_fixture(), Some(fixture));
        *state().lock().unwrap() = None;
        assert_eq!(get_structure_qa_fixture(), None);
    }

    #[test]
    fn store_fixture_refuses_and_writes_nothing_outside_the_dev_channel() {
        // Direct, deterministic coverage of the real safety property
        // (independent of which channel this test binary happens to be
        // compiled as), unlike a test that could only exercise whichever
        // channel is active right now. Uses its own local target Mutex,
        // not the process-global state().
        let target = Mutex::new(None);
        assert_eq!(
            store_fixture(false, Some(sample()), &target),
            Err("Structure QA fixture is Dev-channel only.".to_string())
        );
        assert_eq!(
            *target.lock().unwrap(),
            None,
            "a refused write must leave state untouched"
        );

        assert_eq!(store_fixture(true, Some(sample()), &target), Ok(()));
        assert_eq!(*target.lock().unwrap(), Some(sample()));
    }

    #[test]
    fn the_real_set_structure_qa_fixture_command_gates_on_the_same_channel_constant_used_everywhere_else()
     {
        // This test binary's own Cargo features decide dev_channel_active()
        // at compile time; whichever it is, store_fixture must agree.
        let target = Mutex::new(None);
        let result = store_fixture(dev_channel_active(), Some(sample()), &target);
        if cfg!(feature = "dev-channel") {
            assert_eq!(result, Ok(()));
            assert_eq!(*target.lock().unwrap(), Some(sample()));
        } else {
            assert!(result.is_err());
            assert_eq!(*target.lock().unwrap(), None);
        }
    }

    #[test]
    fn serializes_with_camel_case_field_names_matching_the_frontend_fixture_shape() {
        let json = serde_json::to_string(&sample()).expect("serializes");
        assert!(json.contains("\"providerCount\":12"));
        assert!(json.contains("\"nameLength\":\"long\""));
        assert!(json.contains("\"resetLength\":\"normal\""));
        assert!(json.contains("\"dataState\":\"refreshing\""));
        assert!(!json.contains("provider_count"));
    }
}
