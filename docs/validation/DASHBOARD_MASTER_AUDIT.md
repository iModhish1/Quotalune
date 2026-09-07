# Dashboard Studio — Current-State Audit (Phase 0)

Date: 2026-09-07. Repo: `N:\QuotaArc\quotaarc`, branch `feature/v9-theme-runtime`,
HEAD `0053e6dc` at time of writing. This is Phase 0 of the owner's Dashboard
Studio mega-request (`tasks/MASTER_REQUIREMENTS.md` section I) — a pure
inventory of what exists today, so later phases build on real architecture
instead of guessing. Every claim below is evidence-based (file:line), produced
by a dedicated Explore pass over the actual working tree — no assumptions
carried over from memory of other sessions.

## 1. Current Dashboard implementation

The Dashboard has **one fixed layout**, shared by two surfaces via one
component:

- [`components/DashboardBody.tsx`](../../apps/desktop-tauri/src/components/DashboardBody.tsx:19) — the actual content: `ProviderGrid` (switcher grid) → `CatalogUsageHero` (themed orbital usage view, 2D SVG/CSS despite the "orbital" name — see section 3) → a divider → the full `MenuCard` stack, one per visible provider. Falls back to `MenuEmpty` when there are zero providers.
- [`surfaces/PopOutPanel.tsx`](../../apps/desktop-tauri/src/surfaces/PopOutPanel.tsx:31) — the detached "Open Dashboard in Separate Window" secondary path (window chrome, webview zoom scaling, footer Settings/About/Quit, standalone keyboard shortcuts).
- [`surfaces/settings/tabs/DashboardTab.tsx`](../../apps/desktop-tauri/src/surfaces/settings/tabs/DashboardTab.tsx:25) — the first-class in-shell Settings tab (no window chrome), built this session to fix the "Dashboard opens a separate window" regression.

**No Dashboard Studio / mode-registry / widget-registry concept exists
anywhere** — `DashboardStudio`, `DashboardMode`, `DashboardDefinition`,
`widgetRegistry` all return zero hits across the whole repo. Building the
registry the spec asks for (section "DASHBOARD STUDIO — CORE PRODUCT MODEL")
is a from-scratch addition, not an extension of an existing pattern.

## 2. Charting

**No charting library dependency exists** (`apps/desktop-tauri/package.json`
has no recharts/chart.js/d3/victory/nivo/visx). Every chart today is a
hand-built, dependency-free inline-SVG component:
[`components/charts/LineChart.tsx`](../../apps/desktop-tauri/src/components/charts/LineChart.tsx:1),
`BarChart.tsx`, `chartPalette.ts`, `useChartAnimation.ts` (shared
`prefers-reduced-motion`-aware animation hook), plus the Settings → Providers
detail-pane charts in
[`surfaces/settings/providers/sections/charts/ChartsSection.tsx`](../../apps/desktop-tauri/src/surfaces/settings/providers/sections/charts/ChartsSection.tsx:1)
(cost/credits/tokens/usage-breakdown tabs). Per the repo's own dependency
policy (no new dependency unless the current stack can't solve it cleanly,
prefer existing deps first): any new Dashboard analytics chart should extend
this in-house SVG toolkit, not pull in a chart library.

## 3. 3D / WebGL

**Confirmed zero 3D/WebGL dependencies or usage anywhere in the frontend.**
No three.js, react-three-fiber, babylon, pixi, or WebGPU. The existing
"orbital" visuals (`CatalogUsageHero`, `OrbitTexture`, `EdgeOrbitStage`,
`TopOrbitStage`) are all 2D SVG/CSS despite the orbit/orbital naming — a "3D
Providers Dashboard" is a genuine from-scratch engine addition (new
dependency + render pipeline + disposal lifecycle), not a reskin of anything
that exists today. This is the single largest, highest-risk piece of the
whole spec.

## 4. History / analytics data

- [`rust/src/history.rs`](../../rust/src/history.rs:1) — a real, schema-ready
  local SQLite store (`&lt;config&gt;/history.db`, WAL mode) with a
  `usage_samples` table (`account_id`, `provider`, `window_id`,
  `used_percent`, `remaining_percent`, `cost_used`, `resets_at`,
  `captured_at`), a 45s dedup window, and a `DEFAULT_RETENTION_DAYS = 90`
  constant.
- **Critical finding: this store is currently unwired.** `HistoryStore` /
  `UsageSample` / `record_samples` / `prune` have **no callers anywhere else
  in the codebase** — no provider-refresh path, Tauri command, or scheduled
  job writes to it today. It is dead infrastructure, not a populated data
  source. Any Dashboard Studio history/trend feature must first wire this up
  (decide the write trigger, decide retention as a real settings field — none
  exists today) before there is real history to show.
- **No generic daily/weekly/monthly rollup engine exists.** What's there is
  narrow and source-specific: `codex_workspaces` has its own `DailyPoint`
  aggregator over local Codex session logs; `cost_scanner`/`jsonl_scanner`
  builds its own day-keyed aggregate from JSONL scans; `spend_contract` has
  its own bounded-lookback aggregator. None of these read from
  `usage_samples`, and none would directly power a general "Today / 7 days /
  30 days / Year / Custom" range picker as specified.

## 5. Pricing architecture

- [`rust/src/core/cost_pricing.rs`](../../rust/src/core/cost_pricing.rs:9) —
  `CODEX_PRICING`/`CLAUDE_PRICING`: hardcoded `LazyLock<HashMap>` constants,
  bare `input_cost_per_token`/`output_cost_per_token` numbers. **Zero
  provenance fields** — no `source`, `last_verified`, or `confidence` on the
  struct at all. This is exactly the kind of value the owner's spec says not
  to trust without a source; today there is no source recorded for any of it.
- [`rust/src/core/models_dev_pricing.rs`](../../rust/src/core/models_dev_pricing.rs:189) —
  a separate remote-catalog fallback (fetches `models.dev/api.json`, 24h TTL
  disk cache with a real `fetched_at_unix_ms`) used only when a model misses
  the static tables. Its `refresh_unknown_models_if_needed` function has
  **zero callers** — unwired, same pattern as history.rs.
- **No manual "check pricing updates" command exists anywhere** — no Tauri
  command, no settings UI action. The spec's "Pricing & Data Status" /
  "Check Pricing Updates" section is a genuine new build, and per the spec's
  own instruction, its `Verified`/`Possibly stale`/`Unavailable`/`Custom`
  states can't be populated honestly until real provenance metadata is added
  to `cost_pricing.rs` first.

## 6. Theme system

**23 active Structure Theme catalog entries** exist today
([`design-system/themeCatalog.ts:99`](../../apps/desktop-tauri/src/design-system/themeCatalog.ts:99),
canonical `01-obsidian-orbit` + 7 hand-authored + 15 generated from
`themeCatalogExpansion.ts` seeds), plus a 14-entry archived/inactive list kept
for compatibility only. None of the spec's requested "Obsidian
Archive/Aged Silver/Antique Gold/Lunar Slate/..." names exist yet as such —
that's new palette work layered on the existing catalog mechanism, not a
system rebuild.

**Provider Presentation independence (Follow Structure vs Independent) is
real and already fully shipped** —
[`design-system/limitPresentation.ts`](../../apps/desktop-tauri/src/design-system/limitPresentation.ts:1)
(`LimitPresentation` type, 24 identities including the `'adaptive'` =
"Follow Structure" sentinel, `resolveLimitPresentation` provider-override
resolution) plus the
[`ProviderIdentityGallery.tsx`](../../apps/desktop-tauri/src/surfaces/settings/tabs/ProviderIdentityGallery.tsx:27)
settings UI showing "Following `&lt;structure theme&gt;`" vs "Independent —
`&lt;identity&gt;`" provenance text. Dashboard Studio's "Provider Presentation:
Follow Structure / Independent" requirement is **already satisfied
end-to-end** — nothing new to build here, only to make sure the 3D/Hybrid
dashboards consume this existing system rather than inventing a parallel one.

## 7. Performance / settings infrastructure

**No dashboard-rendering performance preset exists.** The two settings that
sound related — `adaptive_refresh`/`refresh_interval_secs`
([`settings.rs:648`](../../rust/src/settings.rs:648)) and
`low_power_mode_preference`
([`settings.rs:659`](../../rust/src/settings.rs:659)) — both govern **provider
data refresh cadence** (network polling), not UI rendering fidelity. A "Low
CPU / Balanced / High Fidelity" *dashboard* preset (animation density, chart
transition complexity, future 3D render scale) is a genuinely new, distinct
concept with no existing field to extend.

**Reduced-motion handling is extensive and real** — `prefers-reduced-motion`
is honored in ~20 places already, including a shared
[`useChartAnimation.ts:91`](../../apps/desktop-tauri/src/components/charts/useChartAnimation.ts:91)
hook. Any new Dashboard performance/animation work should compose with this
existing layer, not duplicate it.

## 8. Error presentation on the current Dashboard

**Confirmed exactly as the owner flagged from the screenshot.**
[`components/MenuCard.tsx:258`](../../apps/desktop-tauri/src/components/MenuCard.tsx:258)
renders `provider.error` verbatim into `.menu-card__error-text`, with only a
copy-to-clipboard affordance — no severity tiers, no friendly-message layer.
**No cross-provider friendly-error/severity system exists** — the only
related code is one OpenAI-web-dashboard-specific message cleaner
(`providers/openai/friendly_errors.rs`) that isn't wired into `MenuCard` at
all. Building the spec's "Claude — Authentication required [Reconnect] /
View technical details" card is real, needed, bounded work with a clear
target (`MenuCard.tsx:258`) and no existing generic layer to conflict with.

## 9. Density / spacing tokens

Already exists exactly as the spec asks:
[`design-system/tokens.css:101`](../../apps/desktop-tauri/src/design-system/tokens.css:101)
defines `--qa-space-1` through `--qa-space-8` (4/8/12/16/20/24/32px). Any
Dashboard density work should consume these tokens directly.

## 10. Profiles / Collections

Both real, already-shipped, **local-only** features following the same
shape every new Dashboard Studio persisted concept should follow: a
Rust-owned store/command set (`rust/src/profiles.rs`,
`surfaces/collections/collectionModel.ts`) surfaced through a thin React
Settings tab (`ProfilesTab.tsx`, `CollectionsTab.tsx`). No cloud, no account,
no subscription anywhere in either — consistent with the owner's absolute
local-first constraint.

## What this means for the 13-phase plan

Reading the audit against the owner's phase list:

- **Phase 1 (normalized dashboard data)** and **Phase 2 (dashboard
  registry)** are genuinely greenfield — nothing to reuse, straightforward
  to scope once started.
- **Phase 3 (2D Analytics)** is buildable on the existing in-house chart
  toolkit (section 2) but needs real history data first (section 4) — a
  2D analytics dashboard showing trends from an unwired, empty history store
  would either show nothing or (worse) fabricate numbers, which the owner
  explicitly forbids. **Wiring `history.rs` into the provider-refresh path is
  a hard prerequisite for Phase 3**, not optional polish.
- **Phase 4 (pricing audit)** needs the provenance fields added to
  `cost_pricing.rs` before any `Verified`/`Possibly stale` state can be shown
  honestly — today there is literally no source/timestamp to check.
- **Phase 5/6 (3D prototype/production)** is the largest single risk in the
  whole spec: a real WebGL/3D engine from zero, with disposal-lifecycle and
  performance requirements (idle-quiet render loop, dispose-on-switch,
  144→0 FPS discipline) that need their own dedicated performance-testing
  pass before any provider-count scaling work.
- **Phase 7 (Hybrid)** composes 3 and the analytics subset from Phase 3 — it
  cannot start meaningfully before both exist.
- **Structure Theme (23 entries) and Provider Presentation independence are
  already done** — sections 6 confirms the owner's constraint ("Provider
  Presentation owns X, Structure owns Y, no bleed") is not new work, just a
  system to keep respecting.
- **Phase 8 (color/material refinement), 9 (customization), 11
  (RTL/accessibility), 12 (native proof), 13 (release)** all depend on 1-7
  existing first.

## Honest scope for this turn

Given the size of what's above — a from-scratch 3D engine, wiring a dead
history store into live data collection with real retention settings,
adding pricing provenance and a verification workflow across every
provider/model, a widget/layout customization system, and native screenshots
across every mode × theme × performance-preset combination — this cannot be
responsibly compressed into a single turn without fabricating completion.
This document is Phase 0 only. See the session's final report for the
recommended next concrete step.
