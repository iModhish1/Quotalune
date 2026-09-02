# Data flow

What QuotaArc reads, where it writes, and what never happens (no telemetry,
no cloud backend, no prompt/response collection).

## Local storage (QuotaArc-owned)

| Path | Contents |
|---|---|
| `%APPDATA%\QuotaArc\` | `settings.json` (DPAPI-protected secure file), provider stores (`api_keys.json`, `manual_cookies.json`, token accounts), hooks config, logs (`logs/quotaarc-cli.log`, `logs/quotaarc-desktop.log`) |
| `%LOCALAPPDATA%\QuotaArc\` | device-local state: widget snapshots, openai dashboard cache, installed app (installer layout) |
| `%LOCALAPPDATA%\QuotaArc\cost-usage\`, `%CACHE%\QuotaArc\` | cost scan caches, models.dev pricing cache, update downloads |

All path resolution flows through one module (`rust/src/paths.rs`) — the same
directories whether installed, portable, or run from a dev build.

## Provider queries

QuotaArc queries only the minimum information needed for usage/cost features
of each provider (usage endpoints, plan/bucket endpoints, local CLI/config
files). Cookies are only read when the user explicitly enables a browser
source for that provider; decryption uses Windows DPAPI locally.

## Secrets

- App-managed API keys / cookies / token accounts: DPAPI user-scoped secure
  files.
- Provider CLIs' own credentials (e.g. Claude Code, Codex CLI): read in place,
  never copied to QuotaArc storage, never logged.
- Logs and diagnostics pass through a central redactor
  (`rust/src/core/redactor.rs`, with tests): tokens, keys, cookies,
  authorization headers are stripped.

## Events (in-process)

`provider refresh → AppState.provider_cache → provider-updated events → all
surfaces (tray, Edge Arc, Top Arc, dashboard)` — one cache, one event stream,
no per-surface polling of providers.

## Never

No account, no QuotaArc server, no telemetry, no ads, no prompt/response/source
collection, no credential transmission to third parties by QuotaArc itself.
Provider API calls go directly from the app to the provider.
