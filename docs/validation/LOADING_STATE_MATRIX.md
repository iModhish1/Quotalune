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

## Wave 1D: Floating Structures wired (partial), other surfaces still open

Wave 1D §10 closed the one integration explicitly marked "required for
Wave 1": **Floating Structures' own first-load state.** FlowSurface,
ReelSurface, and NotchSurface previously showed the identical text
("Waiting for provider data" / "No quota data" / "No data") whether the
first provider fetch simply hadn't returned yet or there was genuinely
never going to be any data. A new `initialLoading` prop (threaded through
all 14 forms via the existing FlowSurface delegation, wired from the real
production caller `TopArc.tsx` via `useStageRuntime`'s new
`initialLoading` field — itself a thin derivation of `useProviders`'
already-existing `hasLoadedCache` signal) now shows a distinct, localized
`QuotalisStructureLoading` message during the real first-load window,
same DOM shape either way (no silhouette resize). This does NOT use the
`QuotalisAsyncState` component itself (the structure's own compact
silhouette has no room for a full skeleton block without geometry
changes not made this wave) — it reuses the same localization/distinct-
message *principle* the shared component enforces, applied to the
existing text-swap mechanism. 6 tests (2 per render path) prove the
distinct message appears during `initialLoading` and the prior message is
unchanged once it resolves.

**Still genuinely open**: `QuotalisAsyncState`/`QuotalisSkeleton`/
`QuotalisRefreshingBadge` themselves are still not wired into any
Dashboard/provider/reset/Analytics/connection-action surface — items A-C
and E of Wave 1D §4 remain real, unstarted work, same honesty standard as
before. No exhaustive per-surface matrix walk was performed.

## What is genuinely open (not fixed or built this wave)

- **`QuotalisAsyncState`/`QuotalisSkeleton`/`QuotalisRefreshingBadge` are
  still not wired into Dashboard/provider/reset/Analytics/connection-action
  surfaces.** Migrating those — and native-verifying each — is real,
  unstarted follow-up work.
- **No exhaustive per-surface matrix.** This audit spot-checked the shared
  Analytics data hook and confirmed the vocabulary/pattern exists; it did
  not walk every listed surface (provider connect, Data Sources, background
  import, notification history, Tray source preview, local scanner) and
  record its exact seven-state behavior with evidence.
- **Reduced motion for a real production consumer** was not separately
  verified this wave beyond the component-level CSS guard already in
  place (`QuotalisLoadingStates.css`'s `prefers-reduced-motion`/
  `data-qa-motion` rules) — no real consumer exists yet to test it in.

## Verdict

LOADING UX: **PARTIAL** — the hard architectural rule (don't blank valid
cached data on same-scope refresh; keep loading/unavailable/zero/error
distinct) is already correctly implemented in the shared data layer.
Wave 1B FINAL added the real, tested shared visual-language component
set; Wave 1D wired the one Wave-1-required integration (Floating
Structures' first-load distinction) into all 14 forms. Still open:
wiring the shared component set into Dashboard/provider/reset/Analytics/
connection-action surfaces, an exhaustive per-surface matrix, and native
visual verification of any of it. Not claimed as PASS.
