# Analytics table audit — Wave 4.5

## Decision

Quotalis keeps its internal, headless `AnalyticsTable` primitive for this
wave. It now provides typed columns, stable client-side sorting, accessible
column visibility controls, a sticky structural-theme header, density-aware
table styling, and bounded pagination. Markup, keyboard behavior, and visual
treatment remain owned by Quotalis.

## TanStack Table review

On 2026-09-09, the npm registry reported
[`@tanstack/react-table` 9.2.4](https://www.npmjs.com/package/@tanstack/react-table)
under the MIT license, with its source at
[TanStack/table](https://github.com/TanStack/table). Its headless model is a
sound option if Quotalis needs grouped headers, column resizing, filtering
state shared across several unrelated tables, server-side table operations,
or general-purpose virtualization.

Those needs are not present in the active tables. The existing primitive has
a small, stable contract (`rows`, typed `columns`, `rowKey`, caption and empty
state), and the required Wave 4.5 behavior fits that contract without
introducing a package, a startup cost, or a second state model. Therefore no
dependency or lockfile change is justified.

## Behavioral contract

- `sortValue` contains only raw comparable data. Formatting remains in the
  cell renderer, so a localized label can never be accidentally sorted as a
  metric.
- `null`, `NaN`, and non-finite numeric values are unavailable. They sort
  last for both ascending and descending order; they never become an apparent
  best or worst reading.
- Sorting is stable for equal values, preserving the incoming authoritative
  model order.
- Visibility controls are native checkboxes inside a `details` disclosure and
  cannot hide the final visible column.
- Tables render at most 100 rows per page by default. The 70-provider
  operational matrix explicitly uses a 70-row page, so its complete normal
  view remains unpaginated. This is pagination, not virtualization: it avoids
  a large DOM while preserving accessible native table semantics.
- The provider matrix consumes only `CurrentProviderModel`: provider identity,
  backend-classified readiness, validated physical quota windows, future reset
  instants, plan name, and cadence-based freshness. It does not calculate
  velocity, money, historical totals, or a new account state.

## Verification

`AnalyticsPrimitives.test.tsx` covers null-last sorting in both directions,
visibility keyboard controls, and both 1,000-row and 10,000-row histories
bounded to 100 rendered body rows while retaining page navigation. `ProviderOperationsTable.test.tsx`
covers all 70 comparison rows without pagination and validates status and
freshness against the shared current-provider model.

Native screenshot, theme, and performance measurements remain owned by the
Wave 4.5 integration pass.
