# Phase S1 — Spatial Observatory Prototype

**Status: strong first milestone reached, not yet a full Phase S1 PASS.**
This documents what's been built, verified, and captured natively so
far. See "Still open" at the end for what a full PASS still requires.

## Why this phase exists

Phase 6's production visual redesign of the full-3D Provider Universe
(instrument-hub core, real glyphs, selection ring, orbit tracks —
`27320bdd`, `69d2135f`) was reviewed against a real native screenshot
and rejected: it still read as "spherical provider planets + Saturn-like
usage rings + a solar-system metaphor" — a generic Three.js demo, not a
Quotalis precision instrument. The owner's explicit direction: freeze
further visual work on the full-3D scene (preserved unchanged as
"Experimental 3D"), and prototype a second, independent "Spatial
Observatory" mode built ONLY from DOM/SVG/CSS — no WebGL, no second
rendering engine, no giant new dependency.

## Architecture

- **Mode wiring**: `DashboardModeId::Spatial` (`"spatial"`) added
  alongside the existing variants in both Rust (`settings.rs`) and
  TypeScript (`types/bridge.ts`) — additive, existing persisted settings
  files are unaffected (the existing lenient parse already falls back
  safely for any unrecognized value). `lib/dashboardRegistry.ts`'s
  visible picker (`DASHBOARD_DEFINITIONS`) now shows exactly **Analytics
  / Spatial / Experimental 3D** — `providers3d` was relabeled
  "Experimental 3D" with its wire value unchanged; `hybrid` keeps its
  real registry entry (nothing deleted) but is no longer offered in the
  picker, since it has never been more than an unimplemented
  placeholder.
- **Zero WebGL**: `SpatialObservatoryScene.tsx` and everything under
  `surfaces/dashboard/spatial/` never touch `<canvas>`, `getContext`, or
  Three.js. Verified both by code inspection and by a jsdom test
  (`container.querySelectorAll("canvas")` is empty) and by the
  production bundle (below).
- **One truth layer, reused**: `buildProviderSceneNodes`,
  `resolveProviderIdentityColor`, and `structureColorsFromTheme` are
  imported directly from the 3D scene's own `sceneModel.ts`/`identity.ts`
  — not duplicated. The selected-provider detail panel
  (`shared/ProviderDetailPanel.tsx`) was extracted out of the 3D scene
  (previously an inline `SelectedProviderPanel`) so both surfaces render
  the exact same Phase-4-monetary-truth-respecting panel; the 3D scene's
  own 72-test suite still passes unchanged after the extraction,
  confirming zero visual/behavioral regression.
- **Layout**: `spatialLayout.ts`'s `computeSpatialLayout()` is pure and
  deterministic — providers are grouped into depth "tiers"
  (front/mid/back/far, or a centered "hero" tier for a single provider),
  each tier spread across its own horizontal band with a small
  deterministic per-id stagger (reusing a `hashUnitInterval` helper
  extracted from the 3D engine into `lib/deterministicHash.ts`). Six
  providers split into an explicit 3-back/3-front composition — never a
  uniform grid or a circle (which was the whole problem with the 3D
  scene). 16 tests cover 1/2/3/6/12/24, determinism, tier-count growth,
  and selection depth-nudging.
- **Label density**: `spatialLabelPolicy.ts` mirrors the 3D scene's own
  8/16 adaptive thresholds (kept as an independent module since
  Spatial's third input is a tier, not a ring). 9 tests.
- **One Provider Instrument Node** (`ProviderInstrumentNode.tsx`/`.css`):
  a real `<button>`, never a canvas-drawn shape. Neutral obsidian/
  titanium/slate "squircle" housing (never tinted with the provider's
  own color — identity color is local-only: gauge arc, glyph, reset
  tick, selection ring), an inline SVG usage gauge arc, the real
  provider glyph (reused from `providerIcons.ts`, tinted via CSS
  `currentColor` — no raster cache needed, this is native DOM SVG), and
  a small amber reset-proximity tick reusing `isResetSoon()` verbatim
  from the 3D scene's `resetProximity.ts`. Depth/selection/hover are
  plain CSS custom properties transitioning via CSS `transition` — no
  `requestAnimationFrame` loop anywhere in this module.

## Native visual proof

Real captures against a freshly rebuilt `QuotalisDev.exe` via CDP
(`Page.captureScreenshot`), Demo Mode ON, Connected Showcase scenario —
the same fixture used for every prior phase's evidence.

| Screenshot | State |
|---|---|
| `QUOTALIS_SPATIAL_SIX.png` | 6 providers, default view |
| `QUOTALIS_SPATIAL_SELECTED.png` | 6 providers, Codex selected (detail panel populated) |
| `QUOTALIS_SPATIAL_SINGLE.png` | 1 provider — centered hero instrument |
| `QUOTALIS_SPATIAL_TWELVE.png` | 12 providers — 3 depth tiers, no overlap |
| `QUOTALIS_SPATIAL_RTL.png` | Arabic UI language — DOM chrome mirrors, provider names stay LTR-isolated, node positions intentionally unmirrored (owner section 40: "do not mirror arbitrarily") |
| `QUOTALIS_SPATIAL_REDUCED_MOTION.png` | `prefers-reduced-motion: reduce` emulated |

### Section 51 quality-bar check (six providers)

- **Who are these providers?** Real glyph + name on every node.
- **How much quota used?** SVG gauge arc fill + `%` text.
- **Which one is selected?** A visible focus ring + foreground depth
  lift + stronger accent (see `QUOTALIS_SPATIAL_SELECTED.png`).
- **What is its status?** Status dot (warning/critical) + the shared
  detail panel's Status/Monetary rows.
- **Does this look unmistakably like Quotalis, not a planets demo?**
  Yes — no spheres, no rings-around-a-body, no glossy saturated
  material. Machined squircle housings with a restrained accent read as
  instruments.

### Two real defects found and fixed during this pass

1. **Connection traces were invisible.** `--spatial-hairline` (the
   resolved Structure Theme's own hairline token) already carries a low
   built-in alpha for its usual border use; the trace CSS additionally
   applied `opacity: 0.22`/`0.35` on top, compounding to ~0.02 —
   confirmed via CDP by reading the lines' `getComputedStyle().stroke`/
   `opacity` directly, not by guessing from a screenshot. Fixed by
   switching the traces to `--spatial-accent` at an explicit,
   non-compounding low opacity, and removing the redundant multiplier
   from the gauge background track for the same reason.
2. **Node housings overlapped at 12 providers.** The three depth tiers
   (`back`/`mid`/`front`) were spaced too closely (`TIER_Y_BASE`
   16-18 percentage points apart) relative to each tier's actual
   rendered node size — a real native capture showed housings visually
   colliding. Fixed by widening the tier bands (10/26/50/80 instead of
   18/30/46/64); re-captured and confirmed clean separation with no
   overlap at 12 providers, and re-verified 1 and 6 still look correct
   after the change.

Both were caught by inspecting the real native capture and, for the
first one, the real computed DOM style — not assumed from source
reading alone.

## Bundle / lazy-loading evidence (owner sections 45/46/47)

Production build (`pnpm run build`):

| Chunk | Size (gzip) |
|---|---|
| `SpatialDashboard` (JS) | 8.45 kB (3.51 kB) |
| `SpatialDashboard` (CSS) | 4.63 kB (1.44 kB) |
| `ProvidersUniverseScene` (JS, mostly Three.js) | 564.15 kB (142.26 kB) |
| Main bundle, before vs. after this phase | 508.00 kB → 508.09 kB (+90 bytes) |

Spatial's lazy chunk is ~67x smaller than the 3D scene's, and adding it
grew the always-loaded main bundle by well under 1%, confirming it's
properly lazy (`React.lazy` via `dashboardRegistry.ts`) and costs
nothing for a user who never opens it.

## Quality gates run this pass

- `tsc --noEmit`: clean.
- Frontend: 157 test files / 1028 tests passing (up from 1019 before
  this phase), zero regressions.
- `cargo test --workspace`: 455 (Quotalis.exe) + 1612 (quotalis_core) +
  1 (quotalis) = 2068 passing, 1 pre-existing ignored, 0 failed.
- `cargo clippy --workspace --all-targets`: clean.
- `cargo fmt --check`: clean.
- `git diff --check`: clean.
- `node scripts/scan-secrets.mjs`: clean (1562 files).
- Native CDP proof: see screenshots above; RTL and reduced-motion
  verified against real computed DOM state
  (`matchMedia('(prefers-reduced-motion: reduce)').matches === true`,
  `transitionDuration === "0s"` on a node, confirming CSS transitions
  collapse to effectively instant).

## Still open (this is a multi-part prototype spec — not yet complete)

- 24-provider composition capture and review.
- Narrow-viewport and maximized/ultrawide composition (the responsive
  breakpoint exists in CSS but hasn't been natively captured).
- Structure Theme matrix (Smoked Silver / Sapphire-warm / Ceramic) —
  only the default Obsidian theme has been captured.
- Idle-CPU and memory measurement (expected to be very low given zero
  WebGL/RAF, but not yet actually measured).
- The full Spatial-vs-Experimental-3D comparison table (bundle size is
  measured above; GPU dependency/accessibility complexity/implementation
  complexity/visual readability are not yet written up side by side).
- `QUOTALIS_SPATIAL_REVIEW_BOARD.png` composite.
- Provider Identity mode (Follow Structure vs. Independent) re-verification
  specifically for Spatial (the code path is shared with 3D and already
  tested there, but not yet natively re-proven for this surface).
- Cross-referencing this against the full 60-section Phase S1 spec's
  24-item PASS checklist before declaring PASS.

Personal remains untouched throughout (Quotalis Dev only, per every
prior phase's discipline).
