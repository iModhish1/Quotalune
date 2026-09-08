# Pricing Provenance — Phase 4

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

See also: [PHASE4_DATA_ACCURACY_AUDIT.md](PHASE4_DATA_ACCURACY_AUDIT.md),
[PRICING_CATALOG.md](PRICING_CATALOG.md).
