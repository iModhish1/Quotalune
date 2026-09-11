# Phase 3C — Claude Local-Activity Performance Fix

## Root cause (confirmed by reading the actual call graph, not assumed)

A single `get_provider_chart_data("claude")` IPC call
(`apps/desktop-tauri/src-tauri/src/commands/chart.rs`,
`build_provider_chart_data_with_cancel`) triggered **three independent full
walks** of every Claude transcript file on this machine, every single time:

1. `get_daily_token_history("claude", 30)` (`rust/src/cost_scanner.rs`) —
   walked the whole Claude projects directory and re-parsed every JSONL
   line of every in-window file. **No caching at all.**
2. `load_local_usage_summary_cached("claude", ...)` → on a cache miss (the
   30s in-memory TTL had expired, or this was the first call this
   process), calls `load_local_usage_summary_with_unknown_models`, which
   itself calls `scan_local_cost("claude", 30, ...)` **and**
   `scan_local_cost("claude", 1, ...)` — two more independent full walks
   via `CostScanner::scan_claude_with_cancel`.

Compare to Codex: `get_daily_token_history("codex", ...)` calls
`scanner.scan_codex()` once, then reads the result back out of
`JsonlScanner::load_cache`'s persisted, mtime+size-keyed per-file cache —
an unchanged file is never re-opened or re-parsed. Claude had no
equivalent at any layer: `walk_claude_files`/`for_each_claude_usage_record`
opened and JSON-parsed every file from scratch on every single call, and
nothing skipped a file whose content had not changed since the last call.

Reproduced and measured directly via IPC timing
(`.local/proof/claude-audit/phase3b-claude-chart.mjs`, Phase 3B): a single
cold call took 100–112 seconds on this real machine (~500 real Codex files
alongside a substantial Claude transcript history). That number already
reflected the 3x redundant work above.

## The fix

Added a process-lifetime, in-memory cache of each Claude transcript file's
**raw, un-deduped usage records**, keyed by `(canonical path, mtime, size)`
— the same defensible source-identity pair Codex's own
`CostUsageFileUsage` cache already uses (`rust/src/cost_scanner.rs`,
`parse_claude_file_records_cached`/`CachedClaudeFileRecords`).

- A file whose `(mtime, size)` match a prior parse is served from memory —
  no file open, no JSON parsing.
- A file that changed (new content, different size/mtime) is reparsed
  fresh, and the cache entry is replaced.
- A file that no longer exists is never served stale: `fs::metadata`
  failing means the identity check can't match, so the miss path runs and
  correctly returns nothing for that path.
- The cache stores **only** `model`, `timestamp`, a `dedup_key`, and the
  four token counters (`input`/`output`/`cache_create`/`cache_read`) plus
  `cost` — exactly the fields `ClaudeUsageRecord` already carried. No
  prompt or response text is deserialized into this struct in the first
  place (see `ClaudeMessage`/`ClaudeUsage`'s field lists), so there is
  nothing sensitive for the cache to persist even in memory.
- Cross-file dedup (`should_count_claude_record`'s `seen: &mut HashSet`)
  still runs **fresh on every call** from the cached raw records — caching
  only skips the expensive I/O/parsing step, never the correctness-critical
  dedup/cutoff filtering, so a stale cache can never misrepresent the
  current window or double-count a record.
- **Not persisted to disk** (unlike Codex's sidecar): scoped deliberately
  to eliminate the proven redundant-work defect without taking on
  disk-cache versioning/corruption-safety risk in this pass. Each fresh
  app process pays one real cold scan; every call after that, for the rest
  of that process's lifetime, is warm. A full persisted-across-restart
  index (mirroring Codex's `WorkspaceUsageSidecar`) remains a valid future
  improvement, called out explicitly rather than silently deferred.

## Before / after measurements (this real machine)

All timings via direct `invoke("get_provider_chart_data", {providerId:
"claude"})` through the real CDP native-proof harness against a freshly
built, `dev-preflight`-verified `QuotalisDev.exe` — not a synthetic
microbenchmark.

| | Before | After |
|---|---|---|
| **Cold** (first call, fresh process) | 100.2–112.3s (reproduced twice, Phase 3B) | 67.6s |
| **Warm** (second+ call, same process, no file changes) | not meaningfully different from cold — `get_daily_token_history` had zero caching regardless of the 30s TTL on the *other* code path | 370–381ms |
| **Warm, one file actively changing** (a live Claude Code session was writing to its own transcript during this test) | n/a (not previously measurable — every call was ~100s) | 4.1s — only the changed file(s) reparse; the rest serve from cache |

**Cold** dropped by roughly a third (three redundant full walks collapsed
into one). **Warm** is the dramatic result: from effectively "always slow"
to sub-second, matching the "should feel effectively immediate" target.
The remaining ~67.6s cold cost is a genuine one-time full-corpus parse on
this machine's real transcript volume; a bounded-progress indexing UX and/or
a persisted cross-restart cache (mirroring Codex's sidecar) would address
that specifically, and is called out as follow-up work rather than treated
as done.

## Correctness preserved

All 27 pre-existing `cost_scanner` tests continue to pass unchanged
(dedup, cutoff filtering, cost calculation, unknown-model detection,
oversized-line/malformed-JSON handling). Three new deterministic tests
(no timing, per section 10's explicit instruction against flaky
timing-based tests) prove the cache's invalidation semantics directly via
file content:

- `deleted_claude_file_is_not_served_stale_from_cache` — a removed file
  returns no records, never the old cached ones.
- `modified_claude_file_is_reparsed_not_served_stale` — appending a second
  record to a file changes its size/mtime and the second parse correctly
  picks up both records, not the stale single-record cache.
- `unchanged_claude_file_reads_are_stable_across_repeated_calls` — two
  reads of an untouched file return identical content.

## Native re-verification after the fix

Rebuilt `QuotalisDev.exe` (`tauri build --debug --no-bundle --features
dev-channel`), `dev-preflight` **PASS**
(`channel=dev exe=QuotalisDev.exe app_dir_name=QuotaArc-Dev`). Re-opened
Analytics → Tokens and → Models on the same real machine:

- Codex's Tokens/Models values are byte-identical to the pre-fix native
  screenshots (63.9B/63.7B/59.5B/118.6M; the same 10 ranked models) —
  the cache change touches only Claude's path, confirmed unchanged.
- Claude's Tokens card now resolves in a few seconds instead of ~100+,
  showing the same real value (11.2M, matches the pre-fix screenshot)
  with the same honest "no breakdown available" note.
- Claude's Models section now resolves the same way, showing the same
  real `claude-sonnet-5` top-model result with the same honest
  no-per-model-breakdown note.

Screenshots (overwritten in place, same paths as Phase 3B):
`docs/images/analytics-superstack/ANALYTICS_SUPERSTACK_TOKENS_CLAUDE.png`,
`ANALYTICS_SUPERSTACK_TOKENS_CODEX.png`,
`ANALYTICS_SUPERSTACK_MODELS_CODEX.png`,
`ANALYTICS_SUPERSTACK_MODELS_CLAUDE.png`.
