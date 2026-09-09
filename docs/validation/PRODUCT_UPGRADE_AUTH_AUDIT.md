# Provider connection audit — product upgrade

Source audit of all 70 registered IDs, 2026-09-09. This is capability coverage, **not 70 successful remote sign-ins**. No external account authentication was performed. Counts overlap: API key 40; manual cookie 32; token accounts 31; bespoke setup 14; interactive connection 5.

Authorities: `rust/src/core/provider.rs` (`ProviderId::all`, cookie support), `settings/api_keys.rs`, `core/token_accounts.rs`, frontend `CredentialsDispatcher.tsx`, shell `commands/system.rs::provider_login_transport`. Existing storage catalogs remain authoritative; the interactive-action registry is shared by the DTO and command dispatch, so URL metadata cannot grant sign-in capability.

| Provider | Key | Cookie | Token accounts | Bespoke setup | App-started connection |
| --- | --- | --- | --- | --- | --- |
| abacus | — | Yes | — | — | Not offered |
| aiand | Yes | — | Yes | — | Not offered |
| alibaba | Yes | Yes | Yes | — | Not offered |
| alibabatokenplan | — | Yes | Yes | — | Not offered |
| amp | Yes | Yes | Yes | — | Not offered |
| antigravity | — | Yes | — | — | Not offered |
| augment | — | Yes | Yes | — | Not offered |
| azureopenai | Yes | — | — | — | Not offered |
| bedrock | Yes | — | — | — | Not offered |
| chutes | Yes | — | — | — | Not offered |
| claude | — | Yes | Yes | Yes | CLI |
| clinepass | Yes | — | Yes | — | Not offered |
| codebuddy | — | Yes | Yes | — | Not offered |
| codebuff | Yes | — | — | — | Not offered |
| codex | — | Yes | — | Yes | CLI |
| commandcode | — | Yes | Yes | — | Not offered |
| copilot | Yes | — | Yes | — | Device flow |
| crof | Yes | — | — | — | Not offered |
| crossmodel | Yes | — | — | — | Not offered |
| cursor | — | Yes | Yes | — | Not offered |
| deepgram | Yes | — | — | — | Not offered |
| deepinfra | Yes | — | Yes | — | Not offered |
| deepseek | Yes | — | — | — | Not offered |
| devin | Yes | — | — | Yes | Not offered |
| doubao | Yes | — | — | — | Not offered |
| elevenlabs | Yes | — | — | — | Not offered |
| factory | Yes | Yes | Yes | — | Not offered |
| fireworks | Yes | — | — | — | Not offered |
| gemini | — | Yes | — | Yes | Not offered |
| grok | Yes | Yes | Yes | — | Not offered |
| groq | Yes | — | — | — | Not offered |
| infini | Yes | — | — | — | Not offered |
| jetbrains | — | — | — | Yes | Not offered |
| kilo | Yes | — | — | — | Not offered |
| kimi | Yes | Yes | — | — | Not offered |
| kimik2 | — | Yes | — | — | Not offered |
| kiro | — | Yes | — | Yes | CLI |
| litellm | Yes | — | — | Yes | Not offered |
| llmproxy | Yes | — | — | — | Not offered |
| longcat | — | Yes | — | — | Not offered |
| manus | — | Yes | Yes | — | Not offered |
| mimo | — | Yes | Yes | — | Not offered |
| minimax | — | Yes | Yes | — | Not offered |
| mistral | — | Yes | Yes | — | Not offered |
| nanogpt | Yes | — | — | — | Not offered |
| neuralwatt | Yes | — | Yes | — | Not offered |
| notion | — | Yes | Yes | — | Not offered |
| ollama | Yes | Yes | Yes | — | Not offered |
| openaiapi | Yes | — | — | Yes | Not offered |
| opencode | — | Yes | Yes | — | Not offered |
| opencodego | — | Yes | — | Yes | Not offered |
| openrouter | Yes | — | Yes | Yes | Not offered |
| perplexity | — | Yes | — | — | Not offered |
| poe | Yes | — | — | — | Not offered |
| qoder | — | Yes | Yes | — | Not offered |
| qwen-cloud | — | Yes | — | — | Not offered |
| sakana | — | Yes | Yes | — | Not offered |
| stepfun | Yes | — | — | — | Not offered |
| sub2api | Yes | — | Yes | Yes | Not offered |
| t3chat | — | Yes | Yes | — | Not offered |
| venice | Yes | — | — | — | Not offered |
| vertexai | — | — | — | Yes | CLI |
| warp | Yes | — | — | — | Not offered |
| wayfinder | — | — | — | — | Not offered |
| windsurf | — | — | — | — | Not offered |
| xai | Yes | — | Yes | Yes | Not offered |
| zai | Yes | — | Yes | — | Not offered |
| zed | Yes | — | — | Yes | Not offered |
| zenmux | Yes | — | Yes | — | Not offered |
| zoommate | — | Yes | Yes | — | Not offered |

## Verified contracts and boundaries

- Installed Codex CLI help confirms `codex login`; installed Claude help confirms `claude auth login`. Help-only commands did not authenticate. Evidence: `.local/upgrade-codex-login-help.txt`, `.local/upgrade-claude-auth-help.txt`.
- Vertex adapter requires Application Default Credentials and already recommends `gcloud auth application-default login` in its token refresher. The app now offers that matching entry point.
- Gemini reads `.gemini/oauth_creds.json`; a gcloud login cannot satisfy it. No speculative Gemini command is offered. Existing Gemini setup/detection remains available.
- Kiro retains its existing CLI resolver/login contract; Copilot retains its device flow. End-to-end remote completion is unverified in this task.
- Generic provider dashboards remain separate external navigation. The duplicate Buy Credits action was removed because its URL was only a dashboard alias. No dedicated purchase flow is claimed.
- Windsurf relies on externally detected configuration; Wayfinder has gateway configuration. Neither is represented as an app-managed OAuth flow.
- Profile memberships affect monitoring; profile credential references have no fetch resolver. New unresolved explicit references are rejected, existing data preserved. Real multi-token selection remains in Providers.
- Unknown token UUID removal/selection now errors before saving instead of silently succeeding.
- Source/plan/account data are observed fields; lack of errors alone is not treated as proof of configured authentication. Quota values require backend Ready state.
- Full unification of storage-specific credential catalogs into one core metadata type is deferred: replacing secure-storage authorities is not necessary to correct interactive action dispatch and would require a separate migration.

## Supervision and independent review closure

- Codex and Claude commands were corrected to installed CLI help contracts.
- Windows CLI launch is suspended, assigned to an owned kill-on-close Job Object,
  then resumed. Nonblocking pipe polling has bounded lines/output and a wall
  deadline. Only zero exit status means success; printed success text cannot win.
- No reader threads or blocking pipe joins remain. Synthetic subprocess tests
  cover quiet children, 2 MiB newline-free stderr, marker-then-failure, inherited
  pipes, descendants at timeout/exit, and actual Windows `.cmd` wrappers.
- The 18 `login`-filtered tests include seven supervisor behavior tests and their
  fixture entry; the other ten are pre-existing provider/settings tests. Full
  default-parallel core testing exposed overly short fixture startup budgets;
  repaired tests retain PID existence/death assertions and a strict cleanup bound.
- Login stdin is closed because this UI has no terminal input. CLI variants that
  require terminal prompts fail visibly; no successful remote login is claimed.
- Unix nonblocking pipes/process groups are implemented but not runtime-tested on
  this Windows host. Windows child helpers are contained; existing browser
  processes are outside the owned job.
- Fresh read-only Astra review found two retained Copilot defects: missing public
  verification code and unbounded network wait. Both repaired and re-reviewed:
  per-request correlated public challenges reach both UI entry points, listeners
  register before invocation and clean up in `finally`; private polling codes and
  tokens never enter the event. Network request/connect deadlines plus enclosing
  device-expiry timeout bound sleep and in-flight requests.
- Re-review: no remaining P1/P2 findings in reviewed auth/account scope. This is
  source/fixture validation, not proof of external account consent completion.
- Removing a token account before the active row now preserves active identity.
  Unknown removal/selection errors before save; empty selection clamps to zero.
