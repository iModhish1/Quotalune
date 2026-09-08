# Pricing Catalog Architecture (Phase 4)

## What exists today

Quotalis's only local, hand-maintained $/token pricing catalog is
`rust/src/core/cost_pricing.rs`: two `static` `HashMap`s,
`CODEX_PRICING` and `CLAUDE_PRICING`, each keyed by canonical model ID
string, each value a per-token USD rate struct (`CodexPricing`/
`ClaudePricing`). This is already:

- **Versioned & source-controlled** — it's a `.rs` file in this repo,
  changed only via a commit.
- **Offline** — no network call is made to price a Codex/Claude model
  covered by these tables.
- **Testable** — plain Rust structs/functions, unit-testable without any
  I/O.
- **Not a cloud DB / not a Quotalis server** — nothing here talks to any
  Quotalis-owned service; it ships inside the binary.

A second, **live-cached** catalog exists for everything NOT in those two
tables: `rust/src/core/models_dev_pricing.rs` reads
`https://models.dev/api.json` (a public third-party aggregator, not
provider-official) opportunistically — only on a cache miss/staleness for
an unknown model, coalesced and rate-limited to one refresh attempt per
15 minutes, cached to disk with a 24-hour TTL. It backs
`claude_routed_pricing.rs` (Claude models routed to non-Anthropic
backends) and the Codex unknown-model fallback path.

## Precedence (already implicit in the code; stated explicitly here)

1. **Provider-reported cost wins** — if a provider's own API/dashboard
   returns a real cost/spend/balance figure (see
   `QUOTALIS_PROVIDER_DATA_CAPABILITIES.md`, 24 providers), that number is
   shown as-is and Quotalis never recomputes or adds a locally-estimated
   figure on top of it for the same usage.
2. **`CODEX_PRICING`/`CLAUDE_PRICING` (hand-verified, in-repo)** — used
   only for Codex/Claude local cost computation (`cost_scanner.rs`,
   `codex_costs.rs`, `pi_session_cost.rs`, `spend_contract/opencodex.rs`)
   where no provider-reported figure exists for that usage.
3. **`models_dev_pricing.rs` (live-cached, third-party)** — fallback only
   for a model absent from step 2's tables (routed backends, unknown
   Codex/Claude model IDs).
4. **Unavailable** — a model in neither table, with no cached models.dev
   entry, produces no invented price. `cost_pricing.rs`'s public API
   returns `Option`/`Result` throughout; callers already handle "no
   price" as a real outcome, not a panic or a silent zero (verified by
   reading the call sites in Agent B's audit — no caller unwraps a
   pricing lookup with a fallback default price).

## Units

Every rate in both tables is **USD per single token** (e.g. `1.25e-6` =
$1.25 per 1,000,000 tokens) — not per-1K or per-1M. `models_dev_pricing.rs`
converts on ingest (`rate / 1_000_000.0`, since models.dev quotes
per-million rates) so every consumer of `CostUsagePricing`/
`DynamicModelPricing` sees the same per-token unit regardless of which
tier supplied the number. This uniform unit is what makes the anti-1000x
tests in `cost_pricing.rs`'s test module meaningful (see
"Anti-unit-error tests" below).

## Aliases

`CLAUDE_PRICING`/`CODEX_PRICING` collapse aliases only where the code
comment states an explicit equivalence claim (e.g. `cost_pricing.rs:421`
"same pricing as Opus 4.6", `:437` "same pricing as Opus 4.5/4.6/4.7") —
these are pricing-equivalence claims the table author asserted, not
generic latest-model fallbacks; a model ID not literally present in the
map (and not one of these explicit aliases) returns no price rather than
being silently mapped to "the nearest" entry.

## Freshness

Neither table carries a machine-readable `verified_at`/`effective_date`
field today — freshness is currently only visible via git blame /
inline comments (e.EQ. `cost_pricing.rs:437` "updated to match upstream
0.22"). This phase's `PRICING_PROVENANCE.md` records the one
independently-verified freshness date (2026-09-08) against official
sources for the currently-live model families; a future phase should add
a `verified_at` field to `CodexPricing`/`ClaudePricing` directly so the
UI's "Pricing: Verified <date>" surface (owner section 32) can read a
real per-record date instead of one audit-doc-wide date. **Not built in
this phase** — see "Deferred" below.

## Currency

Both tables are USD-only; no currency field exists because no rate in
either table is denominated in anything else. Providers that report cost
in a non-USD currency (see the provider capability matrix) carry their
own `currency_code`/`currency_symbol` on `CostSnapshot` already — Quotalis
does not convert or sum figures across currencies (no FX logic exists
anywhere in the cost pipeline; confirmed by Agent B's grep pass finding
no `exchange_rate`/`fx` symbols in the cost-code files read).

## Validation

`cost_pricing.rs` has no dedicated build/startup validation pass today
(no check for duplicate keys — impossible in a Rust `HashMap` literal
without a compile error; no check for negative prices; no check for
missing provenance). Given the map literals are compile-time-checked for
duplicate keys by Rust itself (a duplicate key in a `HashMap::from([...])`
literal is not a compile error but IS caught by this phase's new golden
test `catalog_has_no_duplicate_keys`, see below), the main residual risk
is a wrong-but-present value — which official-source verification (this
phase's `PRICING_PROVENANCE.md`) is the actual mitigation for, not a
schema check.

## Deferred (not built in this phase)

A full migration to an external JSON/TOML-backed catalog with a formal
schema (per-record `verified_at`, `official_source_url`, `notes`) was
scoped by the owner's request (section 12/13) but is **not implemented
in this Phase 4 pass** — see the final Phase 4 report's "Remaining
limitations" for the explicit reasoning: the existing two-static-map
architecture already satisfies every hard constraint (offline,
versioned, testable, local-only, no server), and a live migration to a
new file format is a meaningful behavior change to money-relevant code
that this pass chose not to rush without a dedicated verification cycle.
What Phase 4 did instead: (1) verified the existing tables against
official sources and documented every record's provenance
(`PRICING_PROVENANCE.md`), (2) found and flagged one real pricing
discrepancy for owner decision rather than silently editing it, (3)
added the golden/anti-unit-error test corpus described below against the
*existing* table shape, so a future schema migration has a real
regression net to migrate against.

## Confirmed token-category semantics (found while writing golden tests)

Writing the golden corpus surfaced a real semantic detail worth
recording: in `codex_cost_from_rates` (`cost_pricing.rs:578-591`),
`cached_input_tokens` is a **subset** of `input_tokens` (billed at the
cache-read discount instead of the full input rate; clamped via
`cached_input_tokens.min(input_tokens)`), not an additional category
counted on top of `input_tokens`. An early draft of this phase's golden
tests assumed cache reads were additive and failed against the real
implementation -- the implementation is correct (this matches how OpenAI
actually bills cached input), the test's assumption was wrong, and the
test was fixed to match verified behavior rather than the code changed
to match a wrong assumption. This is exactly the kind of token-category
ambiguity owner rule 19 asks to be audited explicitly rather than
assumed.

## Golden test corpus / anti-unit-error tests (this phase)

See `rust/src/core/cost_pricing.rs`'s test module additions (Phase 4
commit): known-model exact-rate assertions for the models verified in
`PRICING_PROVENANCE.md`, an explicit `unknown_model_returns_none` case
(never silently priced), and anti-1000x tests asserting that 1 /
1,000 / 1,000,000 tokens against a per-million-token-equivalent price
produce the correct linearly-scaled result (catching a stray `* 1000` or
`/ 1_000_000` unit-conversion bug before it reaches a user-facing dollar
figure).
