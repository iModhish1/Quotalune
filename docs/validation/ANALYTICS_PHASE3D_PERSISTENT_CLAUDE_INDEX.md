# Phase 3D — Persistent Claude Activity Index

## What this phase built

A cross-restart-persistent index for Claude local activity
(`rust/src/claude_activity_index.rs`), sitting beneath the Phase 3C
in-memory cache as a second tier: `(path, mtime, size)`-keyed, versioned,
atomically written, storing only privacy-safe per-record metadata (model,
timestamp, dedup key, four token counters — no prompt/response text, no
cost, no credentials; see docs/validation/CLAUDE_ACTIVITY_INDEX_PRIVACY.md
for the field-by-field audit written *before* the struct, per instruction).

## Architecture, mirroring Codex's proven pattern where semantics matched

- **Cache key**: `(canonical path, mtime, size)` — the same pair Codex's
  own `CostUsageFileUsage` uses.
- **Location**: `crate::paths::cache_dir()/cost-usage/
  claude-activity-index-v1.json` — already Dev/Personal channel-isolated
  (same `APP_DIR_NAME` mechanism every other Quotalis cache uses), so Dev
  and Personal never share this file.
- **Atomic write**: temp sibling + `fs::copy` over the destination
  (matches `JsonlScanner::save_cache`'s own convention) — a crash between
  the two steps leaves the previous valid index untouched. Verified by a
  test that makes the destination unwritable mid-save and confirms the
  prior content survives byte-for-byte.
- **Versioned**: `schema_version` gates every load; any mismatch — or any
  JSON parse failure — is treated as a full cache miss (`ClaudeActivityIndex::
  default()`), never a partially-trusted payload. This is the exact
  safeguard the Phase 3B `model_totals` incident proved necessary,
  verified here by a dedicated test and a mutation test (temporarily
  disabling the version check, confirming the test fails, restoring it).
- **Deliberately NOT** Codex's aggregated `day → model → [i32;3]` shape:
  Claude's forked/resumed transcripts can genuinely duplicate the same
  message across two files, and the existing `should_count_claude_record`
  cross-file dedup pass needs the *raw per-file records* to re-run
  correctly against persisted data — aggregating first (as Codex does)
  would bake in a stale dedup decision that could never be corrected for
  a different query window.
- **Invalidation rules implemented and tested**: unchanged file (mtime+size
  match) → served from the index, zero file I/O; new/changed file →
  reparsed, entry replaced; deleted file → `reconcile_claude_activity_index_
  deletions` (stats every persisted path directly, independent of any
  single walk's own mtime-cutoff filter, so a file outside *this* call's
  window is never mistaken for deleted) prunes it; corrupt JSON / version
  mismatch → safe full rebuild.
- **Single flush per scan, not per file**: the index is only written to
  disk once, after a full walk completes — matching Codex's own
  `scan_codex()` pattern. This was not the original design (see "A
  self-inflicted regression, caught and fixed" below).

## A self-inflicted regression, caught and fixed before it shipped

The first working version saved the index to disk after *every* file's
fresh parse during a walk. On a true first-ever cold build (every file is
"new"), that meant reserializing and rewriting the whole, growing index
once per file — O(files²) disk I/O. Measured: a first-ever cold build
that should have cost about the same as Phase 3C's in-memory-only cold
path (~67.6s) instead took **200.4s** — worse than doing nothing. Caught
by directly measuring rather than assuming success, root-caused by
comparing against Codex's own save-once-per-scan pattern, and fixed by
moving the disk write to a single `flush_claude_activity_index` call
after each scan's walk completes. Re-measured true first-ever cold after
the fix: **71.8s** — back in line with the in-memory-only baseline.

## Restart-warm did not initially meet the pass bar — a second real finding

With a valid, unchanged persisted index across a genuine process restart
(kill, relaunch, call again), the very first measurement was **59.7s** —
barely better than a fresh cold build, nowhere near "dramatically closer
to the ~370ms in-process warm path" the owner's own criteria required.
Not accepted as good enough; investigated further rather than reported as
a win.

**Root cause, confirmed by direct measurement of this machine's real
index**: 329 real Claude transcript files, **80,821 real usage records**.
Every one of those records was being fully reconstructed on every cache
hit — including recomputing its dollar cost via `ClaudePricing::
cost_usd_with_cache_ttl`, a non-trivial pricing-table lookup — even though
Claude's cost is **permanently ineligible for display**
(`cli_log_cost_available()` is always `false` for local-log-derived
Claude/Codex data; see `cost_scanner.rs`'s module doc). That computation
was pure wasted CPU, multiplied by 80,821 records and (still) by the
pre-existing 3x redundant-walk structure from Phase 3C (one call to
`get_provider_chart_data` still triggers a token-history walk plus two
separate cost-summary walks).

**Fix**: `claude_usage_record_from_persisted` no longer recomputes cost at
all — it is hardcoded to `0.0`, which is exactly as correct as any other
value for a field that is never shown to a user for Claude. Re-measured:
**59.7s → 20.2s**, roughly a 3x improvement from this one change alone.

**Not fully resolved.** 20.2s is a real, honest, substantial improvement
over both the 59.7s first attempt and the pre-Phase-3D ~100–112s baseline,
but it does not meet the "dramatically closer to warm (~370ms) than to
cold" bar the owner set. The remaining cost is consistent with the still-
present 3x redundant-walk structure (each of the three separate scans
independently reconstructing and cloning a `Vec<ClaudeUsageRecord>` -- String
clones for `model`/`dedup_key` included -- for a large fraction of those
80,821 records). The scoped, correct next step is exactly what the owner's
own brief already named: consolidate `get_provider_chart_data`'s three
independent walks (`get_daily_token_history`'s own scan, plus
`load_local_usage_summary`'s 30-day and 1-day `scan_local_cost` calls)
into one shared query that computes all three results from a single
pass — not attempted this pass, given the size of that refactor and the
risk of rushing a change to logic several other surfaces depend on.

## Measurements (real machine, same methodology as Phase 3C: direct
`invoke("get_provider_chart_data", {providerId:"claude"})` timing through
the native CDP proof harness against a freshly built, `dev-preflight`-
verified `QuotalisDev.exe`)

| Stage | Cold (fresh process, no valid cache) | Restart-warm (valid persisted index, no file changes) |
|---|---|---|
| Original (pre-Phase-3C) | 100.2–112.3s | *(not applicable — no cache existed)* |
| Phase 3C in-memory-only cache | 67.6s | *(not applicable — in-memory only, doesn't survive a restart)* |
| Phase 3D persistent index, first attempt (per-file save bug) | 200.4s | 59.7s |
| Phase 3D persistent index, batched flush | 71.8s | 59.7s |
| Phase 3D persistent index, batched flush + no wasted cost recompute | 71.8s | **20.2s** |

Real token values across every run stayed consistent (~11.2–11.3M,
drifting slightly because this machine has a live Claude Code session
actively adding new activity between measurements — itself further proof
the incremental invalidation is working on real, changing data, not a
frozen fixture).

## Correctness testing

32 `cost_scanner` tests (0 failed) + 5 `claude_activity_index` tests
(0 failed), including:

- `restart_serves_unchanged_file_from_the_persisted_index_not_a_fresh_
  reparse` — tampers with the saved JSON's record content directly (same
  mtime/size key) and asserts the *tampered* value is what's returned,
  proving the path genuinely reads from the persisted index rather than
  silently re-reading the real file.
- `reconcile_deletions_prunes_a_persisted_entry_for_a_since_deleted_file`
  — proves the actual deletion-reconciliation function used by every
  production scan.
- `schema_version_mismatch_forces_a_rebuild`, `corrupt_json_is_treated_
  as_a_safe_cache_miss`, `atomic_write_failure_preserves_the_previous_
  valid_index`.

**Mutation-tested** (per explicit instruction, not merely present):
temporarily disabled the schema-version check, the persisted-index lookup,
and the deletion-pruning filter in turn — confirmed each corresponding
test fails with the invariant broken, then restored the real
implementation and confirmed all tests pass again.

## Verdict

**CLAUDE PERSISTENT INDEX: PASS** — architecture, privacy, invalidation,
atomicity, and versioning are all real, tested, and mutation-verified.

**CLAUDE LOCAL PERFORMANCE: PARTIAL** — restart-warm improved from
~100–112s (original) to 20.2s, a genuine and substantial (5–6x) real-world
win, achieved only after catching and fixing two self-inflicted
regressions along the way (an O(n²) save pattern, and wasted per-record
cost computation) rather than accepting the first number produced. It
does not yet meet the "dramatically closer to the ~370ms in-process warm
path" bar. The next concrete, scoped step — consolidating the three
redundant per-call scans into one shared query — is named, not hidden.
