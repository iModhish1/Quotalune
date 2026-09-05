# Drag and edge-alignment repair — 2026-09-05

Scope: the adaptive Top Arc/Flow Surface, not a new theme or installer release.

## Root causes and changes

- Previously each native move could snap the surface while the button was still held. Placement is now committed once after the Windows move loop returns. No pointer polling or idle timer decides that a gesture ended.
- Removed per-move settings/geometry work and recursive Top Arc move-event positioning.
- Docking is flush with the monitor work area, without the former 10 logical-pixel gap. The along-edge drop centre is remembered instead of replaced with the monitor midpoint. Corners clamp expanded bounds inside the work area.
- Free placement remembers the original dimensions so later resizes preserve the core's CSS attachment point. Added missing free-position CSS for Flowline, Horizon details and Petal.
- Auto-hide, layout and reconciliation are suspended during dragging, then resumed. Releasing outside rearms auto-hide without requiring another pointer enter/leave. A no-movement click or cancelled move does not overwrite the previous dock.
- Reset uses the form's actual default and broadcasts the change.

The native adapter dispatches a synchronous caption move message on the owning UI thread and awaits its completion from the async command. See [Windows non-client mouse handling](https://learn.microsoft.com/en-us/windows/win32/inputdev/about-mouse-input). Installed Tauri/Tao sources were also inspected; their start-drag request alone does not provide a completion signal.

## Verification

- Reproduced auto-hide during a pending drag with a failing React test, then verified the fix. The final test releases outside and needs no extra enter/leave.
- Added Rust checks for four flush corners, negative monitor origins, stable dock centre across hidden/compact/expanded sizes, near-corner bounds, and reversible free resize attachment for all five forms.
- Frontend: 79 files / 436 tests passed; TypeScript and Vite production build passed.
- Shared Rust: 1,438 tests + one doc-test passed.
- Shell Rust: 403 tests passed on the final reconciliation guards.
- Independent read-only review identified missing CSS aliases, outside-release auto-hide, and reconciliation bypasses. All three were repaired and re-reviewed without a remaining code blocker in those changes.
- Strict Clippy is NOT green: pre-existing `let_underscore_must_use` errors in `rust/src/notifications.rs` at lines 30 and 678 block the shared crate. No lint suppression was added.
- Workspace-wide rustfmt also reports existing formatting drift in shared settings files (`settings.rs`, `settings/raw.rs`, `settings/tests.rs`); the changed shell files were formatted. Secret scan passed (787 files).

## Native evidence and limits

Built `target/debug/QuotaArc.exe` with `dev-channel,tauri/custom-protocol`, embedding the current frontend. Started Dev PID 71420; Windows automation enumerated its Top Arc and Settings windows, and UI Automation read the production Surface Studio controls.

Native interaction proof remains BLOCKED: activation returned `GetCursorPos failed: Access is denied. (0x80070005)`. A fresh window selection and state capture returned a readable accessibility tree but a black screenshot. No successful drag, corner capture, or smoothness recording is claimed. Test release, repeated dragging, Escape, all four corners, expanded collapse, and monitor/DPI crossing on an accessible unlocked desktop before calling this visually accepted.

The existing geometry store logs save failures but is not transactional across settings and geometry; persistence-failure rollback remains a known limitation. Mixed-DPI hardware behavior is unverified; pure negative-origin bounds tests are not a substitute.

No installer was built or installed. Existing unrelated generated icon files were preserved.
