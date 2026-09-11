# Claude Activity Index — Privacy Audit

Field-by-field justification for `rust/src/claude_activity_index.rs`'s
persisted `ClaudeActivityIndex`, written *before* the struct, per the
owner's explicit instruction. Every field below is already present in the
in-memory `ClaudeUsageRecord` (`rust/src/cost_scanner.rs`) this session's
Phase 3C fix already builds from real Claude transcript JSON — persisting
it changes *durability* (survives a restart), not *scope* (no new field
category is introduced).

## Persisted fields

| Field | Why required | Source field | Can contain user text? | Retention | Scope |
|---|---|---|---|---|---|
| `schemaVersion` | Lets a future field addition safely invalidate old payloads instead of silently deserializing incomplete data (the exact `model_totals` failure mode this session already found and fixed once) | n/a — Quotalis-authored | No | Until superseded by a version bump | Index-wide |
| `generatedAtUnixMs` | Diagnostics: when the index was last successfully written | n/a — `SystemTime::now()` at save time | No | Overwritten every save | Index-wide |
| `files[path].mtimeUnixMs` | Cache invalidation key half 1: detects a changed file | `fs::metadata().modified()` | No — filesystem metadata, not transcript content | Until the file changes again | Per-file |
| `files[path].size` | Cache invalidation key half 2 | `fs::metadata().len()` | No — a byte count | Until the file changes again | Per-file |
| `files[path].records[].model` | Model Analytics needs the model identity | `ClaudeMessage.model` | Model IDs are Anthropic-assigned strings (`claude-sonnet-4-6`), not user-authored text | Until the file's record set is replaced | Per-record |
| `files[path].records[].timestampUnixMs` | Daily bucketing, cutoff filtering | `ClaudeEvent.timestamp` | No — an RFC3339 instant, parsed to a millisecond integer | Same | Per-record |
| `files[path].records[].dedupKey` | Cross-file dedup (see "Why not just aggregates" below) | Derived from `ClaudeMessage.id` / `ClaudeEvent.requestId` — themselves API-assigned opaque IDs, not user text | These are Anthropic API IDs (message/request UUIDs), never conversation content | Same | Per-record |
| `files[path].records[].input/output/cacheCreate/cacheRead` | Token Analytics' summary cards and time series | `ClaudeUsage.{input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens}` | No — integers | Same | Per-record |

## Explicitly NOT persisted

- **Prompt text** — never deserialized into `ClaudeEvent`/`ClaudeMessage`/
  `ClaudeUsage` in the first place (those structs have no `content`/
  `text`/`prompt` field); there is nothing to accidentally carry forward.
- **Assistant response text** — same reasoning; the parser only ever reads
  the `usage` object and `model` string out of an `assistant`-typed event.
- **Conversation/message content of any kind.**
- **Credentials, API keys, tokens (authentication), or any secret.**
- **`cost` (USD)** — deliberately dropped from the persisted record even
  though `ClaudeUsageRecord` computes it in memory. Cost is derived from
  the current pricing table at read time; persisting a stale computed
  dollar figure risks it silently outliving a pricing update. The
  eligibility gate (`cli_log_cost_available()`, permanently `false` for
  Claude) means this value is never shown to a user regardless, so there
  is no reason to durably store it.
- **Absolute file paths beyond the cache's own internal keys** — the
  index's `files` map is keyed by the canonical path because that *is*
  the cache's invalidation identity, but this map is never serialized to
  the frontend or shown in the primary UI; see `AnalyticsSourceDescriptor.
  doesNotRead` on `claudeLocalActivity`, which already tells the user
  a per-session record and raw paths are not exposed.
- **Any field not already read by the existing `ClaudeEvent`/
  `ClaudeMessage`/`ClaudeUsage`/`ClaudeCacheCreation` structs.** Serde
  ignores unknown JSON fields in a transcript line by default; this
  index does not add a new parser path that could pick up more.

## Why per-file raw records, not per-day aggregated integers

Codex's own persistent cache (`CostUsageCache.files[path].days`) stores
already-aggregated `[input, cached, output]` triples per day per model —
safe for Codex because a Codex session's records never legitimately repeat
across two different rollout files. Claude's format is different: a
forked or resumed conversation can genuinely duplicate the same message
across two transcript files, and `should_count_claude_record`'s
`dedup_key`-keyed `seen` set is what prevents double-counting that
overlap today. Aggregating first (as Codex does) would bake in whatever
dedup decision was made at write time and could never be corrected or
re-run for a different query window. Persisting the **raw per-file
records** (still bounded, still metadata-only, per the table above) lets
the existing, already-tested `should_count_claude_record` cross-file dedup
pass run fresh against the persisted data on every load — exactly the
owner's instruction: "persist per-file normalized metadata, then
aggregate for the requested range."

## Retention

No explicit pruning is implemented this pass. Per-file entries are removed
from the index only when their source file is deleted (see the
invalidation rules doc). The persisted payload's size is one bounded
`(model, timestamp, dedup_key, 4 integers)` record per real usage event —
materially smaller than the transcript it's derived from — and this
session did not measure real-world growth to justify building retention
controls for a hypothetical problem, per the owner's own instruction not
to build settings for problems not yet observed.
