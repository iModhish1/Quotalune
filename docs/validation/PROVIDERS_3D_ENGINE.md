# Providers 3D Engine — Architecture (Phase 5 Prototype)

Status: **Prototype**, not production. See `PHASE5_3D_PROTOTYPE.md` for the
evidence log and pass/fail assessment. This document is the architecture
reference requested by the Phase 5 spec (redirected here from
`docs/architecture/` per the same gitignore convention established in
Phase 4 — `/docs/*` is gitignored except `docs/validation/*.md`).

## Engine choice

**Three.js `three@0.185.1`** (MIT license), `@types/three@0.185.4` as a
dev dependency. No `react-three-fiber` — the engine is a vanilla
imperative class (`ProvidersUniverseEngine`) with an explicit lifecycle
(`create → mount → resize → updateData → updateTheme → renderDirty →
dispose`), which a declarative reconciler works against, not with.

Confirmed at the time of adoption (live npm registry check): actively
released (r186 shipped shortly before this pass), WebGL2-by-default since
r118, ~2000 contributors. `OrbitControls` is imported from
`three/addons/controls/OrbitControls.js`, bundled inside the `three`
package itself — no extra dependency.

## Lifecycle

One `ProvidersUniverseEngine` instance per mount of
`ProvidersUniverseScene` (`apps/desktop-tauri/src/surfaces/dashboard/providers3d/ProvidersUniverseScene.tsx`):

- **create/mount** — `createProvidersUniverseEngine(canvas, options)` never
  throws; it returns `{ok:false, reason:"context-unavailable"|"init-failed"}`
  on any WebGL2 failure, which the component turns into the
  "3D view unavailable on this device" fallback with a working "Open 2D
  Analytics" action.
- **update** — real prop changes (`liveProviders`, `theme`,
  `dashboardPerformancePreset`, reduced-motion) flow through
  `updateData`/`updateTheme`/`updatePerformancePreset`/`updateReducedMotion`.
  The engine is never re-created by a data refresh.
- **resize** — a `ResizeObserver` on the canvas's container (guarded for
  jsdom, where `ResizeObserver` is undefined) calls `engine.resize(...)`.
- **dispose** — on unmount: `DirtyRenderScheduler.dispose()` (cancels any
  pending frame), `OrbitControls.dispose()`, all `webglcontextlost`/
  `webglcontextrestored`/pointer listeners removed, every tracked
  provider's geometry/material disposed, `renderer.dispose()` +
  `forceContextLoss()`.

## Render scheduling (`renderPolicy.ts`)

No permanent 60fps loop. `DirtyRenderScheduler` coalesces any number of
`requestRender()` calls into a single scheduled frame via
`requestAnimationFrame`; an idle scene renders zero frames. Device pixel
ratio is capped per `DashboardPerformancePreset`: `lowCpu` → 1.0,
`balanced` → 1.5, `highFidelity` → 2.0 (`computeDevicePixelRatio`).
Camera-transition duration is 320ms normally, 0ms under reduced motion
(`cameraTransitionDurationMs`) — sourced from the existing
`design-system/motion.ts` reduced-motion system, not a second one.

All of the above is pure/WebGL-free and unit-tested directly (12 tests in
`renderPolicy.test.ts`) rather than attempting to emulate WebGL inside
jsdom for scheduling logic.

## Scene model (`sceneModel.ts`)

`buildProviderSceneNodes(liveProviders, thresholds, resolveIdentityColor)`
maps the exact same `ProviderUsageSnapshot[]` the 2D Dashboard consumes
into `ProviderSceneNode[]` — display-only, no new computation:

- `MonetaryQuantityKind` ("spend"/"balance"/"credits"/"unknown") mirrors
  `rust/src/dashboard_data.rs::classify_monetary_observation`'s
  provider→quantity-kind table. An unmapped provider fails closed to
  `"unknown"` (`amount: null`), never a guessed dollar figure.
  `providerMonetaryQuantityKind` is documented as tracking the Rust table;
  a change there requires a matching change here (both sides have direct
  test coverage of the table's known entries).
- `AuthState` ("ready"/"needsAuth"/"unavailable") maps 1:1 from
  `ProviderStateKind` (`errorState`).
  `AlertLevel` ("none"/"warning"/"critical") is threshold-based, sourced
  from the real per-profile `highUsageThreshold`/`criticalUsageThreshold`
  settings — never a hardcoded number.

## Structure Theme integration

`"providers3d"` was added to `design-system/themeResolution.ts`'s
`CatalogSurfaceId` union — the existing `resolveCatalogTheme(settings,
surface)` precedence chain (surface → profile → global → default) now
resolves a theme for the 3D surface with no second theme system.
`structureColorsFromTheme(theme: CatalogTheme)` converts the theme's raw
hex fields into the small `SceneStructureColors` the engine's
`updateTheme` consumes.

## Provider identity

`identity.ts`'s `resolveProviderIdentityColor(providerId, {theme,
composition, domRoot})` reuses the existing, real
`resolveVisualComposition` (Follow Structure vs. Independent) resolver:

- **Follow Structure** — `theme.providerColors[providerId] ?? theme.accent`.
- **Independent** — extracts the `--chart-<provider>` CSS variable name
  from `chartPalette.ts`'s `providerCreditsColor(providerId)` and resolves
  it via `getComputedStyle(domRoot)` against the real DOM, falling back to
  `theme.accent` if unset.

## Layout (`layout.ts`)

`computeProviderLayout(providerIds)` is pure and deterministic — provider
ids are sorted before placement, so the same provider set always produces
the same layout regardless of input order or object identity. A single
provider is centered; up to `PRIMARY_RING_CAPACITY` (12) providers form
one ring; beyond that, a primary + secondary ring split. No `Math.random`
anywhere in the layout path. 15 tests cover 0/1/2/3/6/12/13/24/70-provider
counts, order-independence, and bounded distance from the core.

## Accessibility

The canvas (`role="img"`, `aria-label`, `aria-describedby`) is
decorative from a screen-reader's point of view — the actual data lives
in a parallel, always-present DOM: a keyboard-navigable `<nav>` provider
list (arrow keys cycle selection, `Escape` clears, `aria-pressed` on the
active item, an `aria-hidden` alert dot for warning/critical) and a
`SelectedProviderPanel` (`<dl>`) showing usage, next reset (via the
existing `useFormattedResetTime`), auth status, and monetary state.
Selecting a provider in the list also drives the engine's camera/selection
state (`engine.select(id)`) — the two input paths (raycast pick, keyboard
nav) converge on one piece of state (`selectedId`).

## Performance presets & reduced motion

`DashboardPerformancePreset` (`lowCpu`/`balanced`/`highFidelity`) is the
existing, real, persisted setting — reused as-is for the 3D surface's DPR
cap. `useReducedMotion` (existing `design-system/motion.ts`) drives both
`OrbitControls` damping and camera-transition duration; no independent
motion system was introduced.

## Fallback behavior

`createProvidersUniverseEngine` never throws. A WebGL2-context failure (no
GPU/driver support, a disabled feature flag, or a lost context that never
recovers) renders a plain, translated fallback UI: "3D view unavailable on
this device" + a working "Open 2D Analytics" button
(`onOpenProviders`, wired to `DASHBOARD_REGISTRY.analytics2d` by the
Dashboard host). `webglcontextlost`/`webglcontextrestored` are handled
explicitly (`preventDefault()` + an internal flag; restore triggers a
re-render request rather than silently going blank).

Per-mode crash isolation is provided by the pre-existing
`DashboardModeErrorBoundary` in `DashboardHost.tsx` — Phase 5 added no new
boundary logic; a thrown error anywhere in the 3D mode is caught there,
with the same "Switch to 2D Analytics" recovery action.

## DEV-only fixture lab

`Providers3DDevLab.tsx` (reachable only via `?window=providers3d-lab`,
gated by `import.meta.env.DEV`) drives the real engine with deterministic
synthetic `ProviderUsageSnapshot[]` (`devFixtures.ts`) at provider counts
real Dev-channel data cannot reliably produce (1/6/12/24/70) and
status-mix presets covering auth-required/offline/warning/critical
states together. It uses the real Tauri settings bridge for thresholds
and theme resolution — only the provider list is synthetic, and every
fixture is labeled `sourceLabel: "devFixture"` so it can never be
mistaken for real data downstream.

## Known limitations / productionization prerequisites

This is a prototype, not the final 3D Dashboard. Explicitly out of scope
per the Phase 5 spec and not attempted:

- Final visual polish, cinematic camera transitions, Hybrid-mode 3D
  integration, WebGPU-only rendering, dynamic pricing visualization.
- A filtering UI for large provider counts (the layout engine scales to
  70, but no on-canvas filter/search control exists yet).
- No in-canvas visual highlight for the currently-selected provider body
  (selection state is authoritative and correct in the accessible DOM
  panel, which is what the accessibility requirement actually asks for;
  a 3D highlight is a production-polish item).
- A single-provider composition's body visibly overlaps the core sphere
  from the default camera angle (in-frame, legible, not broken — found
  and only partially tuned during Phase 5.1 native proof).
- WebGL context restore does not reapply the Structure Theme's clear
  color (reverts to plain black) — the app does not crash and rendering
  resumes correctly otherwise; a narrow edge case (genuine GPU-driver
  context loss is rare) not hardened in this pass.

Phase 5.1 (`PHASE5_3D_PROTOTYPE.md`) closed the remaining native
WebView2 proof gap this document originally listed here (screenshots at
every required count/theme/RTL/reduced-motion/fallback state, the
20-cycle memory test, demand-render proof, frame performance, live
theme/profile switching) — see that document for the full evidence log,
including two real bugs found and fixed (ring-radius/camera framing, the
WebGL-fallback button's wrong target) and one pre-existing non-3D bug
found and flagged separately (stale provider list after a profile
switch, `task_3e1b7b73`).

Before this becomes the production 3D Dashboard: a provider-count-scaling
strategy proven past the current 12/secondary-ring split (real visual
proof at 24–70), an on-canvas filter/search affordance, real GPU
performance measurement across the supported hardware matrix, and a
decision on whether Hybrid mode reuses this same engine instance or a
second one.
