# Phase 5 — 3D Provider Universe Prototype — Evidence Log

Starting HEAD: `575f6d4d` (Phase 4C close). This log records what was
actually run and observed for the Phase 5 engine prototype, and — per the
Quality-First rule that a claim of "tested" requires a fresh run against a
real surface — is explicit about what was **not** captured this session.

## Commits (this phase)

| Commit     | Content |
|------------|---------|
| `5e783e45` | `PHASE5_3D_ENGINE_AUDIT.md` — engine/CSP/lazy-load/preset/reduced-motion/theme audit |
| `89ce4270` | `three@0.185.1` + `@types/three` dependency |
| `b07d0d59` | `sceneModel.ts`/`identity.ts`/`layout.ts` — pure scene-view-model, provider identity, deterministic layout (29 tests) |
| `0fcab78b` | `renderPolicy.ts`/`engine.ts` — dirty-render scheduling, DPR cap, imperative Three.js engine, WebGL fallback (14 tests) |
| `c76488e2` | `ProvidersUniverseScene.tsx` — accessible selection/detail panel, Structure Theme + performance preset integration (2 tests) |
| `2fb112dc` | `Providers3DDevLab.tsx`/`devFixtures.ts` — DEV-only fixture-driven lab (8 tests) |

## What was verified (fresh runs, this session)

- **`cargo test -p quotalis_core locale`** — 19/19 passed. Locale parity
  intact after the 19 new `Providers3D*` keys.
- **`pnpm exec tsc --noEmit -p .`** — clean, zero errors, at every commit
  point in this phase.
- **`pnpm vitest run`** (full frontend suite) — **922/922 passed, 145/145
  files** (up from the Phase 4C baseline of 912/143; +8 net files, +10 net
  tests once fixture/component tests are counted — see per-commit test
  counts above). No regressions in any pre-existing suite.
- **`pnpm run build`** (production Vite build) — succeeds. Chunk manifest
  confirms lazy code-splitting:
  - Main startup chunk (`index-*.js`): **507.77 kB / gzip 166.08 kB**.
  - `ProvidersUniverseScene-*.js` (contains Three.js + engine + scene):
    **549.79 kB / gzip 139.24 kB**, in its own chunk, loaded only when
    the `providers3d` Dashboard mode or the DEV lab is actually reached
    (via `React.lazy`, `DASHBOARD_REGISTRY`'s existing loader pattern).
  - **Before/after comparison**: built the commit immediately prior to
    adding Three.js (`5e783e45`, via a throwaway `git worktree` — no
    changes to the working tree) and compared its main chunk: **507.35 kB
    / gzip 165.96 kB**. Delta from adding the entire 3D engine to the app:
    **+0.42 kB / +0.12 kB gzip on the startup path** — the 549 kB
    Three.js payload itself never touches 2D startup.
- **jsdom-real (not mocked) WebGL-unavailable path**:
  `createProvidersUniverseEngine` genuinely fails in this project's test
  environment (`HTMLCanvasElement.getContext("webgl2")` is not implemented
  in jsdom) and is asserted to return `{ok:false,
  reason:"context-unavailable"}` — this is the same code path a real
  no-GPU/no-driver machine would hit, exercised for real, not simulated.
  `ProvidersUniverseScene.test.tsx` proves the resulting fallback UI
  renders its title/body text and that "Open 2D Analytics" calls
  `onOpenProviders`.

## What was NOT captured this session (honest gap, not a silent omission)

The Phase 5 spec's sections 43–64 require extensive **native WebView2**
proof that a jsdom/Vite-dev-server environment cannot produce (the app's
Tauri IPC bridge — `getBootstrapState`, `useSettings`, etc. — is only
present inside the real Tauri webview; a bare browser hitting
`?window=providers3d-lab` fails at the bootstrap-fetch step with no
fallback, by design — see `App.tsx`). None of the following were
attempted this session:

- Real Dev-channel + DEV-fixture screenshots (`QUOTALIS_3D_REAL_DATA.png`,
  `QUOTALIS_3D_EMPTY.png`, the 1/6/12-provider fixture screenshots,
  `QUOTALIS_3D_SELECTED_PROVIDER.png`, `QUOTALIS_3D_NARROW.png`,
  `QUOTALIS_3D_RTL.png`, `QUOTALIS_3D_REDUCED_MOTION.png`,
  `QUOTALIS_3D_THEME_MATRIX.png`).
- Motion/video proof or a timed-screenshot-sequence substitute.
- The 20+-cycle 2D↔3D memory-cleanup measurement (process memory,
  listener counts, renderer counts).
- Cold/warm load-time-to-first-usable-frame measurement.
- Frame performance measurement (first-frame time, interaction FPS, idle
  CPU, memory, object count) at 1/6/12/24 providers.
- Large-provider (~70) stress test under real rendering.
- Live Structure Theme switching while 3D is mounted, proving the
  renderer isn't re-created (asserted by code structure — engine created
  once, `updateTheme` called on prop change — but not observed on
  screen).
- Profile-switch test while 3D is mounted.
- The Phase-3 2D regression re-check (startup, idle CPU, theme switching,
  RTL, DashboardSnapshot, provider filtering) to prove no regression from
  this phase's changes.

**Why**: this class of proof requires driving the actual compiled Tauri
desktop binary (native WebView2 window, CDP screenshot capture, real
process-memory sampling) — categorically different from, and much more
time-expensive than, the browser-based/headless tooling available in this
session. The same constraint was hit and explicitly deferred in Phase 3.
Rather than fabricate a plausible-looking screenshot or performance
number, this gap is reported as-is.

## Verdict

**PHASE 5 PROTOTYPE: CODE-COMPLETE, PARTIALLY VERIFIED — NOT PASSED
pending native visual/performance proof.**

Every piece of logic that *can* be verified without a native WebView2
window has been: pure scene/layout/render-scheduling logic (56 unit
tests), the real WebGL-unavailable fallback path (exercised for real in
jsdom, not mocked), theme/identity/accessibility wiring (type-checked and
component-tested), locale parity, full-suite regression safety, and a
real bundle-size/lazy-load measurement. What remains is exactly the
category of evidence Phase 5's own spec (section 44) anticipated might be
impractical to fully automate ("if WebGL unit testing is impractical,
test pure logic separately... real WebView2 Dev proof is more valuable")
— that WebView2 proof itself is the open item.

Per the phase's own instruction: **stopping here** rather than
auto-proceeding. Completing the native proof requires either a dedicated
follow-up pass driving the real Tauri Dev binary (computer-use / CDP
screenshot capture against the compiled app, budgeted separately given
its cost) or the user accepting the code-complete state as sufficient for
this prototype's purpose and deferring native proof to Phase 6.
