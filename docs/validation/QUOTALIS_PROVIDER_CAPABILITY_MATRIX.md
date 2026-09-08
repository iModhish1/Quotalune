# Quotalis Provider Capability Matrix — Phase 4B

Real-code-derived, not inferred. Built from two dedicated evidence passes:
(1) `rust/src/core/provider.rs::ProviderId::all()` — the authoritative
70-provider registry; (2) a full grep+read of every `rust/src/providers/*`
adapter for `CostSnapshot`/`UsageSnapshot`/`RateWindow` construction sites.
See [PHASE4_DATA_ACCURACY_AUDIT.md](PHASE4_DATA_ACCURACY_AUDIT.md) "Phase
4B" section for the narrative summary and reconciliation of prior counts.

## 0. Structural finding that governs every row below

**No provider-facing type anywhere in the codebase has a typed field for
model ID, input/output tokens, cached-token categories, or request
count.** The shared types every adapter returns are:

- `UsageSnapshot` (`core/usage_snapshot.rs:75-109`): `primary/secondary/
  model_specific/tertiary: RateWindow`, `extra_rate_windows`,
  `updated_at`, `account_email`, `account_organization`, `login_method`.
- `RateWindow` (`core/rate_window.rs:75-94`): `used_percent`,
  `window_minutes`, `resets_at`, `reset_description`, `is_informational`.
- `CostSnapshot` (`core/usage_snapshot.rs:230-263`): `used`, `limit`,
  `currency_code`/`symbol`, `period`, `resets_at`, `updated_at`,
  `balance`, `daily`.

A `TokenUsageSummary`/`WidgetSnapshot` type family exists
(`core/widget_snapshot.rs:17-96`) but is explicitly marked `#![allow(
dead_code, reason = "widget snapshot types reserved for future UI
integration")]` and **no provider ever constructs it** — confirmed dead
code, not a live channel.

**Consequence**: wherever a model name, token count, or request count
appears at all in a live adapter, it is free text embedded in
`login_method`/`reset_description`/an `extra_rate_windows` title (e.g.
`"Model: gpt-5.1"`, `"1234 tokens"`) — never a structured,
machine-parseable field, and **never persisted to `history.db`** (whose
schema has no such columns; see section 4). "Structurally available"
below therefore means "present as a real substring in real adapter
output," not "present as a typed field" — no typed field exists for
this data anywhere in the codebase today.

## 1. Provider count reconciliation

`ProviderId::all()` lists **70** providers. Of these, **22 distinct
provider directories** construct a `CostSnapshot` (i.e. have ANY
monetary observation): `aiand, bedrock, claude, codex, commandcode,
crossmodel, cursor, deepinfra, deepseek, devin, fireworks, litellm,
llmproxy, minimax, mistral, neuralwatt, openaiapi, opencodego,
openrouter, sub2api, xai, zenmux`. The remaining **48** construct
`RateWindow`s only — no monetary observation of any kind.

An earlier Phase 4 audit cited "24" for this same set — that number
counted **files** (`claude` spans 2 files — `admin_api.rs`,
`web_api.rs`; `cursor` spans 3 — `mod.rs`, `api.rs`, `token_cost.rs` —
22 providers + 2 extra files from those two = 24 grep hits), not
distinct providers. Phase 4A.1's "14 Spend + 6 Balance + 2 Credits = 22"
arithmetic was already correct at the *provider* level; this document
corrects the earlier *file*-count figure and states the reconciliation
explicitly so it is never repeated as an unexplained discrepancy again.

## 2. Billing channel model (documentation-layer only this phase)

Conceptual channels (mirrored in `rust/src/pricing_eligibility.rs`'s
`BillingChannel` enum, built this phase as a pure, testable eligibility
model — **not wired into any runtime calculation**):

- **SubscriptionQuota** — a consumer/CLI subscription plan's included
  usage (flat monthly fee, quota-limited).
- **DirectApi** — a genuine API key's own per-token/per-request metered
  billing.
- **PrepaidCredits** — a prepaid credit balance in a provider-defined
  unit.
- **ProviderBalance** — a cash-denominated prepaid balance.
- **GatewayReseller** — a proxy/aggregator in front of many upstream
  models; pricing may be gateway-specific, markup-adjusted, or dynamic.
- **CliEntitlement** — a CLI-specific entitlement with no clean
  subscription/API-key distinction established.
- **Mixed** — more than one of the above coexists under one
  `ProviderId` (a real, repeated pattern — see below), each fetched via
  a genuinely different auth mechanism/endpoint.
- **Unknown** — not yet established from real evidence.

**Hard rule (owner section 4), confirmed necessary by real evidence**:
several providers implement the exact "subscription quota looks like an
API" trap this phase warns about. `codex` (ChatGPT-account credits,
`chatgpt.com/backend-api/wham/usage`, OAuth) and `openaiapi` (OpenAI
API-key org billing, `api.openai.com/v1/organization/*`) are two
entirely separate `ProviderId`s specifically because Quotalis's authors
already anticipated this — confirmed by reading both adapters
independently. The same pattern repeats: `xai` (dev-platform Management
API, explicitly documented "Intentionally separate from the Grok
consumer provider") vs `grok` (consumer, no monetary data at all,
non-monetary); `cursor` (consumer IDE subscription) is a fully separate
channel from any raw-API-key provider.

## 3. Billing-channel classification — all 22 monetary providers

| Provider | Channel(s) | Auth mechanism | Evidence |
|---|---|---|---|
| aiand | DirectApi | API key (`AIAND_API_KEY`) | request-log spend export, `aiand/mod.rs:16-20,155-162` |
| bedrock | DirectApi (cloud infra cost) | AWS SigV4 IAM creds | Cost Explorer, `bedrock/mod.rs:15,274-286` |
| claude | **Mixed**: SubscriptionQuota (OAuth quota) + DirectApi (Admin API org cost) + SubscriptionQuota-overage (web session) | OAuth / Admin API key / browser cookie | `admin_api.rs:16-17,304`; `web_api.rs:365,744-753` |
| codex | CliEntitlement/Credits (ChatGPT consumer plan) | OAuth (`~/.codex/auth.json`) | `chatgpt.com/backend-api/wham/usage`, `codex/api.rs:3,15-16,108-116` |
| commandcode | SubscriptionQuota | browser session cookie | no API-key path exists at all, `commandcode/mod.rs:1-3,26-39` |
| crossmodel | PrepaidCredits | API key | "wallet credits," `crossmodel/mod.rs:1-4,15,177` |
| cursor | SubscriptionQuota (consumer IDE plan) | browser cookie/app-auth | `plan_type` = "Cursor Pro" etc., `cursor/mod.rs:1-3` |
| deepinfra | DirectApi/PrepaidCredits | API key | `deepinfra/mod.rs:1-7,18-22` |
| deepseek | DirectApi | API key | `deepseek/mod.rs:1-3,19` |
| devin | DirectApi (agent-run billing) | API key | `devin/mod.rs:9-11` |
| fireworks | DirectApi (prepaid, no quota windows) | API key | `fireworks/mod.rs:1-8,21-24` |
| litellm | GatewayReseller | API key, caller-supplied `base_url` | self-hosted proxy, `litellm/mod.rs:9-10,58-90` |
| llmproxy | GatewayReseller | internal enterprise gateway | `/v1/quota-stats`, `llmproxy/mod.rs:1-3,16` |
| minimax | **Mixed**: SubscriptionQuota ("coding plan" web cookie) + DirectApi (API key) | cookie + API key | `minimax/mod.rs:1-4,139,227-302,1007-1036` |
| mistral | DirectApi accessed via session (org admin billing, not a personal wallet) | browser cookie against admin billing API | `mistral/mod.rs:1-4,17,146` |
| neuralwatt | **Mixed**: SubscriptionQuota + PrepaidCredits | API key, single endpoint returns both | `neuralwatt/mod.rs:1-3,16` |
| openaiapi | DirectApi (confirmed distinct from `codex`) | API key | `api.openai.com/v1/organization/costs`, `openaiapi/mod.rs:1-4,17-19` |
| opencodego | **Mixed**: SubscriptionQuota (cookie/local SQLite) + DirectApi (usage API key) | cookie / local file / API key | `opencodego/mod.rs:1-6,567-614` |
| openrouter | GatewayReseller | API key | multi-model routing aggregator, `openrouter/mod.rs:1-4,30,132-139` |
| sub2api | GatewayReseller + Mixed (subscription quota + wallet balance) | API key | "sub-to-API" reseller product, `sub2api/mod.rs:1-4,16,172-179` |
| xai | DirectApi (dev platform, distinct from consumer Grok) | Management API key | `management-api.x.ai`, `xai/mod.rs:1-8` |
| zenmux | GatewayReseller + Mixed (subscription tier + PAYG balance) | Management API | `zenmux/mod.rs:1-4,17-18,38,204` |

## 4. Field-population trace — 22 monetary providers

Legend: **NA** = not available in live adapter output at all; **POP** =
actually populated by the live adapter (always as free text — see
section 0); "not verified this pass" = genuinely not confirmed, not
assumed either way.

| Provider | Model ID | Input tok | Output tok | Cache tok | Request count | Reset | Tier/plan |
|---|---|---|---|---|---|---|---|
| aiand | NA | NA | NA | NA | NA | SA (informational only) | POP (spend text) |
| bedrock | NA (no model dim in CloudWatch aggregate) | POP (text) | POP (text) | NA | POP (text) | POP (`end_of_current_month`) | NA |
| claude | POP ("Model: {model}" top-3, Admin API only) | POP (cache folded into input) | POP | folded into input, not separated | NA | POP | POP ("Admin API" literal / OAuth plan not verified) |
| codex | NA | NA | NA | NA | NA | POP (reset-credits path) | POP ("ChatGPT Plus" etc.) |
| commandcode | NA | NA | NA | NA | NA | not verified | POP |
| crossmodel | NA | NA | NA | NA | POP (text) | not verified | POP ("API key" literal, not a real tier) |
| cursor | POP on local CSV import only (not live API) | NA (API) | NA (API) | POP on local CSV only | NA | not verified | POP ("Cursor Pro" etc.) |
| deepinfra | NA | NA | NA | NA | NA | not verified | NA (balance text only) |
| deepseek | NA | NA | NA | NA | POP (extra windows) | not verified | NA |
| devin | NA | NA | NA | NA | NA | not verified | NA |
| fireworks | NA | NA | NA | NA | NA | not verified | NA |
| litellm | NA | NA | NA | NA | NA | not verified | NA ("Spend $x.xx" only) |
| llmproxy | NA | NA | NA | NA | POP (text) | not verified | NA |
| minimax | POP in test fixture only, live-population **not verified** | not verified | not verified | not verified | not verified | not verified | POP |
| mistral | POP (aggregate model *count*, not per-model IDs) | POP (`total_input_tokens`) | POP | **POP, separately tracked** (only provider of the 22 that does) | NA | not verified | NA |
| neuralwatt | NA | NA | NA | NA | NA | not verified | POP |
| openaiapi | POP ("Model: {model}" top-3) | POP (folds in cached+audio) | POP | folded, not separated | POP (`num_model_requests`) | POP (credit-grant expiry) | NA |
| opencodego | POP (local SQLite path, real model IDs) | not verified | not verified | NA | POP (per bucket) | not verified | NA |
| openrouter | POP (real per-row model) | POP | POP (incl. reasoning) | NA (no cache category in payload) | POP | not verified | NA (balance text only) |
| sub2api | NA (aggregate only) | NA | NA | NA | POP (text) | not verified | POP (real tier text) |
| xai | NA | NA | NA | NA | NA | not verified | NA |
| zenmux | NA | NA | NA | NA | NA | not verified | POP (real tier string) |

**Only 5 of the 22 monetary providers ever surface a real per-model
breakdown and real input/output token totals at all**: `claude` (Admin
API path only), `openaiapi`, `openrouter`, `mistral`, `opencodego`
(local-SQLite path only). Of those, **only `mistral` separately tracks
a cached-token category** — `claude` and `openaiapi` both fold cache-
read/cache-creation into the input-token total, losing that dimension.

## 5. Notable non-monetary providers worth flagging

- **`wayfinder`**: has a genuinely separate `WayfinderUsageSnapshot`
  type (`wayfinder.rs:31,70-88,241-256`) carrying real configured-router
  model IDs, aggregate token counts, and real request counters — but
  this type is never converted to `UsageSnapshot`/`CostSnapshot`, so
  Wayfinder correctly has **no** monetary observation and sits outside
  the 22. Its real billable-shaped data is structurally isolated from
  any pricing path today.
- **`azureopenai`**: the only other non-monetary provider carrying a
  real model identifier (`model: Option<String>` field + "Deployment:
  {}" text, `azureopenai/mod.rs:31,99,236,248`) — no token/cost data
  alongside it.
- **`kimi`, `alibaba`, `grok`, `longcat`**: no plan/tier text at all,
  unlike almost every other provider (worth noting only as a UX
  completeness gap, not a Phase 4B concern).

## 6. Persistence capability matrix (separate from live-adapter capability)

Even where a live adapter genuinely populates model/token/request text
(section 4's POP rows), **none of it reaches `history.db`**:
`history_recorder.rs::sample_for_window`/the cost-sample branch only
ever writes `used_percent`, `remaining_percent`, `cost_used`,
`cost_currency_code`, `cost_measurement_kind`, `monetary_quantity_kind`,
`resets_at`, `captured_at` — there is no column for model ID, token
counts, or request counts (confirmed unchanged since Phase 4A;
`DataAvailability.has_token_data`/`has_request_data`/`has_model_data`
remain hardcoded `false` for exactly this reason).

| Provider | Current model known (live)? | Historical model persisted? | Current input tokens (live)? | Historical input tokens persisted? | Current output tokens (live)? | Historical output tokens persisted? | Billing channel persisted? | Monetary quantity persisted? | Currency persisted? | Exact historical estimation possible TODAY? |
|---|---|---|---|---|---|---|---|---|---|---|
| claude (Admin API) | YES (text) | **NO** | YES (text) | **NO** | YES (text) | **NO** | NO | YES (Phase 4A.1) | YES (Phase 4A) | **NO** |
| openaiapi | YES (text) | **NO** | YES (text) | **NO** | YES (text) | **NO** | NO | YES | YES | **NO** |
| openrouter | YES (text) | **NO** | YES (text) | **NO** | YES (text) | **NO** | NO | YES | YES | **NO** |
| mistral | partial (count only) | **NO** | YES (text) | **NO** | YES (text) | **NO** | NO | YES | YES | **NO** |
| opencodego (local SQLite) | YES (text) | **NO** | not verified | **NO** | not verified | **NO** | NO | YES | YES | **NO** |
| every other of the 22 | NO/mostly NO | **NO** | mostly NO | **NO** | mostly NO | **NO** | NO | YES | YES | **NO** |
| all 48 non-monetary | n/a | **NO** | n/a | **NO** | n/a | **NO** | n/a | n/a (no monetary data) | n/a | **NO** |

**Result: exact historical cost estimation is not possible for ANY
provider today**, even the 5 that momentarily have real token text in a
live fetch — the loss point is `history_recorder.rs`'s cost-sample
branch, which only persists the aggregate dollar figure (already
proven correct/complete for Phase 4A.1's purposes) and never the
underlying token/model facts that produced it. Per owner section 29,
this document does **not** propose a schema change to fix this — it is
a capability-gap finding for a future Phase 4C decision, not acted on
here.

## 7. Local-estimation eligibility per provider (using `pricing_eligibility::can_locally_estimate_cost`)

Applying the hard rule (owner section 7-8): billing channel must be
priceable and match; canonical model must be known; every required
billable category must be present; currency/unit known; pricing
verified. Since **no provider persists token/model/request data to
history** (section 6), and since 20 of the 22 monetary providers already
report a real dollar/credit/balance figure directly (Phase 4A rule:
provider-reported wins, never add a local estimate on top for the same
scope), the practical eligibility result is:

| Provider | Provider-reported monetary data | Local estimation eligible? | Why |
|---|---|---|---|
| All 14 Spend providers | YES (real $ spend) | **NOT NEEDED** | ProviderReported already covers this exact scope (owner section 21) — a local estimate would be redundant, not additive. |
| crossmodel, sub2api, devin, neuralwatt, opencodego, zenmux (Balance) | YES (balance) | **NOT ELIGIBLE** | Balance channel mismatch against any DirectApi pricing record (owner section 22/40) — a balance is not spend regardless of token data. |
| commandcode, codex (Credits) | YES (credits) | **NOT ELIGIBLE** | No official credits→currency conversion documented for either (owner section 23/24) — Credits stay Credits. |
| All 48 non-monetary providers | NO | **NOT ELIGIBLE** | No monetary observation of any kind exists to estimate against. |

**No provider in the current registry is eligible for local cost
estimation today** — not because pricing data is unavailable (Anthropic
and OpenAI's official DirectApi pricing is verified in
`PRICING_PROVENANCE.md`), but because the *billing channel and billable
inputs* Quotalis actually observes never line up with a priceable
DirectApi record for any monetary provider, and no provider persists
the token/model facts a local estimate would need even where a live
fetch momentarily has them.

**Phase 4C update**: this table covers the `Provider`-trait/registry
pipeline only. `cost_scanner.rs` (section 8 below) is a structurally
separate, third source of local monetary computation, outside the
registry — its own eligibility result (also uniformly `NotEligible
(BillingChannelMismatch)`, now enforced at runtime, not only in this
table) is documented in section 8 and in
`docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md` "Phase 4C".

## 8. A separate, out-of-registry finding: `cost_scanner.rs` — CLOSED in Phase 4C

`rust/src/cost_scanner.rs` (feeding the Settings → "Usage & Spend" tab,
`codex_workspaces/indexer.rs`, `spend_contract.rs`/`opencodex.rs`, the
`quotalis cost` CLI, and the `quotalis serve` `/cost` and
`/dashboard/v1/snapshot` JSON endpoints — entirely independent of the
`Provider` trait / registry above) scans local Codex/Claude CLI JSONL
session logs directly and DOES have real per-session model +
input/output/cached token counts — genuinely billable-shaped local data,
unlike anything in the registry above.

**Token data existing is not the same as that token data being
priceable (owner section 31).** Phase 4B flagged, and Phase 4C traced in
full and closed, a real billing-channel-mismatch risk: it applied
`CODEX_PRICING`/`CLAUDE_PRICING` (`cost_pricing.rs`) uniformly to every
session **regardless of which billing channel produced that session**.
Both Codex CLI (`~/.codex/auth.json`) and Claude Code CLI can be
authenticated either via a subscription (ChatGPT Plus/Pro/Team, Claude
Pro/Max — flat fee, quota-included, confirmed via `codex/api.rs:216-220`'s
`OPENAI_API_KEY`-vs-OAuth-tokens branch, and confirmed for Claude Code
via live official-source research: `support.claude.com` states
subscription-covered usage is billed at standard API rates only if the
user explicitly opts into overage) **or** via a raw API key (per-token
metered). Neither the Codex JSONL record (`day_key`/`model`/`input`/
`cached`/`output` only) nor the Claude transcript event (`type`/
`timestamp`/`requestId`/`model`/token-usage counts only) carries any
field that distinguishes which mode produced a given session.

**Phase 4C fix**: every dollar figure derived from this pipeline
(`CostSummary.total_cost_usd`/`by_model`/`by_speed`, `SpendContract.
known_cost_usd` and its `models`/`daily`/`imports` breakdowns,
`CodexWorkspacesIndex`'s `CostEstimate.known_usd` on every project/
session/daily point) now routes through the single shared
`pricing_eligibility::can_locally_estimate_cost` rule
(`cost_scanner::cli_log_cost_eligibility`/`cli_log_cost_available`),
classified as billing channel `Unknown` against the `DirectApi` channel
these price tables actually price — always `NotEligible
(BillingChannelMismatch)` today. Every dollar-figure-facing surface
(CLI text/JSON output, the `quotalis serve` JSON endpoints, the
Settings tab, the Codex Workspaces view) now reads "Unavailable"/`null`/
`None` instead of a computed number; token/model/session counts are
completely unaffected and remain fully real. See
`docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md` "Phase 4C" for the full
before/after and the complete list of gated call sites.

`opencodego`'s local-cost path is explicitly **NOT** affected by this
gate: `rust/src/providers/opencodego/local.rs` reads a `cost` field
directly out of OpenCode's own local SQLite database
(`json_extract(data, '$.cost')`) — confirmed via grep that no
`CostUsagePricing` call exists anywhere in that file. This is
provider(-tool)-reported passthrough, structurally identical to
Cursor's local-CSV passthrough, not a Quotalis-computed local estimate
-- resolving Phase 4B's earlier "not fully traced" uncertainty flag.

## 9. Provider capability summary (owner section 41)

- **A. Provider-reported Spend available (14)**: aiand, bedrock, claude
  (Admin API/web-overage), cursor*, deepinfra, deepseek, fireworks,
  litellm, llmproxy, minimax*, mistral, openaiapi, openrouter, xai.
  (*cursor and minimax also have a non-monetary SubscriptionQuota
  channel coexisting — see section 3.)
- **B. Balance available (6)**: crossmodel, sub2api, devin, neuralwatt,
  opencodego, zenmux.
- **C. Credits available (2)**: commandcode, codex.
- **D. Quota-only/non-monetary (48)**: every remaining `ProviderId`.
- **E. Candidate for future local estimation (0)**: none — see section
  7's eligibility result.
- **F. Insufficient data/unsupported for local estimation (all 70)**:
  every provider fails at least one hard-rule precondition today.

## 10. Unknown-model policy (owner section 15)

Unchanged from Phase 4/4A's existing `cost_pricing.rs` behavior,
restated as explicit policy for this matrix: an unrecognized model ID
never falls back to the nearest/latest/default model's price. Quota,
history, and reset data continue to work normally; only the price
lookup itself reads "unavailable." No code in this phase changes this
— it documents the existing, already-correct behavior
(`codex_cost_usd`/`claude_cost_usd` both return `None` for an
unrecognized key, proven by `golden_codex_unknown_model_is_none_never_a_guessed_price`/
`golden_claude_unknown_model_is_none_never_a_guessed_price` in
`cost_pricing_tests.rs`).

See also: [PRICING_PROVENANCE.md](PRICING_PROVENANCE.md),
[PRICING_CATALOG.md](PRICING_CATALOG.md),
[PHASE4_DATA_ACCURACY_AUDIT.md](PHASE4_DATA_ACCURACY_AUDIT.md).
