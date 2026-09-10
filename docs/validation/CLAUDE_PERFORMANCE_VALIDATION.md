# Claude performance validation — 2026-09-10

Real measurements, not the historical Product V3 number reused. Layered
breakdown where measured; explicitly marked `NOT MEASURED` where not.

## 250k-history backend breakdown (measured, this pass)

`cargo run --release --example analytics_viz_benchmark -p quotalis_core`
(`rust/examples/analytics_viz_benchmark.rs`, extended this pass to split
the previously-combined number into its two real layers: 6 runs per size,
first run discarded as warmup, median of the remaining 5 reported).
In-memory SQLite only — never an application history database.

| Input rows | Output (bucketed) rows | SQLite read median | Rust aggregate median | Combined |
|---:|---:|---:|---:|---:|
| 1,000 | 70 | 1.08 ms | 1.21 ms | 2.29 ms |
| 25,000 | 70 | 23.26 ms | 22.66 ms | 45.92 ms |
| 100,000 | 140 | 113.36 ms | 91.00 ms | 204.35 ms |
| 250,000 | 280 | 254.42 ms | 221.17 ms | 475.59 ms |

This closely matches the historical 250k figure (475.59ms now vs.
~475.86ms previously recorded) — **no regression**, and confirms the two
backend layers are roughly evenly split (neither one-sidedly dominates),
contrary to an assumption that all the cost sits in one layer.

## Architectural finding: the "ship 250k raw points" concern does not apply
to the normal Dashboard/Analytics path

Traced the real IPC contract (`apps/desktop-tauri/src-tauri/src/commands/
dashboard.rs`): the bridge only ever serializes `Vec<QuotaHistoryPointBridge>`
— the *already-aggregated* output of `aggregate_quota_history` (70-280 rows
in the table above, never the raw 1k-250k input row count). The frontend's
own analytics model (`useDashboardAnalyticsModel.ts` /
`lib/analytics/dashboardModel.ts`) consumes exactly this bridge type. **The
preferred architecture the owner's request describes (full history → Rust
aggregation → bounded DTO → frontend model → visualization) is already how
this pipeline works**, not a gap requiring new work. The historical
"~1820.9ms Worker round-trip at 250k observations" figure from Product V3
was a *synthetic stress test of the frontend Worker's own ceiling* (loading
250k already-in-browser synthetic points to see how the client-side path
degrades under an artificial worst case) — not a measurement of the real
day-to-day Dashboard/Analytics request path, which never receives more
than a few hundred rows for even a 250k-observation history.

## What was NOT measured this pass

- **Serialization/Tauri IPC/worker-transfer layers (C/D/E)**: since the real
  payload is only 70-280 rows (not 250k), these layers are expected to be
  negligible by construction, but this was not independently timed this
  pass.
- **Analytics-model/chart-spec-prep/ECharts render layers (F/G/H)**: not
  measured this pass — would require native browser profiling (CDP
  Performance/Tracing) against a seeded large-history Dev build, which
  was not set up given the time already spent on the backend breakdown
  and the Wave A notification investigation in this same session.
- **Dashboard/Analytics cold-open, range-switch, provider-filter,
  theme-switch timing; settled idle CPU; memory**: not re-measured this
  pass (the most recent real Product V3 numbers stand as the last
  evidence for these, unverified against current HEAD).
- **Stale-request-race adversarial test** (owner section 18): not added
  this pass — the existing analytics model's cancellation/generation-ID
  handling was not re-audited or stress-tested this pass.

## Verdict

**PERFORMANCE: NOT PASSED.** The 250k backend figure is real, current,
broken into its two real layers, and shows no regression. The single most
valuable finding this pass is architectural, not a raw number: the
"250k raw points shipped to the UI" failure mode the request worried about
does not exist in the current pipeline. But the frontend-side layers,
interaction timings, idle CPU/memory, and the stale-request race remain
unmeasured/unverified this pass — a partial result, not a full pass.
