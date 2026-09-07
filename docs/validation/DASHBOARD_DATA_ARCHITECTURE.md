# Dashboard Data Architecture (Phase 1)

Date: 2026-09-07. Repo: `N:\QuotaArc\quotaarc`, branch `feature/v9-theme-runtime`.
This is Phase 1 of the Dashboard Studio mega-request: live history ingestion
+ a normalized `DashboardSnapshot` query layer, built entirely on local
SQLite. No cloud, no account, no server. Follows directly from
[`DASHBOARD_MASTER_AUDIT.md`](DASHBOARD_MASTER_AUDIT.md), which this
document supersedes on one point — see the correction section there and
below.

## Correction carried over from Phase 0

The Phase 0 audit claimed local history ingestion was completely unwired
("dead infrastructure"). That was wrong — the audit's search was scoped to
`rust/src` only and missed
[`apps/desktop-tauri/src-tauri/src/history_recorder.rs`](../../apps/desktop-tauri/src-tauri/src/history_recorder.rs:1),
which lives in the Tauri shell crate and has been calling
`HistoryStore::record_samples()` from the real provider-refresh path since
commit `aa824c3a` (2026-09-03, four days before this Dashboard Studio
request — unrelated to it). **Verified live on this machine**: the real
`%APPDATA%\QuotaArc\history.db` already contained 3,048 samples across 2
providers spanning ~4.1 days of real usage before any of this phase's work
began. Ingestion was not built this phase — the query/aggregation layer on
top of it was.

## What already existed (unchanged this phase)

- [`rust/src/history.rs`](../../rust/src/history.rs:1) — the `HistoryStore`
  (SQLite, WAL, `usage_samples` table), account-scoped, deduplicated
  (`DEDUP_WINDOW_SECS = 45`), with a `DEFAULT_RETENTION_DAYS = 90` pruning
  policy.
- [`history_recorder.rs::record_snapshot`](../../apps/desktop-tauri/src-tauri/src/history_recorder.rs:161) —
  called from the one real refresh boundary
  ([`commands/providers.rs:440`](../../apps/desktop-tauri/src-tauri/src/commands/providers.rs:440),
  inside `refresh_provider()`, right after the snapshot is normalized and
  published to the UI cache). Skips error snapshots entirely (never records
  a failed refresh as valid usage). Account resolution: the first enabled
  account for the provider in the active profile, or a stable synthetic
  `provider:<cli>` key. `prune_on_startup()` is called from
  [`main.rs:442`](../../apps/desktop-tauri/src-tauri/src/main.rs:442).

## What this phase adds

### 1. Cost recording (a real, bounded gap-fill)

`history_recorder.rs` recorded quota-percentage windows (`selected`,
`primary:*`, `extra:*`) but never recorded `snapshot.cost` at all —
`cost_used` was always `NULL`. Fixed: when a snapshot carries a
`CostSnapshotBridge`, a distinct sample is now recorded with
`window_id: "cost"` and `used_percent`/`remaining_percent` pinned to `0.0`
(a placeholder, never meant to be read as quota) so a dashboard "spend"
query never accidentally mixes a dollar amount into a percentage
aggregate, and a provider with no cost data simply produces no `cost` rows
— never a fabricated `$0`.

**Dedup bug found and fixed alongside this**: the existing dedup key only
compared `used_percent`. Since a cost sample's `used_percent` is always the
`0.0` placeholder, two *different* cost readings captured within the 45s
dedup window would have been wrongly treated as duplicates of each other
and silently dropped. `record_samples`'s dedup query now also compares
`cost_used` (via `IS`, so `NULL == NULL` still matches for non-cost
samples). Regression test:
`history::tests::dedups_cost_samples_by_cost_value_not_placeholder_percent`.

### 2. `rust/src/dashboard_data.rs` — the query/aggregation layer

Pure functions over `HistoryStore`/`UsageSample`, no I/O beyond the store
queries it's given:

- **`DashboardRangeKind`** (`Today`/`Last7Days`/`Last30Days`/`ThisMonth`/
  `Last3Months`/`ThisYear`) + **`resolve_range(kind, tz, now)`** —
  timezone-aware boundary resolution. "Today" in `Asia/Riyadh` is not the
  same UTC window as "Today" in `America/New_York`; every boundary is
  computed via `chrono_tz` against the *local* calendar date, not UTC.
  Handles both real DST transitions explicitly: a fall-back's ambiguous
  local midnight resolves to its earlier occurrence; a spring-forward gap
  (where local midnight doesn't exist for a date) steps forward in whole
  hours until a valid local instant is found. `Custom` ranges use caller-
  supplied epoch bounds directly (`resolve_custom_range`).
- **`Grain`** (`Hourly` for `Today`, `Daily` for everything else) —
  buckets are aggregated before being returned, never raw per-sample
  points (per the "don't send 100,000 points to a chart" requirement;
  current real data volume doesn't need hourly grain beyond `Today`, but
  the type is ready for a finer grain later without a contract change).
- **`DataAvailability`** — `first_sample_at`/`last_sample_at`/
  `sample_count`/`has_cost_data`/`has_token_data`/`has_request_data`/
  `has_model_data`. The last three are **always `false`** today: the
  `usage_samples` schema has no columns for token counts, request counts,
  or model attribution, because no `ProviderUsageSnapshot` field carries
  that data through the bridge (verified in Phase 0's audit) — keeping
  these explicitly `false` is what stops a future Dashboard UI from
  inventing per-model or per-token analytics this store cannot support.
- **`aggregate_usage`**/**`aggregate_spend`** — group samples into
  per-(provider, account, bucket) points, taking the *last* sample in each
  bucket (a "close" value, the natural way to read a point-in-time gauge
  like quota-used% on a timeline, as opposed to summing — which would
  double-count a value that isn't cumulative).
- **`latest_provider_summaries`** — the current state of each
  provider/account ("what is my quota right now"), deliberately
  independent of whatever display range was requested.
- **`build_dashboard_snapshot`** — assembles all of the above into one
  `DashboardSnapshot`. Every field is derived from real samples; an empty
  or thin history produces an honestly empty/thin snapshot, never
  fabricated data.

### 3. `commands/dashboard.rs` — the one bridge command

`get_dashboard_snapshot(range, timezone, customSince, customUntil,
providers) -> DashboardSnapshotBridge` — the single typed command every
future Dashboard widget should consume (per the "no ten commands for ten
cards" requirement), not raw per-widget SQLite access. `timezone: None` or
`"system"` resolves via the same `local_timezone_name()` the Reset
Presentation system's Rust-side formatting already uses (re-exported as
`dashboard_data::resolve_system_timezone()`), so "system timezone" means
the same IANA zone everywhere in the app, re-resolved fresh on every call
— never permanently cached.

## Real native verification

Ran the exact production `get_dashboard_snapshot` code path against the
real, already-populated `%APPDATA%\QuotaArc\history.db` on this machine (an
`#[ignore]`d test, `commands::dashboard::tests::
manual_verification_against_real_history_db`, run manually with
`--ignored` so normal `cargo test` never touches a real user's database).
Real output (abridged):

```
timezone: "Asia/Riyadh"          // system zone resolved correctly
availability: { sample_count: 3048, first_sample_at: Some(1788385252),
                 last_sample_at: Some(1788742994), has_cost_data: false }
providers: [
  { provider: "codex", account_id: "4a714a66-...", used_percent: 98.0,
    resets_at: Some("2026-09-12T11:48:34+00:00") },
  { provider: "copilot", account_id: "provider:copilot", used_percent: 0.0,
    resets_at: Some("2026-10-01T00:00:00+00:00") },
]
usage_trend: [ 6 daily buckets across ~4.5 days, codex ranging 34%–98% ]
spend_trend: []                  // honest -- no cost samples exist yet
                                  // (the cost-recording fix landed this
                                  // phase; no refresh has produced a cost
                                  // snapshot for codex/copilot since)
```

This confirms the whole pipeline end-to-end against real data: system
timezone resolution, range boundary math, per-provider/account grouping,
and honest unavailability (`has_cost_data: false`, empty `spend_trend`) all
work correctly on the machine's actual usage history.

## Privacy

`UsageSample` (both the existing schema and this phase's new `cost`
samples) carries only `account_id` (a stable synthetic or profile-store
UUID, never an email/display name), `provider`, `window_id`/`window_label`,
percentages, an optional cost figure, and epoch timestamps. No token,
cookie, API key, or raw provider-response payload is ever constructed
here — `ProviderUsageSnapshot` (the bridge DTO this pipeline reads) never
carries secrets in the first place (verified in Phase 0's audit).

## Explicitly out of scope this phase

- **No frontend consumption yet** — no React hook/selector calls
  `getDashboardSnapshot()`. Per the owner's own Phase 1 scope note ("no
  giant visual redesign yet... a minimal diagnostic view only if needed to
  verify the snapshot"), and given the Rust-side native verification above
  already proves the pipeline against real data end-to-end, a frontend
  wiring pass was judged lower-value than finishing the Rust contract
  correctly first. This is the natural next slice.
- **No alerts/insights/projection engine** — `DashboardSnapshot` carries
  the raw ingredients (`usage_trend`, `spend_trend`, `availability`) an
  insights layer would need, but no delta/rolling-average/projection logic
  was built this phase (spec sections 27-28 explicitly frame these as
  optional foundation, not required this phase).
- **No weekly/monthly aggregation grain** — `Last3Months`/`ThisYear` use
  daily buckets rather than a coarser weekly/monthly grain. With ~4 days of
  real history today, a finer distinction wouldn't currently produce a
  different result; revisit once real history is deep enough for it to
  matter.
- **Account/multi-account resolution stays as the pre-existing design**:
  `account_key_for()` picks the *first* enabled account per provider in
  the active profile. A provider with genuinely multiple simultaneous
  accounts collapses to that one key today (an existing limitation, not
  introduced this phase) — the bridge DTO (`ProviderUsageSnapshot`) has no
  per-account discriminator field to resolve this precisely without a
  larger bridge change.
- **No SQL-side aggregate pushdown** — `DataAvailability`/aggregation are
  computed in Rust from `HistoryStore::query()`'s full result set, not a
  `SELECT MIN/MAX/COUNT` at the SQL layer. Fine at the current real row
  count (~3,000); worth revisiting with real query-time measurements if
  history grows into the hundreds of thousands of rows.
