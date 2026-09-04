# QUOTAARC V9 — CONTINUATION NOTE (written at commit b1ea62ab)

Branch `feature/v9-theme-runtime`. State: **clean, tests green, buildable.**
Frontend suite 74 files / 396 tests green, `tsc --noEmit` clean.
Never launch/install/modify the Personal app; Dev only. No storage metaphors.

## DONE

- **Phase 0** (`fa867129`): `docs/BASELINE_SURFACE_AUDIT.json` — all measured
  surface dims, Rust/CSS mismatches, hard-coded constants, 10 defects.
- **Phase 1** (`b1ea62ab`): `apps/desktop-tauri/src/design-system/surfaceSizing.ts`
  — `computeSurfaceLayout(input): SurfaceLayoutOutput`, pure, DPI-invariant
  (logical px), envelope table for taskbar/top/edge/hud/quick-panel/dashboard/
  settings (compact+expanded), proportional caps (compact ≤35% W / ≤20% H,
  edge thickness ≤12% W), user-scale clamp [0.5,2.0], provider-density growth
  ≤+72px, `clampedBy` provenance, derived `orbitRadius`/`instrumentSize`.
  13 acceptance tests in `surfaceSizing.test.ts`.
  NOTE: `surfaceGeometry.ts` is theme-character DEFORMATION (petals/dial/etc.)
  — complementary, do not merge with the sizing engine.
  NOTE: edge envelopes are authored in final vertical orientation
  (width = thickness). Do NOT swap width/height for rails (caused a
  480px-wide rail; caught by test, removed).

## NEXT (in order)

1. **Phase 1b — Rust twin**: mirror `computeSurfaceLayout` in
   `apps/desktop-tauri/src-tauri/src/surfaces.rs` (or a new
   `surface_layout.rs` under the `codexbar` crate so it is shared). Replace
   `EDGE_ARC_DEFAULT_WIDTH=76`, `TOP_ARC_DEFAULT_WIDTH=380`,
   `TASKBAR_ARC_DEFAULT_WIDTH=320` and every hard-coded resize call with
   layout lookups. Golden-value tests pin Rust and TS to identical outputs
   for a table of (surface, state, workArea, dpi, scale, providerCount).
2. **Phase 1c — scale setting**: add independent `taskbar_arc_scale: u8`
   (percent, 50–200) to `rust/src/settings.rs` + `raw.rs` with serde default
   100. NEVER read `top_arc_scale` for the taskbar. Migration: absent → 100;
   never rename/drop old keys. Add round-trip tests.
3. **Phase 2 — coordinator**: single module owning which surface is expanded;
   expanding one collapses others; Escape always collapses; compact surfaces
   never overlap expanded ones; all placement from `monitor_work_area_logical`
   (already in `surface_kit.rs`).
4. **Phase 3 — recompose** TaskbarArc/TopArc/EdgeArc/HUD/QuickPanel/
   Dashboard to consume `computeSurfaceLayout` (window size via new Tauri
   command or event; content via the same output as props). Fix Quick Panel
   clipping and Dashboard flex-shrink (see baseline audit defects).
5. Phases 4–10 per the V9 wave prompt (15-theme live runtime, motion,
   six-state proof, matrix, 150% DPI native validation, perf audit,
   evidence package).

## COMMANDS

- Frontend tests: `cd quotaarc/apps/desktop-tauri && pnpm vitest run`
- Typecheck: `npx tsc --noEmit`
- Shared tests: `cd quotaarc && cargo test -p codexbar`
- Shell tests: `cargo test` in `apps/desktop-tauri/src-tauri`
- Dev run: `pnpm tauri:dev` (Dev channel build only)
