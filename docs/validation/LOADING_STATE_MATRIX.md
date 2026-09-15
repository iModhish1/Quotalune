# Loading / Refreshing / Unavailable UX Audit — 2026-09-15 (partial, component set now implemented; Refreshing wired into Floating Structures)

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

**Still genuinely open (as of Wave 1D)**: `QuotalisAsyncState`/
`QuotalisSkeleton`/`QuotalisRefreshingBadge` themselves were still not
wired into any Dashboard/provider/reset/Analytics/connection-action
surface — items A-C and E of Wave 1D §4 remained real, unstarted work.
No exhaustive per-surface matrix walk had been performed.

## Wave 1E §12-21: Refreshing wired into Floating Structures (one real production consumer)

Wave 1E added an `isRefreshing` prop to `FlowSurfaceProps` (distinct from
`initialLoading`), threaded it from the real production caller
`TopArc.tsx` (`isRefreshing={!surfaceDemo.enabled && runtime.isRefreshing}`,
sourced from `useStageRuntime`'s pre-existing `isRefreshing` field, itself
from `useProviders`), and rendered it as a small additive
`QuotalisRefreshingBadge` (new `dotOnly` mode: same `aria-label` text,
no visible label text) in FlowSurface and Reel, and as an sr-only text
append in Notch (no new visual element — Notch's 8+ per-form
`.notch-demo` CSS position overrides made a blind visual addition too
risky; see the code comment in `NotchSurface.tsx`). This is now a real
**Loading vs. Refreshing** distinction proven through one real production
consumer (Floating Structures), not just component-primitive tests:
`initialLoading` (Wave 1D) shows the first-fetch message; `isRefreshing`
(Wave 1E) shows cached data with an additive dot badge, never blanking it
— 6+ new tests across `FlowSurface.test.tsx`/`ReelSurface.test.tsx`/
`NotchSurface.test.tsx` prove the badge only appears with cached data
present and never during `initialLoading`.

**Honest limit of this closure**: this proves Loading vs. Refreshing are
distinct in one real consumer. It does NOT prove Zero/No-Data/
Unavailable/Error/Timeout are all distinct in that same consumer —
`StageProvider.status` (`"ok" | "attention" | "offline"`) has no distinct
"error" value at the layer Structures consume (see
`lib/structureFixtures.ts`'s own doc comment for the full architecture
finding), so a Structure genuinely cannot distinguish "no data yet" from
"the last fetch errored" today. §20's full seven-state distinctness
requirement is therefore only partially closed by this one consumer;
Dashboard's `QuotalisAsyncState` usage (5 distinct statuses, unit-tested)
remains the more complete state-vocabulary proof, just not yet wired into
a production surface.

## Wave 1F §3-16: production surfaces wired (real consumers, not fabricated states)

Traced the actual hook/data shapes of Dashboard, Reset, Analytics, and
Provider-connection-action surfaces before writing any code (a dedicated
investigation, not assumption) — see each fix's own commit for the exact
file:line evidence. Real, non-fabricated fixes landed:

- **Dashboard/provider usage** (§4-5): `AnalyticsDashboard.tsx`'s
  `MenuEmpty` had `isLoading` hardcoded `false` — the spinner branch
  could never render on that call path, so a genuine first fetch and "no
  providers configured" were indistinguishable. Now uses
  `hasLoadedCache` from `useEffectiveProviders`, the same real signal
  Wave 1D already proved correct for Structures' `initialLoading`.
- **Real zero regression** (§8): confirmed, not newly built —
  `stageProviders.ts`'s `remainingOf()`/`windowRemaining()` already
  distinguish a real `0` from a `null` (absent) window; a `usedPercent:
  0` snapshot renders as a real zero, never as loading/unavailable. No
  code change needed; disclosed as verified rather than silently assumed.
- **Reset surfaces** (§9-10): `ProviderResets.tsx`'s `ResetDatum` model
  (`known`/`unavailable`/`unsupported`) already satisfies "never
  fabricate 0h/now/unknown" and already stays visible during a refresh
  (it lives inside `MenuCard`, which never unmounts on refresh — only
  gains a class/aria flag). Verified, not rebuilt.
- **Analytics** (§11): `DashboardAnalyticsPanel.tsx` now shows an
  additive `QuotalisRefreshingBadge` when `useEffectiveDashboardSnapshot`
  reports `isLoading` with a cached snapshot already present (a same-
  scope background refresh) — every chart/panel underneath stays
  rendered unchanged, no calculation/query contract touched. Proven with
  a real integration test that fires the actual `"refresh-complete"`
  event the hook listens for.
- **Provider connection actions** (§12): `busy` (action in flight) and
  `actionSequenceRef` (stale-result guard) already existed and already
  satisfy pending/single-flight/disabled-duplicate-activation. The one
  real gap closed: `ProviderIssueNotice.tsx` showed the same generic
  "privacy-safe detail" text for a Refresh timeout as for any other
  issue — now shows the shared `QuotalisLoadingTimeout` message when
  `lastError` is exactly `"Timeout"` (the same backend-confirmed signal
  reused throughout this wave), exact-match only so an unrelated error
  string can't misfire it.
- **Floating Structures Error/Timeout** (§13-14): `StageProvider.status`
  gained real `"error"`/`"timeout"` values, wired into NotchDetails'
  footer and FlowSurface/Reel's reset-row slot — see
  `STRUCTURE_VISUAL_QA_MATRIX.md` for the per-form detail.
- **MenuCard refreshing indicator** (§6): `.menu-card--refreshing`/
  `aria-busy` existed but had zero visible indication for sighted users
  (assistive-tech only, no CSS at all targeted the class). Added the
  same additive dot badge Structures use.

## Seven-state proof (§14) — what is and isn't representable, per source

| Concept | Dashboard (`MenuCard`/`useProviders`) | Analytics (`useDashboardSnapshot`) | Floating Structures (`StageProvider`) |
|---|---|---|---|
| Loading (first fetch) | REAL (`hasLoadedCache`) | REAL (`isLoading`, no cached snapshot yet) | REAL (`initialLoading`) |
| Refreshing (cached) | REAL (`refreshingProviderIds`) | REAL (`isLoading` + cached snapshot) | REAL (`isRefreshing`) |
| Available | REAL | REAL | REAL |
| Real zero | REAL (`usedPercent: 0` distinct from absent window) | REAL | REAL (`primaryValue: 0`, `status: "ok"`) |
| No data | REAL (`hasCachedData`) | REAL (`snapshot: null`, no error) | REAL (`initialLoading` false, no selected provider) |
| Unavailable | REAL (`errorState`, no error string) | N/A (no analytics-specific unavailable concept) | REAL (`status: "offline"`) |
| Error | REAL (`provider.error`, non-"Timeout") | UNSUPPORTED — `.catch()` collapses every failure into a generic string; no distinguishable error state | REAL (`status: "error"`) |
| Timeout | REAL (`provider.error === "Timeout"`) | UNSUPPORTED — same collapse as Error above | REAL (`status: "timeout"`) |

Analytics' four sub-panels (Overview/Tokens/Models/Activity) each do
their own local fetch with a generic `error: boolean` — none exposes a
distinguishable timeout signal at the TS boundary today (confirmed by
reading `commands/providers.rs`'s equivalent history-fetch path, which
has no `tokio::time::timeout` wrapper the way per-provider usage fetches
do). Marked UNSUPPORTED here rather than forcing a fake `timeout` status
onto those panels.

## What is genuinely open (not fixed or built this wave)

- **`QuotalisAsyncState`/`QuotalisSkeleton` (the full 5-status component)
  are still not the rendering mechanism for Dashboard/Analytics/reset** —
  this wave wired real distinct signals into each surface's OWN existing
  UI (MenuEmpty, ProviderIssueNotice, etc.) rather than replatforming
  every surface onto the shared component, which would have been a much
  larger, riskier visual change than the wave's actual asks required.
- **Structures still cannot distinguish Error from Timeout from a
  genuinely-corrupted-but-not-erroring state** beyond what
  `ProviderUsageSnapshot.error` already reports — this is the real
  ceiling of the backend's current signal, not a frontend gap.
- **Analytics history/model fetches have no timeout signal** (see the
  seven-state table above) — a real backend question, not something to
  fabricate around.
- **No exhaustive per-surface matrix beyond the ones this wave actually
  touched.** Provider connect/Data Sources/background import/
  notification history/Tray source preview/local scanner were not each
  walked and recorded.
- **Reduced motion for a real production consumer** was not separately
  verified this wave beyond the component-level CSS guard already in
  place (`QuotalisLoadingStates.css`'s `prefers-reduced-motion`/
  `data-qa-motion` rules) — still no real consumer exists to mount with
  `prefers-reduced-motion: reduce` and prove the shared treatment stays
  visible without continuous shimmer/spin (Wave 1F §15's explicit ask,
  not closed this wave; disclosed rather than skipped silently).
- **Native visual verification** of any of the above (does the badge
  render correctly, at the right position, at real DPI, across themes)
  has not occurred — `WAVE1_NATIVE_QA_MATRIX.json`'s `NATIVE-REFRESH-01`/
  `NATIVE-DATA-ERROR-01`/`NATIVE-DATA-TIMEOUT-01` entries are prepared
  for the next capable session.

## Verdict

LOADING UX: **PARTIAL** — the hard architectural rule (don't blank valid
cached data on same-scope refresh; keep loading/unavailable/zero/error
distinct) is already correctly implemented in the shared data layer.
Wave 1B FINAL added the real, tested shared visual-language component
set; Wave 1D wired Floating Structures' first-load distinction into all
14 forms; Wave 1E added the Refreshing distinction into the same real
consumer; Wave 1F wired real, distinct signals into Dashboard, Analytics,
Reset (verified pre-existing), Provider-connection actions, and
Structures' Error/Timeout — every required Wave-1F consumer (§4-5, §6,
§9-10, §11, §12, §13-14) now has a real, tested, non-fabricated
treatment. Still open: full `QuotalisAsyncState` replatforming (not
required — each surface's own UI now correctly distinguishes states),
reduced-motion proof in a real consumer (§15, not closed), Analytics'
missing timeout signal (a backend gap, not a frontend one), and native
visual verification of any of it. Not claimed as PASS — no screenshot
exists for any of this wave's visual changes.
