# Demo Mode — Architecture (Phase 5.2)

A first-class, user-accessible product feature (Settings > Dashboard
Studio > "Demo & Preview") that lets any user preview Quotalis with
simulated provider data without connecting real accounts. Default off;
never gated behind `import.meta.env.DEV` or any developer flag —
distinct from the engineering-only `?window=providers3d-lab` fixture
lab (`docs/validation/PHASE5_3D_PROTOTYPE.md`), which remains available
separately for stress testing.

## Settings

Mirrors `quotalis_core::settings::{DemoProviderMode, DemoScenario}` (Rust)
and `types/bridge.ts` (TS), following the exact pattern already
established by `DashboardModeId`/`DashboardPerformancePreset`:

| Setting | Type | Default |
|---|---|---|
| `demoModeEnabled` | bool | `false` |
| `demoProviderMode` | `"curated" \| "custom"` | `"curated"` |
| `demoProviderCount` | u32, clamped 1-24 | `6` |
| `demoProviderIds` | `string[]` (custom mode only) | `[]` |
| `demoScenario` | one of 6 scenarios | `"connectedShowcase"` |
| `demoSeed` | u64 | `1` |
| `demoHistoryDays` | `7 \| 30` | `7` |

Global, not profile-scoped (a preview mode, not an account
configuration — switching profiles never secretly carries fake accounts
with it). A corrupt/out-of-range on-disk value never produces a
degenerate state: `demo_provider_count: 0` falls back to the real
default of 6 (not clamped to the floor of 1, which would still be a
near-empty showcase); `demo_history_days` normalizes anything that isn't
exactly `30` down to `7`. These fields are CONFIGURATION only — nothing
in this system ever writes a generated observation anywhere persistent.

## Data layer (`apps/desktop-tauri/src/demoMode/`)

The one authoritative source of Demo Mode's synthetic data, pure and
fully deterministic:

- **`rng.ts`** — a mulberry32 seeded PRNG (`createRng(seed)`) plus
  `deriveSeed(rootSeed, key)`, which derives an independent-looking
  sub-stream per `(provider, field)` pair from one root seed. No
  `Math.random()` anywhere in this module tree.
- **`constants.ts`** — the six real, registry-verified default curated
  providers (`codex`, `claude`, `gemini`, `perplexity`, `grok`,
  `deepseek`) and the 1-24 bounds.
- **`curatedProviders.ts`** — `selectCuratedProviderIds(count, catalog)`
  deterministically extends past the default six using the real
  registry catalog (never an invented id), and `displayNameFor` reads
  the real catalog display name.
- **`scenarios.ts`** — `buildScenarioProfile(scenario, index, rng)`
  returns a `{usedPercent, errorState, resetOffsetMs}` recipe per
  scenario (Connected Showcase's default six use a fixed example spread
  rather than the RNG; every other scenario draws from the seeded RNG).
  `trendShapeFor(index)` cycles through five named history-curve shapes
  (gradual rise, stable, late spike, reset cycle, moderate oscillation)
  so the generated 7/30-day history looks intentional, never like noise.
- **`providerSnapshots.ts`** — `buildDemoProviderSnapshots(config,
  catalog, now)`, the one function every consumer calls for the current
  live-shaped array. `resolveDemoProviderIds` handles curated/custom
  selection, with the "Monetary Semantics" scenario always overriding to
  its fixed four real providers (`claude`/`codex`/`sub2api`/`gemini` —
  one of each real quantity kind, verified in `sceneModel.ts`'s
  classification table, plus one genuinely unclassified provider).
  `demoCostFor` only ever produces a synthetic `cost` object for a
  provider `providerMonetaryQuantityKind` classifies as
  spend/balance/credits — an unclassified provider always gets `cost:
  null` (Unavailable), exactly like real data.
- **`dashboardSnapshot.ts`** — `buildDemoDashboardSnapshot(config,
  catalog, range, now)` builds the same `DashboardSnapshot` shape
  `get_dashboard_snapshot` returns, including a real `costContract` (only
  claims `quantityKind: "spend"`, `availability: "available"` when a
  real spend-classified provider exists in the dataset) and per-provider
  usage-trend history shaped by `trendShapeFor`.

Every generated `ProviderUsageSnapshot` carries `sourceLabel: "demo"` (a
value no real adapter ever emits) as a low-level honesty signal in
addition to the provenance flag below.

## Data provenance (orthogonal to Phase 4's monetary model)

Demo Mode does **not** add a third value to Phase 4's `MonetaryQuantityKind`
(`spend`/`balance`/`credits`/`unknown`) or touch `dashboard_data.rs`'s
classification table. Instead, provenance is a separate concept: a demo
observation still semantically means exactly what its real quantity kind
says (Spend, Balance, Credits, or Unavailable) — Demo Mode only changes
*where the data came from*, never *what it means*. This is carried by
`DataProvenance` (`hooks/useEffectiveProviders.ts`): `"live" | "demo"`,
returned once per effective-data-source resolution (not per provider,
since Demo Mode is all-or-nothing — never a mix of live and demo
providers in one array).

## Effective data source (the one switching layer)

Two hooks, both pure passthroughs to the real hooks when Demo Mode is
off (byte-for-byte unchanged behavior):

- **`useEffectiveProviders(settings, catalog, options?)`** — wraps
  `useProviders()`. Demo ON returns the synthetic array with **replacement**
  semantics (never merged with the live array); `useProviders()` is
  still called unconditionally (Rules of Hooks) but its result is simply
  not used while Demo Mode is on — no new network activity is triggered
  for demo providers, because they never pass through its fetch path at
  all.
- **`useEffectiveDashboardSnapshot(range, timezone, providers, settings,
  catalog)`** — the same pattern for `useDashboardSnapshot()`.

Both real Dashboard surfaces (`AnalyticsDashboard.tsx`,
`Providers3DDashboard.tsx`) consume these instead of the raw hooks — no
duplicated Dashboard implementation. `useDashboardState` (shared by
`AnalyticsDashboard.tsx` and `PopOutPanel.tsx`) gained a
`bypassEnabledFilter` flag: demo providers are never a subset of the
real profile's `enabledProviders`, so the profile-scoped filter (fixed
in an earlier Phase 5.1 follow-up) must be skipped for demo data or it
would filter the whole synthetic dataset away.

## UI surfaces

- **Settings** (`demoMode/DemoSettingsSection.tsx`, mounted inside
  `DashboardStudioTab.tsx`): the enable toggle, Curated/Custom mode with
  a searchable multi-select picker over the real registry catalog, a
  provider-count stepper (clamped 1-24, disabled at the bounds),
  scenario selection, 7/30-day history, "Regenerate Demo Data"
  (increments `demoSeed` — deterministic, never random), a live
  configuration summary, and an "About Demo Data" disclosure. Uses
  `useOptionalLocale()` with an inline English fallback per string
  rather than `useLocale()`, since `DashboardStudioTab` has never used
  the locale system and its own tests render without a
  `<LocaleProvider>` — this keeps those existing tests passing
  unmodified while still fully translating (Arabic included) inside the
  real app.
- **`demoMode/DemoIndicator.tsx`**: the one shared "this is simulated"
  indicator, rendered in both the 3D scene (`ProvidersUniverseScene.tsx`)
  and the 2D header (`DashboardAnalyticsPanel.tsx`) — "DEMO · N
  simulated providers" plus an "Exit Demo" action that only flips
  `demoModeEnabled` off (never clears the user's saved customization).
  `role="status"`, understandable without relying on color.
- **3D detail panel**: shows "Connected · Demo" instead of a bare
  "Connected", and a small `DEMO` pill next to the selected provider's
  name.
- **`AlertsPanel`**: a simulated auth-required/unavailable alert's action
  becomes a disabled "Demo state" button instead of a real "Reconnect"
  (which would otherwise open the real Providers tab implying a genuine
  credential flow).
- **3D scene bodies**: each carries a small, always-visible glyph label
  (a `THREE.Sprite` with a canvas-texture name tag) — added after native
  proof showed identically-shaped, unlabeled spheres were not
  distinguishable at a glance (see `PHASE5_DEMO_MODE.md`).

## Isolation guarantees

- **History**: demo observations never reach the production history
  recorder — `buildDemoProviderSnapshots`/`buildDemoDashboardSnapshot`
  are pure, in-memory, frontend-only functions with no code path into
  `history.db`.
- **Network/auth**: demo providers never pass through
  `refreshProviders`/`refreshProvidersIfStale` — there is no
  `providerId` in the demo array that maps to a real adapter fetch.
- **Notifications/tray**: the real desktop-notification watcher
  (`notifications.rs`) reads only the real backend provider cache, which
  Demo Mode never writes to — there is no code path connecting a
  frontend-only synthetic snapshot to that system, so this is a
  structural guarantee, not something that needs a runtime toggle to
  suppress.
- **Profiles/accounts**: Demo Mode never creates a provider account,
  modifies `ProfileStore`, or touches the real provider cache/credential
  store.

## Supported surfaces (Phase 5.2 scope)

Analytics 2D Dashboard, Providers 3D Dashboard, and their shared
provider navigator/detail views. Provider Display / Providers management
/ authentication configuration remain real-management surfaces Demo Mode
never touches or pretends to populate.

## Known limitations

- **History range**: Demo Mode always generates exactly
  `demoHistoryDays` of history regardless of the 2D Dashboard's selected
  range (Today/7 Days/30 Days/...) — selecting a wider range than
  configured does not generate more data; the real history chip still
  honestly reports the generated span.
- **Provider Display**: not integrated in this phase (owner section 44)
  — kept out of scope rather than duplicating fixture logic to force it.
- **Model-level analytics**: intentionally not simulated (Phase 3/4's
  product honesty about not claiming a Top-Models capability that
  doesn't exist).
