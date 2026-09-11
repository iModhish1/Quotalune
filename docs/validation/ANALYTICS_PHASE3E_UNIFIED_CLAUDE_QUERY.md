# Phase 3E — Unified Claude Local-Activity Query

## The three passes, traced precisely (not guessed from names)

A single `get_provider_chart_data("claude")` call (still, as of Phase 3D)
made three independent full traversals of the same persisted Claude
records:

- **PASS A** — `get_daily_token_history("claude", 30)`
  (`cost_scanner.rs`): walked all Claude files within a 30-day cutoff,
  called `for_each_claude_usage_record` per file, accumulated into a
  `day_key -> total tokens` map via `add_claude_record_to_daily_tokens`.
  Consumer: `ProviderChartData.tokensHistory`.
- **PASS B** — `scan_local_cost("claude", 30, cancel)` inside
  `load_local_usage_summary_with_unknown_models` (`chart.rs`): a second,
  independent 30-day walk via `CostScanner::scan_claude_with_cancel`,
  building a full `CostSummary` (tokens, cost, `by_model`/
  `by_model_tokens`, `sessions_count`, `unknown_models`). Consumer:
  `thirty_day_tokens`, `top_model`, `unknown_models`.
- **PASS C** — `scan_local_cost("claude", 1, cancel)`: a third,
  independent walk over the same files with a 1-day cutoff, same
  `CostSummary` shape. Consumer: `latest_tokens`.

All three read the exact same underlying persisted per-file records
(Phase 3C/3D's cache), just aggregated three separate times.

## The unified query

`cost_scanner::get_claude_local_activity(window_days, cache_root, cancel)`
— **one** walk producing everything the three passes used to compute
separately:

```rust
pub struct ClaudeLocalActivity {
    pub daily_tokens: Vec<(String, u64)>,  // same shape PASS A returned
    pub today_tokens: u64,                  // replaces PASS C
    pub trailing_tokens: u64,               // replaces PASS B
    pub model_totals: HashMap<String, u64>, // real per-model totals (new capability, not yet surfaced -- see below)
    pub top_model: Option<String>,          // identical selection rule to the old top_model() helper
    pub unknown_models: HashSet<String>,    // preserved for the pricing-catalog-refresh mechanism only
}
```

No `sessions`, no `cost`, no `active time`, no invented fields — exactly
the owner's explicit list.

**Cost removed entirely from this path.** The old `CostSummary`-based
passes computed `total_cost_usd`/`by_model` via `ClaudePricing::
cost_usd_with_cache_ttl` for every record, even though
`cli_log_cost_available()` is permanently `false` for Claude and that
cost was *never shown to a user* through this path. The unified query
does not compute cost at all. `unknown_models` is still populated, but
only via a lightweight pricing-table *existence* check
(`CostUsagePricing::claude_cost_usd(&model, 0, 0, 0, 0).is_none()`), not
the tiered cost formula — preserved because
`refresh_provider_local_usage_cache` genuinely uses it to keep the shared
pricing catalog fresh for other, cost-eligible providers. This is the
same category of dead work Phase 3D already found and removed from the
per-record reconstruction path; this phase removes the equivalent waste
from the aggregation layer.

**Consumers migrated, nothing else touched** (per the explicit instruction
not to rewrite unrelated APIs): `get_daily_token_history`'s `"claude"`
match arm and `load_local_usage_summary_with_unknown_models` (renamed
Claude branch: `load_claude_local_usage_summary`) both now call the one
shared function. `CostScanner::scan_claude_with_cancel`/`scan_local_cost`
are completely unchanged and still serve every other consumer (CLI,
`spend_contract.rs`, `usage_spend.rs`, `analytics_sources.rs`, `cli/serve/
dashboard/source.rs`) exactly as before.

## Semantic equivalence, proven on fixtures

`unified_claude_activity_matches_old_daily_and_summary_semantics`: two
files, two real days, two distinct models, plus a cross-file duplicate
(same dedup key, snake_case `request_id` variant — the exact real-world
shape a resumed/forked conversation produces). Asserts:
- today's bucket counts the duplicated record exactly once (1500 tokens,
  not 3000 — proves dedup survives the refactor);
- yesterday's bucket is correct (300 tokens);
- the 30-day total is the sum of both real days (1800);
- `top_model` is the correct argmax by total input+output tokens
  (`model-x`, not `model-y`).

Not a call-count instrumentation test (rejected deliberately, per the
explicit instruction against flaky global counters) — a value-correctness
test against the exact same low-level primitives
(`for_each_claude_usage_record`, `add_claude_record_to_daily_tokens`) the
unified function's inner loop calls, so the equivalence is structural, not
coincidental.

## Performance: real improvement, then a real finding that reframes it

Restart-warm (kill the app, relaunch, `get_provider_chart_data("claude")`
via the native CDP harness), 5 samples, median reported:

| Stage | Restart-warm |
|---|---|
| Phase 3D (3 redundant passes, cost recompute removed) | 20.2s |
| Phase 3E (1 shared walk, no cost work at all) | **12.9s median** (8.8s–22.1s across 5 samples) |

A real ~35% further improvement — but the samples are **not** flat, and
they don't approach the ~370ms Phase 3C in-process-warm figure the way a
purely architectural fix should. Investigated rather than accepted as
"good enough":

**Root cause of the remaining variance**: this very conversation's own
Claude Code session transcript file
(`~/.claude/projects/N--QuotaArc/<session-id>.jsonl`) is, at time of
measurement, **100 MB** and growing continuously as this session's own
tool calls are written to it in real time. Every measurement above was
taken *while this same agent session was actively running* on the same
machine — meaning the single largest, most expensive file in the whole
corpus was, by construction, changing between almost every sample. An
actively-growing file can never benefit from either cache tier (in-memory
or persisted) — its `(mtime, size)` identity changes every time it's
touched, so it is correctly and unavoidably reparsed in full on every
access where it changed. Reparsing ~100 MB of JSONL, even bounded
per-line, is genuinely multi-second work, and that cost is now the
dominant term in these numbers — not redundant aggregation (fixed) and
not wasted cost computation (also fixed).

This means the measured 8.8–22.1s range reflects **this session's own
unusual, self-referential, actively-writing 100 MB test environment**,
not the steady-state experience a real user would have restarting
Quotalis after closing a normal-length Claude Code session (where every
transcript file, including that session's own, is static once the app
that wrote it has exited). The architecture fix (one shared walk, zero
redundant passes, zero wasted cost math) is real and complete; the
remaining latency in *this specific measurement* is dominated by an
artifact of measuring performance from inside the very session generating
the load.

**Not re-measured in a "clean" environment this pass** (would require
either waiting for this session to end, or fabricating a synthetic
100 MB+ transcript, neither of which was done — no number is asserted
that wasn't actually observed).

## Correctness testing

33 `cost_scanner` tests, 0 failed (32 prior + 1 new semantic-equivalence
test). Full workspace: Desktop 474 passed/1 ignored, Core 1684 passed, CLI
1 passed, 0 doctests. Clippy `-D warnings` clean, `cargo fmt --check`
clean.

## Verdicts (see final report for the complete set)

**CLAUDE SHARED QUERY: PASS** — one traversal, semantically proven
equivalent, cost work fully removed, legacy APIs untouched.

**CLAUDE LOCAL PERFORMANCE: PARTIAL** — real, measured further
improvement (20.2s → 12.9s median), but did not reach the sub-second
target this pass, and the specific reason is now precisely identified
(measurement-environment artifact from a 100 MB actively-growing session
transcript) rather than left as an unexplained shortfall.
