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

## Wave 2 integration and independent review

The recorder previously assigned refreshes to the first enabled profile account
and persisted a mutable `selected` display metric. That was not account or window
evidence. Schema v5 adds nullable account scope, physical window key and duration;
legacy rows are never backfilled. New observations hash provider-reported email
with organization context; organization-only and absent identity stay unresolved.
Physical primary, secondary, model-specific, tertiary and extra limits are recorded
independently. Invalid timestamps, invalid quota totals and unhealthy snapshots
are rejected. No Personal database was opened or migrated during development.

The additive `quotaHistory` carries closing capture time, duration, reset endpoint,
account scope and sample count over the requested and preceding equal-duration
periods. A fresh Astra read-only review found two P2 defects, repaired by the mother:

- Current provider summaries still read only retired `selected` rows. They now
  use physical primary observations and suppress old aliases once a provider has
  physical history. Legacy-only providers retain explicitly dated old summaries.
- Bucket closing values erased conflicting timestamps and hidden counter decreases.
  Raw observations are sorted; exact duplicates do not increase coverage. Conflict
  and counter-decrease flags survive aggregation and serialization. TS rejects
  conflicting metrics and suppresses velocity after a hidden decrease.

The legacy `usageTrend` remains historical only, explicitly labeled in the UI. It
is not appended to or silently spliced into physical history. Monetary observations
keep their independent existing contract and history series.

Comparison means difference in bucket-close quota-state means, in percentage
points, across equal elapsed spans; it is NOT consumption. It requires observed
identity, known physical duration, four distinct buckets per period, endpoint
sampling support and bounded gaps. Velocity is percentage points per elapsed hour
within one explicit reset cycle, at least four observations and one hour, with no
counter decrease. No forecast, token-rate conversion or interpolated heatmap exists.

Evidence: 55 core dashboard-data tests after recovery; 115 affected frontend tests.
The earlier full Rust run passed before the review repairs; final integrated gates
are still required. Current targeted results are not final product acceptance.

## Waves 3–6 implementation in progress

Shared analytical section/table/coverage/ribbon/gauge/time-series primitives reuse
existing theme tokens. Reset Horizon positions future provider resets on a linear
24-hour/7-day scale with the full schedule available as a sortable DOM table.
Physical history charts use actual observation times and break at gaps/resets.
Legacy line charts now preserve time spacing when timestamps are supplied, break
large gaps, retain a single point, and expose keyboard tooltips. Bar/line styles
share the persisted chart-style context; no dependency was added.

Analytics preferences are normalized in Rust and TS: section order/visibility,
default range, chart style, quota template and filter scope. Workspace density adds
dense. The Settings Center keeps legacy tab IDs and provider/profile models intact.
Demo controls live only in Settings/Dashboard; Demo filtering no longer replaces
current observations with historical averages or hides missing requested history.
Generated physical history is deterministic and never persisted.

Initial synthetic CPU benchmark (Node24 Windows, five measured samples after one
warmup, 70 fixture series): 1k/25k/100k rows ~3/52/189ms median for range+chart prep.
This is NOT native frame timing or production history throughput. Raw output:
`.local/v2-analytics-benchmark.json`. Final native performance/evidence remain open.


### Owner correction L10 — hierarchical navigation
The owner rejected the sparse five-destination presentation and duplicate Settings category rail during native review. Existing destinations now appear as inline children under expandable Workspace and Settings branches in the primary navigation. No extra select/dropdown navigation was added. Search remains in the editor and only displays result links while a query is entered. Existing tab IDs, settings storage and editor scopes are preserved.

Root cause of the half-empty Settings screenshot: legacy `.settings-body[data-tab=general]` two-column CSS placed the new SettingsShell wrapper into one outer grid cell. The shell now occupies the full content width; a grid inside its editor owns General/Notifications/Advanced cards. Language and Appearance occupy the first row; logo identity spans the next row.

Validation after navigation change: 992 frontend tests across 165 files passed; TypeScript clean; native Dev rebuild successful before the final General grid placement adjustment, which is being rebuilt. The previous full Rust gates remain valid for this frontend-only correction: desktop 469 passed/1 existing ignored, core 1637 passed, CLI 1 passed; Clippy warnings denied and formatting passed. Native visual review remains ongoing; no overall Product V2 PASS is asserted here.


L10 native verification completed on the rebuilt Dev binary (SHA-256 `F4DA2DFE1C18A3BB3203ACF2411D4A24C1C9934FE4A4E7D827AEF27780EB4C5D`). The final General first-row placement was visually inspected at 1280×730 CSS pixels. Expansion and collapse were exercised in the real native window. Actual native frame resizing produced 520×669 RTL and 720×669 LTR content viewports, each without document horizontal overflow. CUA frame readback at 520 reported `unverifiable`, but the native page independently reported the actual 520px viewport; no CDP emulation was used. Evidence is under `docs/images/product-v2/QUOTALIS_V2_SETTINGS*.png`. Dev presentation settings were restored after proof; Personal was not launched or changed by this work.

The L10 navigation correction is implemented and available for owner visual review. This is not an overall PRODUCT V2 PASS: the remaining broad performance/customization matrix and full native evidence report are still open. The Arabic screenshot also exposes an existing untranslated Appearance fallback, which remains a localization follow-up rather than a claimed complete Arabic audit.
