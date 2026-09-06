# OAuth / provider authentication UX audit — 0.10.1

Audit, not a rewrite (per instructions) — the existing credential system was
inspected, not replaced.

## What exists (grouped by mechanism, per the audit's own framing)

- **OAuth/browser**: `codex-accounts` (Codex CLI OAuth), Claude OAuth
  (`rust/src/providers/claude/oauth/`).
- **Token/API key**: `ApiKeySection.tsx`, provider-specific extras
  (`OpenAiExtras.tsx`, `OpenRouterManagementCreds.tsx`, `VertexAiCreds.tsx`).
- **Cookie import**: `CookieSection.tsx` / `CookieSourceSection.tsx`,
  backed by `rust/src/browser/cookies.rs` (Chromium App-Bound Encryption
  aware, per-domain).
- **CLI/session discovery**: `GeminiCliCreds.tsx`, `JetBrainsCreds.tsx`,
  `KiroCreds.tsx`.

## D1 — secret safety

Grepped `rust/src` for `tracing::{info,debug,warn,error}!` calls near
token/api_key/secret/cookie/password/bearer identifiers. Every match found
logs *metadata* (byte lengths, success/failure, "detected"/"failed to
decrypt") — none logs an actual secret value. Grepped the provider-settings
frontend for `console.*` calls: none found. No actionable secret-leakage
defect identified.

## D2 — status clarity

`ProvidersSidebar.tsx` has an explicit, localized 5-state status model
(`ProviderSidebarStatus`: `ok | stale | error | disabled | loading`, each
mapped through a `LocaleKey`), rendered as a status dot plus a free-text
`subtitlePrimary` for the specific reason (e.g. distinguishing "needs login"
from "token expired" within the `error`/`stale` states). This is a reasonable,
working design — a fixed small set of semantic states for the dot color, with
the specific human-readable reason carried in the subtitle — not the literal
`Connected/Needs login/Expired/Unavailable/Unsupported/Multiple accounts`
enum the phrasing in the request implied exists verbatim, but it satisfies the
same underlying requirement (the user is never left reading logs to know
what's wrong). No redesign performed since no confusion or broken flow was
found — this is a judgment call to document, not silently declare "matches
exactly."

## D3 — live validation

Not exercised against real provider accounts this session: doing so would
mean interacting with the owner's real, already-connected accounts (visible
in this session's own account state) beyond what the specific task required,
and no specific broken auth flow was reported to investigate. Per the
instructions' own D3 rule, this is recorded as **UNVERIFIED**, not PASS, for
live OAuth/token round-trips in this pass — a targeted follow-up should name
which specific provider flow to exercise live, rather than this session
probing all of them speculatively.

## Conclusion

No actionable authentication UX or security defect was found in this audit.
No rewrite was needed or performed. If the owner has a specific provider
whose auth flow felt unclear or broken, naming it would let this become a
targeted fix instead of a general (and here, unproductive) sweep.
