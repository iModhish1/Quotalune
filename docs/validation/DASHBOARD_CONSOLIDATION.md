# Single Analytics Dashboard consolidation

Date: 2026-09-09. **FINAL DASHBOARD PASS** for this consolidation scope.
The owner can review the final native screenshots below; subjective visual approval
is not implied by the engineering verdict. No new mode or release work follows.

## 1. Starting HEAD

`9733e8ab`, clean working tree on `feature/v9-theme-runtime`.
The owner's 46-section consolidation request supersedes the earlier 3D/Spatial work.

## 2. Ending HEAD

Application code: `c90b12a7`. The subsequent evidence-only commit containing this
report is the delivery revision; its exact hash is returned in the final response.
No application code changed after the final build and test run.

## 3. Commits

- `3f35a190` — resolve retired dashboard settings to analytics.
- `29ca39a5` — consolidate runtime and build the limits-first Analytics surface.
- `22cac229` — scope deterministic Demo history by range and provider.
- `2c164eae` — validate spend chart semantics and refine compact instruments.
- `c90b12a7` — keep Demo provenance visible and localize Credits.
- Delivery evidence commit — this report, ADR, requirement checkpoints and captures.

## 4. Removed modes/features

Removed Providers3D, Spatial, Hybrid, the mode registry/selector, 3D lab route,
scene model, renderer lifecycle, camera/interaction code and obsolete localized
mode strings. Dashboard has no planet/orbit hero. Shared provider presentation
components used by other product surfaces remain; their historical folder name
`components/orbit` does not mean the Dashboard mounts an orbital renderer.

## 5. Three.js status

Removed `three` and `@types/three` from package dependencies and lockfile; pnpm
removed eight dependency packages. No active import or linked `node_modules/three`.
The local pnpm cache still contains 33,798,954 bytes for the two retired package
payloads; this is not shipped code and is **not claimed as reclaimed disk space**.
No global cache pruning was performed.

## 6. WebGL status

No active Dashboard WebGL renderer, canvas mode or experimental route. Native DOM
readback reports **zero canvas elements** in every required captured Dashboard.
Production assets contain no 3D/Spatial chunk. Cosmic decoration is static CSS/SVG.

## 7. Legacy mode migration

Rust `DashboardModeId` has one value, Analytics. Serde aliases and parsing resolve
`providers3d`, `spatial` and `hybrid` to Analytics. Existing lenient settings loading
also handles unknown/wrong-type legacy input. Compatibility strings in the TS wire
type are not selectable modes. Tests cover legacy aliases and fallback behavior.
No settings files were deleted or manually rewritten; ordinary saves serialize
the canonical value.

## 8. Final architecture

Settings Dashboard and the generic pop-out Dashboard use the same `DashboardHost`
and one lazy `AnalyticsDashboard`. The host retains crash isolation. Provider-only
focused windows retain their independent provider display. Analytics consumes
`useEffectiveProviders`, `useDashboardState` and `useEffectiveDashboardSnapshot`;
there is no new pricing or data interpretation engine.
See [the ADR](../architecture/ADR-DASHBOARD-SINGLE-ANALYTICS-MODE.md).

## 9. Limits/quota experience

`CurrentLimits` is the primary section: provider identity, connection state,
used/remaining readings and configured limit windows. The adapter runs per provider
to avoid its compact-surface seven-provider cap; a component test verifies 24 cards.
Unavailable authentication states do not display stale quota as ready. Invalid
percentages remain unavailable. Monetary values retain Spend/Balance/Credits labels;
the monetary native fixture proves all three side by side.

## 10. Reset experience

Reuse `useResetStageOptions`, the shared stage adapter and `UsageWindowList` for
configured reset formatting and limit selection. Reset schedule and attention
states remain prominent. Multi-window controls use the existing paging behavior;
there is no separate reset clock implementation or nested card scrollbar.

## 11. Analytics experience

History range/provider filtering, usage trends, distribution and data status remain
below current limits. Current status is labeled separately from selected-range
history. Native filtering to Claude produced exactly one Claude history series
while retaining six current provider instruments. No synthetic all-provider quota
total is added. Spend charts reject non-Spend, unknown measurement, missing currency
and non-finite values; a series cannot combine different currencies/measurements.
The source currency is displayed instead of hardcoded dollars. Existing backend
reported-cost eligibility and local-estimation safety remain intact.

## 12. Demo Mode

Existing deterministic generator, seed, 1–24 provider controls, curated/custom
selection, scenarios and history stay available in Dashboard Studio. Demo remains
visibly labeled, including after scrolling. Filters subset the existing history
instead of rerolling values. The monetary scenario intentionally yields its four
curated providers. Demo does not write synthetic provider history or credentials.
Final Dev state was returned to **Demo off**.

## 13. Cosmic design

Static observatory surfaces: restrained layered gradients, calibration lines,
themed instrument edges and compact SVG gauges. No animated cosmic background,
particles, camera, planets or orbit navigation. Low-CPU preset removes decorative
effects; higher presets retain bounded/static styling, not a permanent render loop.

## 14. Structure Theme

Existing Dashboard Structure Theme resolution remains authoritative. Native
captures verify Sapphire Observatory, Smoked Silver and warm Solar Ember Material.
Themes update the mounted DOM surfaces through shared tokens. No second theme system.
The full existing theme/structure compatibility test passes.

## 15. Provider Identity

Provider icons, chart palette and shared configured limit presentation remain
separate from Structure Theme. `UsageWindowList` receives the resolved provider
presentation; theme colors do not redefine provider data or identity settings.
The monetary classifier needed by Demo was moved into a small display-only helper
before the scene directory was removed.

## 16. RTL

Native Arabic capture verifies mirrored layout and no horizontal overflow. New
Credits copy is `وحدات الائتمان`, distinct from Balance `الرصيد` and Spend `الإنفاق`.
Some pre-existing navigation/provider labels remain English, including Collections,
Profiles and provider-supplied Monthly. This is not a claim of complete app translation.

## 17. Responsive

Native captures: narrow 520×636 CSS pixels, normal 1040×688, maximized 1280×730.
All required screenshot metadata reports `overflow:false`. Limits grid adapts to
width and long content; page scrolling remains available. Maximization used the
actual app control and narrow sizing used the native CUA window API.

## 18. Bundle and cold open

Measured production Vite builds before/after on the same workstation:

| JavaScript payload | Before | After |
| --- | ---: | ---: |
| All emitted JS, decimal kB | ~1507.90 | 924.888 |
| All emitted JS, gzip kB | ~436.71 | 284.273 |
| Main entry, kB | 508.09 | 507.59 |
| Main entry, gzip kB | 166.16 | 166.03 |
| 3D scene lazy chunk, kB | 564.15 | removed |
| 3D scene lazy chunk, gzip kB | 142.26 | removed |
| Spatial lazy chunk, kB | 8.45 | removed |

Total emitted JS decreases approximately **583 kB (38.7%)**, gzip **152.4 kB
(34.9%)**. This is build payload removal, not a claim that 2D startup formerly
downloaded the lazy 3D payload. Baseline values are rounded Vite log output;
candidate bytes and gzip sizes are recorded in `bundle.json`.

One fresh Dev Settings-window open took **808.8 ms** from open command to ready
provider instruments, including CDP polling overhead. Window navigation DCL was
180 ms and FCP 272 ms. This is one window-open sample, not a whole-process startup
benchmark or a percentile. Resource readback confirms no retired engine chunk.

## 19. Memory

Fresh native Debug Dev process, visible real-data Dashboard, no CDP, complete
process tree: **9 processes**, working set **592.46–592.84 MiB**, private bytes
about **217.91 MiB**, root working set **69.34 MiB**. Summed working sets can count
shared pages more than once and are not unique physical memory consumption.

Historical Phase 5 evidence recorded 578.3 MB baseline and 721.6 MB after 20 2D/3D
switches (8 processes). Current summed working set is roughly 129 lower than that
post-cycle reading, but slightly above its baseline. Builds, process counts,
provider states and sessions differ; **no controlled causal memory saving is
claimed**. The firm savings are removal of engine code/dependencies and lifecycle.
Historical source: [Phase 5 prototype](PHASE5_3D_PROTOTYPE.md).

## 20. Idle CPU

Five samples with four-second waits after settling, no CDP, visible Dashboard;
actual intervals include process enumeration overhead. 80 logical processors.
Whole-machine normalized CPU: **0.0388%, 0.0217%, 0%, 0%, 0%**; median **0%**.
Equivalent one-core percentages: **3.102%, 1.739%, 0%, 0%, 0%**.
This includes all Dev descendants and the existing Top Arc surface. The temporary
Dev startup preference used to open Dashboard was restored after measurement.
Historical 3D was already event-driven at idle; a material idle-CPU improvement
over its near-zero baseline is not established by these samples.

## 21. Native screenshot paths

Durable evidence: `docs/images/dashboard/final/`.

- The historical real-Dev-data capture was withdrawn from the public image tree during the screenshot privacy audit. Its audit copy is retained under ignored `.local/historical-real-data-2026-09-27/`; the current Quotalune release gallery requires a new, reviewed Dev capture.
- [Demo, six providers](../images/dashboard/final/QUOTALIS_DASHBOARD_FINAL_DEMO.png)
- [Maximized](../images/dashboard/final/QUOTALIS_DASHBOARD_FINAL_MAXIMIZED.png)
- [Narrow](../images/dashboard/final/QUOTALIS_DASHBOARD_FINAL_NARROW.png)
- [Arabic RTL](../images/dashboard/final/QUOTALIS_DASHBOARD_FINAL_RTL.png)
- [Smoked Silver](../images/dashboard/final/QUOTALIS_DASHBOARD_FINAL_SMOKED_SILVER.png)
- [Warm theme](../images/dashboard/final/QUOTALIS_DASHBOARD_FINAL_WARM.png)
- [Monetary Demo](../images/dashboard/final/QUOTALIS_DASHBOARD_FINAL_MONETARY_DEMO.png)
- [Before/after comparison](../images/dashboard/final/QUOTALIS_DASHBOARD_BEFORE_AFTER_FINAL.png)
- [Analytics and sticky Demo provenance](../images/dashboard/final/QUOTALIS_DASHBOARD_FINAL_ANALYTICS.png)
- [Native CUA, no CDP during performance sampling](../images/dashboard/final/performance-native.png)

Before/after is a labeled comparison plate of existing native captures, scaled to
fit, not a generated application image. Original historical capture is unchanged.
Final captures use fresh `target/debug/QuotalisDev.exe`, size 51,674,624 bytes,
SHA-256 `8E37C35DC7300ED96AB27E7909F3253EE190175D9D6E0DD5B2440513BDFF0B50`,
build mtime 2026-09-09 14:01:54 UTC. The manifest records evidence hashes.
CUA verified the actual Dev windows; WebView content UIA was degraded, so detailed
DOM assertions and screenshots used the real native WebView2 CDP endpoint.

## 22. Tests and review

Final-code gates, all successful:

| Gate | Result |
| --- | --- |
| `pnpm test` | 147 files, **920 passed** |
| `pnpm exec tsc --noEmit` | passed; also run by production build |
| Frontend production build | passed |
| `cargo test --workspace`: desktop `Quotalis` | **455 passed, 1 pre-existing ignored** |
| `cargo test --workspace`: `quotalis_core` | **1611 passed** |
| `cargo test --workspace`: CLI `quotalis` | **1 passed** |
| Rust doc-tests | 0 tests, passed |
| `cargo clippy --workspace --all-targets -- -D warnings` | passed |
| `cargo fmt --all -- --check` | passed |
| Locale parity | **1085 keys**, passed |
| Added-line secret pattern scan | 0 matches |
| Added-line skip/focus scan | 0 matches |
| `git diff --check 9733e8ab` | passed |
| Native Dev build with `dev-channel`, debug, no bundle | passed |

Ignored test: `commands::dashboard::tests::manual_verification_against_real_history_db`.
It pre-dates this change and requires real history; it was not enabled or newly
skipped. Pattern scanning is a bounded check of changed code, not a guarantee that
the entire repository has no secrets. Test/build logs are included with evidence.

Review covered correctness (filtering, legacy input, unavailable and monetary
states), readability, removal of engine coupling, absence of new credentials or
network actions, and static rendering/resource measurements. No blocking defect
remained in this consolidation scope. It was a direct integrator review, not an
independent second-agent audit.

## 23. Historical code/docs

Git retains removed implementation at `9733e8ab`. Prior Phase 5/5.1/5.2/6 and
Spatial reports/screenshots remain historical evidence; no history was rewritten.
The new ADR records the retirement explicitly. No new replacement mode is planned.

## 24. Personal

Dev channel only (`app.quotaarc.desktop.dev`, `QuotaArc-Dev`). Personal was not
launched, installed, promoted, migrated or modified. No push or release performed.
The only stopped processes were verified instances of the built Dev executable.

## 25. Verdict

**FINAL DASHBOARD PASS**: one Dashboard; retired mode selection/engines removed;
Demo and truthful analytics retained; limits/resets primary; static themed design;
RTL/narrow/maximized native evidence; near-zero idle CPU; simpler production
payload; safe legacy handling; all required automated gates green; Personal untouched.
Owner visual review remains available through the screenshots. Stop here.
