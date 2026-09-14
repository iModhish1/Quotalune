# Loading / Refreshing / Unavailable UX Audit — 2026-09-14 (partial)

## Scope and honesty note

This is a **partial** audit spot-checking the shared data layer and a
handful of representative surfaces, not the exhaustive full-matrix pass the
owner's request describes (every async surface × 7 states). Given this
wave's remaining time budget after the legal-quick-close and structure
consistency fix, a full implementation of a new shared visual loading
language (skeleton/shimmer/progress components, applied across every
surface, with native screenshot verification) was not attempted — that is
real, multi-day UI work requiring its own native QA cycle, not something to
claim done from a code read alone.

## What already exists (real, verified by reading the source)

**Shared data layer already does the hard part correctly.** The Analytics
surfaces' shared hook, `useDashboardSnapshot` (`hooks/useDashboardSnapshot.ts`),
already implements the owner's exact hard rule (§26/§27) for the most
important case — a same-scope refresh (e.g. the periodic `refresh-complete`
event) does **not** blank valid cached data:

```ts
return { snapshot: loaded?.key === requestKey ? loaded.snapshot : null, error, isLoading, reload: load };
```

`requestKey` is derived from `[range, timezone, providersKey]`. A refresh
triggered while range/provider stay the same keeps `requestKey` unchanged,
so the previously-loaded `snapshot` stays visible while `isLoading` is
`true` — exactly "keep cached data visible, show refreshing separately", not
"blank the whole card". A genuine range/provider **change** legitimately
returns `snapshot: null` until the new data arrives, which is correct (an
old range's data displayed under a new range's label would be misleading,
not merely stale). This was directly verified during the Phase 3N stale-
request work (`useDashboardSnapshot.test.ts`'s deferred-promise tests),
re-confirmed by reading the current source this session, not re-tested.

**Distinct-state vocabulary already exists in code**, matching §27's hard
rule (loading != unavailable != zero != error != stale):
`DataStatusPanel.tsx` has a dedicated `unavailable` status key
(`DashboardDataStatusCostUnavailable`) distinct from a zero value; the
Analytics Superstack phases (closed, see `docs/validation/ANALYTICS_PHASE3*`)
established "missing != zero" as an explicit, tested invariant across cost/
token/quota data — not something this audit needs to re-establish.

**Some skeleton/loading primitives already exist** — `DashboardHost.tsx`/
`.css` has skeleton-class styling; multiple Analytics panels
(`AlertsPanel`, `CurrentLimits`, `KpiRow`, `LocalActivity`, `ModelAnalytics`,
`MonetaryAnalytics`, `ProviderOperationsTable`, `ProviderUsageMatrix`,
`QuotaInsights`, `ResetHorizon`, `TokenAnalytics`) each independently
reference `isLoading`/status-role patterns, per file. This is real existing
coverage, not a blank slate — but it is **per-component**, not a single
shared "one Quotalis loading system" component library the owner
specifically requests in §25.

## What is genuinely open (not fixed or built this wave)

- **No single shared loading-visual-language component.** Each surface
  implements its own loading/skeleton/spinner treatment independently.
  Building one shared component set (obsidian/titanium, silver highlight,
  restrained luminous edge, Dark+Light) and migrating every surface to it is
  real, unstarted work.
- **No exhaustive per-surface matrix.** This audit spot-checked the shared
  Analytics data hook and confirmed the vocabulary/pattern exists; it did
  not walk every listed surface (provider connect, Data Sources, background
  import, notification history, Tray source preview, local scanner) and
  record its exact seven-state behavior with evidence.
- **Floating structures' own loading state (§28)** was not audited or built
  this wave — a separate, smaller scope from the Analytics dashboard's data
  layer, using the `StageProvider`/`hasSurfaceQuotaValue` model instead
  (see `docs/validation/STRUCTURE_SYSTEM_AUDIT.md`).

## Verdict

LOADING UX: **PARTIAL** — the hard architectural rule (don't blank valid
cached data on same-scope refresh; keep loading/unavailable/zero/error
distinct) is already correctly implemented in the shared data layer and
independently verified in a prior phase's test suite; a unified shared
visual loading language and an exhaustive per-surface matrix remain open,
honestly not claimed done.
