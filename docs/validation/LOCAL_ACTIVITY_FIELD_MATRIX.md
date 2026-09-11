# Local Activity Field Matrix — Codex vs Claude

Traced directly against the two real local-log scanners: `rust/src/cost_scanner.rs`
(`scan_codex`/`scan_claude`, `get_daily_token_history`) and
`rust/src/codex_workspaces/{types.rs,indexer.rs}` (Codex-only workspace/session
index). No field below is inferred from naming — each row cites the struct/field
or the code path that proves it.

| Field | Codex | Claude | Evidence |
|---|---|---|---|
| Timestamp (event-level) | NO | YES | `ClaudeEvent.timestamp: Option<String>` parsed via `parsed_timestamp()` (RFC3339). `CodexEventMsg` (`cost_scanner.rs:357-363`) has no timestamp field — Codex day-bucketing comes from the JSONL *file's* position/scan cutoff, not a per-event timestamp. |
| Model identity | YES | YES | Codex: `by_model`/`by_model_tokens` keyed by model string from the rollout stream. Claude: `ClaudeMessage.model: Option<String>` (`cost_scanner.rs:389`). |
| Input tokens | YES | YES | `CodexEventMsg.input_tokens` / `ClaudeUsage.input_tokens`. |
| Output tokens | YES | YES | `CodexEventMsg.output_tokens` / `ClaudeUsage.output_tokens`. |
| Cache-read tokens | PARTIAL | YES | Codex only exposes `cached_input_tokens` (undifferentiated cache reads folded into `cached_tokens`; `cost_scanner.rs:361`) — no read/write split. Claude: `ClaudeUsage.cache_read_input_tokens` (`cost_scanner.rs:398`), distinct field. |
| Cache-write tokens | NO | YES | Claude: `ClaudeUsage.cache_creation_input_tokens` + TTL breakdown `ClaudeCacheCreation.ephemeral_1h_input_tokens` (`cost_scanner.rs:397,416`) — Codex has no equivalent field. |
| Reasoning tokens | NO | NO | No `reasoning`-named field anywhere in `cost_scanner.rs` or `codex_workspaces/`. Neither scanner captures reasoning-token counts; do not display a "Reasoning" token category for either provider. |
| Total tokens | YES | YES | Derived (`ModelTokenCounts::total()` = input + output) for both; not a raw source field for either. |
| Session identity (real, with start/end) | YES (workspace index only) | NO | `codex_workspaces::types::SessionUsage` has real `started_at`/`latest_activity` `DateTime<Utc>` fields (`types.rs:145-146`) — but per the existing audit, these are calendar-day-bounded approximations, not true conversation start/end timestamps. `cost_scanner.rs`'s Codex path has no session-identity struct. Claude has no equivalent workspace/session index at all. |
| Session count | YES (file-count proxy) | YES (file-count proxy) | Both scanners increment `summary.sessions_count` once per **source file** that yielded ≥1 usage record (Claude: `cost_scanner.rs:640-647`; Codex: analogous per-file increment). This is a rollout/transcript **file** count, not a real conversation-session count — do not present it as "sessions" without qualifying it as file-based. |
| Source-file identity | YES | YES | Both walk a provider-specific directory tree (`get_codex_sessions_dirs()` / `get_claude_projects_dir()`) and dedup by path; file identity is available internally but is filesystem-path data — do not surface raw local paths in the primary UI (only under an advanced disclosure, per product design rule). |
| Speed/mode tier | YES | NO | Codex: `by_speed` / `by_speed_tokens: HashMap<String, ModelTokenCounts>` (`cost_scanner.rs:149-151`) — a real, distinct dimension. Claude has no speed/tier concept in its usage schema. |
| Daily token history | YES | YES | `get_daily_token_history(provider, days)` (`cost_scanner.rs:1209`) is generic across `"codex"`/`"claude"` — confirmed both have real match arms (prior agent audit); this is the shared time-series source for both providers. |
| Dollar cost | NEVER SHOWN | NEVER SHOWN | `CostSummary::cost_eligible()` gates on `cli_log_cost_available()`, which is permanently `false` (billing-channel ambiguity cannot be resolved from local logs) for both providers. `total_cost_usd` is computed internally for diagnostics only; `eligible_total_cost_usd()`/`format_total()` always return `None`/`"Unavailable"`. Token Analytics must never derive a cost figure from either scanner. |
| Scope | DEVICE-WIDE | DEVICE-WIDE | Both scanners read local filesystem logs with no per-account attribution — this is genuinely device-wide activity, not scoped to a specific signed-in account. Matches `AnalyticsScope::Device` in `analytics_sources.rs`. |

## Implications for the Token/Model/Session/Activity views

- **Token Analytics summary cards**: show Total/Input/Output for both providers.
  Show Cache Read only for Claude (Codex's cache figure is undifferentiated —
  folding it into "Cache" for Codex but splitting Read/Write for Claude would
  misrepresent Codex's actual granularity, so Codex gets one "Cached" card,
  Claude gets separate "Cache Read"/"Cache Write" cards). Never show a
  "Reasoning" card for either. Never show a cost card for either.
- **Token provider comparison**: only compare the shared intersection —
  Total, Input, Output. Do not compare Codex's undifferentiated cache figure
  against Claude's split cache-read/cache-write as if equivalent (rule from
  spec section 14).
- **Session Analytics**: Codex may show a real Session view sourced from
  `codex_workspaces` (with the existing caveat that timestamps are
  calendar-day-bounded, not true start/end — must be labeled as such, not as
  "duration"). Claude must not gain a Session Analytics destination — its
  `sessions_count` is a file-count proxy with no session identity, start/end,
  or per-session breakdown to visualize. This matches the registry's
  `sessionCount: false` for `claudeLocalActivity` already reflected in the
  Data Sources page.
- **Model Analytics**: available for both (real `model` field on both sides).
- **Speed/tier breakdown**: Codex-only view; must not appear when Claude is
  the selected scope.
