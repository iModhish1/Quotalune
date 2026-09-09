# Analytics visualization platform

Wave 4.5 starts at 376d4182. Dashboard V2 metric semantics are accepted; this wave replaces the presentation engine, not the meaning of readings.

## Decision and official evidence

ECharts 6.1.0 (Apache-2.0) was verified through the npm package metadata and [Apache repository](https://github.com/apache/echarts). Use modular/core directly, with no React wrapper. [Official modular-import guidance](https://echarts.apache.org/handbook/en/basics/import/) supports registering only the chart/component/renderer modules used by the application.

The application registers line and heatmap charts, grid, tooltip, legend, dataZoom, markLine, markPoint, visualMap, ARIA and SVG. Canvas is evaluated in the isolated benchmark bundle; it is not registered in production. No pie, map, 3D, animation or universal-transition package is added.

visx 4.0.0 (MIT) remains maintained React/D3 building blocks; its [official repository](https://github.com/airbnb/visx) presents low-level reusable primitives. It would preserve much of Quotalis's manual work for zoom, tooltips, legends and lifecycle. The internal SVG approach has no extra dependency, is easily themed and appropriate for gauges, but lacked those advanced analytics behaviors. Keep the compact QuotaGauge and embedded legacy visuals; remove the now-unused full-size TimeSeriesChart/geometry implementation after native ECharts proof.

ECharts supports both renderers; its [renderer guide](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/) recommends measuring the actual workload. WebView2 measurements (800×280, DPR1, five runs after warmup) gave SVG/Canvas medians: 100 points 8.6/10.3 ms; 1k 12.4/12.5; 10k 20.5/23.0; 100k 138.5/131.5. This does not justify Canvas for ordinary bounded line plots. Dense future non-line charts require a new benchmark.

TanStack Table 9.2.4/MIT was audited separately in ANALYTICS_TABLE_AUDIT.md. Existing typed headless table could cleanly supply the needed controls, so no table dependency was added.

## Boundaries

Metric Registry → buildDashboardAnalyticsModel → typed ChartSpec factory → ProfessionalChart → lazy EChartsSurface. The model groups history once per snapshot/range/filter generation and is memoized at DashboardAnalyticsPanel. Tables and widgets reuse its validated series, current state, attention, resets and coverage. No chart fetches history or determines billing semantics.

Registry compatibility fails closed: reset timestamps cannot become distributions, and unrelated quota percentages cannot become a share pie. Comparison means observed quota state; full-data comparison/velocity guards are unchanged. Unsupported comparison renders a compact explanation. No exhaustion projection is invented.

## Lifecycle and performance

Only EChartsSurface imports runtime modules. Vite isolates analytics-engine; charts load when an actual populated chart mounts. The React integration initializes once, applies setOption, coalesces ResizeObserver changes with a single cancellable frame, and disposes observer/frame/chart on unmount. Theme changes replace options without recreating the instance. Initialization/observer failure disposes the partial instance. A local error boundary isolates lazy-import failure and preserves HTML alternatives.

All animation is disabled, including reduced motion. Low CPU reduces point budget and annotations. High Fidelity adds an observed peak annotation. No interval, worker, perpetual requestAnimationFrame loop or global chart controller exists.

Large-data pipeline retains the existing SQLite → Rust physical-window aggregation → DashboardSnapshot architecture. An isolated in-memory SQLite benchmark (debug Rust, five warm samples) reduced 25k/100k/250k captures to 70/140/280 daily records; read+aggregation medians 192/780/1969 ms. Equivalent raw frontend processing at 250k took ~662 ms and would block the UI. These measure different stages and build modes, not a claim Rust is inherently faster. Backend aggregation keeps raw captures outside the synchronous rendering path; no new worker or schema was justified.

Visual sampling is presentation only: split on missing buckets, reset endpoints and counter decreases first, then retain segment endpoints and local extrema. Approximately 240/600 point budgets bound ordinary charts. If discontinuities alone exceed the budget, return an unavailable plot rather than silently joining or discarding them. Metrics and raw history tables still use full validated observations. Heatmap groups capture counts by time/physical-account/window; blank cells are unknown, not zero. It never sums different quotas.

## Theme, identity and interaction

ChartThemeAdapter derives structural background/text/grid/tooltip/axis from the existing resolved CatalogTheme. Provider color follows resolveVisualComposition, including provider overrides and canonical Codex→OpenAI alias. No default ECharts palette. Semantic warnings stay on status tokens.

Native Ceramic proof also requires an opaque light analytics surface above dark application chrome. Light-theme series reuse `accessibleMeterFill` to preserve provider hue while reaching the existing 3:1 graphical contrast floor; comparison uses dashes at full opacity. Tooltip direction follows interface language independently from the user's regional date setting.

Time grows left to right even in RTL. Arabic dates/tooltips use the existing locale/time-zone settings and Latin digits. Tooltips escape source-derived strings, include provider/window/period, original timestamp, unit and provenance. Prior-period overlays shift only plotted time; tooltip and HTML table retain original time. Crosshair assists inspection. Long-range zoom is explicitly visual only, with separate legend/slider bands. It does not mutate Dashboard range or recompute period metrics.

## Accessibility

[ARIA](https://echarts.apache.org/handbook/en/best-practices/aria/) is explicitly registered and enabled with a localized scope description. Every professional chart supplies an expandable semantic HTML reading table; current/previous series have textual labels and dashed comparison styling. Full raw current history remains separately available. Native keyboard controls, focusable reset markers, sortable column headers and pagination provide parallel DOM interaction; no claim of a full third-party WCAG certification.

## Layout and ownership

Current Limits uses a compact shared instrument grid with a primary dial and only secondary rails, avoiding duplicate primary bars. Metric ribbon replaces repeated KPI rectangles. Attention uses an incident rail, Trends a wide analytical surface, Reset Horizon a calibrated timeline/agenda, provider comparison a bounded table and Data Quality a coverage heatmap/status matrix. Existing section visibility/order remains authoritative; drag reorder supplements keyboard arrows. Settings/navigation organization and Providers page are unchanged.

See ANALYTICS_TEMPLATE_CATALOG.md and ANALYTICS_V3_VALIDATION.md for supported templates, measurements, native captures and known limits. Personal is outside the test boundary.

Final native Demo6 evidence: 397.2 ms cold analytical render, 103.3 ms median over twenty warm opens, exactly two initial chart instances/observers and zero after each unmount. Theme changes preserve instance IDs. Measured idle median is 0.566% of one core across the entire Dev process tree; the retained first-sample transient is 13.69%. No controlled V2 cold-open improvement claim is made. Full samples are archived in `docs/validation/ANALYTICS_V3_PERFORMANCE.json`.
