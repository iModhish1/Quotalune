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

## 6. Phase 4A.1 — Monetary Contract Semantic Closure

Starting HEAD `160853db` (Phase 4A accepted). This section closes the one
remaining semantic gap Phase 4A's own audit surfaced but did not yet
formalize: `CostMeasurementKind` (temporal shape) is not sufficient to
describe a monetary observation -- it says nothing about WHAT the number
represents. A provider that reports a prepaid balance and a provider
that reports period spend can both read as the same measurement kind
while meaning financially opposite things.

### 6.1 The missing dimension: `MonetaryQuantityKind`

`MonetaryQuantityKind ∈ {Spend, Balance, Credits, Unknown}`, orthogonal
to `CostMeasurementKind ∈ {Cumulative, Delta, PointInTime, Unknown}`. See
`rust/src/dashboard_data.rs`'s `MonetaryQuantityKind` enum and
`classify_monetary_observation()` for the full model, and
`CostContract` for how both dimensions attach to a `DashboardSnapshot`
alongside origin/currency/period/availability/pricing-status. Every one
of the 24 `CostSnapshot`-constructing providers is classified on BOTH
dimensions at once, from real adapter evidence -- never inferred from
the `cost_used` column name.

### 6.2 24-provider classification table

| Provider | Quantity kind | Measurement kind | Evidence |
|---|---|---|---|
| aiand | Spend | Cumulative | rolling-30-day summed log cost |
| bedrock | Spend | Cumulative | AWS Cost Explorer month-to-date |
| claude | Spend | Cumulative | admin_api.rs org cost report / web_api.rs extra-usage credits |
| commandcode | **Credits** | Cumulative | `plan.monthly_credits_usd - monthly_credits`, a credit allotment, not raw cash (`commandcode/mod.rs:356-366`) |
| cursor | Spend | Cumulative | billing-cycle "included"/on-demand spend |
| deepinfra | Spend | Cumulative | `payment/checklist` billing-cycle spend |
| deepseek | Spend | Cumulative | `/api/v0/usage/cost` current-month sum |
| fireworks | Spend | Cumulative | `billing/summary` 30-day rated spend |
| litellm | Spend | Cumulative | proxy `spend`/`spend_usd` field |
| llmproxy | Spend | Cumulative | `approximate_cost_usd` |
| minimax | Spend | Cumulative | 30-day billing-history sum |
| mistral | Spend | Cumulative | admin billing API, token-priced |
| openaiapi | Spend | Cumulative | credit-grants usage / Admin API org cost |
| openrouter | Spend | Cumulative | `/activity` 30-day summed cost |
| xai | Spend | Cumulative | team-scoped daily cost buckets |
| crossmodel | Balance | PointInTime | `CostSnapshot::new(0.0, ...)`, real balance in `.limit` (`crossmodel.rs:197`) -- **`used` is a constant 0 today; see 6.4 caveat** |
| sub2api | Balance | PointInTime | same 0.0-in-`used`/real-value-in-`.limit` shape (`sub2api/mod.rs:519,573`) |
| devin | Balance | PointInTime | `extra_usage_balance()` (`devin/mod.rs:141`) |
| neuralwatt | Balance | PointInTime | `prepaid_remaining()` (`neuralwatt/mod.rs:319`) |
| opencodego | Balance | PointInTime | scraped Zen balance (`opencodego/mod.rs:539`) |
| zenmux | Balance | PointInTime | PAYG balance, currency validated `== "usd"` (`zenmux/mod.rs:244`) |
| codex | **Credits, classified by adapter-produced `period` label, not provider ID alone** | **Cumulative if `period == "Monthly credits"`; PointInTime if `period == "Credits"` (the live case today)** | see 6.3 |

### 6.3 Codex dual-path, traced in full

| Code path | Source field | Business meaning | Measurement kind | Currency | Distinguishable at write time? |
|---|---|---|---|---|---|
| `build_result_from_json` -> `extract_credits` (`codex/api.rs:559-585`) -- **the ONLY path either `fetch_usage` or `fetch_usage_pat` (both live, production-used) ever calls** | `credits.balance` | Raw ChatGPT-account credit balance | PointInTime | `"USD"` (hard-coded; really credits) | **Yes** -- this path always sets `period = "Credits"` |
| `build_result` -> `SpendControlLimitSnapshot::to_cost_snapshot` (`codex/api.rs:588-660`, `947-965`) -- **dead code**: `UsageResponse`, the only type `build_result` accepts, is constructed nowhere except two unit tests (`codex/api.rs:1572,1598`) | `individual_limit.used` (or derived from `remaining_percent`/`limit - balance`) | Spend against a monthly credit limit | Cumulative | `"USD"` (hard-coded; really credits) | **Yes, if ever live** -- this path always sets `period = "Monthly credits"` |

**Result**: Codex's *live* fetch path is unambiguous and 100% traceable
-- it is always the Balance/PointInTime/Credits case, never the
theoretical Spend case, because the code that would produce the Spend
case is unreachable from any real fetch today. This supersedes Phase
4A's more conservative "Codex = Unknown, dual-path, can't distinguish"
classification, which was based on reading `build_result`'s branching
logic without first confirming which function the live fetch path
actually calls. `classify_monetary_observation("codex", period)`
resolves correctly using the adapter's own `period` string (real
evidence the adapter produced, not a guess) -- if `build_result`'s
branch is ever wired into a live path in the future, its distinct
`"Monthly credits"` label already classifies correctly with zero further
code changes, protected by
`classify_codex_would_resolve_monthly_credits_path_correctly_if_ever_live`.
An unrecognized period string for Codex fails closed to
`(Unknown, Unknown)`, never guessed.

### 6.4 Confidence caveats found during re-audit

- **crossmodel/sub2api's `cost_used` history is currently always `0.0`.**
  Both adapters pass `used = 0.0` and put the real balance in
  `CostSnapshot.limit`, which `history_recorder.rs` never reads or
  persists. Their Balance classification is correct, but no non-zero
  balance value from either provider reaches `history.db` today. Not
  fixed in this pass (would require persisting `.limit`, a separate,
  larger change) -- flagged explicitly rather than silently left as an
  apparent "real $0 balance".
- **`commandcode`/Codex's `currency_code` is hard-coded `"USD"`** even
  though both are genuinely credit-denominated, not cash. Pre-existing,
  not introduced or fixed by this pass; the `Credits` quantity
  classification is what keeps this from being treated as real currency
  regardless.

### 6.5 Dedup semantic fix

`history.rs`'s dedup key was `(account_id, window_id, used_percent,
cost_used)`. Two samples with the same `cost_used` but different
currency, quantity kind, or measurement kind are different facts, not
duplicates -- the key now also joins `cost_currency_code`,
`cost_measurement_kind`, and `monetary_quantity_kind` (all via NULL-safe
`IS`). Six new regression tests
(`rust/src/history.rs::tests::dedup_*`) prove: identical semantics still
dedup per existing timing rules; different currency, quantity kind,
measurement kind, or account never dedup; an untagged legacy row and a
semantically-known row with the same numeric value never silently
collapse.

### 6.6 Current-period vs. selected-range spend semantics

Phase 4A's latest-reading-wins rule is correct for **"current
billing-period reported spend"** -- it is NOT automatically the same
metric as **"total spend observed across the selected historical
range"** when that range crosses one or more billing-period resets (a
sequence like `8 -> 10 -> [reset] -> 0.5 -> 2` has a current-period spend
of `2`, but a hypothetical total-across-both-periods metric could be as
much as `12`, an entirely different number). Per owner instruction, Phase
4A.1 does NOT implement the second metric (reset-boundary detection
would require providers to declare *why* a reset happened, which none do
in-repo) -- the Dashboard's Spend KPI continues to expose only "current
billing-period reported spend", and the alternative metric remains
unavailable rather than approximated. `changing_bucket_grain_does_not_change_the_latest_cumulative_reading`
proves the resulting invariant: `Today`/`7 Days`/`30 Days` never change
the resolved current-period total merely because more buckets are
loaded.

### 6.7 Spend-trend chart semantics

`SpendTrendPoint`s are cumulative-period snapshots, not per-bucket
deltas -- `UsageTrendSection.tsx`'s chart renders each bucket's own
value as a line point (already correct: no summing happens there), which
visually reads as a cumulative-spend trajectory across the period, not a
"daily spend"/"cost per bucket" bar chart. No visual change was needed
this pass (re-confirmed by reading `UsageTrendSection.tsx`'s chart-point
mapping); the existing implementation does not imply per-bucket deltas.

### 6.8 Legacy data

Unchanged from Phase 4A section 5.8, restated per owner section 14: a
pre-migration row's `cost_used` is never inferred as `Spend` just
because the historical column is named `cost_used` -- column names are
not proof.
`cost_contract_legacy_row_never_inferred_as_spend_from_column_name`
proves this explicitly for the new quantity dimension.

### 6.9 Git-history reconciliation

The Phase 4A final report's "Starting HEAD: `afa4ddb3`" was accurate but
incomplete context: `afa4ddb3` was simply the most recent commit on this
same branch at the moment Phase 4A began, not a divergent starting
point. `70717d30` (the owner's last explicitly accepted checkpoint,
Phase 3.6) and `160853db` (Phase 4A's end) are connected by exactly
eight commits, all on `feature/v9-theme-runtime`, all from this same
continuous work session, with no unreported or unrelated change:

```
$ git log --oneline --decorate 70717d30..160853db
160853db docs: Phase 4A section — bug documented in full, not downplayed
51f42289 Phase 4A: frontend respects the cost-measurement contract, drops $-only rendering
e1969e1e Phase 4A: formal cost-measurement contract (Rust) — origin/kind/currency
afa4ddb3 docs+test: pricing catalog architecture, provenance, golden test corpus
1494c29e fix: label the Dashboard spend KPI/chart as "Reported Spend", not "Estimated"
6d3a16fb fix: stop summing cumulative spend across time buckets (Estimated Spend KPI)
789a2319 docs: Phase 4 provider data-capabilities matrix
35322ef4 docs: Phase 4 data pipeline audit — trace + confirmed defects
```
(`be08bd2d`, "docs: close Phase 3 profile-theme sanity check", is
`70717d30`'s direct child and the true start of this range -- included
above only where its own descendant commits begin the Phase 4 work.)

Classification: `35322ef4`/`789a2319` = Phase 4 audit docs;
`6d3a16fb`/`1494c29e` = the two confirmed correctness fixes;
`afa4ddb3` = pricing-catalog research/docs (explicitly not wired into
runtime); `e1969e1e`/`51f42289`/`160853db` = Phase 4A itself. No history
rewrite was performed or is needed.

### 6.10 Rust test-count reconciliation

The Phase 4A final report stated "cargo test --workspace -- 1558+1
passed" as the complete workspace total. That was **incomplete
reporting, not a lost/skipped test**: `cargo test --workspace` runs
THREE test binaries, not two --

```
Running unittests src\main.rs (target\debug\deps\Quotalis-*.exe)      -- 455 passed, 1 ignored
Running unittests src\lib.rs  (target\debug\deps\quotalis_core-*.exe) -- 1577 passed (was 1558 pre-Phase-4A.1)
Running unittests src\main.rs (target\debug\deps\quotalis-*.exe)      -- 1 passed
Doc-tests quotalis_core                                                -- 0
```

`Quotalis` (capital Q, `apps/desktop-tauri/src-tauri`'s `[[bin]]` target
-- `codexbar-desktop-tauri`'s actual binary name) and `quotalis`
(lowercase, `rust`'s own small `[[bin]]` target inside `quotalis_core`)
are two DIFFERENT binaries in the same Cargo workspace with
case-differing names. Cargo correctly builds and runs both as separate,
distinctly-hashed artifacts (`target/debug/deps/Quotalis-<hash>.exe` vs
`quotalis-<hash>.exe` -- confirmed no filename collision on this
Windows/case-insensitive filesystem: the hash suffix keeps them
distinct). The Phase 4A report's `cargo test --workspace` output tool
calls were read via a truncated `tail`, and the earlier "Quotalis" bin's
455-test block scrolled out of what was quoted in the final report --
the tests themselves ran and passed at the time; only the report's
arithmetic omitted them. **Total: 455 + 1577 + 1 + 0 = 2033 passed, 0
failed, 1 ignored** (the intentionally-`#[ignore]`d
`manual_verification_against_real_history_db` test, by design). This
satisfies PASS condition A: the complete expected suite runs, and the
discrepancy has a precise, verified explanation (case B is not needed,
but is also true).

### 6.11 Dev-history reconciliation

The 64-real-sample Dev history the owner referenced (`64 real samples,
~2.1 days, 1 provider`) is documented in
`docs/images/dashboard/phase3/EVIDENCE.md`: captured against a
`dev-channel` build at HEAD `8eac68dd` (a prior commit on this same
branch, mtime `2026-09-08 04:13:24`), data root `%APPDATA%\QuotaArc-Dev`
/ `%LOCALAPPDATA%\QuotaArc-Dev`. Read-only investigation this session
confirmed via `Test-Path`:
- `%APPDATA%\QuotaArc-Dev` -- does not exist
- `%LOCALAPPDATA%\QuotaArc-Dev` -- does not exist
- `%APPDATA%\QuotaArc` (Personal) -- does not exist either

Every Quotalis/QuotaArc app-data directory on this machine is currently
absent, for both Dev and Personal. This is an environment-continuity
fact, not a code regression and not cleanup performed by any Phase 4/4A
work: this session never launched any Quotalis binary, Dev or
otherwise, and the directories were already absent before any Phase 4
commit in this session touched anything. The most consistent
explanation is that the prior evidence was captured in a different
execution environment instance than the one this session runs in (this
repo also contains `.local/recovery/20260906-222639/` and
`.local/recovery/personal-backup-0.10.0-20260907-002703/`, both
consistent with at least one environment-level reset/recovery event
having occurred at some point before this session). `target/debug/`
does contain a leftover `QuotalisDev.exe` build artifact from that prior
work, but a binary artifact surviving does not imply its data directory
did. No data was fabricated to fill this gap; see 6.12.

### 6.12 Real Dev check (this session)

No Dev history database was found to query. Per owner section 19, this
is reported honestly rather than fabricated: this session recorded zero
new samples (no Quotalis binary was launched), and the prior 64-sample
dataset's on-disk location does not currently exist. There is nothing to
sanitize-and-report this pass.
