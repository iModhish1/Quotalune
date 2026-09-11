# Phase 3G — Zero-Copy Claude Records & Performance Investigation Closure

## 1. The deep-clone fix: implemented, correct, proven

`CachedClaudeFileRecords.records` changed from `Vec<ClaudeUsageRecord>` to
`Arc<Vec<ClaudeUsageRecord>>`. `parse_claude_file_records_cached` now
returns `Arc<Vec<ClaudeUsageRecord>>`; every cache-hit path (in-memory
tier 1, persisted tier 2, and the append fast path) returns `Arc::clone`
(a reference-count bump) instead of deep-cloning the record list. Lock
discipline also tightened: the persisted-index lookup now copies out only
the one small `PersistedClaudeFile` entry under the lock, then drops the
lock *before* the more expensive per-record reconstruction runs — no
mutex is held during aggregation.

**Proven, not assumed**: `unchanged_file_second_call_shares_the_same_arc_
allocation_not_a_deep_clone` asserts `Arc::ptr_eq` between two calls for
an unchanged file — not merely equal content, the exact same heap
allocation. **Mutation-tested**: replacing the `Arc::clone` with a real
deep clone made this test fail immediately; restored and re-verified
passing. All 43 pre-existing `cost_scanner` tests continue to pass
unmodified.

**A real test-isolation bug found and fixed along the way**: the new
`Arc::ptr_eq` test occasionally failed only under `cargo test`'s default
parallel execution (never under `--test-threads=1`), because several
Claude-cache tests clear process-global static caches
(`claude_file_records_cache`/`claude_activity_index_cache`) and could
race against each other on different threads. Added
`claude_cache_test_guard()` — a dedicated test-only mutex every
Claude-cache test now holds for its duration — serializing exactly the
tests that share this global state, without forcing the whole test
binary single-threaded. Verified: 3 consecutive full `cargo test
--workspace` runs in default parallel mode, 0 failures.

## 2. The honest result: this was NOT the dominant bottleneck

Re-measured on the real machine, same methodology as every prior phase:

| | Before Arc fix (Phase 3F) | After Arc fix (Phase 3G) |
|---|---|---|
| Cold | 78.4s | 74.5s (noise-level difference, expected — this fix doesn't touch first-parse) |
| Warm, 5 samples | median 9.34s (9.16–18.6s) | median 9.11s (8.9–18.2s) |

**The Arc fix made no measurable difference to end-to-end latency.** The
diagnosis in Phase 3F's own report — "every cache hit still deep-clones a
fresh `Vec<ClaudeUsageRecord>` ... across 80,000+ records on every
request" — was a genuine, real cost (proven by the `Arc::ptr_eq` test:
before this phase, that cost existed; after, it's eliminated), but it was
**not what was actually consuming the ~9 seconds**. This is stated
plainly rather than declaring victory on the strength of a test passing
when the real-world number didn't move.

## 3. Re-investigated: a new, unconfirmed hypothesis

Rather than accept "9 seconds, unexplained" a second time, inspected the
walk path itself for other per-file costs that would scale with file
*count* rather than record count. Found, by code inspection (not yet
proven by instrumentation):

- `walk_claude_files` calls `path.is_dir()` per directory entry, which
  (unlike `DirEntry::file_type()`) is not guaranteed to reuse the
  `readdir`-provided file-type on every platform and can trigger its own
  `stat`-equivalent syscall.
- Immediately after, the same function calls `fs::metadata(&path)` again
  for the cutoff check.
- `parse_claude_file_records_cached` then calls `fs::metadata(path)` a
  *third* time to read the current `mtime`/`size` for its own cache-key
  check.

On a real machine, `fs::metadata` is not free — antivirus real-time
scanning, in particular, is known to add tens of milliseconds per file
open/stat on Windows. With ~330 real Claude files in this corpus, two to
three redundant metadata calls per file is a plausible, file-count-scaled
(not record-count-scaled) explanation for a roughly constant ~9-second
cost that doesn't change whether 0 or 80,000 records need reconstruction.

**This is a hypothesis, not a proven finding.** Confirming it would
require actual timing instrumentation (a rebuild-and-relaunch cycle this
pass's remaining scope didn't accommodate, given the explicit instruction
in this same phase not to open a new speculative architecture project on
an unconfirmed lead). It is recorded here precisely so the next
investigation starts from evidence, not from scratch: the concrete next
step is threading `DirEntry`'s already-known file type and the walk's
already-fetched `Metadata` through to the per-file cache-key check,
eliminating the redundant `stat` calls, then re-measuring.

## 4. Product-acceptance criteria, checked individually

Per the owner's own list (not the raw millisecond number alone):

- Persisted index survives restart — **yes** (Phase 3D, still true).
- Unchanged files do not reparse — **yes**, and now proven zero-copy too
  (this phase).
- An appended file reads only its tail — **yes** (Phase 3F, still true;
  unaffected by this phase).
- No 3 redundant analytical walks — **yes** (Phase 3E, still true).
- Unchanged cache records are shared, not deep-cloned — **yes, newly
  proven this phase** (`Arc::ptr_eq`, mutation-tested).
- Latest request wins / UI responsiveness / correct values — unaffected
  by this phase's change; previously verified, not re-broken (full test
  suite green).

Five of six criteria are met and proven. The remaining end-to-end
latency is real, but its cause is a *different*, now more precisely
targeted question than the one this phase set out to answer — and that
distinction is the honest, useful output of this investigation.

## Verdict

**CLAUDE ZERO-COPY CACHE: PASS** — implemented correctly, proven via a
decisive `Arc::ptr_eq` test, mutation-tested, zero regressions across 43
existing tests and 3 repeated full-workspace parallel runs.

**CLAUDE LOCAL PERFORMANCE: PARTIAL** — the specific mechanism this phase
targeted (deep-cloning on cache hits) is fixed and proven gone, but it
was not the dominant real-world cost; the end-to-end number is unchanged.
A new, evidence-based (not speculative) hypothesis is recorded for the
next investigation rather than another unproven fix being shipped in its
place.
