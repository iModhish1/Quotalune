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

## 7. Phase 4B — Provider Capability Matrix + Billing Channel Audit + Official Pricing Provenance

Starting HEAD `24fb9800` (Phase 4A/4A.1 closed). Full detail lives in
[QUOTALIS_PROVIDER_CAPABILITY_MATRIX.md](QUOTALIS_PROVIDER_CAPABILITY_MATRIX.md)
and the updated [PRICING_PROVENANCE.md](PRICING_PROVENANCE.md); this
section is the narrative summary.

### 7.1 Provider count reconciliation

`ProviderId::all()` (`rust/src/core/provider.rs`) lists **70** real
registered providers. **22 distinct provider directories** construct any
`CostSnapshot` at all: 14 Spend + 6 Balance + 2 Credits (CommandCode,
Codex) = 22, matching Phase 4A.1's arithmetic exactly. The earlier
Phase 4 audit's "24" figure counted **files**, not providers (`claude`
spans 2 files, `cursor` spans 3 -- 22 providers + 2 extra files from
those two = 24 grep hits). No real discrepancy in substance; a units
mismatch in an earlier doc, now corrected and explained.

### 7.2 Structural finding: no typed model/token/request field exists anywhere

Every adapter-facing type (`UsageSnapshot`, `RateWindow`, `CostSnapshot`)
lacks a dedicated field for model ID, input/output tokens, cached-token
categories, or request count. A separate `TokenUsageSummary`/
`WidgetSnapshot` type family exists but is dead code -- confirmed no
provider ever constructs it. Wherever this data appears in a live
adapter at all, it is free text embedded in a display string
(`login_method`/`reset_description`), never a structured field, and
never persisted to `history.db`.

### 7.3 Billing channel audit

Several providers blend more than one billing channel under a single
`ProviderId` (`claude`: OAuth subscription quota + Admin-API DirectApi +
web-session overage; `minimax`, `neuralwatt`, `opencodego`, `sub2api`,
`zenmux`: similar mixes). The hard rule this phase set out to verify
(subscription quota must never be priced with API-key pricing) is
already respected structurally in the registry design: `codex`
(ChatGPT-account credits, OAuth, `chatgpt.com/backend-api/wham/usage`)
and `openaiapi` (raw API key, `api.openai.com/v1/organization/*`) are
deliberately separate `ProviderId`s, confirmed by independently reading
both adapters -- the same pattern repeats for `xai`/`grok` and
`cursor`/any raw-API provider.

### 7.4 Local-estimation eligibility result

`rust/src/pricing_eligibility.rs` (new, pure, offline, 14 tests) makes
the hard rule executable: `can_locally_estimate_cost(observation,
pricing_requirements)` checks billing-channel match first (always,
independent of every other field), then canonical model, then every
required billable category, then currency/unit, then pricing
verification -- any single miss fails closed with a named reason, never
a fallback. Applying this to the real registry: **no provider is
eligible for local cost estimation today.** The 14 Spend providers
already report real dollars directly (a local estimate would be
redundant, not additive -- owner rule: provider-reported wins). The 6
Balance and 2 Credits providers fail on billing-channel mismatch against
any DirectApi pricing record. The 48 non-monetary providers have no
monetary observation to estimate against at all.

### 7.5 A real, previously-undocumented finding: `cost_scanner.rs`'s billing-channel gap

`cost_scanner.rs` (the separate JSONL-session-log pipeline behind
Settings -> "Usage & Spend", explicitly out of Phase 4/4A/4A.1 scope)
applies `CODEX_PRICING`/`CLAUDE_PRICING` -- both independently verified
against official DirectApi pricing -- to every local Codex/Claude CLI
session log uniformly, regardless of whether that session was run under
a flat-fee subscription (ChatGPT Plus/Pro/Team, Claude Pro/Max) or a
raw, per-token-metered API key. Live official-source research
(`support.claude.com`, fetched 2026-09-08) confirms subscription-covered
Claude Code usage is NOT itself billed per-token unless the user
explicitly opts into API-rate overage; `codex/api.rs:216-220` confirms
Codex CLI's `auth.json` distinguishes the two auth modes but
`cost_scanner.rs`'s session parser never records which one produced a
given file. This is exactly the "ChatGPT/Codex subscription quota != API
token billing" mismatch this phase's hard rule names -- a real,
currently-shipping risk, **not fixed this phase** (out of scope), flagged
as a required Phase 4C prerequisite investigation.

### 7.6 Official pricing research (scoped narrowly, per owner instruction)

Only the two pricing tables an actual code path consumes
(`CODEX_PRICING`, `CLAUDE_PRICING`, both feeding `cost_scanner.rs`) were
in scope for fresh research -- researching official API price lists for
all 22 monetary providers would produce data Quotalis cannot use, since
20 of them already report real provider-reported figures directly.
Anthropic and OpenAI's official DirectApi pricing were already verified
in Phase 4 (`claude.com/pricing`, `developers.openai.com/api/docs/
pricing`); this phase adds the required per-record provenance table
format, the source-trust hierarchy, the discrepancy-handling policy, and
the model-alias audit, all in `PRICING_PROVENANCE.md`. The `gpt-5.6-sol`
discrepancy from Phase 4 remains **UNRESOLVED**, not silently fixed.

### 7.7 Persistence capability

A second matrix in `QUOTALIS_PROVIDER_CAPABILITY_MATRIX.md` section 6
proves exact historical cost estimation is not possible for any provider
today, even the 5 (`claude` Admin-API, `openaiapi`, `openrouter`,
`mistral`, `opencodego` local-SQLite) that momentarily have real
token/model text in a live fetch -- `history_recorder.rs`'s cost-sample
branch only ever persists the aggregate dollar figure, never the
underlying token/model facts. No schema change was made this phase
(owner section 29) -- this is a capability-gap finding for a future
Phase 4C decision only.

### 7.8 Arabic terminology review

Reviewed every Phase 4A/4A.1 monetary term. Found and fixed one real
collision: `DashboardDataStatusCostProviderReportedCredits` originally
used "الأرصدة" (the balances -- same root as Balance's "الرصيد"),
which would have visually/semantically blurred Balance and Credits in
Arabic exactly as owner section 45 warns against. Changed to "وحدات
الائتمان" (credit units, a distinct root, ائتمان = credit). Spend
(إنفاق), Balance (رصيد), Credits (ائتمان), Pricing (تسعير), and
Unavailable (غير متاح) now use five genuinely distinct Arabic roots.

### 7.9 No runtime changes

No pricing engine wired, no forecasting, no schema migration, no
Dashboard redesign. `pricing_eligibility.rs` is a pure, offline,
untested-in-production model -- 14 new tests validate the rule itself,
not any live calculation.

### 7.10 Phase 4C shortlist

**No provider is shortlisted.** Per the eligibility result (7.4), every
current provider fails at least one hard precondition: the 14 Spend
providers don't need local estimation (redundant), the 6 Balance + 2
Credits providers fail billing-channel match, and the 48 non-monetary
providers have no monetary data. The one path that could theoretically
become eligible -- `cost_scanner.rs`'s Codex/Claude CLI JSONL logs,
which do have real per-session token/model data -- is blocked by the
unresolved billing-channel-mismatch finding in 7.5 and would need that
resolved (session-level auth-mode detection, or channel-scoped
relabeling) before it could honestly be called eligible. This is
recorded as the single concrete prerequisite for any future Phase 4C
scope, not a shortlist entry.

## 8. Phase 4C — Billing-Channel Attribution + Existing Cost-Scanner Safety Closure

Starting HEAD `d3b4436f` (Phase 4A/4A.1/4B closed; Phase 4C shortlist
established EMPTY). This phase's purpose was narrow and specific: close
or fail-closed the one currently-shipping risk Phase 4B's audit
discovered -- `cost_scanner.rs` (and everything downstream of it) has
real token/model data for Codex/Claude CLI sessions but could not prove
which billing channel produced any given session.

### 8.1 Every active local-cost runtime path, audited first

A dedicated trace (before any code was touched) found the local-cost
computation graph is bigger than `cost_scanner.rs` alone -- three
structurally independent pipelines, all ultimately calling
`CostUsagePricing::codex_cost_usd`/`claude_cost_usd`/`codex_cost_usd_at_date*`:

1. **`cost_scanner.rs`** (+ its internal helpers `codex_costs.rs`,
   `pi_session_cost.rs`) -- reachable from `get_provider_chart_data`,
   `get_provider_local_usage_summary`, `get_spend_contract`,
   `get_usage_spend_summary` (Tauri commands), `quotalis cost` and
   `quotalis serve /cost`, `/dashboard/v1/snapshot` (CLI/API).
2. **`codex_workspaces/indexer.rs`** (`CodexWorkspacesIndex`) --
   reachable from `get_codex_workspaces_snapshot`, `quotalis cost
   --group-by session`, `quotalis workspaces`, and
   `spend_contract.rs::load_native_spend`.
3. **`spend_contract.rs`/`spend_contract/opencodex.rs`** -- reachable
   from `get_spend_contract`, `get_usage_spend_summary`, `quotalis
   cost`'s embedded `spendContract` JSON field.

All three read local JSONL session-log files (Codex:
`~/.codex/sessions/**/*.jsonl`; Claude: `~/.claude/projects/**/*.jsonl`;
OpenCodex: `$OPENCODEX_HOME/usage.jsonl`) -- there is no live-API cost
computation anywhere in this graph. `CostUsagePricing::
claude_models_dev_target` is TEST ONLY (no non-test caller). No dead
code was found anywhere in the traced graph. `providers/cursor/
local_csv.rs::summarize` and `providers/opencodego/local.rs` are
PROVIDER(-TOOL)-REPORTED PASSTHROUGH -- they read a `cost` field the
respective tool (Cursor, OpenCode) already computed itself, never
calling `CostUsagePricing` -- confirmed unaffected by this phase's gate.

The computed dollar figure is **not durably persisted** anywhere in this
graph (Codex's on-disk cache stores only token counts, re-priced on
every read; Claude has no cache at all; only short-lived 30s/session
in-memory UI caches hold an already-computed total).

### 8.2 Codex channel result

Traced Codex CLI's own `auth.json` parsing (`providers/codex/api.rs:
216-220`): it explicitly branches on whether the file contains an
`OPENAI_API_KEY` field (raw API key mode) or OAuth `access_token`/
`refresh_token` tokens (ChatGPT-subscription mode) -- proving Codex CLI
genuinely supports both channels. But the LOCAL SESSION JSONL FORMAT
Codex CLI writes (`CodexUsageRecord`: `day_key`/`model`/`input`/
`cached`/`output` only, confirmed by reading `jsonl_scanner.rs:160-165`)
carries none of that information forward -- a session file alone cannot
prove which mode produced it. **Result: BillingChannel::Unknown for
every Codex CLI session, unconditionally.**

### 8.3 Claude channel result

Live official-source research (`support.claude.com/en/articles/
11145838-use-claude-code-with-your-pro-or-max-plan`, fetched
2026-09-08) confirms Claude Code genuinely supports the same two
channels: Pro/Max subscription usage (flat fee, shared quota, NOT
itself billed per-token unless the user explicitly opts into API-rate
overage) and a raw Anthropic API key (per-token metered). The local
Claude transcript JSONL format (`ClaudeEvent`/`ClaudeMessage`/
`ClaudeUsage`: `type`/`timestamp`/`requestId`/`model`/token-usage counts
only, confirmed by reading `cost_scanner.rs:257-307`) carries none of
that information either. **Result: BillingChannel::Unknown for every
Claude Code session, unconditionally** -- and per owner section 5,
Bedrock and Vertex usage (routed through entirely different provider
adapters, not this JSONL pipeline at all) were never priced with
Anthropic-direct rates in the first place; no change was needed there.

### 8.4 Other scanner/channel findings

- **OpenCodex import** (`spend_contract/opencodex.rs`): its own
  `RouteTarget::Subscription("codex")`/`"opencodego"`/`"kimi"`/
  `"deepseek"` labels only say WHICH upstream vendor a request routed
  to, not which billing mode was used for that vendor -- the identical
  gap as Codex/Claude, so it is gated by the same global verdict.
- **`opencodego`'s own local-cost path** (`providers/opencodego/
  local.rs`) reads a `cost` field OpenCode's own local SQLite database
  already computed (`json_extract(data, '$.cost')`) -- confirmed no
  `CostUsagePricing` call exists in that file. Genuinely provider(-tool)-
  reported passthrough, not gated by this phase (resolves Phase 4B's
  "not fully traced" flag on this path).
- **Cursor's local CSV** (`providers/cursor/local_csv.rs`): reads a
  `cost` column Cursor's own export already contains -- same passthrough
  category, unaffected.

### 8.5 Eligibility-runtime integration (not documentation/tests-only)

`rust/src/pricing_eligibility.rs`'s `can_locally_estimate_cost` (built
in Phase 4B as a pure model) is now the SOLE authority
`cost_scanner::cli_log_cost_eligibility`/`cli_log_cost_available` calls
into -- no second, duplicated billing-channel check exists anywhere
else in Rust or the frontend. Every dollar-figure-facing call site was
updated to route through it (or through `CostSummary::
eligible_total_cost_usd`/`eligible_by_model`/`eligible_by_speed`,
`SpendContract`'s `strip_model_costs`/`strip_daily_costs`/
`strip_import_costs`, or `CostEstimate::eligible_known_usd`, all of
which themselves call the same shared function once per scan/session,
never re-deriving the verdict independently):

- `CostSummary.total_cost_usd`/`by_model`/`by_speed` (`cost_scanner.rs`)
- `get_daily_cost_history` (`cost_scanner.rs`) -- returns an EMPTY series
  for `codex`/`claude` when ineligible, never a flat `$0.00` line (which
  would misread as a real known-zero total)
- `SpendContract.known_cost_usd`, `.models[].cost_usd`,
  `.daily[].cost_usd`, `.imports[].known_cost_usd` and their nested
  models/daily (`spend_contract.rs`)
- `CostEstimate.known_usd` on every `ProjectUsage`/`SessionUsage`/
  `DailyPoint.estimated_cost_usd` (`codex_workspaces/types.rs`,
  `indexer.rs`)
- `quotalis cost` CLI text output (`format_total()` now reads
  "Unavailable") and JSON output (`total_usd: null`, `eligible: false`,
  `unavailableReason: "billingChannelUnknown"`)
- `quotalis serve /cost` and `/dashboard/v1/snapshot` JSON responses
- Settings → Usage & Spend tab (`usage_spend.rs`'s Claude branch;
  Codex/OpenCodeGo/Kimi/DeepSeek branches already inherited the gate via
  `SpendContract`)
- Provider card local-usage tile and chart cost trend
  (`chart.rs::load_local_usage_summary_with_unknown_models`)
- Codex Workspaces project/session list (`UsageSpendTab.tsx`, via the
  new `CodexWorkspacesCostEstimate.eligible` field)

The frontend never decides billing-channel compatibility itself -- it
only ever receives an already-gated `number | null` (or, for the Codex
Workspaces view, a `knownUsd`/`eligible` pair) and renders "Unavailable"
via the existing `formatUsd`/`DashboardValueUnavailable` conventions.

### 8.6 Unresolved-pricing handling

`gpt-5.6-sol`'s output-rate discrepancy (Phase 4/4B, still UNRESOLVED)
is now doubly quarantined: the whole `CODEX_PRICING` table is already
gated to `Unavailable` by the billing-channel check regardless, so this
specific unresolved record cannot reach a user even by coincidence. No
code distinguishes per-model verification state at runtime today (the
gate is table-wide, not per-record) -- documented as a known
simplification, not a gap: since the entire table is unreachable, a
finer-grained per-record gate would currently have no observable effect.

### 8.7 Unknown-model handling

Unchanged, pre-existing, already-correct behavior, re-confirmed
unaffected by this phase: `codex_cost_usd`/`claude_cost_usd` still
return `None` for an unrecognized model ID, never a nearest/latest/
default price (`golden_codex_unknown_model_is_none_never_a_guessed_price`/
`golden_claude_unknown_model_is_none_never_a_guessed_price`, unchanged
this phase). This is now redundant-but-harmless with the new
billing-channel gate (both independently prevent a bad number from
reaching a user), which is the correct "fail closed on any single
missing precondition" posture the eligibility rule is designed for.

### 8.8 Legacy local-estimate handling

`cost_scanner.rs`'s computed dollar figures were never durably persisted
(8.1) -- there is no "legacy locally-estimated row" to reinterpret, and
this phase touched no history schema. The Phase 4A.1 `MonetaryQuantityKind`/
`CostMeasurementKind`/currency schema on `history.db`'s `usage_samples`
table is untouched; this phase's fix operates entirely on the separate,
on-demand-computed `cost_scanner.rs`/`spend_contract.rs`/
`codex_workspaces` pipeline, which never wrote to that table.

### 8.9 Provider-reported Spend: unaffected

Nothing in this phase touches `history.db`, `DashboardSnapshot`,
`CostContract`, or any of the 14 Spend / 6 Balance / 2 Credits
providers' real provider-reported figures (Phase 4A/4A.1's territory).
The fail-closed rule applies exclusively to LOCALLY ESTIMATED money from
the three local-JSONL pipelines audited in 8.1.

### 8.10 Before/after (concrete)

Before this phase: `quotalis cost --provider codex --json` on a machine
with real Codex CLI usage would emit `"cost": {"total_usd": 12.34,
"currency": "USD"}` and `"by_model": {"gpt-5": 12.34}` regardless of
whether that $12.34 was ever actually billed per-token or was entirely
covered by a flat ChatGPT subscription fee. After this phase, the same
scan emits `"cost": {"total_usd": null, "currency": "USD", "eligible":
false, "unavailableReason": "billingChannelUnknown"}` and `"by_model":
{}` -- `"tokens"`/`"sessions_count"` are identical in both cases (proven
by `json_output_cost_is_null_and_ineligible_when_billing_channel_unknown`).

### 8.11 Real Dev validation

No Dev history exists in this environment (unchanged from Phase 4A.1/
4B's reconciliation) and no live CLI session could be safely observed
without a real Codex/Claude local install on this machine. Verification
used the sanitized, real-shaped fixtures already embedded in this
project's own test suite (`records_unknown_claude_model_while_using_
fallback_cost`'s Claude transcript JSON, `parses_current_codex_payload_
token_count_events`'s Codex `token_count` event JSON, and this phase's
new `json_output_cost_is_null_and_ineligible_when_billing_channel_
unknown` fixture) -- none contain credentials, tokens, cookies, or
account identifiers. No fixture is labeled as real provider data.

### 8.12 Personal

Untouched throughout -- confirmed absent (unchanged since Phase 4A.1),
no app launch, no history read/write, no migration.
