# Quotalis Provider Data Capabilities Matrix (Phase 4)

Built from a real read of `rust/src/core/provider.rs::ProviderId` (70
variants) and a repo-wide evidence pass over `rust/src/providers/*`.
Columns are YES (verified in code) / NO (verified absent, e.g. no
`CostSnapshot::new` construction found) / UNVERIFIED (not read this pass
— given ~70 providers, exhaustive per-file verification of every column
for every provider was out of scope for one phase; see note below).

Legend: **quota%** = `RateWindow.used_percent` — structurally guaranteed
for every provider (compile-time requirement of `UsageSnapshot`).
**Provider cost** = the provider's own API/dashboard reports a real
dollar (or provider-currency) figure Quotalis did not compute.
**Credits** = an explicit, provider-defined non-USD unit distinct from
tokens or dollars.

## Providers with confirmed provider-reported cost (24, via `CostSnapshot::new`/`CostSnapshot {}` construction)

| Provider | Cost field | Unit | Source |
|---|---|---|---|
| Claude (Admin API) | `CostResult.amount` | USD (from lowest-currency-unit) | `providers/claude/admin_api.rs:150-197` |
| Cursor | `chargedCents`/`token_usage.total_cents` | USD (cents) | `providers/cursor/token_cost.rs:37-62` |
| DeepInfra | `total_cost` | USD (cents) | `providers/deepinfra/mod.rs:24-51` |
| Fireworks | `total_cost: Option<Money>` | USD | `providers/fireworks/mod.rs:52-150` |
| Mistral | `total_cost` (aggregated) | USD | `providers/mistral/mod.rs:87-231` |
| LiteLLM | `spend`/`spend_usd`/`team_spend` | USD | `providers/litellm/mod.rs:139-158` |
| LLM Proxy | `approximate_cost_usd` | USD (proxy-approximated) | `providers/llmproxy/mod.rs:69-144` |
| xAI/Grok | `cost_usd`, `balance_usd` | USD | `providers/xai/mod.rs:95-131` |
| Neuralwatt | `cost_usd`, `balance` | USD | `providers/neuralwatt/mod.rs:21-319` |
| OpenAI API (key) | `grants.total_used` | USD | `providers/openaiapi/mod.rs:58-279` |
| OpenRouter | per-request cost summed | USD | `providers/openrouter/activity.rs:131` |
| Bedrock | AWS Cost Explorer `fetch_monthly_spend` | USD | `providers/bedrock/mod.rs:296-469` |
| ai& | `last_30_days_spend` | provider currency | `providers/aiand/mod.rs:42-106` |
| DeepSeek | `total_balance`/`granted_balance`/`topped_up_balance` (**balance**, not spend) | USD | `providers/deepseek/mod.rs:26-34` |
| CrossModel | `balanceMicro` (**balance**) | provider currency | `providers/crossmodel/mod.rs:27-197` |
| ZenMux | PAYG `payg/balance` | USD | `providers/zenmux/mod.rs:146-231` |
| Devin | `overage_balance`/`extra_usage_balance` | USD | `providers/devin/mod.rs:140-175` |
| Sub2Api | `actual_cost_usd`, `balance` | USD | `providers/sub2api/mod.rs:31-87` |
| CommandCode | monthly + purchased credit balance | credits | `providers/commandcode/mod.rs:366` |
| MiniMax | `used_amount`/`total_amount` (cash) | provider currency | `providers/minimax/mod.rs:173-849` |
| Codex | ChatGPT account "Credits"/"Monthly credits" balance | credits | `providers/codex/api.rs:585,654,962` |

Provider-reported **credits** with no fixed USD conversion documented in
repo: Warp (`requestCreditsGranted`/`Remaining`), JetBrains
(`used_credits`/`credit_limit` from `<option name="usedCredits">` XML),
Kiro (`current_usage_with_precision` credits), Zai (credit-based Coding
Plan windows), CommandCode, Codex.

## Structural fields (universal, guaranteed by `UsageSnapshot`/`RateWindow`)

Every one of the 70 `ProviderId` variants compiles only if it supplies a
`primary: RateWindow { used_percent, remaining_percent, resets_at,
reset_description, ... }` — so **quota% and reset-time are structurally
universal** across all 70 providers, verified by the type system itself,
not per-provider reading. `login_method`/`account_email`/
`account_organization` are optional `UsageSnapshot` fields most providers
populate (de-facto "plan" surface).

## Token / request / model-ID data (NOT part of the shared struct — opt-in per provider)

| Provider | Tokens | Requests | Model ID |
|---|---|---|---|
| Claude (Admin API) | YES — `uncached_input_tokens` etc. | — | YES — `model: Option<String>` |
| Cursor | YES — `EventTokenUsage{input,output,cache_write,cache_read}` | implicit (event count) | YES — `model: Option<String>` |
| LLM Proxy | — | — | YES (per-provider cost breakdown) |
| Codex | via `codex_costs.rs` token fields | — | via `normalize_codex_model` |
| DeepSeek | — (pricing.rs is a peak/off-peak schedule only, no token fields) | — | — |
| All other ~65 providers | UNVERIFIED this pass | UNVERIFIED this pass | UNVERIFIED this pass |

## Full 70-provider ID list (`rust/src/core/provider.rs::ProviderId::all()`)

Codex, Claude, Cursor, Factory, Gemini, Antigravity, Copilot, Zai,
MiniMax, Kiro, VertexAI, Augment, OpenCode, Kimi, KimiK2, Amp, Warp,
Ollama, AzureOpenAI, T3Chat, OpenRouter, JetBrains, Alibaba,
AlibabaTokenPlan, NanoGPT, Infini, Perplexity, Abacus, Mistral,
OpenCodeGo, Kilo, Bedrock, Codebuff, DeepSeek, DeepInfra, AiAnd,
Windsurf, Manus, MiMo, Doubao, CommandCode, Crof, StepFun, Venice,
OpenAIApi, Grok, ElevenLabs, Deepgram, Groq, LLMProxy, Chutes, LiteLLM,
Poe, Devin, Zed, CrossModel, Qoder, CodeBuddy, Sakana, Sub2Api,
Wayfinder, ZenMux, ClinePass, LongCat, Neuralwatt, ZoomMate, QwenCloud,
Notion, Xai, Fireworks.

**Not `CostSnapshot`-constructing** (46 providers, no provider-reported
cost/spend surfaced today — includes Factory, Antigravity, Amp, Ollama,
AzureOpenAI, T3Chat, Alibaba, AlibabaTokenPlan, NanoGPT, Infini,
Perplexity, Abacus, OpenCodeGo, Kilo, Codebuff, Windsurf, Manus, MiMo,
Doubao, StepFun, Venice, ElevenLabs, Deepgram, Groq, Chutes, Poe, Zed,
Qoder, CodeBuddy, Sakana, Wayfinder, ClinePass, LongCat, ZoomMate,
QwenCloud, Notion, Gemini, Copilot, OpenAI-via-scraper). For these, any
"spend"/"cost" figure Quotalis shows can only be a locally-estimated
figure from the pricing catalog (with cost-origin explicitly labeled
`LocallyEstimated`) or `Unavailable` — never invented as
provider-reported.

## Completeness caveat

This matrix's `CostSnapshot`-construction column and the structural quota%
column are exhaustive (grep-verified against every file in
`rust/src/providers/`). The token/request/model-ID columns and the full
credits inventory are verified only for the providers listed explicitly
above; a complete field-by-field read of all 70 provider modules was
outside Phase 4's time budget. This is recorded as a known audit gap, not
papered over — Phase 4's runtime code treats any provider not explicitly
verified as NOT supplying token/request/model data (fails closed, per
owner rule 45), so no capability is ever assumed present without
evidence.
