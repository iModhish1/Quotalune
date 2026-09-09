# Quotalis Product V2 — architecture audit and execution contract

2026-09-09. Verified clean starting HEAD: `6fbe7a6b2f218a409f814638e30b9eb765d4f584`.
Branch: `feature/v9-theme-runtime`. Prior product work is accepted, not replaced.
One Analytics Dashboard; Dev only; no Personal changes or new chart dependency.

## Current evidence

| Area | Source and finding | V2 decision |
| --- | --- | --- |
| Primary navigation | `surfaces/settings/settingsTabs.ts` lists 16 peer destinations. `Settings.tsx` renders every preferences editor as a primary tab. | Five primary destinations: Dashboard, Usage & Spend, Providers, Workspace, Settings. Preserve every legacy editor ID as an internal deep link. |
| Workspace | `ProfilesTab.tsx` uses profileBridge/ProfileStore; Collections uses its own collection persistence. Profiles are membership, not resolved credential identities. | Combine management shell only, retain independent models and commands. |
| Settings | `GeneralTab` mixes navigation/density, logo, startup/language, notifications by mode; `DisplayTab` splits menu/menuBar; Surfaces has its own controller. | SettingsShell with searchable local category metadata and reusable controls, reuse real editors and persistence. |
| Theme | `ThemeGallery.tsx` uses `set_catalog_theme`; `themeResolution.ts` resolves surface > profile > global > default. Gallery has hardcoded English headings. | Retain 24-theme architecture, localize visible shell/editor language, no duplicate resolver. |
| Provider presentation | `ProviderDisplayTab.tsx` composes identities and usage rules; provider overrides already exist. | Global editor in Settings Appearance, provider overrides remain in Provider Display. |
| Reset | `ResetDisplaySection.tsx` uses dedicated validated global/surface commands and the production formatter, but many labels are hardcoded English. | Settings Limits & Reset, retain real preview/resolution and improve localization. |
| Shared settings | `useSettings` broadcasts, `WorkspacePresentation` projects density/motion; patch transaction serialized, settings publication atomic. | Extend authoritative persisted preferences, not a new local-only dashboard store. |
| Logo | `logoAppearance.ts` caches in localStorage but documents canonical Rust persistence and runtime sync. | Preserve projection; do not misidentify cache as a new authority. |
| Dashboard | `DashboardAnalyticsPanel.tsx`: fixed order, local default range, global current state separated from selected history. | Typed section layout and metric contracts, memoized model feeding templates. Preserve current/history distinction. |
| Analytics | `dashboardSelectors.ts`, `DashboardSnapshot`, `history.rs`: scope, bucket and monetary contracts need explicit review before new comparisons. | Fail closed on missing window identity/reset continuity; no counter delta across resets. |
| Charts | Dependency-free LineChart/BarChart + SVG primitives, hooks for locale and reset presentation. | Audit axes/gaps/tooltips; retain engine unless measured need proves otherwise. |
| Auth | Previous auth audit verified five interactive entrypoints; CLI Job Objects/deadlines and Copilot public challenge exist. No public cancellation/progress controller yet. | Explicit capability-driven header action, cancelable request lifecycle, no generic website as sign-in. |
| Demo | Shared deterministic generator and indicator; configuration duplicated in Providers and Dashboard Studio. | One configuration entry in Settings Dashboard; indicators remain on both data views. |

## Settings taxonomy and legacy routing

- General: `general` (startup, language, refresh/basic preferences).
- Appearance: `themes`, `providerDisplay` (Structure Theme, Provider Presentation,
  workspace density/effects; scopes stay explicit).
- Dashboard: `dashboardStudio` (layout/default range/style/performance/Demo).
- Limits & Reset: `resetDisplay` (reset and regional formatting).
- Notifications: `notifications` (existing event settings and thresholds).
- Navigation & Surfaces: `menuBar`, `menu`, `surfaces` plus navigation preference.
- Advanced: `advanced`, `about` (diagnostics, local data and version).
- Workspace children: `profiles`, `collections`.

Legacy tray/native tab IDs route into the parent shell and correct internal editor.
The backend whitelist need not discard or destructively rewrite persisted IDs.
Settings search matches local translated category/editor labels and declared
keywords. Metadata records setting authority, default, scope and affected surfaces;
it does not generate complex credential/theme editors or reset accounts.

## Controlled waves and acceptance

0. Audit all listed surfaces and actual analytics schema. Commit audit/ledger.
1. Simplify primary navigation and implement searchable Settings/Workspace shells;
   prove all legacy links resolve, keyboard/RTL navigation and local search.
2. Metric registry, availability and shared aggregation/comparison helpers;
   deterministic corpus for accounts/windows/resets/missing/invalid/monetary inputs.
3. Shared analytical frames/table/gauge/timeline with chart style invariance.
4. Dashboard V2 hierarchy, multi-window limits, attention, comparisons, reset horizon,
   coverage and persisted sections; no extrapolated or fabricated history.
5. Provider operations template and capability-driven connection lifecycle;
   synthetic cancel/timeout tests, no real credential submissions.
6. Audit all preference consumers, unify defaults/reset/scope and live propagation.
7. English/Arabic, keyboard, 520/720/normal/max/ultrawide and bounded history benchmarks.
8. Rebuild native Dev, capture requested board, full quality gates and final 31-item
   report with PASS only when required evidence exists. No next unrelated phase.

Each implementation wave runs affected tests, typecheck/build, locale parity,
Rust checks where affected and diff checks before the next dependent wave.
Native evidence is always from the rebuilt Dev executable. Source/fixture tests do
not establish external account-consent success or Unix process behavior.

## Risks and explicit limits

Historical primary-window percent may lack sufficient window identity to support
velocity or cross-period equivalence. That must be recorded as unsupported rather
than inferred from provider name. Cumulative spend is not per-range accrued spend.
Refresh freshness must follow configured cadence and known provider behavior;
manual cadence cannot imply a scheduled missed refresh. Optional forecasting and
heatmaps are conditional on valid evidence, not required decorative widgets.

Routing coordination currently cannot register an unknown root effort with the
local planner. Work stays conservative with one bounded child; no account-wide
coordination or root-effort change is claimed.
