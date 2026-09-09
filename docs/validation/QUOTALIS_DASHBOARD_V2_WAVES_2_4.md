# Dashboard V2 — Waves 2–4 validation

2026-09-09. Scope: Dashboard visual checkpoint; accepted Settings/navigation organization preserved. No further Providers redesign.

1. **Starting HEAD:** `ef0872f3d52243462e1a6513622f56f00c706919`.
2. **Ending implementation HEAD:** `09838037`; the subsequent evidence-only commit is the delivery HEAD (resolve with `git log -1 --format=%H -- docs/validation/QUOTALIS_DASHBOARD_V2_WAVES_2_4.md`).
3. **Commits:** `3076b935` metric contracts/model/locale/cost safety; `09838037` Dashboard integration; subsequent evidence commit contains this report and screenshots.
4. **Metric Registry:** 29 typed IDs in `metricRegistry.ts`; source inventory in `QUOTALIS_METRIC_REGISTRY_AUDIT.md`. Definitions include scope, units, provenance, aggregation, comparison, availability requirements, reset/freshness semantics and presentation keys. Legacy surfaces are inventoried, not falsely claimed to consume one universal monetary DTO.
5. **New metrics:** observed start/end/change, minimum/peak, missing interior buckets, snapshot age, categorical attention. They derive from existing observations; no new backend metric collection.
6. **Unsupported metrics:** quota-to-token/cash conversion, incompatible monetary totals, unknown-identity comparison, missing-price local estimates and unsupported daily-cost sources fail closed. No new speculative metric.
7. **Comparison:** mean observed quota versus preceding equal elapsed period, same account/physical window/grain. Four distinct buckets per period plus validity and coverage guards. Different reset cycles may be compared as state, never consumption. One closing value per bucket prevents overweighting reset-heavy buckets.
8. **Velocity:** observed percentage-point change/hour, requiring sufficient observations, duration, monotonic counters, stable reset endpoint and bounded gaps. It is not token throughput.
9. **Projection:** explicitly unavailable because future workload is not established. Existing legacy provider pace remains separately inventoried; it is not reused as a Dashboard history forecast.
10. **Attention:** deterministic auth/failure/critical/stale/high/reset/gap ordering. KPI count uses the same queue. Provider action opens existing provider management; Demo disables real actions.
11. **Reset Horizon:** 24-hour default, seven-day option, proportional timestamp positions, collision lanes, focusable provider markers and selected-reset detail. Table preserves all known future physical-window resets.
12. **Provider comparison:** independent provider state plus account/window historical table. No arithmetic sum of unrelated quota percentages. Unknown identities stay unknown; observed accounts have distinct local labels without raw IDs.
13. **History coverage:** sample counts, first/last actual observation, missing interior buckets. Empty/invalid coverage is not presented as known zero or continuous monitoring.
14. **Freshness:** current snapshot timestamp versus configured refresh cadence. This is snapshot age, not proof of successful authentication or complete historical coverage; operational state is shown separately.
15. **Data Quality:** source-aware availability and explicit history limitations. Unknown legacy cache age remains unknown.
16. **Templates:** preserved precision, capacity, compact and matrix limit templates; all physical windows remain visible on Dashboard. Tests cross four templates and three densities without changing values.
17. **Charts:** selected account/window observed trend, actual timestamps, gaps/reset boundaries, start/end/mean/extrema. Reuses existing SVG geometry and theme tokens; no chart dependency, animation engine or 3D.
18. **Tables:** existing semantic sortable AnalyticsTable reused for provider comparison, quota metrics, reset schedule and detailed observations; null values retain unavailable semantics.
19. **Customization:** existing persisted order/visibility/range/filter/style/template preferences retained. Reset layout resets only section order/visibility. Settings/navigation IA unchanged.
20. **Demo:** six-provider connected showcase used for primary screenshots; real cached Dev data captured separately with privacy enabled. Deterministic model corpus and existing Demo tests passed. Demo records are not inserted into real history.
21. **Performance:** five measured samples after one warmup for each deterministic 1,000/25,000/100,000-row corpus. Whole quota-model regeneration (including comparisons) plus chart geometry: 4.16/58.98/198.31 ms median for wide range; single-provider filter 0.10/1.38/3.72 ms; short range 2.99/6.79/6.34 ms. Previous wide-range medians 3.22/48.29/176.42 ms; added validation has measurable CPU cost. These are CPU-only synthetic timings, not native frame or database timings. Keep work memoized; no claim that a 100k-row synchronous rebuild is frame-budget safe. Native Dev idle: five ~5.5-second samples, 0.28–1.13% of one core, private bytes ~283 MB, eight processes. Different display/process conditions prevent treating old idle figures as a controlled regression comparison.
22. **RTL:** actual Arabic WebView2 screenshot, RTL document, no document-level horizontal overflow.
23. **Responsive:** actual native resize to 520×690 CSS pixels; maximized 1280×784; dense and comfortable captures. No document-level horizontal overflow in captures. Wide tables retain their own scrolling semantics.
24. **Screenshots:** see below. PNGs are native Dev captures. Comparison board juxtaposes unmodified images of the pre-wave and current Data Quality area; it is not a retired 3D comparison. Heights differ slightly; CSS widths are approximately matched. It does not imply a pixel-perfect controlled visual benchmark.
25. **Tests:** full frontend 1,001 passed /166 files; after registry metadata cleanup, focused 8 passed again. TypeScript and production build passed. Rust: desktop 469 passed/1 existing ignored; core 1,638 passed; CLI 1 passed; doc-tests 0. Locale subset 19 passed. Clippy all targets with warnings denied, fmt and diff check passed. Added-code scan found zero focused/skipped tests, private-key blocks or known credential-token patterns. Pattern scan is not a guarantee against all secrets. Native Dev build passed. Existing Vite chunk-size warning remains.
26. **Limitations:** legacy monetary DTOs outside Dashboard do not yet expose the full history CostContract; legacy cache freshness lacks timestamps. No native large-history interaction latency claim. Long-term projections remain unavailable. Visual approval belongs to the owner; product-wide Providers/customization waves remain open. No new package dependency.
27. **Personal status:** Personal was not launched, stopped, installed, migrated or edited. Only exact-path QuotalisDev process and Dev presentation settings were operated. Presentation baseline restored after proof.
28. **DASHBOARD V2 PASS:** implementation/automated gates and native screenshot checkpoint complete, with the above explicit limits. Stop here for owner visual review; no further Providers redesign in this delivery.

## Screenshot evidence

All paths are under `docs/images/product-v2/`:

- QUOTALIS_V2_DASHBOARD_OVERVIEW.png
- QUOTALIS_V2_CURRENT_LIMITS.png
- QUOTALIS_V2_RESET_HORIZON.png
- QUOTALIS_V2_TRENDS.png
- QUOTALIS_V2_COMPARISON.png
- QUOTALIS_V2_DATA_QUALITY.png
- QUOTALIS_V2_DASHBOARD_DENSE.png
- QUOTALIS_V2_DASHBOARD_RTL.png
- QUOTALIS_V2_DASHBOARD_NARROW.png
- QUOTALIS_V2_DASHBOARD_MAXIMIZED.png
- QUOTALIS_V2_REAL_DATA.png
- QUOTALIS_DASHBOARD_V1_VS_V2.png

Local detailed evidence: `.local/wave24-full-tests.log`, `wave24-rust-tests.log`, `wave24-locale-tests.log`, `wave24-clippy.log`, `wave24-tsc.log`, `wave24-build.log`, `wave24-native-final.log`, `wave24-scans.json`, `v2-analytics-benchmark.json` and `.local/proof/product-v2/*.json`. Local logs are not shipped as product assets.
