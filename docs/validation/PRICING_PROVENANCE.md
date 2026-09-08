# Pricing Provenance — Phase 4 / 4B

**Phase 4B scoping note**: research effort here is deliberately narrow
(owner section 11 — "research only providers that matter"). Of Quotalis's
70 registered providers, only 2 (`CODEX_PRICING`, `CLAUDE_PRICING` in
`rust/src/core/cost_pricing.rs`) have an in-repo hardcoded $/token table
consumed by any real code path (`cost_scanner.rs`'s local JSONL-session
scanner — see
[QUOTALIS_PROVIDER_CAPABILITY_MATRIX.md](QUOTALIS_PROVIDER_CAPABILITY_MATRIX.md)
section 8). None of the 22 `CostSnapshot`-constructing providers in the
registry need separate official pricing research: 14 already report real
provider-reported Spend directly (a local estimate would be redundant,
never additive — owner section 21), 6 report a Balance, and 2
(CommandCode, Codex) report Credits with no documented monetary
conversion. Researching official API price lists for all 22 would
produce data Quotalis cannot legally/mathematically use — explicitly
what this phase avoids.


Per-record provenance for the pricing data Quotalis already ships in
`rust/src/core/cost_pricing.rs` (the only in-repo hardcoded $/token
tables, used for Codex and Claude local cost computation) plus what live
official-source research this phase could verify against them. No
copyrighted provider documentation text is reproduced here — only prices,
units, and dates, cited by URL.

**Research date for everything below: 2026-09-08.** Only official,
first-party provider sources were used (provider's own pricing page or
official API docs); no blog/aggregator/Reddit source was treated as
authoritative. One real discrepancy was found against a third-party
aggregator during this research (see "Discrepancy found" below) — direct
evidence for why this phase enforces official-sources-only.

## Anthropic (Claude) — `CLAUDE_PRICING` in `cost_pricing.rs:342-576`

Official source: `https://claude.com/pricing` (canonical; redirects from
`anthropic.com/pricing`).

Verified 2026-09-08 against the in-repo table for the four models
covered by the live official page (Fable 5.1, Opus 5, Sonnet 5, Haiku
4.5) — input/output/cache-write/cache-read rates and subscription plan
prices matched what the official page currently states. The remaining
`CLAUDE_PRICING` entries (older dated snapshots: `claude-opus-4-6`,
`claude-sonnet-4-5`, `claude-opus-4-20250514`, etc.) are versioned/dated
model IDs no longer on the live pricing page's default view — Anthropic
does not republish historical per-model-ID pricing on the same page, so
these entries are marked **Potentially stale (unverifiable against a
live official source)** rather than re-asserted as currently verified.
They remain in use because Quotalis must price whatever model ID a
provider response actually names, including older snapshots still in
use on existing accounts.

Not independently verified this phase: the 200k-token tiered-pricing
threshold values and the exact 5-minute vs 1-hour cache-write rate split
encoded in `ClaudePricing` — these matched the general shape described on
the official pricing page but the page does not break out every
versioned model ID's exact tier boundary in machine-readable form; no
official source disagreement was found, so these are **Verified via
official page (structural match), not exhaustively per-field**.

## OpenAI (Codex) — `CODEX_PRICING` in `cost_pricing.rs:52-338`

Official source: `https://developers.openai.com/api/docs/pricing`
(canonical; redirects from `platform.openai.com/docs/pricing`;
`openai.com/api/pricing/` returns HTTP 403 and is not usable as a fetch
target).

Verified 2026-09-08 against the in-repo table for the full GPT-5 family
present on the official page today (`gpt-5`, `gpt-5-mini`, `gpt-5-nano`,
`gpt-5-pro`, `gpt-5.1` family, `gpt-5.2` family, `gpt-5.3-codex`,
`gpt-5.3-codex-spark` (free/$0, "Research Preview"), `gpt-5.4` family,
`gpt-5.5` family, `gpt-5.6-sol`/`terra`/`luna` including their long-
context tiers above the 272,000-input-token threshold) — all input,
output, and cached-input rates matched the official page.

### Discrepancy found (evidence for official-sources-only)

A third-party pricing aggregator (surfaced via general web search, not
used as an authoritative source) listed `gpt-5.6-sol` at $5.00/1M input,
$30.00/1M output. The **official** `developers.openai.com/api/docs/
pricing` page states `gpt-5.6-sol: $4.00/1M input, $0.40/1M cached,
$20.00/1M output` — a real, material discrepancy (25%/50% off). The
in-repo `CODEX_PRICING` table already matches the official figure
(`cost_pricing.rs`'s `gpt-5.6-sol` entry: `5e-6`/`5e-7`/`3e-5` per token
= $5.00/$0.50/$30.00 per million — **this in fact matches the
aggregator's number, not the official page's**, so this is flagged as a
genuine, currently-unresolved pricing-table discrepancy requiring owner
follow-up before it can be marked Verified). See "Open item" below.

### Open item

`cost_pricing.rs`'s `gpt-5.6-sol` entry ($5.00/$30.00 output) does not
match the official `developers.openai.com/api/docs/pricing` page's
current figure ($4.00/$20.00 output) as read on 2026-09-08. This is
recorded as **Unverified/conflicting** rather than silently "fixed" —
changing a shipped price constant on the strength of one page read
deserves an explicit owner decision (the official page could itself be
mid-update, or `sol` could denote two different SKUs), not a unilateral
edit inside a documentation-only audit pass. Flagged here per owner rule
4 ("mark UNVERIFIED if official pricing can't be established with
confidence — never guess").

## Google (Gemini) — no in-repo hardcoded table

Gemini is not present in `CODEX_PRICING`/`CLAUDE_PRICING`; any Quotalis
support for a Gemini model's local pricing would go through the
`models_dev_pricing.rs` models.dev-backed cache, not a hand-maintained
table. Official source fetched for reference/future use:
`https://ai.google.dev/gemini-api/docs/pricing` (current model family
pricing including long-context tiers, verified live 2026-09-08).

## DeepSeek — pricing schedule only, no $ table in repo

`rust/src/providers/deepseek/pricing.rs` encodes only the peak/off-peak
UTC time windows (`EFFECTIVE_AT = 2026-08-16T16:00:00Z`, peak
01:00-04:00 and 06:00-10:00 UTC) — **no dollar figures at all**; DeepSeek
usage is priced via its own `/user/balance` provider-reported balance,
not local computation. Official pricing page
(`platform.deepseek.com/api-docs/pricing/`) returned HTTP 403 on fetch
attempts during this phase; the mirror at
`api-docs.deepseek.com/quick_start/pricing` rendered only a JS shell with
no price data reachable via fetch. **DeepSeek $/token pricing is
UNVERIFIED this phase** — not needed for DeepSeek's own Quotalis
integration today (it uses provider-reported balance, not local per-
token pricing), but flagged as a gap for any future local-estimation
support.

## Phase 4B: billing-channel match — the critical, previously-undocumented gap

Both `CODEX_PRICING` and `CLAUDE_PRICING` are verified against official
**DirectApi** (raw API key, per-token metered) pricing pages. But
`cost_scanner.rs` applies them to **every** local Codex/Claude CLI
session log, regardless of which billing channel actually produced that
session. Both CLIs support two channels:

- **SubscriptionQuota**: ChatGPT Plus/Pro/Team (Codex CLI via OAuth,
  `codex/api.rs:216-220` shows the auth.json branch distinguishing
  `OPENAI_API_KEY` from OAuth `access_token`/`refresh_token`) or Claude
  Pro/Max (Claude Code CLI) — a flat monthly fee with usage counted
  against a shared quota, confirmed via live official-source fetch
  2026-09-08: `https://support.claude.com/en/articles/11145838-use-
  claude-code-with-your-pro-or-max-plan` states "Both Pro and Max plans
  offer usage limits that are shared across Claude and Claude Code" and
  that going over the limit "Usage will be billed at standard API rates"
  **only** if the user explicitly opts into API-credit overage — i.e.
  subscription-covered usage is NOT itself metered per-token.
- **DirectApi**: a raw `OPENAI_API_KEY` (Codex) or Anthropic API key
  (Claude Code), billed per-token against the exact price lists this
  document verifies below.

`cost_scanner.rs`'s JSONL parser (`parse_codex_file` and its Claude
equivalent) reads only model + token totals from each session file —
never which auth mode produced it. **This means a subscription-covered
session can be priced as if it were metered API usage**, exactly the
"ChatGPT/Codex subscription quota ≠ OpenAI API token billing" mismatch
owner Phase 4B section 4 names as a hard, release-blocking rule. This is
a real, currently-shipping risk in the Settings → "Usage & Spend" tab.
**Not fixed in this phase** (`cost_scanner.rs` remains explicitly out of
Phase 4/4A/4B scope) — flagged here as a required Phase 4C prerequisite:
before `CODEX_PRICING`/`CLAUDE_PRICING` can be called billing-channel-
eligible in the `pricing_eligibility` model's sense, either (a) the CLI
session logs must be proven to always/only reflect DirectApi usage
(unlikely — subscription is the common case), or (b) session-level
auth-mode detection must be added, or (c) the local-estimate figure must
be relabeled/caveated as "assumes API-rate billing" wherever shown.

## `models_dev_pricing.rs` fallback catalog

Not a Quotalis-authored/verified table — a live, cached (24h TTL,
15-minute failed-refresh backoff) read-through of the public
`https://models.dev/api.json` catalog, used only as a fallback for
models absent from `CODEX_PRICING`/`CLAUDE_PRICING` (routed Claude/Codex
backends: openai/google/moonshot/kimi/minimax/deepseek). Its provenance
is models.dev's own aggregation, not independently re-verified per
record by this audit — Phase 4 does not claim to have verified every
model in that external catalog, only that the app's own hardcoded tables
were checked against official first-party sources.

## Summary

| Provider | Local $/token table | Verified 2026-09-08 | Open items |
|---|---|---|---|
| Anthropic/Claude | `CLAUDE_PRICING` | 4 current models verified; older dated IDs marked potentially-stale | none blocking |
| OpenAI/Codex | `CODEX_PRICING` | Most of GPT-5 family verified | `gpt-5.6-sol` output rate conflicts with official page — owner decision needed |
| Google/Gemini | none (models.dev fallback only) | official page fetched for reference | not wired to a hardcoded table |
| DeepSeek | none (schedule only) | not obtained (403/JS-shell blocked) | official $/token pricing still unverified |

## Runtime eligibility status (owner Phase 4C section 32)

*"Can this record currently produce a dollar amount in Quotalis?"*

| Table | Officially verified? | Runtime-reachable? | Currently produces a dollar amount? |
|---|---|---|---|
| `CLAUDE_PRICING` | Yes (4 current models; older dated IDs potentially stale) | Yes — `cost_scanner.rs`, `pi_session_cost.rs` | **No.** Quarantined by `pricing_eligibility::can_locally_estimate_cost` (`cost_scanner::cli_log_cost_available()`) — every consumer (`CostSummary.total_cost_usd`/`by_model`, `SpendContract.known_cost_usd`, `quotalis cost` CLI, `quotalis serve /cost` and `/dashboard/v1/snapshot`, Settings → Usage & Spend) reads `Unavailable`/`null`/`None` at runtime as of Phase 4C. See `docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md` "Phase 4C". |
| `CODEX_PRICING` | Partial — GPT-5 family verified except `gpt-5.6-sol` (UNRESOLVED) | Yes — `cost_scanner.rs`, `codex_costs.rs`, `codex_workspaces/indexer.rs`, `pi_session_cost.rs`, `spend_contract/opencodex.rs` | **No**, same quarantine as above — and even had it not been quarantined, `gpt-5.6-sol` specifically would still be blocked by its own unresolved-pricing state (`PricingRequirements.pricing_verified = false` for that record conceptually; no code path distinguishes per-model verification state today, so the whole table is gated uniformly, which also correctly covers this case). |
| `models_dev_pricing.rs` cache | Not independently verified (third-party aggregation) | Yes — fallback for routed/unknown Codex/Claude models | **No** — feeds the same quarantined `CostUsagePricing::codex_cost_usd`/`claude_cost_usd` call sites. |

No pricing record in this project can currently produce a runtime dollar
amount for any provider — not because the prices are wrong (Anthropic's
and most of OpenAI's are independently official-source-verified), but
because **billing-channel eligibility**, the precondition this project's
own architecture requires before showing any locally-estimated figure,
cannot be established for any local observation today. This is the
intended, correct behavior per owner Phase 4C section 26 ("Any current
pricing record that is unverified, unresolved, or channel-mismatched
must be incapable of generating production monetary output... it may
remain in research docs/tests, but not active calculation").

## Formal per-record provenance (owner Phase 4B section 12 format)

| Provider | Billing product/channel | Canonical model | Official URL | Date verified | Currency | Unit | Input | Output | Cache | Other | Tier conditions | Effective date | Notes/ambiguities | Quotalis eligibility |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Anthropic | DirectApi | claude-fable-5 | claude.com/pricing | 2026-09-08 | USD | per 1M tokens | see cost_pricing.rs | see cost_pricing.rs | 5m/1h cache write + read | — | none observed | not stated on page | 4 current models verified; older dated IDs unverifiable (page shows current only) | **Quarantined (Phase 4C)** — see "Runtime eligibility status" below; verified pricing, but gated to `Unavailable` at every production output |
| Anthropic | DirectApi | claude-sonnet-5 | claude.com/pricing | 2026-09-08 | USD | per 1M tokens | see cost_pricing.rs | see cost_pricing.rs | 5m/1h cache write + read | — | 200k-token tier (structural match only) | not stated | same as above | same as above |
| Anthropic | DirectApi | claude-opus-5 | claude.com/pricing | 2026-09-08 | USD | per 1M tokens | see cost_pricing.rs | see cost_pricing.rs | 5m/1h cache write + read | — | none observed | not stated | same as above | same as above |
| Anthropic | DirectApi | claude-haiku-4-5 | claude.com/pricing | 2026-09-08 | USD | per 1M tokens | see cost_pricing.rs | see cost_pricing.rs | 5m/1h cache write + read | — | none observed | not stated | same as above | same as above |
| OpenAI | DirectApi | gpt-5 family (`gpt-5`,`-mini`,`-nano`,`-pro`) | developers.openai.com/api/docs/pricing | 2026-09-08 | USD | per 1M tokens | verified | verified | cached-input rate | — | none | not stated | matches official page | same billing-channel caveat as above |
| OpenAI | DirectApi | gpt-5.1/5.2/5.3/5.4/5.5 families | developers.openai.com/api/docs/pricing | 2026-09-08 | USD | per 1M tokens | verified | verified | cached-input rate | — | none | not stated | `gpt-5.3-codex-spark` is $0 ("Research Preview") | same |
| OpenAI | DirectApi | gpt-5.6-sol/terra/luna | developers.openai.com/api/docs/pricing | 2026-09-08 | USD | per 1M tokens | **sol: UNRESOLVED, see below** | **sol: UNRESOLVED** | cached-input rate | long-context tier above 272,000 input tokens | 272,000-token threshold | not stated | `gpt-5.6-sol` output conflicts with the in-repo table — see "Open item" | same, plus sol specifically NOT Verified |
| Google | DirectApi | Gemini family | ai.google.dev/gemini-api/docs/pricing | 2026-09-08 | USD | per 1M tokens | fetched, not wired to any table | fetched, not wired | long-context tiers present | — | long-context tiers | not stated | reference only — no Quotalis provider routes Gemini through a local table | N/A — not consumed by any code path |
| DeepSeek | DirectApi (provider-reported balance in practice) | DeepSeek family | platform.deepseek.com/api-docs/pricing/ | attempted 2026-09-08, blocked (403) | unknown | unknown | UNVERIFIED | UNVERIFIED | unknown | peak/off-peak schedule confirmed in-repo (no $ values) | peak/off-peak time windows | not stated | official page blocked twice this project; DeepSeek's own Quotalis integration uses provider-reported balance, not local pricing | N/A — not needed (DeepSeek already Spend, provider-reported) |

## Source trust policy (owner section 34)

- **Tier 1** (may support a shipped pricing record): the provider's own
  official pricing page, official API/model documentation, official
  billing documentation.
- **Tier 2** (may support a shipped record): an official changelog or
  release announcement from the provider.
- **Tier 3** (discovery only, never authoritative): aggregators, blogs,
  forums, secondary "pricing comparison" sites — usable only to locate
  Tier 1/2 material or to investigate a suspected discrepancy (as
  happened with the `gpt-5.6-sol` case below), never to justify a
  shipped value.

## Discrepancy handling policy (owner section 35)

If two official (Tier 1/2) sources disagree, this project does not
choose silently: both pages, their dates, the exact product/channel each
describes, and a plausible reason (stale cache, page mid-update, two
distinct SKUs) are recorded, and the record is marked **UNRESOLVED**
until reconciled by the owner. Applied below to `gpt-5.6-sol`.

## The OpenAI third-party discrepancy (owner section 10 — required lesson)

Documented in full above under "Discrepancy found": a general-web-search
aggregator's figure for `gpt-5.6-sol` ($5.00/1M input, $30.00/1M output)
does **not** match OpenAI's own official
`developers.openai.com/api/docs/pricing` page ($4.00/1M input, $20.00/1M
output) as read 2026-09-08. The in-repo `CODEX_PRICING` table currently
matches the *aggregator's* number, not the official page's — a real,
still-open discrepancy (see "Open item" above), not resolved by this
phase (changing a shipped price constant deserves an explicit owner
decision, not a unilateral edit during an audit pass). This stands as
the concrete, first-hand evidence for why this project's pricing
provenance policy is official-sources-only: an aggregator's number was
materially wrong, and the in-repo table's use of that wrong number would
never have been caught without independently fetching the official page.

## Model alias audit (owner section 14)

Real model IDs observed in `CODEX_PRICING`/`CLAUDE_PRICING`
(`cost_pricing.rs`) and their classification — aliases are only ever
collapsed where the code's own comment asserts a proven pricing
equivalence, never guessed:

| Real ID(s) observed | Classification | Evidence |
|---|---|---|
| `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5-pro` | canonical IDs | official page, current default listing |
| `gpt-5.1`, `gpt-5.1-codex`, `gpt-5.1-codex-max` → same rate | provider-asserted alias | `normalize_codex_model` collapses `-codex(-max)` suffixes onto the base ID; not an official-doc-proven equivalence, an in-repo normalization choice (pre-existing, not changed this phase) |
| `gpt-5.6`, `gpt-5.6-codex`, `openai/gpt-5.6`, `gpt-5.6-2099-01-01` | latest-alias + dated-ID + vendor-prefix, all → `gpt-5.6-sol` | `test_normalize_gpt56_aliases`, an in-repo assertion, not independently re-verified against an official alias-equivalence statement this phase |
| `claude-opus-4-6`/`-4-7`/`-4-8`/`-4-5` | dated/versioned IDs sharing one rate, per in-repo comment "same pricing as Opus 4.6" | `cost_pricing.rs:421,437` — an in-repo claim, not an official Anthropic alias document; not independently verified this phase |
| `anthropic.claude-sonnet-4-5` → `claude-sonnet-4-5` | vendor-prefix normalization (identity alias, not a pricing claim) | `normalize_claude_model`, unaffected by pricing equivalence questions |

None of these normalizations were changed this phase; they are
inventoried here for the first time as an explicit alias audit, per
owner section 14 — no case was found where Quotalis silently normalizes
`model-latest` to a specific dated ID without an in-repo assertion of
equivalence (whether or not that in-repo assertion has itself been
independently verified against an official source, which several have
not — flagged above rather than treated as fact).

## Unknown-model policy (owner section 15, cross-referenced from the capability matrix)

Unchanged, existing, already-correct behavior: an unrecognized model ID
returns `None` from both `codex_cost_usd`/`claude_cost_usd` — never the
nearest, latest, or a provider-default price. Quota/history continue to
work; only the price lookup reads unavailable. Proven by
`golden_codex_unknown_model_is_none_never_a_guessed_price`/
`golden_claude_unknown_model_is_none_never_a_guessed_price`
(`cost_pricing_tests.rs`).

## Token category / long-context / cache requirements (owner sections 16-19)

For the two priced products (Anthropic DirectApi, OpenAI DirectApi):
both require input, output, and cache-read token categories at minimum;
OpenAI's `gpt-5.6` family additionally requires knowing whether input
tokens crossed the 272,000-token long-context threshold (Quotalis's
in-repo `CODEX_LONG_CONTEXT_THRESHOLD` constant matches this). Neither
product bills per-request or per-minute — both are pure per-token.
Whether `cost_scanner.rs`'s local JSONL logs actually carry a separate
cached-input count (vs. folding it into input) was not re-verified this
phase (out of scope: that scanner's own field extraction, not its
pricing table, is unaffected by Phase 4B).

## Currency/unit classification (owner section 20)

Both priced products: USD, per-1,000,000-token unit. No other currency
or non-token unit appears in either shipped table. Not normalized to
any other unit at runtime (no such runtime lookup exists yet — see
`PRICING_CATALOG.md`).

## Freshness states used in this document

**Verified** (an official Tier-1 source was fetched live 2026-09-08 and
matched): Anthropic's 4 current models, OpenAI's GPT-5 family except
`gpt-5.6-sol`. **Unresolved/conflicting**: `gpt-5.6-sol`. **Potentially
stale** (real number, but no live official source could confirm it
still applies): Anthropic's older dated model IDs. **Unavailable**
(official source could not be fetched at all): DeepSeek. `verified_at`
throughout this document is the real date each fetch was performed
(2026-09-08), never a build or install timestamp.

See also: [QUOTALIS_PROVIDER_CAPABILITY_MATRIX.md](QUOTALIS_PROVIDER_CAPABILITY_MATRIX.md),
[PHASE4_DATA_ACCURACY_AUDIT.md](PHASE4_DATA_ACCURACY_AUDIT.md),
[PRICING_CATALOG.md](PRICING_CATALOG.md).
