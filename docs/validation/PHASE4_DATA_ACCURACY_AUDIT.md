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
- The `usage_samples` SQLite schema (no migration in this phase — see
  defect #3's resolution above).
- Any of `cost_scanner.rs`'s JSONL-log scanning logic itself (only its
  *labeling/precedence* relative to the Dashboard's numbers is in scope).

See also: [QUOTALIS_PROVIDER_DATA_CAPABILITIES.md](QUOTALIS_PROVIDER_DATA_CAPABILITIES.md),
[PRICING_PROVENANCE.md](PRICING_PROVENANCE.md),
[../architecture/PRICING_CATALOG.md](../architecture/PRICING_CATALOG.md).
