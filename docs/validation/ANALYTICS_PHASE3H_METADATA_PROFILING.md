# Phase 3H — Final Targeted Performance Check: Metadata Hypothesis

## The hypothesis (from Phase 3G)

"Up to ~3 redundant `fs::metadata` calls per Claude source file across
~330 files may account for much of the remaining constant latency" —
explicitly flagged as unconfirmed, based on code inspection only.

## Direct measurement (not code inspection)

Added temporary instrumentation (atomic call counter + cumulative
`Instant`-based timer around every `fs::metadata`/`path.is_dir()` call on
the Claude scan path — `walk_claude_files`'s cutoff check and
`parse_claude_file_records_cached`'s own cache-key fetch), gated behind
`#[cfg(debug_assertions)]` so it never compiles into a release build.
Rebuilt a real `QuotalisDev.exe`, ran it against this real machine's
actual Claude corpus, and read the real output from the process's own
log.

**Real measured numbers, captured during the actual slow (~9–18s) warm
requests, not a synthetic benchmark:**

```
files=349  metadata_calls=1488  calls_per_file=4.26  metadata_total_ms=61–72
```

## Verdict: hypothesis REJECTED

The redundancy is real and slightly worse than guessed (4.26 calls per
file, not "up to 3") — but its **cost is negligible**: ~65ms out of a
9,000–18,500ms request, roughly **0.4–0.7% of the total**. Eliminating
every redundant metadata call would not have produced a measurable
improvement. Recorded honestly rather than "fixed" on the strength of a
plausible-sounding theory — this is exactly the outcome this targeted
profiling pass existed to catch before any code was changed on the
strength of an unproven guess.

The temporary instrumentation was removed after use (reverted to the
Phase 3G committed baseline) — it was diagnostic-only, its job is done,
and per this phase's own hard boundary, no further caching/index/
ownership redesign is being started this pass regardless of outcome.

## What the numbers point to instead (recorded, not chased)

With metadata ruled out and the per-record deep-clone already fixed
(Phase 3G, proven via `Arc::ptr_eq`), the remaining ~8.9–9.5 seconds must
be CPU time spent doing real work on every one of the corpus's ~80,000+
records on every call — most plausibly the cross-file dedup/aggregation
pass itself (`should_count_claude_record`'s `HashSet<String>` insert with
a `String` clone per record, plus the daily/model `HashMap` updates in
`get_claude_local_activity`'s per-record closure), which by design
re-runs fully on every call regardless of whether any file changed
(Phase 3D's own documented tradeoff, made deliberately for dedup
correctness). A secondary contributing factor visible in the sample
timings themselves: `get_provider_chart_data` still invokes the unified
`get_claude_local_activity` path from two independent call sites
(`get_daily_token_history` and, once its 30-second in-memory TTL
expires, `load_local_usage_summary_cached`) — the bimodal sample
distribution this pass measured (~9s vs ~18.5s, roughly 2x) is consistent
with whether that TTL happened to be warm or not for a given sample.

**Neither of these is fixed this phase.** Per the explicit hard boundary
("FREEZE CLAUDE PERFORMANCE ARCHITECTURE FOR THIS PHASE... DO NOT start
another cache/index/ownership redesign"), this is recorded as a
precisely-targeted starting point for a future investigation, not
implemented now — including because caching the aggregation *result*
itself (the natural fix for the first factor) is, by definition, another
caching layer, which this phase's own rule places out of scope regardless
of how contained the change would be.

## Product-acceptance status (unchanged from Phase 3G)

All five previously-met criteria remain true (persisted index survives
restart, unchanged files don't reparse, appended files read only their
tail, no redundant multi-pass walks, unchanged cache records are shared
not deep-cloned). End-to-end latency is unchanged from Phase 3G
(~9.1–9.5s median, ~18.5s on TTL-cold samples).

## Verdict

**CLAUDE METADATA OPTIMIZATION: NOT NEEDED** — the hypothesized cost was
real but negligible; no code change was warranted or made.

**CLAUDE LOCAL PERFORMANCE: PARTIAL** — unchanged from Phase 3G. The
performance investigation across Phases 3B–3H is closed for this
engagement's current scope: five of six product-acceptance criteria are
met and proven, cold-start and hot-file-append behavior are both correct
and measurably improved from the original ~100–112s baseline, and the
remaining warm-path cost is now precisely characterized (not vaguely
"slow") for whoever picks up the next investigation.
