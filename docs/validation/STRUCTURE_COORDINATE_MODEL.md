# Structure coordinate model — two layers, one owner each

Wave 1E §4/§5. Written after tracing the REAL production window-position
code (`apps/desktop-tauri/src-tauri/src/surfaces.rs`), which corrects a
scoping mistake in the Wave 1D report: `resolveStructurePlacement()`
(`design-system/structurePlacement.ts`) was described there as "not yet
wired into a native positioning call," implying that wiring was the
remaining work. It is not — the real native positioning system already
exists, already works, and is already tested. Wiring a second, TS-side
positioning algorithm into it would be building exactly the "parallel
positioning system" this wave explicitly forbids.

## Layer A: the one native window's position on the monitor

**Owner: Rust, `surfaces.rs`. Already production, already tested.**

- `anchored_top_arc_position(anchor, size, work_area, centre)`
  (`surfaces.rs`) computes the window's logical position flush against
  the chosen edge/corner for a user-selected `topArcAnchor` (a 9-value
  enum), or centred along that edge using a persisted fractional centre
  for non-corner anchors.
- `clamp_top_arc_position_to_work_area(position, size, work_area)` then
  clamps that into the real monitor work area (from
  `monitor_work_area_logical`, which reads Win32 `GetMonitorInfoW`'s
  `rcWork` directly — excludes the taskbar).
- `logical_to_physical_position(position, scale_factor)` (Wave 1E,
  extracted this session as a pure, unit-tested function) is the ONE
  place a logical coordinate becomes a physical one, applied only at the
  final `window.set_position()` call.
- This entire pipeline runs on every window show, every resize (compact
  ↔ expanded), and every drag-end (`finish_top_arc_drag` →
  `position_top_arc_after_drag`) — so when the surface expands and needs
  more room near a monitor edge, the WHOLE WINDOW is repositioned/
  clamped by this existing code, not by anything CSS-side.
- "Free" (user-dragged) positions are re-validated against currently-
  connected monitors on every restore (`saved_top_arc_position_is_visible`),
  so an off-screen position after a monitor is unplugged self-corrects.
- Deliberately does **not** "flip" a user-chosen anchor to the opposite
  side the way `resolveStructurePlacement()` does — the anchor is the
  user's explicit choice (they picked "right"); silently flipping it to
  "left" because the window happens to be tall would be surprising,
  unwanted behavior for a deliberately docked app window. This is the
  correct product behavior, confirmed by reading the code's own "match
  the core's CSS attachment point" intent, not a gap.

## Layer B: the detail panel's position WITHIN that one window

**Owner: per-form CSS** (`FlowSurface.css`/`ReelSurface.css`/
`NotchSurface.css`), computed rules like
`.flow-surface[data-form="X"][data-anchor="Y"] .flow-surface__details {...}`.

- The window itself is resized (via `apply_surface_layout` →
  `resize_top_arc_surface`) to be large enough to contain BOTH the
  compact core AND the expanded detail panel for the active form/anchor
  combination — the detail panel's CSS position is relative to the
  window's own box, which always already contains it by construction.
  There is no "detail panel goes past the monitor edge while the window
  itself doesn't" failure mode in the current architecture, because
  Layer A's resize-triggered repositioning keeps the WHOLE window
  (detail included) inside the work area.
- This is real, deliberately per-form-tuned geometry (Wave 1B/1C's
  explicit instruction not to flatten it) — not a bug, not unwired.

## Where `resolveStructurePlacement()` actually fits

It solves a THIRD, currently-hypothetical problem neither layer has: an
auto-flipping tooltip/popover-style attachment, where a detail region's
preferred side is a soft preference that should flip/shift based on
available room around a specific anchor point — not the user's
deliberate window-dock choice (Layer A) and not a form's tuned static
CSS (Layer B). No current UI in this codebase needs that behavior. It
remains a real, tested (13 cases), reusable pure function — a candidate
for a genuinely new floating-detail UI pattern should the product need
one, or for the Dev QA fixture panel's own positioning — not something
to force into Layer A or B where it would either fight the existing
tested logic (Layer A) or fight deliberately-tuned per-form CSS
(Layer B).

## DPI / coordinate space — already correct, now proven

Every function in Layer A above operates purely in LOGICAL pixels
(`monitor_work_area_logical` converts physical monitor rects to logical
on read; `anchored_top_arc_position`/`clamp_top_arc_position_to_work_area`
never see a scale factor at all). `logical_to_physical_position` is the
single, centralized conversion boundary, and it is now:

- Extracted into its own pure function (previously inlined in
  `set_top_arc_position`, untestable without a live window).
- Unit-tested at 1.0/1.25/1.5/2.0 (the wave's exact required set) with
  exact expected physical values.
- Hardened against a degenerate `scale_factor()` return (0, negative,
  NaN, infinite) — a real bug this session's own test caught: the
  original clamp-to-0.01 behavior would have crammed the window near the
  origin instead of falling back to a sane 100% scale. Fixed, not just
  documented.
- Proven scale-invariant upstream: the same logical work-area/anchor
  inputs produce identical logical output regardless of DPI (a
  dedicated test asserts this explicitly across the four factors) —
  there is no place logical and physical pixels are implicitly mixed.

Native DPI *screenshot* verification (does it actually look right at
125%/150% on a real multi-monitor Windows setup) remains pending — see
`WAVE1_NATIVE_QA_HANDOFF.md`. The coordinate MATH is closed.
