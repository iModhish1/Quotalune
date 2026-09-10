# Claude cross-surface provider-truth consistency audit — 2026-09-10

Wave F §31. Static-code audit (real source read, not assumed) of whether
Dashboard, Analytics, Providers, Usage & Spend, and Provider Display all
derive provider truth from the same resolvers, rather than each surface
computing or interpreting usage/remaining/plan/connection/freshness/
monetary semantics independently.

## Shared resolvers found

- `lib/providerState.ts` — `describeProviderState()`, maps the backend
  `errorState` wire enum to a label/problem descriptor.
- `lib/analytics/freshness.ts` — `observationFreshness()`, the single
  source for fresh/aging/stale/unavailable classification (cadence-
  relative, not a fixed cutoff).
- `lib/analytics/currentProviders.ts` — `physicalQuotaWindows()`
  (validated 0–100 window selection) and `currentProviderModel()`
  (per-provider `ready`/`windows`/`highest`/`resets`/`freshness`), built
  on `observationFreshness`.
- `lib/usageWindows.ts` — `selectSingleMetricUsageWindow()` for
  single-metric surfaces.
- `lib/providerMonetaryKind.ts` — `providerMonetaryQuantityKind()`, the
  one 24-provider Spend/Balance/Credits/Unknown table (mirrors
  `rust/src/dashboard_data.rs`).
- `lib/analytics/quotaAnalytics.ts` — history/trend series builder
  (`buildQuotaAnalytics`), used by Analytics-only trend widgets.
- `surfaces/settings/providers/providerOperationalState.ts` —
  `providerOperationalState()`, Providers-page-specific status
  derivation, itself built on `observationFreshness`.
- `hooks/useProviders.ts` / `useEffectiveProviders.ts` — the one live/
  demo data source every surface consumes.
- `components/orbit/usageTone.ts` — `usageTone()`, fixed-threshold
  (≤10%/≤20% remaining) visual urgency for the usage-window widget.

## Which surface uses what

| Data point | Dashboard | Analytics | Providers | Usage & Spend | Provider Display |
|---|---|---|---|---|---|
| usage% | `physicalQuotaWindows()` | `currentProviderModel`/`physicalQuotaWindows`/`buildQuotaAnalytics` | `selectSingleMetricUsageWindow()` + `physicalQuotaWindows()` | N/A — local token-cost estimate, not live quota | N/A — static `73%` mock preview |
| remaining% | same window object | same | same | N/A | N/A (mock preview) |
| plan | raw `snapshot.planName` (no interpretation to diverge) | same | same | N/A | N/A |
| connection/state | `errorState==="ready" && !error` | same, plus `describeProviderState` in `ProviderIssueNotice.tsx` | `providerOperationalState()` (folds freshness in) | N/A | N/A |
| freshness | `observationFreshness` via `currentProviderModel` | same | `observationFreshness` directly | N/A (local-log recency, different concept) | N/A |
| monetary kind | `providerMonetaryQuantityKind()` | `costContract.quantityKind` (same enum) | `providerMonetaryQuantityKind()` in `CostSection.tsx` | Always locally-computed "spend" (own `SpendContract` domain) | N/A |

All surfaces that render real provider truth (Dashboard, Analytics,
Providers, provider-detail `CostSection`) route usage%, remaining%,
freshness, and monetary kind through the same three resolvers
(`currentProviders.ts`, `freshness.ts`, `providerMonetaryKind.ts`) by
direct import. Plan and connection state are read straight off the same
bridge/backend-classified fields everywhere — no local reinterpretation
to drift.

**Usage & Spend** and **Provider Display** are legitimately out of this
resolver's scope, not careless omissions: Usage & Spend shows a
Rust-computed local-log cost estimate (`SpendContract`/
`getUsageSpendSummary`) — a different domain from live-quota Spend/
Balance/Credits, with its own `contract.provenance`/
`priceCoverageRatio` honesty fields. Provider Display components render
only static/synthetic preview data to preview visual style choices —
they never touch real provider snapshots.

## Duplication found (documented, not fixed — no value-mismatch bug)

1. **Usage-tone/alert-threshold classification duplicated** between
   `dashboardSelectors.ts:116-124` (`buildAlerts`) and
   `ProviderUsageMatrix.tsx:25,37` (inline ternary + legend). Both are
   driven from the same `settings.highUsageThreshold`/
   `criticalUsageThreshold` and the same `>=` comparison, on numbers
   already range-constrained the same way — structurally duplicated,
   not functionally divergent today, but a future threshold-rule change
   in one spot without the other would silently drift. Worth a shared
   `usageLevel(used, settings)` helper if this area is touched again;
   out of scope for this audit pass (no broad refactor).
2. **Two independent "is this provider OK" classifications** at
   different granularity, both anchored to the same `errorState`/
   `observationFreshness` primitives but not unified:
   `currentProviderModel().ready` (Dashboard/Analytics, binary, ignores
   staleness) vs. `providerOperationalState()` (Providers page, folds
   staleness into a distinct `stale` state). This is a **designed**
   granularity difference — Providers needs finer status chips — not a
   bug, but means a stale-but-`errorState:ready` provider shows "ready"
   on Dashboard/Analytics and "stale" on Providers, intentionally.
3. `usageTone()`'s fixed ≤10%/≤20%-remaining thresholds vs. the
   user-configurable alert thresholds are two intentionally separate
   concepts (per-widget visual urgency vs. dashboard alert config), not
   duplication of the same rule.

## Verdict

**CROSS-SURFACE CONSISTENCY: PASS.** No case found where two surfaces
would render a different usage%, remaining%, plan, connection state,
freshness, or monetary kind for identical underlying provider data.
Nothing changed — the duplication findings above are structural/
documented, not fixed, per this pass's explicit scope (fix only a
proven value-mismatch bug, not cosmetic duplication).
