# Phase 4 — Data Accuracy Audit (Trust Pass)

Status: audit complete, code changes tracked separately in this doc's
"Defects" section and fixed incrementally in subsequent Phase 4 commits.
Starting HEAD: `70717d30` (Phase 3.6). Phase 3/3.5/3.6 accepted PASS.

This document traces the **complete existing data pipeline** for every
statement Quotalis makes about usage, tokens, requests, quota, cost, and
history — end to end, before any Phase 4 code was written — per the
owner's explicit instruction not to assume prior audits caught everything.

## 1. Pipeline trace: provider response → UI

```
Provider API/CLI response
   │
   ▼
rust/src/providers/<provider>/mod.rs
   -> ProviderFetchResult { usage: UsageSnapshot, cost: Option<CostSnapshot>, ... }
   │  UsageSnapshot: primary/secondary/model_specific/tertiary/extra_rate_windows
   │    (each RateWindow: used_percent, remaining_percent, resets_at, ...)
   │  CostSnapshot: used, limit, currency_code, currency_symbol, period,
   │    resets_at, updated_at, balance, daily: Vec<CostDailyPoint>
   │  NEITHER struct carries token counts, request counts, or a model ID
   │  as first-class fields (core/usage_snapshot.rs:75-109, 229-264).
   ▼
apps/desktop-tauri/src-tauri/src/commands/bridge.rs
   -> ProviderUsageSnapshot (the live, "right now" snapshot sent to React)
   │  Has NO account_id/accountId field, despite the fetch pipeline
   │  receiving token_account_id: Option<uuid::Uuid> (dropped after use,
   │  bridge.rs:165-211).
   ▼ (in parallel, independent path)
apps/desktop-tauri/src-tauri/src/history_recorder.rs
   -> samples_for_snapshot() writes rows into rust/src/history.rs's SQLite
      store (history.db, table usage_samples: id, account_id, provider,
      window_id, window_label, used_percent, remaining_percent, cost_used,
      resets_at, captured_at).
   │  account_key_for() (history_recorder.rs:24-32) always resolves to the
   │  FIRST enabled ProviderAccount for a given provider CLI name -- a
   │  second account for the same provider is silently never recorded.
   │  Dedup key (history.rs:143-174): (account_id, window_id, used_percent,
   │  cost_used) via SQL IS (NULL-safe), DEDUP_WINDOW_SECS=45,
   │  DEFAULT_RETENTION_DAYS=90.
   ▼
rust/src/dashboard_data.rs
   -> DashboardSnapshot { generatedAt, rangeSince, rangeUntil, grain,
      timezone, availability: DataAvailability, providers, usageTrend,
      spendTrend }
   │  aggregate_usage(): last-value-per-bucket (274-306) -- correct for a
   │  gauge (used_percent).
   │  aggregate_spend(): ALSO last-value-per-bucket per (provider,
   │  account_id, bucket_start) (308-334) -- this is the correct way to
   │  store one bucket's cost_used, and the struct's own doc comment says
   │  the value is "whatever the provider reported as its own
   │  dollar-usage figure" (237-242), i.e. a point-in-time/period
   │  cumulative reading, NOT a delta.
   │  DataAvailability (194-249): hasCostData is real (checks actual
   │  cost_used samples exist); hasTokenData/hasRequestData/hasModelData
   │  are doc-commented as "always false today" -- the schema has no
   │  columns for them, so no code path can set them true regardless of
   │  what a provider actually returns.
   ▼
apps/desktop-tauri/src/types/bridge.ts
   -> TS mirror of DashboardSnapshot/DataAvailability (1033-1097), same
      "always false" comment preserved -- the frontend has no way to know
      per-provider token/request/model support even where the Rust
      provider module itself surfaces it (e.g. Cursor's
      token_cost.rs EventTokenUsage, Claude admin_api.rs's uncached/cached
      token breakdown) because dashboard_data.rs's aggregation never
      reads those fields out of the raw provider fetch -- only out of the
      history.db samples, whose schema doesn't carry them.
   ▼
apps/desktop-tauri/src/surfaces/dashboard/analytics/dashboardSelectors.ts
   -> computeKpis() reads snapshot.spendTrend and derives estimatedSpendTotal
      (260-264):
        spendPoints.reduce((sum, p) => sum + p.costUsed, 0)
      *** CONFIRMED DEFECT -- see "Defects found" #1 below. ***
   ▼
Dashboard UI (DashboardAnalyticsPanel.tsx and children)
   -> renders the (currently wrong) "Estimated Spend" KPI, Usage Trend
      cost series, Data Status panel.
```

## 2. Second, independent cost pipeline (not wired to the Dashboard)

`rust/src/cost_scanner.rs` scans local Codex/Claude CLI JSONL session logs
directly, computing `CostSummary { total_cost_usd, input_tokens,
output_tokens, cached_tokens, sessions_count, by_model, by_model_tokens }`
via `CostUsagePricing::{codex,claude}_cost_usd`. This feeds
`apps/desktop-tauri/src-tauri/src/commands/usage_spend.rs` and the
Settings → "Usage & Spend" tab (`UsageSpendTab.tsx`) only. It is
**structurally unrelated** to `history.db`/`DashboardSnapshot` — same
underlying usage, two independent derivations, no reconciliation, and no
shared cost-origin labeling. See "Defects found" #2.

## 3. Defects found (existing code, pre-Phase-4)

1. **`estimatedSpendTotal` sums cumulative-period readings across time
   buckets** —
   [dashboardSelectors.ts:260-264](../../apps/desktop-tauri/src/surfaces/dashboard/analytics/dashboardSelectors.ts:260).
   `SpendDailyPoint.cost_used` is, by `dashboard_data.rs`'s own doc
   comment, "whatever the provider reported as its own dollar-usage
   figure" for that bucket — a point-in-time/period reading, not a delta.
   Summing N buckets of the same running total inflates the KPI by
   roughly Nx and violates the owner's explicit rule 23/24 ("do not sum
   cumulative snapshots... never double-count"). **Must fix in Phase 4.**
   Root cause: the aggregation function is correct (last-value per
   bucket); the KPI selector layered a naive `reduce`/sum on top without
   checking whether the underlying quantity is additive. The fix is to
   stop summing across buckets for a cumulative/period metric — report
   the latest bucket's value (current period-to-date spend) instead, or
   compute an explicit delta only where the reset semantics are known.

2. **Two independent, unreconciled cost pipelines** (`history.db` →
   `DashboardSnapshot` vs. `cost_scanner.rs` → `UsageSpendTab`) can show
   different dollar figures for the same underlying usage, with no
   indication to the user that they are different measurements (one is
   provider-reported cumulative balance/spend; the other is a local
   token-based recomputation from JSONL logs). Per owner rule 8
   ("provider-reported cost wins over local recomputation — never add
   them"), Phase 4 must make this precedence explicit wherever both
   pipelines' output could appear near each other, and must label each
   number with its real origin.

3. **`DataAvailability`'s `hasTokenData`/`hasRequestData`/`hasModelData`
   are hardcoded false** regardless of what a given provider's raw fetch
   actually contains (e.g. Cursor and Claude Admin API both return real
   per-request token breakdowns today) — the `usage_samples` schema has
   no columns for them. This is honest (no fabrication) but incomplete:
   Phase 4 should either (a) extend the schema/aggregation so real
   per-provider token capability surfaces, or (b) explicitly document
   this as a known Phase-4 limitation rather than a defect requiring a
   schema migration in this phase. Given the phase's "do not build the
   forecast engine yet" spirit and the risk of a rushed schema change,
   this audit recommends **(b) for now**: keep the flags honestly false,
   but stop implying (via naming alone) that "unavailable" means "no
   data exists anywhere" — Phase 4's new `costOrigin`/`pricingStatus`
   fields (see `PRICING_CATALOG.md`) carry the real nuance for cost
   specifically, which is the money-relevant subset this phase is
   scoped to.

4. **Multi-account history silently drops all but the first-enabled
   account per provider** (`history_recorder.rs::account_key_for()`,
   lines 24-32). Not a cost-correctness bug per se (no numbers are wrong
   for the account that IS recorded), but a data-completeness gap
   relevant to owner rule 26. Documented as a known limitation; fixing it
   requires a schema/recorder change beyond Phase 4's pricing-accuracy
   scope and risks destabilizing the already-verified Phase 3 history
   pipeline, so it is **not fixed in Phase 4** — flagged for a future
   phase.

5. **Single app-wide timezone for all providers' bucketing**
   (`dashboard_data.rs::resolve_timezone`) — does not use each
   provider's own billing-period timezone (most providers don't expose
   one). Documented as a known limitation (owner rule 27); no provider
   in the registry surfaces a per-provider reset timezone field to
   correct against, so there is nothing concrete to fix without
   guessing — guessing is explicitly prohibited.

## 4. What Phase 4 will NOT change

- The Phase 3/3.5/3.6 2D Dashboard layout, unless a data-semantics fix
  requires a small, targeted correction (e.g. the Estimated Spend KPI's
  underlying computation and label).
- `history.rs` dedup logic — re-audited against real cost semantics
  (owner rule 25) and found correct: the dedup key
  `(account_id, window_id, used_percent, cost_used)` treats a changed
  `cost_used` as a genuinely new sample even when `used_percent` is
  identical (regression test
  `dedups_cost_samples_by_cost_value_not_placeholder_percent`,
  `history.rs:386-407`), so legitimate cost samples are not collapsed.
- The `usage_samples` SQLite schema's core columns (defect #3's resolution
  above still stands: `has_token_data`/`has_request_data`/`has_model_data`
  remain hardcoded `false`). **Superseded by Phase 4A below**: two
  additive, backward-compatible columns (`cost_currency_code`,
  `cost_measurement_kind`) were added — see section 5.
- Any of `cost_scanner.rs`'s JSONL-log scanning logic itself (only its
  *labeling/precedence* relative to the Dashboard's numbers is in scope).

See also: [QUOTALIS_PROVIDER_DATA_CAPABILITIES.md](QUOTALIS_PROVIDER_DATA_CAPABILITIES.md),
[PRICING_PROVENANCE.md](PRICING_PROVENANCE.md),
[PRICING_CATALOG.md](PRICING_CATALOG.md).

## 5. Phase 4A — Monetary Semantics & Cost Aggregation Correction

Phase 4A superseded remaining lower-priority Phase 4 work to fix defect
#1 (this doc's section 3, item 1) properly and completely, after the
initial Phase 4 fix (commit `6d3a16fb`) turned out to encode an
incomplete assumption. This section is the dedicated, non-downplayed
record the owner's Phase 4A spec requires.

### 5.1 Old behavior

`dashboardSelectors.ts`'s `computeKpis()` computed `estimatedSpendTotal`
as:
```ts
spendPoints.reduce((sum, p) => sum + p.costUsed, 0)
```
— a plain sum of every `SpendTrendPoint` in the requested display range,
across every time bucket, for every provider/account.

### 5.2 Why it was mathematically wrong

`SpendDailyPoint`/`SpendTrendPoint.costUsed` is not a delta. It is
whatever a provider's `CostSnapshot.used` field held at capture time --
documented in `core/usage_snapshot.rs` as "Amount used in the current
period", i.e. a **running total for the provider's current billing
period**. A history series like:
```
day 1: $1.00
day 2: $2.00
day 3: $3.00
day 4: $4.00
```
represents the SAME underlying period-to-date total read four times
(spend increased from $1 to $4 over four days) -- not four independent
$1 charges. Summing them (`1+2+3+4 = $10`) reports 2.5x the real current
spend ($4). The error scales with how many buckets/days are in the
requested range: `Last 30 Days` would have summed roughly 30x more
inflation than `Today`.

### 5.3 Root cause (deeper than the first fix realized)

The first Phase 4 fix (commit `6d3a16fb`) corrected the "sum across
time" mistake by taking only the latest bucket per (provider, accountId)
series, then summing those latest values *across* providers/accounts.
That is safe **only when every provider being combined reports the same
kind of number**. A dedicated provider-adapter audit (Phase 4A, this
document's evidence base) proved that assumption false: **6 of the 24
`CostSnapshot`-constructing providers** (`crossmodel`, `sub2api`,
`devin`, `neuralwatt`, `opencodego`, `zenmux`) write a **point-in-time
prepaid balance** into `used`, not period spend -- a balance can
legitimately *decrease* as money is spent, which is the opposite
direction from a spend total. `codex` has two code paths with genuinely
different semantics (a real spend-control cumulative total, or a raw
credit balance) with nothing in `history.db` recording which path
produced a given historical row. Combining a Cumulative-period-spend
provider with a PointInTime-balance provider in one "sum the latest
readings" total (even without ever summing across time) still conflates
two different kinds of number.

### 5.4 Affected code

- `apps/desktop-tauri/src/surfaces/dashboard/analytics/dashboardSelectors.ts`
  -- `computeKpis`/`totalReportedSpend` (the KPI total).
- `rust/src/dashboard_data.rs` -- new `CostContract`, `CostOrigin`,
  `CostMeasurementKind`, `CostAvailability`, `PricingStatus` types;
  `provider_cost_measurement_kind()`; `aggregate_spend()` now also
  carries `currency_code`/`measurement_kind` per bucket.
- `rust/src/history.rs` -- additive schema migration (`user_version` 2
  and 3): `cost_currency_code`, `cost_measurement_kind` columns.
- `apps/desktop-tauri/src-tauri/src/history_recorder.rs` -- stamps both
  new columns at write time from the real `CostSnapshot` and the proven
  per-provider classification.
- `apps/desktop-tauri/src-tauri/src/commands/dashboard.rs` -- bridges
  the new `CostContract` and per-point currency/measurement-kind fields
  to the frontend.
- `apps/desktop-tauri/src/types/bridge.ts` -- `CostContract`,
  `CostOrigin`, `CostMeasurementKind`, `CostAvailability`,
  `PricingStatus` TS mirrors; `SpendTrendPoint` gains `currencyCode`/
  `measurementKind`.
- `KpiRow.tsx` -- renders the KPI in its real currency (`Intl.NumberFormat`)
  instead of a hardcoded `$` prefix, and only when the contract proves a
  trustworthy combined total exists.
- `DataStatusPanel.tsx`/`dashboardSelectors.ts`'s `resolveDataStatus` --
  cost/pricing status now reads the real `CostContract` instead of
  inferring from `hasCostData` alone.
- Locale files (`en-US.ftl`, `ar-SA.ftl`) -- new/renamed Data Status
  strings (`DashboardDataStatusCostProviderReported`,
  `DashboardDataStatusCostLegacyAmbiguous`,
  `DashboardDataStatusPricingNotRequired`).

### 5.5 Affected ranges

Every display range (`Today`, `7 Days`, `30 Days`, `This Month`,
`3 Months`, `This Year`, `Custom`) was affected by the original bug --
the inflation factor scaled with the number of buckets the range
produced (more days/hours = more summed cumulative readings = worse
inflation), so wider ranges were wrong by a larger factor than `Today`.

### 5.6 Could real displayed historical numbers have been inflated?

**Yes, structurally, for any account that had more than one cost sample
in the selected range while running a pre-Phase-4 build.** Whether any
*specific* real user ever saw an inflated number in this Quotalis Dev
environment could not be confirmed one way or the other: this
environment's `history.db` has never held real multi-day cost history to
observe the bug against (see section 6's real-Dev-state report below).
The bug is proven mathematically (this doc's before/after reproduction)
and by the now-fixed/tested code path, not by having caught it live in a
screenshot.

### 5.7 Corrected semantics

- **Never sum a cumulative reading across time buckets of the same
  series** (unchanged conclusion from the first fix, now with a name:
  `CostMeasurementKind::Cumulative` readings use "latest bucket wins").
- **Never combine series across providers/accounts of different
  measurement kinds.** `CostContract.measurementKind` collapses to
  `Unknown` the moment more than one kind (or an unclassified provider)
  appears in the relevant sample set, and the frontend's
  `reportedSpendTotal` returns `null` whenever the contract is anything
  but a uniform `Cumulative` reading in one known currency.
- **Never combine currencies.** `CostContract.currencyCode` is `None`/`null`
  the moment more than one currency appears; the combined KPI is
  unavailable in that case (no FX, per owner rule 13).
- **Pre-Phase-4A ("legacy") rows are never treated as trustworthy.** A
  row with no recorded currency reads back as
  `CostAvailability::LegacyAmbiguous` and is excluded from any combined
  total -- the raw row is still visible in history for inspection, just
  not aggregated.
- Bucket granularity (hourly vs. daily) does not change the true current
  total -- proven by
  `changing_bucket_grain_does_not_change_the_latest_cumulative_reading`.

### 5.8 Legacy-data limitations

Every row written before this migration (schema `user_version` < 2) has
no recorded currency or measurement kind. These rows are NOT
retroactively reinterpreted, NOT deleted, and NOT rewritten -- they
remain fully queryable (usage/quota data on the same rows is completely
unaffected), but any cost figure on such a row is excluded from every
Phase-4A-and-later monetary aggregate. This is a deliberate, permanent
limitation of pre-Phase-4A history, not a bug: guessing a currency or
measurement kind for old data would violate the same "never guess" rule
this phase exists to enforce.

### 5.9 Before/after reproduction (real fixture shape)

Using a `SpendDailyPoint`-shaped fixture matching the real
`CostSnapshot.used`/`currency_code` fields exactly as `claude`'s adapter
constructs them (Cumulative, USD):
```
Reading 1 (day 1): $2.00
Reading 2 (day 2): $4.00
Reading 3 (day 3): $6.00
```
- **OLD** (`spendPoints.reduce((sum, p) => sum + p.costUsed, 0)`):
  `2 + 4 + 6 = $12.00` -- wrong, 2x the true current spend.
- **NEW** (latest reading in the series, per `CostMeasurementKind::Cumulative`
  semantics): `$6.00` -- correct.

Reproduced executably in
`rust/src/dashboard_data.rs::tests::latest_value_per_bucket_never_sums_a_cumulative_series`
and mirrored in
`dashboardSelectors.test.ts`'s `"PHASE 4A regression: never sums a
cumulative-period reading across time buckets..."` test.
