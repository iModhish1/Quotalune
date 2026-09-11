# Analytics Superstack — Design Contract

Status as of Phase 3I. This document records what the Analytics visual
system **actually is today**, verified natively, not an aspirational
spec for a full redesign that hasn't been built. Sections marked
`NOT YET DEFINED` are genuinely open — do not treat their absence as an
oversight to silently fill in without a real design pass.

See also: [ANALYTICS_V4_DESIGN_SYSTEM.md](ANALYTICS_V4_DESIGN_SYSTEM.md),
[ANALYTICS_VISUALIZATION_PLATFORM.md](ANALYTICS_VISUALIZATION_PLATFORM.md)
(pre-existing, narrower documents this one does not replace).

## Ribbon / metric-cell grammar

Every summary ribbon in Analytics (`Overview`, `Usage trends`, `Data
quality`) is a `<dl class="analytics-metric-ribbon">` whose direct
children are `<div class="analytics-comparison-stat">` cells, each a
`<dt>` label + `<dd>` value pair. This is the ONLY metric-cell grammar
in Analytics — a new ribbon consumer must reuse `analytics-comparison-stat`
rather than hand-rolling its own `<div>`/`<dt>`/`<dd>` styling (Phase 3I
found and fixed exactly this omission in `AnalyticsOverview.tsx`, see
`AnalyticsWorkstation.css`).

Two `dd` presentation modes:
- **Hero value** (default): large (20px), bold, for a real number
  answering "how many/how much" (`5/5`, `63.9B`, `10`).
- **Text value** (`dd.analytics-comparison-stat--text`): smaller (14px),
  regular weight, for a qualitative/descriptive value that would
  otherwise wrap awkwardly at hero size (`Updated just now`,
  `Collecting history`). Use this whenever the value is a phrase, not
  a number.
- A `dd` may pair a hero number with a `<small>` sub-caption
  (`6 <small>days of history</small>`) when the unit needs spelling out
  — keep a literal space between them; the two live in the same text
  flow and a missing space visibly concatenates them.

A ribbon cell that depends on an async, possibly slow (multi-second)
data source must render a `analytics-comparison-stat--pending`
placeholder cell in the same grid position from first render, not omit
the column until the data resolves — an omitted-then-inserted column
reflows the whole ribbon out from under the reader mid-glance. See
`AnalyticsOverview.tsx`'s `tokenActivityPending` handling (Claude local
scanning can legitimately take several real seconds on a large
transcript corpus).

## Source grammar

Both `AnalyticsOverview.tsx`'s compact source list and
`AnalyticsSourcesTab.tsx` (Settings → Analytics Sources / "Data
Sources") render the same registry (`get_analytics_source_registry`)
through the same status/scope vocabulary:
`AnalyticsSourceStatus{Available,NoDataYet,Unsupported}` /
`AnalyticsScope{Account,Provider,Device}`. A source's availability is
never re-derived or re-worded locally — always look it up through
these keys so the two surfaces never drift into contradicting each
other about what a source means.

## Content width / spacing

Analytics content lives inside `.dashboard-analytics` (`padding:16px`,
`gap:12px`). A section is `.analytics-section` with a `border-top`
hairline separator; it does not get its own card border/background —
only the metric ribbon and comparison tables do
(`--qa-analytics-surface-primary` background, `--qa-analytics-hairline`
border). Do not wrap a whole section in a second bordered card — that
produces the "card soup" the owner has repeatedly flagged.

## Empty-canvas rule

A section with real but sparse data (few sources, short history) must
still fill the canvas with genuine secondary content — e.g. the source
list under the Overview ribbon — rather than leaving a large blank
area of cosmic background below a single thin ribbon. Do not invent
content to fill space; add the next real, already-available piece of
information (per-source detail, a data-quality note) instead.

## Chart theming

`.quotalis-chart` / ECharts surfaces must consume the shared Structure
Theme tokens (axis/grid/tooltip/legend/surface/selection) and Provider
Identity colors for series — never a chart-local hardcoded palette.
This rule was already established before Phase 3I; it is restated here
because it governs the still-outstanding Token trend chart and
Activity heatmap work below.

## NOT YET DEFINED (open from Phase 3I)

These have no real design pass behind them yet — they are gaps, not
silent defaults:

- **Token trend chart grammar** (axis/tooltip/crosshair/gap-handling
  for the Token Analytics primary trend called for in the Phase 3I
  spec). `TokenAnalytics.tsx` currently renders numeric summary cells
  only, no chart.
- **Model share visualization grammar** (ranked bar/instrument-row
  presentation for `ModelAnalytics.tsx`, which currently renders a
  plain table).
- **Heatmap grammar** (the Activity/Heatmap page does not exist yet).
- **Data Sources detail-inspector grammar** (per-source drill-down
  view; today `AnalyticsSourcesTab.tsx` is a flat list only).
- **Light palette** for Analytics specifically (the app has a light
  theme; Analytics has not been visually re-verified under it this
  phase).
- **RTL layout rules** for Analytics (not re-verified this phase).
- **Responsive breakpoint behavior** below 1100px for the Overview
  ribbon/source-list beyond the two rules already in
  `AnalyticsWorkstation.css` (`@media(max-width:720px)`).

Do not backfill any of the above ad hoc inside a single component —
when the work is picked up, extend this document first.
