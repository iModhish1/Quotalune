# Loading / Refreshing / Unavailable UX Audit — 2026-09-15 (partial, component set now implemented)

## Scope and honesty note

Wave 1B FINAL implemented the shared component library this audit
previously described as unstarted work (§38):
`design-system/QuotalisLoadingStates.tsx`/`.css` — `QuotalisAsyncState`
(loading/noData/unavailable/error/timeout), `QuotalisSkeleton`, and
`QuotalisRefreshingBadge`, reusing `DashboardHost.css`'s existing
obsidian/titanium shimmer material rather than inventing a second visual
language, with `prefers-reduced-motion` and the app's own
`data-qa-motion="reduced"|"off"` attribute both honored. 10 unit tests
prove the five `QuotalisAsyncState` statuses render distinct DOM/markup
(not just distinct prop values), that Retry is offered only for
error/timeout (never noData/unavailable, which are not retryable
failures), and that error/timeout use `role="alert"` while noData/
unavailable use `role="status"`.

**Still genuinely open, not claimed done**: this component set is not yet
wired into any of the real Dashboard/provider/reset/structure/connection
surfaces listed below — each of those already has its own working
(if inconsistent) loading treatment tied to locale strings and, in
Analytics' case, data logic this wave was explicitly told not to touch
("Do not rewrite Analytics data logic, only unify presentation" — §47).
Migrating a real surface to the shared component set safely needs the same
native-verification cycle this document has consistently required before
claiming a UI change is correct, which was not performed this wave. So:
the shared library itself is real and tested; using it everywhere is real,
unstarted follow-up work, same honesty standard as every other item in
this file.

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

- **The shared component set exists and is tested (see above) but is not
  wired into any real surface yet.** Migrating Dashboard/provider/reset/
  structure/connection surfaces to it — and native-verifying each — is
  real, unstarted follow-up work.
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
independently verified in a prior phase's test suite. Wave 1B FINAL added
the real, tested shared visual-language component set the owner
specifically asked for (§38-40) — genuinely new, not merely re-described.
Still open: wiring that component set into real surfaces, an exhaustive
per-surface matrix, and native visual verification of any of it. Not
claimed as PASS.
