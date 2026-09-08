# Phase 5 — 3D Engine Technical Audit

Performed before any dependency was installed, per owner instruction.
Repository: `N:\QuotaArc\quotaarc`, HEAD `575f6d4d` at the time of this
audit.

## Existing state

- **No WebGL/3D dependency exists anywhere in `package.json`** — grepped
  for `three`, `babylon`, `webgl`, `pixi`, `react-three`: zero hits.
  Confirmed independently by `Providers3DDashboard.tsx`'s own doc
  comment ("No Three.js/WebGL dependency exists in this codebase yet").
- `apps/desktop-tauri/src/surfaces/dashboard/Providers3DDashboard.tsx`
  and `HybridDashboard.tsx` are Phase-2 placeholders: they mount/dispose
  correctly under `DashboardHost`'s real lazy-loading contract, use the
  real `useDashboardSnapshot` hook (never synthetic data), and render a
  plain `<dl>` fact list. No canvas, no 3D geometry, no fake metrics.
- `apps/desktop-tauri/src/lib/dashboardRegistry.ts` already defines the
  authoritative 3-mode registry (`analytics2d`/`providers3d`/`hybrid`)
  with `React.lazy(() => import(...))` per mode — confirmed the module
  for a non-selected mode is never requested (standard Vite/React lazy
  dynamic-import semantics: the `import()` call itself is what triggers
  the network/module fetch, and it is inside the lazy factory, only
  invoked when that mode is actually rendered). `isPlaceholder: true` on
  both non-2D modes; `performanceClass` already distinguishes
  `"lowest"`/`"medium"`/`"high"` per mode, independent of the
  `DashboardPerformancePreset` a user can pick within any mode.
- `DASHBOARD_PERFORMANCE_PRESETS` already exists:
  `lowCpu`/`balanced`/`highFidelity`, described in the UI as
  "Maximum efficiency..."/"Recommended..."/"Maximum visual quality...".
  `DashboardPerformancePreset` type lives in `types/bridge.ts`
  (Rust-mirrored settings field) — real, persisted, not a placeholder.

## CSP / WebView2 constraints

- `apps/desktop-tauri/src-tauri/tauri.conf.json`'s `csp`: `default-src
  'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src
  'self' data:; font-src 'self'; connect-src 'self' ipc: http://
  ipc.localhost http://localhost:* http://127.0.0.1:* ws://localhost:*
  ws://127.0.0.1:*; object-src 'none'; base-uri 'none'; frame-ancestors
  'none'`.
- **WebGL/Canvas is not gated by any CSP directive** — there is no
  `webgl-src`/`canvas-src` directive in the CSP spec; a `<canvas>`
  element and its WebGL context are native browser APIs, unaffected by
  `script-src`/`img-src`. The existing CSP already forbids what Phase 5
  itself requires forbidding: no CDN script (`script-src 'self'`,
  already excludes any three.js CDN build), no remote texture fetch
  (`connect-src` has no external host, `img-src` is `'self' data:'`
  only). No CSP change is needed for a locally-bundled Three.js.
- `script-src 'self'` contains no `'unsafe-eval'` — this is safe for
  Three.js's default renderer path (shader compilation happens on the
  GPU driver via `WebGLRenderingContext` calls, not via JS `eval`); no
  known mainstream Three.js feature requires `eval`.
- **WebView2 version / minimum Windows target**: not pinned anywhere in
  `tauri.conf.json` or `Cargo.toml` — Tauri v2's default behavior is to
  use whatever WebView2 Runtime is installed system-wide (Windows 10
  1803+ ships/auto-installs it; Windows 11 ships it by default). No
  explicit minimum-WebView2-version requirement is declared in this
  project. WebView2 (Chromium-based, evergreen-updated on most
  machines) has supported WebGL2 for years — this is a reasonable,
  low-risk baseline assumption, but was not independently re-verified
  against a specific pinned WebView2 build number this pass (no such
  pin exists to verify against).
- No GPU-disable / software-rendering (`--disable-gpu`,
  `--use-gl=swiftshader`, etc.) flag exists anywhere in this project's
  Tauri/WebView2 launch configuration — confirmed via grep across
  `apps/desktop-tauri/src-tauri/`. A real hardware-acceleration failure
  on a given machine is therefore an environment condition Phase 5 must
  detect and fail gracefully for (`webglcontextlost` /
  renderer-init-throw handling), not something this project already
  works around.

## Reduced motion / existing motion primitives

- `apps/desktop-tauri/src/design-system/motion.ts` is the established,
  single motion system: `MotionLevel = "full" | "reduced" | "off"`,
  `motionLevelFor(setting, systemReduced)` combines the user's explicit
  setting with the OS-level `prefers-reduced-motion` media query (read
  via the `motion/react` library's own `useReducedMotion()`, re-exported
  here), `motionEnabled(level)` is the one boolean gate every animated
  DOM primitive in this app already checks. Phase 5's 3D engine reuses
  this exact system for its own reduced-motion behavior (ambient
  orbital drift, camera transition duration) rather than inventing a
  second one.
- `[data-qa-motion]` is set on the root element by the existing settings
  pipeline; multiple existing components (`BarChart.tsx`,
  `useChartAnimation.ts`, `CatalogUsageHero.css`, `EdgeOrbitStage.css`,
  `TaskbarStage.css`, `TopOrbitStage.css`) already key off it or off
  `prefers-reduced-motion` directly.

## Structure Theme / Provider Identity primitives to reuse

- `design-system/themeCatalog.ts`'s `CatalogTheme` interface is the
  single existing Structure Theme model: `core`/`coreEdge`/`accent`/
  `accent2`/`accent3`/`hairline`/`bg: [string, string]`/`material?:
  {text, muted, finish, sheen, light?}`/`providerColors: Record<string,
  string>` — all raw hex/CSS color strings, directly convertible to
  `THREE.Color` without any DOM/CSS-custom-property indirection.
- `design-system/themeResolution.ts::resolveCatalogTheme(settings,
  surface)` is the one real resolver (precedence surface → profile →
  global → default, proven live in Phase 3.6) — Phase 5 calls this
  exact function for a new `"providers3d"` surface key, not a second
  resolver.
- `surfaces/dashboard/analytics/useDashboardStructureTheme.ts` is the
  Phase-3.6 pattern for mapping a resolved `CatalogTheme` onto scoped
  CSS custom properties for 2D DOM chrome — Phase 5's engine does NOT
  reuse this hook directly (it targets CSS custom properties, meaningless
  to a `THREE.Color`), but follows its exact reasoning pattern (derive
  every 3D material/lighting color from the resolved theme's own real
  fields, never a hardcoded scene palette) in a new, engine-appropriate
  form (see `PROVIDERS_3D_ENGINE.md`).
- `providerColors` on each `CatalogTheme` is the existing Provider
  Identity color source when a surface is "Follow Structure"; the
  separate, provider-authoritative color/glyph system (used by
  `ProviderIcon`, `providerCreditsColor`, etc.) is the source when
  "Independent" — Phase 5 must read from whichever the existing
  provider-presentation setting already resolves to, not invent a third
  option.

## Bundle / lazy-chunk architecture

- Vite 6.4.2 + `React.lazy` (confirmed above) is the existing
  code-splitting mechanism — no manual `import()`-avoidance work is
  needed beyond keeping the 3D engine import inside
  `Providers3DDashboard.tsx`'s own module (never imported from
  `AnalyticsDashboard.tsx` or any 2D-mode-reachable file).
- `apps/desktop-tauri/package.json` has no chunk-size-limit override for
  this concern specifically; Vite's default `chunkSizeWarningLimit`
  (500 kB) already surfaces in the existing build output for the
  largest 2D chunk (`index-*.js`, ~507 kB) — Phase 5 must keep the new
  3D chunk separate from that one, not add to it.

## Answers to the audit's explicit questions

| Question | Answer |
|---|---|
| Existing WebGL dependency? | None. |
| Canvas/WebGL allowed by CSP? | Yes — not gated by any CSP directive; existing CSP already forbids CDN/remote assets Phase 5 must avoid anyway. |
| WebView2 version/features assumable? | Chromium-based, evergreen, WebGL2-capable on any currently-supported Windows 10/11 install; no explicit minimum pinned in this project. |
| Minimum Windows target? | Not declared in this project's Tauri config — inherited from whatever WebView2 Runtime the user's Windows install provides. |
| GPU-disable/software-rendering scenarios? | Not configured for or against; must be handled defensively (context-loss + init-failure fallback), not assumed absent. |
| How is Dashboard mode lazy-loaded today? | `React.lazy(() => import(...))` per entry in `DASHBOARD_REGISTRY`, rendered only by `DashboardHost` when that mode is selected. |
| Reusable Provider Identity/theme primitives? | `CatalogTheme` (raw color fields), `resolveCatalogTheme`, `providerColors`, the existing provider-presentation Follow-Structure/Independent setting, and the `MotionLevel`/`motionEnabled` reduced-motion system. |

See also: [PROVIDERS_3D_ENGINE.md](PROVIDERS_3D_ENGINE.md),
[PHASE5_3D_PROTOTYPE.md](PHASE5_3D_PROTOTYPE.md).
