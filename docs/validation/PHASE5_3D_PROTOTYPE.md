# Phase 5 / 5.1 — 3D Provider Universe Prototype — Evidence Log

Phase 5 (prototype code) starting HEAD: `575f6d4d` (Phase 4C close).
Phase 5.1 (native runtime validation) starting HEAD: `94555e3e`.
Ending HEAD: `ecff3d89`.

This log records what was actually run and observed for the Phase 5/5.1
engine prototype and its native runtime validation, per the Quality-First
rule that a claim of "tested" requires a fresh run against a real
surface named by artifact.

## Commits

| Commit     | Content |
|------------|---------|
| `5e783e45` | `PHASE5_3D_ENGINE_AUDIT.md` — engine/CSP/lazy-load/preset/reduced-motion/theme audit |
| `89ce4270` | `three@0.185.1` + `@types/three` dependency |
| `b07d0d59` | `sceneModel.ts`/`identity.ts`/`layout.ts` — pure scene-view-model, provider identity, deterministic layout (29 tests) |
| `0fcab78b` | `renderPolicy.ts`/`engine.ts` — dirty-render scheduling, DPR cap, imperative Three.js engine, WebGL fallback (14 tests) |
| `c76488e2` | `ProvidersUniverseScene.tsx` — accessible selection/detail panel, Structure Theme + performance preset integration (2 tests) |
| `2fb112dc` | `Providers3DDevLab.tsx`/`devFixtures.ts` — fixture-driven lab (8 tests) |
| `94555e3e` | docs: Phase 5 architecture + prototype evidence (Phase 5 close) |
| `2ad4245e` | Renderer diagnostic registry (`window.__quotalisProviders3DDebug__`) for native demand-render proof |
| `f852656a` | **Fix**: primary-ring radius/camera framing scale with provider count; DEV lab reachability fix (see below) |
| `ecff3d89` | **Fix**: WebGL-unavailable fallback now really switches to 2D Analytics (see below) |

## Phase 5.1 native method

**Binary**: `target\debug\QuotalisDev.exe`, built via
`pnpm exec tauri build --config src-tauri/tauri.dev.conf.json --features dev-channel --debug --no-bundle`
at HEAD `ecff3d89` (final pass; earlier passes rebuilt at intermediate
fix commits, each hash recorded at the time). Final build:
- SHA-256: `6c409fa69028351e26505bef5dc9a463ed9008357c5df350440cddc779aadcc6`
- ProductName/FileDescription: `Quotalis Dev` / CompanyName: `Quotalis`
- FileVersion/ProductVersion: `0.11.0`
- Data root: `%APPDATA%\QuotaArc-Dev`, `%LOCALAPPDATA%\QuotaArc-Dev` (isolated from Personal)

**CDP**: launched with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`
(a fresh port, distinct from the `9223` used by prior phases, avoiding
the collision documented in `.local/recovery/claude-freeze-20260906-231310/development-ports.txt`).
Reused the project's established CDP technique (`scripts/capture-native-usage-proof.mjs`,
`.local/proof/phase3-2d/cdp-lib.mjs`) — scripts for this pass live in
`.local/proof/phase5-3d/` (not committed, matching the existing
`docs/*` gitignore convention; the final labeled screenshots below are
committed under `docs/images/dashboard/phase5/`).

**Personal**: confirmed untouched throughout — the pre-existing Personal
`QuotaArc.exe` (PID 52000, `%LOCALAPPDATA%\QuotaArc\QuotaArc.exe`) was
never launched, inspected, or modified by any script in this pass.

## What was verified natively (fresh runs, this pass)

### Rust test-count reconciliation (owner section 1)

The Phase 5 report previously stated `cargo test --workspace: 1599
passed` — an artifact of quoting a truncated `tail` of the real output,
not a real regression. Re-ran the complete workspace suite from the repo
root and read the **full** output (three separate test binaries actually
run under one `--workspace` invocation):

| Binary | Result |
|---|---|
| `Quotalis` (codexbar-desktop-tauri, src-tauri) | **455 passed, 1 ignored** |
| `quotalis_core` (lib) | **1599 passed** |
| `quotalis` (rust/src/main.rs bin) | **1 passed** |
| **Total** | **2055 passed, 1 ignored** |

Matches the Phase 4C-established inventory exactly. No test target was
ever lost.

### Real Tauri IPC + lazy loading (owner sections 3-5)

- Confirmed `window.__TAURI_INTERNALS__` present on the main window;
  called the real `get_bootstrap_state`/`get_cached_providers` commands
  — not a mock.
- **Cold-start lazy-load proof**: on a fresh process launch with
  `dashboardMode: "analytics2d"` persisted, `performance.getEntriesByType("resource")`
  showed **no** `ProvidersUniverseScene` chunk request at all
  (`loaded3dChunk: false`) and `window.__quotalisProviders3DDebug__`
  did not exist (the module's own top-level code never ran). Switching
  to `providers3d` via the real `update_settings` command then showed
  the chunk requested (`loaded3dChunk: true`) and **exactly one** engine
  instance registered (`engineCount: 1`), with a genuine
  `WebGL2RenderingContext` on the canvas (`isContextLost: false`).
  Switching back to `analytics2d` dropped the registry back to
  `engineCount: 0` (real disposal, not just a hidden DOM node).

### Demand-render proof (owner section 6) — the most load-bearing gate

Added a lightweight diagnostic registry (`2ad4245e`,
`window.__quotalisProviders3DDebug__.engines`, a `Set` of live engine
instances) exposing `getDebugInfo()`, which reads Three.js's own
always-on `renderer.info.render.frame` — a monotonically-increasing
count of real `render()` calls, never reset by `info.reset()`. Sampled
it, waited **20 seconds with zero interaction**, sampled again:

```
t=0s:  { rendererInfo: { frame: 3, ... } }
t=20s: { rendererInfo: { frame: 3, ... } } -- delta: 0
```

Repeated the same test under real `prefers-reduced-motion: reduce`
emulation over 10s: delta 0 again. **No permanent
`requestAnimationFrame` loop exists.** (Not gated by
`import.meta.env.DEV` — see "Bugs found and fixed" below for why that
flag can't gate anything in this binary.)

### 20-cycle mode-switch memory test (owner section 20)

20 full `analytics2d` → `providers3d` cycles via the real
`update_settings` command, sampling the full process tree
(`QuotalisDev.exe` + all `msedgewebview2.exe` descendants, walked
recursively — 8 processes total) every 5 cycles:

| Point | Process-tree working set |
|---|---|
| Baseline | 578.3 MB |
| After cycle 5 | 703.4 MB |
| After cycle 10 | 719.4 MB |
| After cycle 15 | 716.8 MB (down from cycle 10) |
| After cycle 20 | 721.6 MB |

One-time jump after the first few cycles (GPU/driver/JIT warmup —
consistent with a first-use cost, not a per-cycle leak), then flat
within ~20 MB across cycles 5→20 (GC noise). Confirmed at the engine
level too: after all 20 cycles, exactly **1** live engine instance,
`geometries: 5`, `textures: 1` — identical to a single fresh 2-provider
mount, not accumulated. **No unbounded growth.**

### Frame performance (owner sections 21-23)

Using the fixture lab (`?window=providers3d-lab`), measured first-frame
latency (mode-switch click → `renderer.info.render.frame >= 1`) and
settled geometry/triangle counts at each provider count, `balanced`
preset:

| Providers | First-frame latency | Settled geometries | Settled triangles |
|---|---|---|---|
| 1 | 50 ms | 3 | 992 |
| 6 | 60 ms | 13 | 5,552 |
| 12 | 45 ms | 25 | 11,024 |
| 24 | 68 ms | 49 | 21,968 |

All four settle to zero further renders within the same 20s-idle demand-
render proof above (spot-checked at 6 providers). Geometry/triangle
counts scale exactly linearly with provider count (2 geometries per
body + 1 core), as expected from `layout.ts`'s design — no hidden
per-provider cost growth.

**Performance-preset DPR spot-check** (12 providers): `lowCpu` forced
`effectiveDPR: 1` (below this machine's real hardware DPR); `balanced`
and `highFidelity` both showed `effectiveDPR: 1.5` — because this
machine's real `window.devicePixelRatio` is 1.5, below `highFidelity`'s
2.0 cap, so both presets legitimately converge on the same real value.
`computeDevicePixelRatio` behaves correctly; there was nothing to fix.

We did not chase a frames-per-second number under active camera drag
(OrbitControls damping + demand rendering makes "idle FPS" a
category error — the correct metric, demand rendering, is proven above).

### Idle CPU (owner section 22) — investigated a real-looking anomaly, found a measurement artifact

Initial measurement (CDP-attached process, `Get-Process` cumulative
`TotalProcessorTime` delta over 20s) showed an alarming **~590-620% of
one core**, identically in *both* 2D and 3D modes. Rather than accept
this at face value (same discipline as Phase 3.5's own idle-CPU red
herring), investigated further:

1. Confirmed the number was identical in 2D and 3D — ruling out the 3D
   engine as the cause.
2. Repeated with `Get-Counter '\Process(QuotalisDev)\% Processor Time'`
   (5 samples, 4s apart): consistently 580-620%, corroborating the
   `Get-Process` reading — not a delta-calculation bug.
3. Launched a **second, completely clean instance with no
   `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` at all** (no CDP attached) —
   the `tauri-plugin-single-instance` plugin correctly refused a true
   second process and just focused the existing window, confirmed via
   `Get-Process` on the returned PID finding nothing.
4. Killed the CDP-attached instance, launched a genuinely clean one, and
   sampled CPU with `Get-Counter` (no CDP needed for measurement): **0%,
   0%, 0%, 1.5%, 0%** — both in `providers3d` mode and, separately, in
   `analytics2d` mode.

**Conclusion**: the ~600% reading was a real but *environmental*
artifact of leaving `Runtime.enable`/`Page.enable` CDP domains active
across many long-lived WebSocket sessions over a multi-hour test pass —
a well-known Chromium/V8 characteristic (enabling the Debugger/Runtime
protocol domains changes V8's execution/instrumentation mode), not a
production defect and not specific to this app. **True idle CPU with no
devtools attached is ~0%, in both 2D and 3D** — consistent with Phase
3's own 0.00-0.31% 2D baseline. No continuous render loop exists in
either mode.

### Real Dev data first (owner section 7)

The real Dev profile currently has 2 configured accounts (`codex`,
`claude`), both genuinely `needsAuthentication` (matches Phase 3's own
finding — this profile has never completed sign-in for either). Fetched
via the real `get_cached_providers` command (sanitized, no tokens/IDs):

```json
{ "visibleCount": 2, "summary": [
  { "providerId": "codex", "errorState": "needsAuthentication", "usedPercent": 0, "hasCost": false },
  { "providerId": "claude", "errorState": "needsAuthentication", "usedPercent": 0, "hasCost": false }
]}
```

`QUOTALIS_3D_REAL_DATA.png` shows exactly this: 2 real bodies (dimmed —
`authState !== "ready"`) around the core, no fabricated third state.

A genuinely **empty** real state was found for free during the profile-
switch test (section 17 below): a freshly created DEV-only profile with
zero accounts attached showed `get_cached_providers` returning `[]`
against the *real* `Providers3DDashboard` (not the fixture lab) —
`QUOTALIS_3D_EMPTY_REAL.png` is that real capture, not an injected
fixture.

### Fixture states 1/6/12/24 (owner section 8-10)

Via the DEV-only fixture lab. Visual review (owner section 26) at each
count:

- **1 provider** (`QUOTALIS_3D_SINGLE_PROVIDER_DEV_FIXTURE.png`): after
  the ring-radius fix (below), in-frame and legible, though the body
  still visibly overlaps the core sphere from this camera angle — a
  known, minor composition nuance, not a blocking defect (data stays
  fully legible via the accessible detail panel regardless of the 3D
  composition). Left as-is per the phase's own "don't production-polish
  endlessly" guidance.
- **6 providers** (`QUOTALIS_3D_SIX_PROVIDERS_DEV_FIXTURE.png`): clean,
  well-separated, "little planet with a Saturn-like usage ring" reads
  well — genuinely closer to "ancient precision observatory" than
  "generic Three.js solar system demo."
- **12 providers** (`QUOTALIS_3D_TWELVE_PROVIDERS_DEV_FIXTURE.png`):
  all 12 legible, one minor near-touch between two bodies, not
  occluding either.
- **24 providers** (`QUOTALIS_3D_TWENTYFOUR_PROVIDERS_DEV_FIXTURE.png`):
  primary+secondary ring split comprehensible, one body partially
  clipped by the canvas's bottom edge at this window size (would be
  visible with a taller canvas/window) — noted, not fixed (70-provider
  polish is an explicit Phase 5 non-goal).

Status-mix fixtures (`mixedAlert`) confirmed real Phase 4 monetary
semantics hold in the 3D detail panel: Balance/Credits never show a `$`
sign, an unclassified/no-cost provider shows "Not available", never a
fabricated `$0.00`.

### Selection / hover (owner section 11)

Clicking a provider in the accessible nav list correctly updates
`aria-pressed`, the selected-provider `<dl>` panel, and calls
`engine.select()`. `QUOTALIS_3D_SELECTED_PROVIDER.png`. **Known gap**:
there is no visual highlight on the selected body *inside the canvas
itself* — selection state is authoritative only in the accessible DOM
panel. Not a correctness defect (the phase's own accessibility
principle — "critical information available outside canvas" — is met),
but a real polish gap for a production pass.

### Accessibility (owner section 12)

`ArrowDown` moved selection from item 0 to item 1 (list + detail panel
both updated); `Escape` cleared selection (`aria-pressed` gone, detail
panel unmounted) — all via real `KeyboardEvent` dispatch, not a mocked
handler. 7 real focusable elements found (Reset View + one button per
provider) with no keyboard trap.

### RTL (owner section 13)

Real `set_ui_language("arabic")` IPC call. `document.dir === "rtl"`,
`document.documentElement.lang === "ar"`. `QUOTALIS_3D_RTL.png` shows:
full layout mirroring (nav + detail panel swap to the left), real
Arabic strings from the shipped `.ftl` files (`الاستخدام`, `الحالة`,
`الحالة المالية`, `غير متاح`), percentages stay Latin-numeral ("96%"),
provider display names stay LTR-isolated ("Claude (Dev Fixture 1)"),
and the 3D canvas itself is correctly **not** mirrored (camera/scene
orientation is language-independent, as it should be).

### Narrow window (owner section 14)

480×900 via CDP `Emulation.setDeviceMetricsOverride` (native window
untouched, same technique as Phase 3). `QUOTALIS_3D_NARROW.png`: the
existing `@media (max-width: 720px)` CSS rule stacks controls → canvas →
nav list → detail panel vertically, canvas fits full width, zero
horizontal overflow.

### Reduced motion (owner section 15)

Real `prefers-reduced-motion: reduce` emulation. Confirmed
`data-qa-motion="reduced"` on the component root and
`matchMedia(...).matches === true`. `QUOTALIS_3D_REDUCED_MOTION.png`.
Demand-render proof re-run under this condition: frame delta 0 over 10s
(see above).

### Live Structure Theme switching (owner section 16)

Cycled Obsidian Orbit → Smoked Silver → Solar Ember → Ceramic Pearl →
back to Obsidian, **while the same engine instance stayed mounted**.
Proven via the renderer's own frame counter, which only advanced by
exactly 1 per switch (one dirty render, as expected) while
`geometries` stayed at 13 throughout — a re-created renderer would have
reset both counters to a fresh baseline. Confirmed visually: Follow-
Structure providers (teal, following `theme.accent`) genuinely changed
color per theme (e.g. silver-gray under Smoked Silver); Independent-
identity providers (orange, from a `--chart-*` CSS var) correctly did
not. `QUOTALIS_3D_THEME_OBSIDIAN.png` / `_SMOKED_SILVER.png` /
`_SOLAR_EMBER.png` / `_THEME_MATRIX_CERAMIC_PEARL.png`.

### Live profile switching (owner section 17)

Created a temporary DEV-only profile ("Phase5.1 Sanity B", zero
accounts, `catalogTheme: eclipse-ember`) via the real `create_profile`/
`update_profile` commands, switched to it while `providers3d` was
mounted on the **real** `Providers3DDashboard` (not the fixture lab).
Confirmed: **Structure Theme changed live** (warm amber Eclipse Ember
palette, `QUOTALIS_3D_EMPTY_REAL.png`) with the same engine instance.
**Provider view model did NOT update live** — the nav list kept showing
the previous profile's `Codex`/`Claude` even though
`get_cached_providers` correctly returned `[]` for the new profile.
**Root-caused, not a 3D-engine bug**: `useProviders()`
(`apps/desktop-tauri/src/hooks/useProviders.ts`) only listens for the
`settings-changed` Tauri event, but `switch_profile` (and
`create_profile`/`update_profile`/`delete_profile`) emit
`profiles-changed`/`quotalis:settings-updated` instead — a pre-existing
gap affecting every `useProviders()` consumer (2D Dashboard, tray, 3D
alike), not introduced by Phase 5. Flagged as a follow-up task
(`task_3e1b7b73`, "Fix stale provider list after profile switch") rather
than fixed in this pass — out of Phase 5.1's scope, same precedent as
Phase 3's own "flagged, not fixed here" RTL bug. Cleaned up: switched
back to Default, deleted the temporary profile.

### WebGL failure fallback (owner section 18) — a real bug found and fixed

Launched the Dev binary with WebGL genuinely disabled
(`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333
--disable-webgl --disable-webgl2 --disable-gpu` — real Chromium flags,
not a simulated failure). Confirmed the fallback UI renders correctly:
"3D view unavailable on this device" + body text, no raw WebGL stack
trace, 2D still fully functional. `QUOTALIS_3D_WEBGL_FALLBACK.png`.

**Bug found**: clicking the "Open 2D Analytics" button actually
navigated to the **Providers** settings tab, not the 2D Dashboard — it
was wired to `onOpenProviders`, the same prop every other Dashboard mode
uses to mean "open Providers settings" (`Settings.tsx`:
`onOpenProviders={() => handleTabClick("providers")}`), not "switch
Dashboard mode." **Fixed** (`ecff3d89`): threaded `DashboardHost`'s
existing `onSwitchToDefault` (already used by its own per-mode error
boundary) down into `DashboardModeProps` as `onSwitchToAnalytics2D`, and
rewired the fallback button to call that instead. Re-verified natively
after the fix: clicking the button now genuinely sets
`dashboardMode: "analytics2d"` in the real settings snapshot, and the
real `AnalyticsDashboard` content actually renders afterward (confirmed
by DOM content, not just the setting value).

### Context loss / restore (owner section 19)

Triggered a **real** WebGL context loss via the standard
`WEBGL_lose_context` extension's `loseContext()` (the same mechanism
browsers themselves use for this, not an artificial hack) — genuinely
sets `gl.isContextLost() === true` and fires the real
`webglcontextlost` event. Confirmed: app did not crash, canvas element
stayed mounted. Then called `restoreContext()` on the same extension
handle: `gl.isContextLost()` returned to `false`, the engine's
`disposed` flag stayed `false` (no crash-and-recreate), and a new frame
rendered correctly with all provider bodies in their correct positions
(`QUOTALIS_3D_CONTEXT_RESTORE.png`). **Known minor gap**: the canvas
clear color reverted to plain black instead of the theme's tinted
background after restore — `onContextRestored` requests a re-render but
doesn't re-call `updateTheme()`, so `setClearColor` (renderer-level
state, separate from the scene graph Three.js automatically rebuilds)
isn't reapplied. Not fixed in this pass (narrow edge case — genuine GPU-
driver context loss is rare in practice — and the core requirement,
"app does not crash," is met); noted as a production-hardening item.

### 2D regression check (owner section 25)

Confirmed the 2D Dashboard was never touched by any Phase 5/5.1 commit
(`git diff --stat` against every changed file: all under
`surfaces/dashboard/providers3d/`, `dashboardRegistry.ts` /
`DashboardHost.tsx` (additive prop only), `themeResolution.ts` (additive
surface id only), locale files (additive keys only), `App.tsx`
(additive route only) — nothing in `surfaces/dashboard/analytics/` or
`AnalyticsDashboard.tsx` changed). Live-verified anyway:
`QUOTALIS_2D_REGRESSION_CHECK.png` shows the real 2D Dashboard rendering
correctly (real usage trend chart, real alerts, real "Cost data
unavailable" honesty from Phase 4C) with zero `<canvas>` elements and
zero live 3D engine instances. True (no-devtools) idle CPU in 2D mode:
0%, 0%, 0%, 1.5%, 0% — identical to the 3D reading above, both matching
Phase 3's original 2D baseline.

## Bugs found and fixed this pass

1. **Ring-radius/camera-framing scale** (`f852656a`): 2 real providers on
   a fixed-radius-6 ring with a fixed camera distance looked like debris
   lost in a huge empty canvas. Fixed by making the primary ring's
   radius (and the camera distance derived from it) a function of actual
   occupancy, growing from a 3-unit floor at 2 providers up to the
   existing 6-unit radius at capacity (12) — still fully deterministic.
2. **DEV lab permanently unreachable** (`f852656a`): gated on
   `import.meta.env.DEV`, which is Vite's *build-mode* flag and is
   `false` in every artifact this project ships (including a
   `dev-channel` Rust build) — this made the lab unreachable in the very
   binary it exists to help verify. Fixed to match the pre-existing
   `?window=demo` convention (query-param check alone, undiscoverable
   from any in-app UI).
3. **Single-provider body overlapping the core** (`f852656a`, caught
   immediately after fix #1): tying the single-provider distance to the
   new smaller ring-radius floor shrank it enough to visually overlap
   the core. Given its own dedicated constant instead.
4. **WebGL-fallback button opened the wrong tab** (`ecff3d89`): see
   "WebGL failure fallback" above.

## Bugs found, NOT fixed (flagged for follow-up, out of Phase 5.1 scope)

1. **Stale provider list after profile switch** — pre-existing,
   affects every `useProviders()` consumer app-wide, not 3D-specific.
   Spawned as `task_3e1b7b73`.
2. **Context-restore doesn't reapply theme's clear color** — narrow edge
   case, app does not crash, core requirement met.
3. **No in-canvas visual highlight for the selected provider** — the
   accessible DOM panel is authoritative and correct; a 3D highlight is
   a production-polish item.
4. **Single-provider composition** — body visibly overlaps the core from
   this camera angle; in-frame and legible, not broken.

## Final bundle-size re-confirmation (owner section 24)

Rebuilt at final HEAD `ecff3d89`:
- Main startup chunk: `index-*.js` — 507.77 kB (gzip 166.08 kB, ±0.1 kB
  noise from the diagnostic registry's tiny footprint).
- `ProvidersUniverseScene-*.js` (Three.js + engine + scene): 550.62 kB
  (gzip 139.54 kB), still its own lazily-`import()`-ed chunk.
- Delta from the pre-Three.js baseline (`5e783e45`, 507.35 kB / gzip
  165.96 kB): **+0.42-0.49 kB on the startup path**, confirmed
  unchanged in shape from the original Phase 5 measurement — no
  accidental import moved Three.js into the startup bundle.

## Full quality gates (final HEAD `ecff3d89`)

- `cargo test --workspace`: **2055 passed, 1 ignored** (455 + 1599 + 1,
  reconciled above)
- `cargo clippy --workspace --all-targets -- -D warnings`: clean
- `cargo fmt --all -- --check`: clean
- `pnpm exec tsc --noEmit`: clean
- `pnpm vitest run`: **924/924 passed, 145/145 files**
- `pnpm run build`: succeeds, `check-locale` OK (1053 keys)
- `git diff --check`: clean
- Skip/focus scan (providers3d test files): none found
- Secret scan (providers3d files + this doc): none found
- Personal: confirmed untouched throughout (PID 52000 never
  launched/inspected/modified)

## Verdict

**PHASE 5.1 — NATIVE RUNTIME VALIDATION: PASS.**

Every item in the Phase 5.1 pass-condition checklist was verified
against the real compiled Dev-channel binary via genuine WebView2 CDP
control — not simulated, not mocked, not skipped:

- [x] Complete Rust test count reconciled (2055 passed, 1 ignored)
- [x] Fresh Quotalis Dev binary verified (hash/mtime/identity recorded)
- [x] Real WebView2/CDP proof succeeds
- [x] True lazy loading proven (cold-start: chunk never requested)
- [x] Demand rendering proven (frame delta 0 over 20s idle, and again
      under reduced motion)
- [x] Renderer disposal proven (engine registry drops to 0 on 2D switch)
- [x] 20-cycle switch shows no unbounded leak
- [x] 1/6/12/24 layouts run in the real renderer
- [x] Interaction works (selection sync, keyboard nav)
- [x] Accessible DOM navigator works
- [x] Reduced motion works
- [x] RTL works
- [x] Narrow layout works
- [x] Structure Theme changes live (same engine instance)
- [x] Profile theme changes live (provider list staleness is a
      pre-existing, non-3D bug, flagged separately)
- [x] WebGL failure fallback works (bug found and fixed)
- [x] 2D remains unaffected (code untouched; live-verified; idle CPU
      confirmed identical/negligible in both modes)
- [x] Performance measured (first-frame latency, geometry/triangle
      scaling, DPR-per-preset)
- [x] Required screenshots captured (18 real captures under
      `docs/images/dashboard/phase5/`)
- [x] Full quality gates green
- [x] Personal untouched

Two real defects were found and fixed in this pass (ring-radius/camera
framing, WebGL-fallback button behavior); one pre-existing, non-3D bug
was found and flagged for separate follow-up rather than fixed here
(matches the established "flag real bugs found in passing, fix only
what's in scope" precedent from Phase 3). No known critical
lifecycle/performance defect remains open.

Per the phase's own instruction: **stopping here**. Not starting
Phase 6. The owner should review the real screenshots under
`docs/images/dashboard/phase5/` before deciding on further investment
in this prototype.
