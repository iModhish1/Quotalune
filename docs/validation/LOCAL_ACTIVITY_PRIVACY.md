# Local Activity Privacy Contract — Codex & Claude

What Quotalis's local-activity scanning actually does, traced from the
real source-file format through the real parser code
(`rust/src/cost_scanner.rs`, `rust/src/codex_workspaces/`) to what
Analytics displays. Written to the exact evidentiary standard the owner
requires: a claim here is either verified against real code, or marked
as not verified. This document supersedes the per-field table in
`CLAUDE_ACTIVITY_INDEX_PRIVACY.md` for anything it repeats; that
document's per-field justification for the *persisted index specifically*
still stands and is not duplicated here.

Scope: the local-activity **scanners** that back Analytics (Tokens,
Models, Activity, Heatmap, and the `codexLocalActivity`/
`claudeLocalActivity` rows on Settings → Data Sources). Codex's session/
workspace browser (a different feature, not part of Analytics) reads a
superset of fields from the same underlying data — noted explicitly
below where it diverges, so this document never implies a narrower
scope than what actually happens.

---

## Codex

### SOURCE FILE CONTAINS

Codex's local rollout files are line-delimited JSON (JSONL), one event
object per line, written by the Codex CLI itself. Real observed line
shapes (`rust/src/codex_workspaces/indexer.rs` test fixtures, matching
the indexer's own parsing expectations):

```
{"type":"session_meta","payload":{"session_id":"...","cwd":"...","originator":"codex_exec","source":"cli"}}
{"type":"turn_context","payload":{"model":"..."}}
{"type":"event_msg","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":N,"cached_input_tokens":N,"output_tokens":N}}}}
```

The real rollout file also contains additional event types this
document does not enumerate exhaustively (e.g. the actual prompt/
response turns) — Codex's own on-disk log is a full session transcript.
**The source file itself is not privacy-scoped; only what Quotalis's
parser reads out of it is.**

### QUOTALIS PARSES

Two independent, narrow parse paths read this same file family:

1. **Token/cost scanning** (`cost_scanner.rs::CodexEvent` /
   `CodexEventMsg`): deserializes exactly `{type, event_msg: {type,
   input_tokens, cached_input_tokens, output_tokens}}`. No `content`,
   `text`, `prompt`, or message-body field exists anywhere in these two
   structs — serde silently ignores every other JSON key on each line
   (no `deny_unknown_fields`), so prompt/response text is never
   deserialized into memory by this path, not merely "not persisted."
2. **Workspace/session indexing** (`codex_workspaces/indexer.rs`):
   additionally reads `session_id`, `cwd` (the project's absolute
   filesystem path), `originator`, `source`, and `model` (from
   `turn_context.payload.model`) to build the session/project list
   Model Analytics and the Codex workspace browser both consume.
   **`cwd` is a real absolute path from the user's filesystem and is
   parsed by this path.**

Neither path deserializes prompt or assistant response text.

### QUOTALIS PERSISTS

- Token scanning results are cached in-memory per file
  (`CachedClaudeFileRecords`-equivalent for Codex, see
  `cost_scanner.rs`) and in Codex's own on-disk sidecar cache
  (`codex_workspaces/sidecar.rs`, a versioned SQLite blob) as
  `ModelUsage{model, totalTokens, lastObserved}` aggregates and daily
  `{day, totalTokens, cachedInputTokens, estimatedCostUsd}` points —
  never prompt/response text, never credentials.
- The workspace/session index additionally persists `session_id`,
  `cwd`, and a `display_title` (derived from the session, not verified
  further here) as part of `CodexLocalProjectUsageSnapshot` — used by
  the Codex session/workspace browser, not by the Analytics surfaces
  this document scopes.
- **Locally-estimated dollar cost**: `estimatedCostUsd` is computed
  from token counts and a local pricing table — this is a real,
  persisted, locally-estimated figure, gated by
  `cli_log_cost_available()` (`false` for the account/session-level
  contract Analytics' Monetary tab uses) so it is never shown under the
  Monetary tab's Spend/Balance/Credits contract; see
  `MonetaryAnalytics.tsx`'s header comment for why local token activity
  structurally cannot become a Monetary "Spend" figure.

### QUOTALIS DISPLAYS

In Analytics (Tokens/Models/Activity/Heatmap) and Data Sources: total
tokens, per-model token totals and last-observed timestamps, daily
token totals, observed-day counts, and the source's own availability/
capability/freshness metadata. **Never** prompt/response content,
`cwd`, `session_id`, or `display_title` — none of those fields are read
by any Analytics component (`TokenAnalytics.tsx`, `ModelAnalytics.tsx`,
`LocalActivity.tsx`).

Outside Analytics, the separate Codex workspace/session browser *does*
display `cwd` and session titles by default; `CodexLocalProjectUsageSnapshot::redact_for_privacy()`
strips both (session titles become "Local Codex chat", project paths
become `null`) when the user's `hidePersonalInfo` setting is on. This
is a real, existing redaction path for a different feature, noted here
so this document never implies Codex's local data is narrower in scope
than it actually is.

---

## Claude

### SOURCE FILE CONTAINS

Claude Code's local transcript files are JSONL, one event per line,
written by the Claude Code CLI itself. This is a real conversation
transcript: **the source file itself does contain prompt and assistant
response text** for the session it records, plus request/message
identifiers and token-usage metadata. Quotalis does not control this
file's format or content.

### QUOTALIS PARSES

`cost_scanner.rs::ClaudeEvent` / `ClaudeMessage` / `ClaudeUsage` /
`ClaudeCacheCreation` deserialize exactly:

```
ClaudeEvent    { type, timestamp, requestId, message: ClaudeMessage }
ClaudeMessage  { id, model, usage: ClaudeUsage }
ClaudeUsage    { input_tokens, output_tokens, cache_creation_input_tokens,
                 cache_read_input_tokens, cache_creation }
```

No field in any of these four structs holds message content — there is
no `content`, `text`, `prompt`, or body field declared anywhere in this
parse path. Serde ignores every other key on each JSON line (no
`deny_unknown_fields`), so even though the source file's own JSON *does*
carry prompt/response text on the same line, that text is never
deserialized into a Rust value by Quotalis — it is skipped at the JSON
level, not read-then-discarded.

### QUOTALIS PERSISTS

Exactly the fields in `CLAUDE_ACTIVITY_INDEX_PRIVACY.md`'s table,
unchanged by this phase: per persisted record, `model`,
`timestampUnixMs`, `dedupKey` (derived from the API-assigned
`message.id`/`requestId`, never conversation content), and the four raw
token counters (`input`/`output`/`cacheCreate`/`cacheRead`). Plus, at
the index level: `schemaVersion`, `generatedAtUnixMs`, and per-file
`mtimeUnixMs`/`size`/`indexedBytes`/`boundaryFingerprint` (filesystem
metadata and a bounded content hash — Phase 3F — used only to detect
whether a file changed, never derived from message content).

**Explicitly not persisted, verified against the structs above:**
prompt text, assistant response text, credentials/API keys, or any
conversation content. **Locally-estimated dollar cost is not persisted
either** — `claude_usage_record_from_persisted` hardcodes `cost: 0.0`
on every reconstruction (Phase 3D); Claude's local cost estimate is
permanently ineligible for the billing-channel contract
(`cli_log_cost_available()` always `false`), so there is no figure to
carry forward.

### QUOTALIS DISPLAYS

In Analytics (Tokens/Models/Activity/Heatmap) and Data Sources: total
tokens, the single top-observed model (Claude has no per-model ranked
breakdown, only an aggregate top model — `ModelAnalytics.tsx` never
fabricates one), daily token totals, observed-day counts, and the
source's availability/capability/freshness metadata. **Never** prompt
text, response text, `requestId`/message IDs, or any conversation
content — none of these are read by any Analytics component in the
first place (see QUOTALIS PARSES above), so there is nothing for
QUOTALIS DISPLAYS to accidentally expose.

---

## Cross-cutting notes

- Neither source's local-scanner cost/token figures are shown under
  Analytics' Monetary tab. `MonetaryAnalytics.tsx` reads exclusively
  from `DashboardSnapshot.spendTrend`, which is populated only by real
  provider-API cost responses (`CostOrigin::ProviderReported`) — there
  is no code path connecting either scanner's token counts to a Spend/
  Balance/Credits figure.
- No cloud telemetry is introduced by any Analytics work in this
  project. All scanning reads local files on the user's own device;
  nothing described in this document is transmitted anywhere.
- This document was written by reading the actual parser struct
  definitions and redaction code cited above, not inferred from field
  names or prior documentation.
