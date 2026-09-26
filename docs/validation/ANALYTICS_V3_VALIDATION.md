# Analytics V3 — Wave 4.5 validation and owner review

Validated on Windows / native Quotalis Dev / WebView2, September 9–10, 2026.
**ANALYTICS V3 PASS — engineering and evidence gates. Owner visual approval remains pending.**
No Providers redesign or subsequent wave was started.

## 1–7. Revision and technology decision

1. **Starting HEAD:** `376d41823ba543d133d978c3083e8b5de83caf90`, branch `feature/v9-theme-runtime`; clean before this wave.
2. **Ending implementation HEAD:** `78829734`. The final evidence HEAD is the commit containing this report, obtainable with `git log -1 --format=%H -- docs/validation/ANALYTICS_V3_VALIDATION.md`; the handoff supplies its exact hash.
3. **Commits:** `a6760841` typed bounded tables/localized controls; `b1a0af3d` modular chart platform/model; `ff3d2ef9` Dashboard integration and retired SVG; `78829734` isolated SQLite/Rust benchmark; followed by this documentation/native-evidence commit. Each includes the requested co-author trailer.
4. **Evaluated:** Apache ECharts 6.1.0, visx 4.0.0, internal SVG, and TanStack Table 9.2.4. Package versions/licenses were read from the registry; capability research used the [Apache repository](https://github.com/apache/echarts), [official modular guide](https://echarts.apache.org/handbook/en/basics/import/), [renderer guide](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/), [visx repository](https://github.com/airbnb/visx), and [TanStack column-visibility documentation](https://tanstack.com/table/latest/docs/framework/react/examples/column-visibility).
5. **Selected:** ECharts **6.1.0 / Apache-2.0**, direct modular/core integration, SVG renderer. visx and TanStack are MIT; neither was added. Canvas exists only in the isolated performance experiment.
6. **Bundle impact:** production Vite output, decimal kB / gzip kB:

   | Asset | V2 | V3 |
   |---|---:|---:|
   | Main JS | 510.89 / 166.97 | 510.88 / 166.97 |
   | Dashboard JS | 62.92 / 17.05 | 75.91 / 21.40 |
   | Dashboard CSS | 16.25 / 3.07 | 27.60 / 4.61 |
   | Analytics engine JS | absent | 625.55 / 211.83 |
   | Lazy React surface JS | absent | 1.35 / 0.75 |

   The engine is a material deferred payload, not a bundle-size reduction. Native resource timing confirmed it absent before Dashboard open and present afterward. The main startup bundle does not import the runtime chart engine. Vite still emits its >500 kB chunk advisory; no warning threshold was raised to conceal it.
7. **Why:** ECharts supplies maintained time axes, crosshairs, zoom, legends, heatmaps, ARIA and explicit disposal without rebuilding those facilities in SVG. Measured ordinary workloads did not favor Canvas enough to justify shipping it. visx would retain more manual integration. Internal SVG remains appropriate for tiny limit instruments. Details: [architecture](../architecture/ANALYTICS_VISUALIZATION_PLATFORM.md), [table audit](ANALYTICS_TABLE_AUDIT.md).

## 8–22. Architecture and product result

8. **Analytics model:** `buildDashboardAnalyticsModel` derives current limits, validated physical-window series/comparisons, attention, coverage, resets, KPIs, freshness and availability once per snapshot/range/provider-filter generation. React memoizes this shared boundary; charts do not fetch or reinterpret raw history.
9. **Chart specifications:** typed factories convert validated series to display options. Registry compatibility rejects unsupported representations. Theme adaptation, sampling and lifecycle are separate modules. Local chart error boundaries preserve semantic DOM alternatives if loading fails.
10. **Template catalog:** [ten analytical templates](ANALYTICS_TEMPLATE_CATALOG.md), including an explicitly unsupported distribution/share template. Availability follows data requirements; no quota pie is offered.
11. **Current Limits:** one compact instrument grid, six columns at the golden desktop width, fewer columns when narrow. A provider with a single physical limit no longer shows a misleading empty-secondary-window message. One/two-provider real views fill their available grid. Primary percentages/reset and secondary rails remain separate. Spend, Balance and Credits retain distinct labels.
12. **Metric Ribbon:** joined measurements and quiet dividers replace repeated KPI cards; freshness/scope notes remain explicit. Reported Spend is still latest cumulative readings, not inferred spending during the selected dates.
13. **Attention:** deterministic incident rail, provider glyph, reason and semantic severity; no visual ranking changes the underlying priority model.
14. **Trend:** professional 0–100 physical-quota time series, actual timestamps, gaps/reset boundaries, observed mean and optional real peak. Provider/account/window selection remains explicit. Four-to-eight provider small multiples share scale and time domain and mount only when opened.
15. **Period comparison:** current solid/prior dashed, compact textual legend, same eligible physical scope. Only plotted prior timestamps shift; tooltip and reading table retain original dates. Incompatible history shows its analytical reason rather than invented lines.
16. **Reset Horizon:** calibrated linear timeline with Now, 0.5h (30 minutes), 2h, 6h, 12h and 24h markers. Close events use lanes; agenda and full schedule retain exact timestamps and physical windows. Time never mirrors in RTL.
17. **Coverage heatmap:** capture counts by day and physical provider/account/window. Blank cells represent missing observations; there are no fabricated zero cells. A numerical color scale and HTML reading table explain the intensity. The evenly filled Demo heatmap reflects its deterministic source; real Dev coverage is visibly sparse and uneven.
18. **Provider comparison:** current provider operations matrix plus physical-window historical comparison, preserving account scope. Current state, plan, usage, remaining, reset and freshness have distinct typed columns.
19. **Table system:** internal headless component now supports stable null-last sorting in either direction, column visibility, sticky headers, native keyboard controls, density and bounded pagination. Seventy providers remain visible as one page; 1k/10k history tests render at most 100 body rows. No unnecessary virtualization or generic table theme.
20. **Data Quality:** full-width status matrix and heatmap. Observed date bounds, capture counts, missing intervals and source status remain visible. Unknown identity is not upgraded by inference; no unsupported metric becomes zero.
21. **Chart/style settings:** existing Precision/Minimal/Detailed and valid limit templates remain persisted. Low CPU reduces visual point budgets/annotations; High Fidelity adds a full-data observed peak. All chart animations are off, including reduced motion. Metric calculations do not depend on the preset.
22. **Layout:** Demo/control strip, metric ribbon, limit instruments and attention are followed by an 8/4 trend/reset composition, comparison tables and full-width coverage. Existing visibility/order controls still govern sections; constrained drag reorder supplements keyboard arrows. No new settings navigation or Providers redesign.

## 23–24. Large-history policy and measured performance

23. **Pipeline:** keep the existing SQLite → Rust physical-window aggregation → snapshot boundary. Presentation sampling first splits missing buckets, changed reset endpoints and counter decreases, then retains segment endpoints/extrema. Raw metrics never use sampled points. About 240/600 points per ordinary series are targeted; pathological discontinuity counts fail closed to an unavailable plot. No worker or backend schema rewrite was justified by this experiment. The old large `TimeSeriesChart` and geometry implementation were removed; compact SVG gauges remain.
24. **Measurements:** raw samples and scope notes are archived in [ANALYTICS_V3_PERFORMANCE.json](ANALYTICS_V3_PERFORMANCE.json).

   ECharts renderer experiment: actual native WebView2, synthetic isolated 800×280 chart, DPR1, no symbols/animation, init + setOption + synchronous painter flush; five trials after one warmup. Hosts and instances were disposed after every trial. These are unsampled engine stress tests, not product metrics.

   | Observations | SVG median | Canvas median |
   |---:|---:|---:|
   | 100 | 8.6 ms | 10.3 ms |
   | 1,000 | 12.4 ms | 12.5 ms |
   | 10,000 | 20.5 ms | 23.0 ms |
   | 100,000 | 138.5 ms | 131.5 ms |

   Aggregation experiment: five warm trials, 70 synthetic provider scopes, in-memory SQLite; no application database was opened by the benchmark. Rust used a debug build. Frontend timing includes raw model processing; Rust timing includes SQLite reads and daily aggregation. They are different stages, not a language-speed comparison.

   | Raw captures | Frontend model median | SQLite read + Rust median | Daily output records |
   |---:|---:|---:|---:|
   | 25,000 | 61.3 ms | 192.1 ms | 70 |
   | 100,000 | 264.5 ms | 779.7 ms | 140 |
   | 250,000 | 661.9 ms | 1,969.4 ms | 280 |

   Production already aggregates before IPC. Sending 250k raw captures to synchronous React work would be unsuitable; the result supports retaining that boundary, not adding ten raw-history consumers. Reproduce the backend case with `cargo run -p quotalis_core --example analytics_viz_benchmark`.

   Final native Demo6 at 1280×784 CSS pixels, deterministic 30-day source, balanced preset:

   | Action | Measurement |
   |---|---:|
   | Cold Dashboard → analytical SVG | 397.2 ms, one cold sample |
   | Warm Dashboard open | 103.3 ms median, 20 cycles |
   | Range change | 97.3 ms median, five samples |
   | Provider filter | 117.3 ms median, five samples |
   | Theme switch | 311.8 ms median, five samples |
   | Chart container resize | 124.3 ms median, five samples |

   Interaction timing ends after changed SVG plus two animation frames; it includes React/settings delivery. Resize is a real container width change through ResizeObserver, not native OS-window resizing latency. Actual CUA window resizing was separately verified in the dense/narrow screenshots.

   Every one of the 20 General↔Dashboard cycles produced **two** initial chart instances and two observers; after leaving Dashboard both counts were **zero**. Comparison and atlas charts only mount on disclosure. All five live theme changes preserved instance IDs. Final JS heap was 24,796,100 bytes; this is an endpoint measurement, not proof of zero possible memory leaks.

   Idle: five approximately 5.5-second intervals across Dev plus its WebView2 descendants, **no CDP sampling during the intervals**. One-core CPU percentages: **13.69, 0.56, 1.12, 0.00, 0.57**; median **0.566%**. Private bytes ranged 337,424,384–340,209,664 (median 322.4 MiB). The first transient sample is retained. The historical V2 run recorded median 0.565% and 269.6 MiB private bytes. Different process lifetime/history/interaction conditions mean this is contextual before/after evidence only; no CPU or speed improvement is claimed. A controlled V2 cold-open baseline was not collected.

## 25–28. Native visual and accessibility evidence

25. **Themes:** Obsidian Orbit, Smoked Silver, Sapphire Observatory (champagne accents) and Ceramic Pearl all changed mounted chart colors without reinitialization. Ceramic's native screenshot exposed dark-chrome compositing; light analytic surfaces are now opaque and series reuse the existing 3:1 meter-color adjustment. Provider identity override changed Claude's series color while the values and instance ID stayed unchanged. Final overrides were restored and read back.
26. **RTL:** native Arabic navigation, chart description, tooltip and comparison text verified; time advances LTR. Arabic-date proof explicitly selected the existing Dashboard regional option “UI language,” preserving Latin digits. System regional formatting remains supported and was restored afterward. No horizontal page overflow at 1280 or 718 CSS pixels.
27. **Accessibility:** ECharts ARIA is enabled; current state, comparison and coverage have semantic HTML alternatives. Native Space opened the chart reading disclosure and exposed seven rows/three headers. Tooltip stayed inside the viewport and used RTL flow. Reduced-motion media was verified; the renderer has no animation loop. Color is supplemented by names, values, period labels and dashed comparison strokes. This is targeted native/DOM validation, not an external accessibility certification.
28. **Evidence:** [review board](../images/analytics-v3/QUOTALIS_ANALYTICS_V3_REVIEW_BOARD.png) and [matched V2/V3 comparison](../images/analytics-v3/QUOTALIS_ANALYTICS_V2_VS_V3.png) are the owner-review entry points. Boards contain actual native captures scaled to fit, with no edited chart values. The before/after uses the same 1280×784 CSS viewport and Demo6/seed1/7-day history; captures occurred at different times. The full comparison-capable golden set uses the same existing Demo generator with 30-day history.

   Required native captures under `docs/images/analytics-v3/`:

   - `QUOTALIS_ANALYTICS_V3_OVERVIEW.png`
   - `QUOTALIS_ANALYTICS_V3_CURRENT_LIMITS.png`
   - `QUOTALIS_ANALYTICS_V3_ATTENTION.png`
   - `QUOTALIS_ANALYTICS_V3_TREND.png`
   - `QUOTALIS_ANALYTICS_V3_COMPARISON.png`
   - `QUOTALIS_ANALYTICS_V3_RESET_HORIZON.png`
   - `QUOTALIS_ANALYTICS_V3_HEATMAP.png`
   - `QUOTALIS_ANALYTICS_V3_PROVIDER_TABLE.png`
   - `QUOTALIS_ANALYTICS_V3_DATA_QUALITY.png`
   - `QUOTALIS_ANALYTICS_V3_RTL.png`
   - `QUOTALIS_ANALYTICS_V3_DENSE.png`
   - `QUOTALIS_ANALYTICS_V3_REAL_DATA.png` (withdrawn from the public image tree; ignored local audit copy retained)

   Additional images cover all four themes, RTL tooltip, dense trend, real coverage and the existing monetary-semantics Demo scenario. Native capture iterations repaired legend overflow, slider spacing, secondary-limit messaging, dense statistics, heatmap label contrast, light-theme compositing and few-provider layout. A fresh independent chart review also exercised real ECharts SVG output; its actionable gap, identity, tooltip, accessibility and lifecycle findings were repaired and checked.

## 29–32. Gates, limits and verdict

29. **All required gates passed on the final source candidate.**

   | Gate | Actual result |
   |---|---|
   | Complete frontend Vitest | **1,017 passed / 167 files**, zero failures |
   | TypeScript `tsc --noEmit` | pass, also runs in final build |
   | Production Vite + freshly embedded native Dev build | pass |
   | `cargo test --workspace`: desktop `Quotalis` | **469 passed / 1 pre-existing ignored** |
   | `cargo test --workspace`: `quotalis_core` | **1,638 passed** |
   | `cargo test --workspace`: CLI `quotalis` | **1 passed** |
   | Rust doctests | **0**, pass |
   | `cargo clippy --workspace --all-targets -- -D warnings` | pass |
   | `cargo fmt --all -- --check` | pass |
   | Locale parity | **1,323 keys**, Rust/TypeScript; English/Arabic Rust locale tests pass |
   | Targeted changed-source credential scan | zero findings; not a comprehensive secret audit |
   | New skip/focus markers | zero |
   | `git diff --check` | pass |

   Chart tests cover reset/gap splitting, visual bounds, original comparison timestamps, registry rejection, lifecycle disposal, light-theme contrast and theme/value separation. Native evidence supplements jsdom; it is not inferred from unit tests.
30. **Intentionally unsupported:** quota share/distribution without an additive denominator; inferred token consumption from quota movement; unproven future exhaustion; local monetary estimation without billing evidence; comparison with unresolved/incompatible physical/account history; unlimited unsampled point rendering. Legacy history is not upgraded to stronger semantics by this wave. Visual zoom is not a new semantic date filter. Providers V2.1 remains outside scope.
31. **Personal:** untouched—no launch, settings migration, installation or promotion. Only repository Dev was rebuilt/launched. Demo is off again; language, density, catalog surface override, regional override and provider identity were restored to the pre-proof Dev baseline and read back. Authentication was not exercised or changed.
32. **Verdict:** **ANALYTICS V3 PASS** for this scoped visualization-platform implementation and supplied evidence. Owner visual acceptance remains open. Stop here for review; do not automatically begin Providers work.
