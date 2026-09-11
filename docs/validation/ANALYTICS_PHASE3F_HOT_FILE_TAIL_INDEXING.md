# Phase 3F — Hot-File Incremental Tail Indexing

## 1. Real file write pattern, audited (not assumed)

Inspected this very session's own live Claude Code transcript
(`~/.claude/projects/.../<session>.jsonl`, ~100MB and continuously
growing during this work):

- The file's **prefix is stable**: hashing the first 500 bytes twice, 3
  seconds apart, produced identical hashes while the file kept growing.
- **Size only ever grows** between reads (never observed to shrink).
- The file's resting state between writes **always ends with a complete
  JSONL line terminated by `\n`** — confirmed by inspecting the raw
  trailing bytes (`...pancake"}\n`).

Conclusion: real Claude Code transcripts are **append-only (A)** in
practice, not truncated/rewritten/replaced during normal operation. The
implementation below still defends against B/C/D (truncation, rewrite,
replacement) via a continuity check — never assumed safe purely from
append-only being the common case.

## 2. Persisted index extended (schema v1 → v2)

`PersistedClaudeFile` gained two fields:

```rust
pub struct PersistedClaudeFile {
    pub mtime_unix_ms: i64,
    pub size: i64,
    pub records: Vec<PersistedClaudeRecord>,
    pub indexed_bytes: i64,       // NEW: byte offset of the last fully-consumed line
    pub boundary_fingerprint: u64, // NEW: bounded hash proving that boundary is still real
}
```

`CLAUDE_ACTIVITY_INDEX_SCHEMA_VERSION` bumped 1 → 2 — an old v1 payload
has no way to express "boundary verified, safe to resume here," so rather
than defaulting those fields to a value that would be silently (and
incorrectly) trusted, the version bump forces every v1 payload to a full,
safe rebuild. No raw transcript content is added to what's persisted —
same privacy scope as Phase 3D
(docs/validation/CLAUDE_ACTIVITY_INDEX_PRIVACY.md still applies field-for-
field to the unchanged `PersistedClaudeRecord` shape).

## 3. Append-aware fast path

When a known file's `size` has grown past what's persisted:

1. **Continuity check** — hash a bounded (256-byte) window of bytes
   ending at the old `indexed_bytes`. If it doesn't match the stored
   `boundary_fingerprint`, this isn't a safe append (something changed
   earlier in the file) — fall through to a full reparse. **Never trusts
   size growth alone.**
2. **Tail parse** — seek directly to `indexed_bytes`, read only the new
   bytes (bounded to 64MB; beyond that, fall back to a full reparse
   rather than load an unbounded tail into memory), parse only complete
   (newline-terminated) lines within that tail.
3. **Merge** — append the new records onto the existing persisted list;
   never re-derive the old ones.
4. Update `indexed_bytes`/`boundary_fingerprint`/`size`/`mtime`.

The old 100MB (or however large the file has grown) is never re-read for
an append.

## 4. Partial trailing lines handled correctly

`indexed_bytes` only ever advances past a **real** newline. A dangling
segment with no trailing `\n` yet (a writer mid-flush) is never counted
as a record and never advances the boundary — the next read (whether
another append-tail pass or a fresh full parse) resumes at exactly that
point, so a line that completes between two reads is counted **exactly
once**, never zero or two times. Proven by
`hot_file_tail_indexing::d_e_partial_trailing_line_completes_without_
duplication`.

## 5. Truncation, rewrite, and replacement all correctly rejected

- **Truncation** (`f_truncation_forces_a_full_reparse_not_a_bad_append`):
  new size smaller than persisted → append path's `size > persisted.size`
  guard alone rejects it; full reparse runs.
- **Modification before the old EOF**
  (`g_modification_before_old_eof_is_not_treated_as_append`): same-or-
  larger total size, but earlier content changed — the boundary
  fingerprint mismatches, forcing a full reparse rather than blending
  stale and new content. **Mutation-tested**: disabling the continuity
  check made this exact test fail (the stale record leaked through),
  confirming the check is load-bearing, not decorative.
- **Larger replacement**
  (`h_larger_replacement_is_not_treated_as_append`): entirely different,
  larger content — same fingerprint-mismatch rejection.

## 6. No duplicate records, ever

`hot_file_tail_indexing::a_one_appended_record_is_indexed_incrementally`
and `b_repeated_append_batches_never_duplicate_prior_records` (5
sequential append batches, asserting the exact record count after each)
both pass. **Mutation-tested**: forcing the resume offset to `0` (instead
of the real `indexed_bytes`) made the single-append test fail with a
duplicated record (3 instead of 2) — confirming the resume-offset
invariant is real and enforced by the test.

## 7. Cross-file dedup unaffected

The shared `should_count_claude_record` dedup pass (Phase 3C/3D) still
runs on every record the tail parser produces, exactly as before — tail
parsing only changes *how bytes are read*, never the dedup/cutoff
semantics. `unified_claude_activity_matches_old_daily_and_summary_
semantics` (Phase 3E) continues to pass unchanged, confirming this.

## 8. Security

Oversized appended lines and malformed appended JSON are both discarded
safely without blocking subsequent good lines in the same append
(`m_n_oversized_and_malformed_appended_lines_are_discarded_safely`) — the
same `CODEX_JSONL_MAX_LINE_BYTES` (256KB) bound already enforced
elsewhere is reused here, not reinvented. The 64MB append-tail cap
prevents an unbounded in-memory read even for a pathological single
append.

## 9. Testing summary

9 new deterministic tests (`cost_scanner::tests::hot_file_tail_indexing`),
0 flaky timing assertions — every assertion is on byte offsets or record
content, matching the explicit instruction against wall-clock tests.
3 invariants mutation-tested (continuity check, resume offset,
partial-line guard) — each confirmed to fail with the real implementation
broken, then restored and re-verified passing. Full `cost_scanner` suite:
42 tests, 0 failed (33 prior + 9 new).

## 10. Performance — real, honest result

Re-measured on the real machine, same native CDP methodology:

| Scenario | Result |
|---|---|
| Cold (no persisted index) | 78.4s — unchanged, as expected (this fix doesn't touch the first-ever cold path) |
| Warm, in-process, hot file both growing and static across 5 samples | **median 9.34s** (9.16–18.6s) |

This is a real improvement in *what happens on an append* (proven by the
test suite: only new bytes are read, never the old 100MB), but the
end-to-end IPC call did **not** drop to sub-second the way a pure
architecture fix should. Investigated rather than declared "close
enough":

**New finding, distinct from Phase 3E's hot-file diagnosis**: samples 3–5
above show **identical token totals** (the hot file did not change
between those three calls) yet still cost ~9.1–9.4s each. Since nothing
changed, this cannot be re-read/re-parse cost — every one of those three
calls should have hit the in-memory cache tier for every one of the ~330
files. The real remaining cost is **reconstruction**: every cache hit
(`claude_usage_record_from_persisted` and the `Vec<ClaudeUsageRecord>`
clone that backs it) still runs across the full persisted corpus
(80,000+ records, each carrying two heap-allocated `String`s) **on every
single call**, because the current design returns and clones a fresh
`Vec<ClaudeUsageRecord>` per file per call rather than sharing one
already-built copy. This is a genuinely different bottleneck than either
Phase 3E's redundant-passes finding (fixed) or the giant-hot-file re-read
problem this phase set out to fix (also fixed, and proven working) — it
is a **per-call materialization cost across the whole corpus**, present
even when zero files changed.

**Not fixed this pass.** The scoped, well-understood next step is to
share the reconstructed `Vec<ClaudeUsageRecord>` across calls (e.g. via
`Arc`) so a cache hit is a cheap reference-count bump instead of a deep
clone of tens of thousands of records — named precisely here rather than
left as an unexplained plateau.

## Verdict

**CLAUDE HOT-FILE INDEXING: PASS** — append-only growth is now handled
correctly and efficiently: proven by 9 deterministic tests (3 of them
mutation-tested) that a growing file's new bytes are parsed without
re-reading its old content, truncation/rewrite/replacement are all
correctly rejected back to a full reparse, and no record is ever
duplicated or dropped.

**CLAUDE LOCAL PERFORMANCE: PARTIAL** — the specific defect this phase
targeted (re-reading an entire active file on every append) is fixed and
proven. The end-to-end restart/warm number did not reach sub-second
because a different, now precisely identified bottleneck (whole-corpus
record-reconstruction cost on every call) dominates once the re-read cost
is removed.
