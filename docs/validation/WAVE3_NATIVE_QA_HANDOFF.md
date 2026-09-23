# Wave 3 native QA handoff

**Status: DEFERRED — ENVIRONMENT BLOCKED. Release gate: CLOSED.**

The active Wave 3 instruction explicitly forbids retrying already-blocked BACKGROUND_ONLY capture, WebView2 UIA interaction and CDP-launcher modifications. None was retried. Unit tests and a fresh Dev binary do not substitute for native pixels.

## Candidate and evidence

Use the final clean commit, then `node scripts/build-dev-verified.mjs`. Check its proof files under `target/dev-verified/` against current HEAD. Required identity: channel `dev`, AUMID `app.quotalis.desktop.dev`, data root `QuotaArc-Dev`. Never launch/install over Personal.

The case inventory is `WAVE3_NATIVE_QA_MATRIX.json`. READY means prepared, never executed or passed. The local operator prompt is `.local/handoff/WAVE3_NATIVE_QA_PROMPT.md`.

## Fixture workflow

Open the existing Dev Structure QA controller, select a real registry provider and a connection scenario, and apply. The fixture is in memory, visibly labeled in the connect dialog, and unavailable outside Dev. Visit Providers → Connections → Connect. Select only offered methods. Test invalid/missing/expired/offline/rate-limited/timeout/permission/success/stale states. Browser import uses the synthetic QA browser for that provider. Real login/credential mutations are blocked while fixture mode is active. The sign-in button runs an in-memory transport: oauthPending waits for cancellation (bounded to 120 seconds), oauthSuccess/cliReady/connected finish successfully, timeout times out, and other states fail. The synthetic QA-DEMO challenge has no browser or clipboard action. Simulated success cannot trigger a global live-provider refresh; these screens are not a real OAuth exchange.

Clear the fixture before real-account testing in a disposable Dev profile. Never use Personal cookies, keys or history. Test one explicit browser profile and one provider-owned domain. Never capture revealed keys, raw cookies, auth URLs with tokens or account emails. Use synthetic labels.

## Required native closure

- Provider search/filter on actual registry and separate synthetic stress views; 24 and 70 synthetic rows do not change production registry.
- Flow method selection, missing requirements, manual CLI documentation, trusted installed CLI, cancellation during queues and active login, retry, success and disconnect.
- Device code presentation and cancellation; no fabricated browser PKCE or callback server.
- Keyboard focus trap/restoration, Escape and RTL directional layout; light/dark, small window, scaling, scroll boundaries, modal safe areas and logo integrity.
- Repeated connect/disconnect, provider switching, refresh and cancel/retry; inspect real process/listener counts.
- Independent Wave 1/2 native gates remain open.

Installer confirmation cases are historical prepared cases: automated installation is intentionally unavailable after security review. Validate manual documentation/no process launch, and mark automated cases NOT APPLICABLE unless a later audited installer implementation exists. Do not mark all matrix cases PASS by inference.

## Guarded native retry with the new desktop adapter — 2026-09-23

The newly installed desktop-visual-qa adapter provides a new, narrowly authorized route, so the prior no-retry instruction was revisited without using a forbidden input fallback. Its canonical launch command held and verified SHA256 `13dc965f03f2d4c93abbe984db6c0f82a0e6099049b25d617d84b907b8eff64a`, launched `target/debug/QuotalisDev.exe` from embedded HEAD `4fcf3269b274`, and returned Dev identity (`channel=dev`, `app.quotalis.desktop.dev`, `QuotaArc-Dev`). The visible window was `Quotalis Dev`; no Personal process was launched.

Background UIA inspection returned only Tauri/WebView2 Pane nodes and no uniquely selectable page controls. The adapter rejected the requested window screenshot as `BACKGROUND_ONLY` because that tool can move the physical pointer, steal focus, or inject input. The adapter was stopped in `finally`, releasing its job-owned Dev process. No mouse, keyboard, clipboard, settings mutation, credential read, page interaction or screenshot occurred. This is a verified launch/identity check, **not native visual or functional QA**; the prepared case matrix remains unexecuted and the release gate remains closed. Further capture needs a permitted adapter path that can expose actual pixels without shared physical input.
