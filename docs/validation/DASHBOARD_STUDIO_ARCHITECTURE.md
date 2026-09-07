# Dashboard Studio Architecture (Phase 2)

Date: 2026-09-07. Repo: `N:\QuotaArc\quotaarc`, branch `feature/v9-theme-runtime`.
Phase 2 of the Dashboard Studio mega-request: the **product architecture**
that lets the user choose exactly one Dashboard experience and guarantees
only that experience is ever loaded. Follows
[`DASHBOARD_DATA_ARCHITECTURE.md`](DASHBOARD_DATA_ARCHITECTURE.md) (Phase 1,
HEAD `52991e4e`, accepted PASS). This is **not** the 2D visual redesign
(Phase 3) and **not** the 3D engine (Phase 5) — those remain untouched.

## What this phase adds

### 1. Typed registry — one source of truth

[`src/lib/dashboardRegistry.ts`](../../apps/desktop-tauri/src/lib/dashboardRegistry.ts:1)
is the single place that knows about the three Dashboard modes. Nothing
else in the frontend branches on `mode === "..."` — every consumer
(`DashboardHost`, `DashboardStudioTab`) looks the active mode up in
`DASHBOARD_REGISTRY: Record<DashboardModeId, DashboardDefinition>`.

Each `DashboardDefinition` carries `id`, `name`, `shortDescription`,
`performanceClass` (`"lowest" | "medium" | "high"`), `isPlaceholder`, and a
`loader` — a `React.lazy(() => import(...))` component, not an eager
import. The three definitions:

| id | name | isPlaceholder | loader target |
|---|---|---|---|
| `analytics2d` | 2D Analytics Dashboard | `false` | [`surfaces/dashboard/AnalyticsDashboard.tsx`](../../apps/desktop-tauri/src/surfaces/dashboard/AnalyticsDashboard.tsx:1) |
| `providers3d` | 3D Providers Dashboard | `true` | [`surfaces/dashboard/Providers3DDashboard.tsx`](../../apps/desktop-tauri/src/surfaces/dashboard/Providers3DDashboard.tsx:1) |
| `hybrid` | Hybrid Dashboard | `true` | [`surfaces/dashboard/HybridDashboard.tsx`](../../apps/desktop-tauri/src/surfaces/dashboard/HybridDashboard.tsx:1) |

`resolveDashboardMode(value)` and `resolveDashboardPerformancePreset(value)`
are the only entry points that turn an untrusted string (from disk, from a
stale window, from a corrupt settings file) into a valid enum value —
anything unrecognized, `undefined`, `null`, or empty falls back to
`analytics2d` / `balanced`. 13 tests in
[`dashboardRegistry.test.ts`](../../apps/desktop-tauri/src/lib/dashboardRegistry.test.ts:1)
cover: exactly 3 definitions, unique ids, valid lazy loaders, correct
placeholder flags, non-empty name/description, and every fallback path.

### 2. Local persistence — two new settings, existing system

Two fields were added to the **existing** Rust settings struct
(`rust/src/settings.rs`) — no parallel config file, matching the
established `LowPowerModePreference` convention (`Copy` enum,
`#[serde(rename_all = "camelCase")]`, `#[default]` variant, inherent
`as_str()`/`parse()`):

```rust
pub enum DashboardModeId { #[default] Analytics2d, Providers3d, Hybrid }
pub enum DashboardPerformancePreset { LowCpu, #[default] Balanced, HighFidelity }
```

`dashboard_mode` defaults to `Analytics2d` (safest — never silently drops a
user into the 3D placeholder) and `dashboard_performance_preset` defaults
to `Balanced`. These are deliberately separate from
`low_power_mode_preference` / `adaptive_refresh`, which govern provider
*network polling*, not Dashboard *rendering*.

**Migration safety**: unlike `LowPowerModePreference` (where an invalid
serialized value fails the whole settings load — accepted existing
behavior), the two new fields use per-field lenient deserializers
(`rust/src/settings/raw.rs`) that catch a wrong-typed or unknown value and
fall back to the field's own default *without* failing the rest of
`RawSettings`. A settings file with `"dashboard_mode": "quantum3d"` still
loads every other setting correctly and lands on `analytics2d`. Proven by
4 new tests in `rust/src/settings/tests.rs`: missing-fields-default,
round-trip through a real temp file, and corrupt-value fallback
(`test_settings_corrupt_dashboard_mode_value_falls_back_without_crashing`).

The fields flow through the same bridge the rest of Settings uses:
`SettingsSnapshot` (`commands/bridge.rs`) exposes them as
`dashboardMode`/`dashboardPerformancePreset` strings, `SettingsUpdate`
(`commands/settings.rs`) accepts and parses them back with the same
`DashboardModeId::parse`/`DashboardPerformancePreset::parse`, silently
ignoring an unparseable patch value (existing pattern for every other
enum setting) rather than crashing the update command.

### 3. Settings tab whitelist — frontend and Rust in lockstep

Commit `0053e6dc` fixed a real bug where the frontend's settings-tab list
and Rust's `SETTINGS_TAB_IDS` whitelist
(`apps/desktop-tauri/src-tauri/src/surface_target.rs`) drifted apart. This
phase adds `"dashboardStudio"` to **both** in the same change:
`SettingsTabId`/`TAB_META` (`src/surfaces/settings/settingsTabs.ts`) and
`SETTINGS_TAB_IDS` (`surface_target.rs`, with a new
`supported_settings_tabs_include_dashboard_studio` test). Locale key
`TabDashboardStudio` was added to `rust/src/locale.rs` and both
`en-US.ftl`/`ar-SA.ftl`.

### 4. `DashboardHost` — exactly one mode mounted, ever

[`src/surfaces/dashboard/DashboardHost.tsx`](../../apps/desktop-tauri/src/surfaces/dashboard/DashboardHost.tsx:1)
is the only place a Dashboard mode component is actually rendered. It:

1. Resolves the requested mode through `resolveDashboardMode` (never
   trusts the caller).
2. Looks the resolved mode up in `DASHBOARD_REGISTRY`.
3. Renders `<DashboardModeErrorBoundary key={resolved}><Suspense
   fallback={<DashboardHostSkeleton/>}><Mode .../></Suspense></...>`.

The `key={resolved}` is load-bearing: React treats a key change as a new
element identity, so switching modes **unmounts** the old lazy component
(firing its cleanup effects) before **mounting** the new one — never both
at once, never a hidden duplicate. Proven directly (not just asserted) by
[`DashboardHost.test.tsx`](../../apps/desktop-tauri/src/surfaces/dashboard/DashboardHost.test.tsx:1),
which mocks each mode with a mount/unmount-tracking component and asserts
`unmountLog` contains the old mode and `mountLog` contains the new one
after a `rerender()` with a different `mode` prop — real evidence of
disposal, not an assumption.

Because `loader` is a `React.lazy` import, the two inactive modes'
JS is **not evaluated** until selected — confirmed in the production build
(`vite build`): `AnalyticsDashboard`, `Providers3DDashboard`, and
`HybridDashboard` each land in their own separate chunk
(`AnalyticsDashboard-*.js` 0.88 kB, `Providers3DDashboard-*.js` 0.75 kB,
`HybridDashboard-*.js` 0.66 kB), not inlined into `index-*.js`.

An invalid/corrupt stored mode (e.g. `"legacy3d"`) resolves to
`analytics2d` before any lookup happens — proven by a dedicated
`DashboardHost.test.tsx` case.

### 5. Error isolation per mode

`DashboardModeErrorBoundary` (class component, `DashboardHost.tsx`) wraps
each mode individually. If a mode's render throws (proven with a Hybrid
mock that throws `new Error("hybrid boom")`), the boundary renders
"Unable to load Hybrid Dashboard" plus a "Switch to 2D Analytics" button
that calls `onSwitchToDefault` (wired in `DashboardTab.tsx` to
`update({ dashboardMode: "analytics2d" })`) — the rest of the app,
including Settings, is unaffected. The boundary is suppressed for the
`analytics2d` mode itself (no "switch to yourself" affordance).

### 6. Loading state

`DashboardHostSkeleton` (in `DashboardHost.tsx`, styled by
`DashboardHost.css`) is the `Suspense` fallback shown while a lazy chunk
resolves — a shimmer skeleton (respecting `prefers-reduced-motion`), never
a blank white frame.

### 7. 2D Analytics is the existing baseline, not new work

[`AnalyticsDashboard.tsx`](../../apps/desktop-tauri/src/surfaces/dashboard/AnalyticsDashboard.tsx:1)
is the pre-existing Dashboard content (from the `93d367b9` in-shell
Dashboard fix), moved verbatim out of the old `DashboardTab.tsx` with no
visual changes — `useProviders`, `useSettings`, `useDashboardState`,
`DashboardBody` all unchanged. `DashboardTab.tsx` is now a thin wrapper
that reads `settings.dashboardMode` and renders `DashboardHost` with it.
Visual redesign is explicitly out of scope for Phase 2 (Phase 3).

### 8. 3D/Hybrid Dev placeholders

[`Providers3DDashboard.tsx`](../../apps/desktop-tauri/src/surfaces/dashboard/Providers3DDashboard.tsx:1)
and
[`HybridDashboard.tsx`](../../apps/desktop-tauri/src/surfaces/dashboard/HybridDashboard.tsx:1)
are intentional, labeled placeholders — not fake UI. Both consume
`useDashboardSnapshot()` and display **real** numbers
(`availability.sampleCount`, provider count) pulled from the local history
database, with explicit copy ("3D engine will be implemented in a later
phase (development build only)" / same pattern for Hybrid) so nothing
reads as a finished feature. Styled by the shared
`DashboardPlaceholder.css` (dashed border, muted tone — visually distinct
from finished surfaces).

### 9. Dashboard Studio Settings tab

[`DashboardStudioTab.tsx`](../../apps/desktop-tauri/src/surfaces/settings/tabs/DashboardStudioTab.tsx:1)
(new Settings destination, `settingsTabs.ts` id `dashboardStudio`):

- **Dashboard Experience** — `role="radiogroup"` of 3 cards (`role="radio"`,
  `aria-checked`), each with a CSS-gradient preview swatch
  (`data-mode={def.id}` — no bitmap asset, so no image-generation
  dependency and no multi-hundred-KB thumbnail; explicitly a scoped
  substitute for the spec's "lightweight thumbnail" ask) and a "Dev
  preview" badge on the two placeholder cards. Selecting a card calls
  `update({ dashboardMode: def.id })` through the same `useSettings` hook
  every other Settings tab uses.
- **Performance** — 3 preset cards (`Low CPU` / `Balanced` / `High
  Fidelity`), same radiogroup pattern, `update({
  dashboardPerformancePreset: preset.id })`.
- **Current Visual Identity** — read-only display (not a rebuild) of the
  already-shipped Structure Theme (`catalogBySlug(activeThemeSlug)?.name`)
  and Provider Presentation (`Follow Structure` vs `Independent`, from
  `settings.globalLimitPresentation?.identity`), each with a "Change"
  button that calls `onOpenThemes` / `onOpenProviderDisplay` — navigating
  to the existing Themes / Provider Display tabs rather than duplicating
  their UI.

Critically, this tab **never** renders `DashboardHost` — the mode cards are
static swatches, so opening Settings can never mount a live 2D/3D/Hybrid
Dashboard, satisfying the "Settings preview must never double-mount a real
engine" requirement structurally, not by convention.

5 tests in
[`DashboardStudioTab.test.tsx`](../../apps/desktop-tauri/src/surfaces/settings/tabs/DashboardStudioTab.test.tsx:1)
cover: all 6 cards render; the currently-selected mode/preset show
`aria-checked="true"`; clicking a mode/preset card persists it via
`updateSettings`; both "Change" buttons route to the right tab.

### 10. Snapshot bridge for the frontend

[`useDashboardSnapshot.ts`](../../apps/desktop-tauri/src/hooks/useDashboardSnapshot.ts:1)
wraps the Phase-1 `get_dashboard_snapshot` command
(`lib/tauri.ts::getDashboardSnapshot`). It fetches once on mount for the
requested `DashboardRangeKind`/timezone, and re-fetches only on
`"refresh-complete"` and `"codexbar:settings-updated"` events — no
polling. Both Dev placeholders use it as their only data source, proving
real `DashboardSnapshot`/`DataAvailability` data (sample count, provider
count) reaches the frontend without any widget re-implementing its own
fetch. 3 tests cover: loads on mount, surfaces a rejected fetch as
`error` without throwing, reloads on `"refresh-complete"`.

### 11. Routing convergence (unchanged, reconfirmed)

Startup, single-instance activation, tray → Dashboard, and "Last Opened" →
Dashboard already converge on the in-shell Dashboard route via
`MainRoute::Dashboard.settings_tab() == Some("dashboard")`, fixed in
`93d367b9` prior to this phase. Phase 2 does not touch this routing layer
— `DashboardTab.tsx` (the thing that route lands on) is the only thing
that changed, and it renders the identical `dashboard` tab id as before,
now internally delegating to `DashboardHost`.

## Explicitly out of scope this phase (unchanged)

- Full 2D Dashboard visual redesign — Phase 3.
- Any real 3D rendering (Three.js/WebGL) — Phase 5, gated on Phase 3 and
  Phase 4 (pricing) both being complete first.
- Bitmap preview thumbnails (WebP/AVIF) — no image-generation capability in
  this environment; CSS-gradient swatches used instead, noted above.
- `dashboardPerformancePreset`'s effect on actual rendering (chart
  animation level, glass/shadow quality, 3D render scale) — the enum and
  its persistence exist; consuming it to change behavior is future-phase
  work.

## Native Dev proof — NOT DONE

No native Windows screenshot capability exists in this working
environment. The screenshots the spec asks for
(`DASHBOARD_STUDIO_PHASE2.png`, `DASHBOARD_MODE_2D_SELECTED.png`,
`DASHBOARD_MODE_3D_SELECTED_PLACEHOLDER.png`,
`DASHBOARD_MODE_HYBRID_SELECTED_PLACEHOLDER.png`,
`DASHBOARD_REAL_HISTORY_DIAGNOSTIC.png`) were **not captured**. This is
reported honestly rather than fabricated. All other Phase 2 pass
conditions are backed by real automated test evidence (cited by file
throughout this document) plus a real `cargo test --workspace` / `npx
vitest run` / `tsc --noEmit` / `vite build` / `cargo clippy -D warnings` /
`cargo fmt --check` pass — see the Phase 2 checkpoint entry in
[`WAVE6_CONTINUATION.md`](../WAVE6_CONTINUATION.md) for the exact numbers
and commit range.
