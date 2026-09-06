# Multi-monitor matrix — 0.10.1

## Hardware available

`[System.Windows.Forms.Screen]::AllScreens` returns exactly **one** display
(1920×1200 @ 150%) on this machine. There is no second monitor, and one
cannot be attached to this automated session.

## What this means concretely

Every "which monitor" code path in this codebase (`window_positioner.rs`'s
`multi_monitor_offset`/anchored-popout tests, `collections_window.rs`'s
monitor-loss fallback added this session, `settings_window.rs`'s
`resolve_settings_geometry`, flyout's `reanchor`) already has deterministic
unit-test coverage for monitor selection, offset math, and fallback-to-
primary-monitor behavior using synthetic monitor rectangles — that logic is
exercised and passing (see the shell crate's `window_positioner::tests::*`
and this session's own `collections_window::tests::clamps_a_stored_position_
that_is_now_off_the_work_area`, which specifically simulates monitor loss).

What is **not** covered, and cannot be from this session: real Windows
multi-monitor behavior — actual monitor hot-plug, mixed-DPI monitors side by
side, a surface actually relocating when Windows reports a monitor
disconnected, work-area changes from a real taskbar move, and "no phantom
old window" / "no click-blocking invisible window" checks that only show up
with genuinely different monitors.

## Status

**External hardware blocker**, not a skipped step. Needs a machine with 2+
displays (ideally at different scale factors) for a real pass. Every
`should_target_the_correct_monitor`-shaped question is answered at the unit
level; only the "does Windows itself actually do the right thing" question
remains open.
