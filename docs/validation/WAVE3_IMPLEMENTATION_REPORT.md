# Wave 3 implementation and validation report

This report distinguishes completed code/automated checks from native and live-account evidence. The last-commit Dev build and exact hashes are recorded locally after this document is committed. Historical Claude work was preserved and repaired; starting HEAD was `d066226d9edb` with an already-dirty Wave 3 tree.

| # | Required item | Evidence / result |
|---|---|---|
| 1 | actual provider count | 70 entries, derived from ProviderId::all(). |
| 2 | capability coverage | Every registry entry has a connection row and explicit methods/status. Reporting declarations remain separate from populated response evidence. |
| 3 | providers missing metadata | No missing method rows. Static quota-window metadata is unavailable; JSON marks it null rather than inventing windows. Reporting flags inherited from older registries require response-level confirmation. |
| 4 | automated registry gate | Registry exhaustiveness, duplicate/recommendation/CLI tests, JSON equality gate and per-provider frontend rendering. |
| 5 | unified flow | One ProviderConnectFlow integrated into ProviderDetailPane. |
| 6 | method selection | Only derived offers appear; one-method flows skip selection. |
| 7 | requirements | Method-specific CLI/browser/key/local requirements. CLI filesystem provenance fails closed. |
| 8 | connection state model | 14 states and typed issues, reusing ProviderStateKind. |
| 9 | success state | Method, provider-reported plan, actual windows, resets and verification time; only after verified success. |
| 10 | failure states | Credentials, expiry, permissions, throttling, network, timeout and unsupported are distinct; unknown is never connected. |
| 11 | reconnect | Repeat the unified flow; only successful verification changes enablement/source. |
| 12 | disconnect | Explicit confirmation; disable monitoring and delete selected Quotalis-owned credentials. External sessions/history remain intact. |
| 13 | dependency count | 8 dependency definitions. |
| 14 | detection | Lazy bounded probes from protected known locations; arbitrary PATH and user npm roots rejected. Unsupported layouts remain manual. |
| 15 | version handling | Nonzero exit is Broken; unknown version stays explicit; no invented minimum version. |
| 16 | official install policy | Curated official package metadata documented. Automated install execution disabled after security review. |
| 17 | confirmation | Confirmation UI implemented/tested with fixture plan; production install action unavailable when provenance is unproven. |
| 18 | update | Manual official instructions; no blind automatic update. |
| 19 | timeout | 15-second probes, existing login/fetch timeouts; installer has no executable production path. |
| 20 | cancellation | Pre-cancel, owned Windows process tree, task cancellation and serialized final publication. |
| 21 | command safety | Argument arrays, protected roots, no arbitrary shell interpolation, scrubbed environment. |
| 22 | output sanitization | Bounded/sanitized stdout/stderr; no raw provider output in UI. |
| 23 | supported providers | 28 browser-session offers after transport audit; see generated matrix. |
| 24 | browsers/profiles | Chrome/Edge/Brave/Arc/Firefox/Chromium metadata; explicit single profile selected by opaque ID. |
| 25 | domain minimization | Provider domain (regional domain where applicable) before extraction; no merged browser accounts. |
| 26 | import | Existing CookieExtractor into protected ManualCookies; fixture import short-circuits without browser/store access. |
| 27 | expiry | Expired/missing/reauth states derived from adapter evidence. Real-browser decryption not exercised. |
| 28 | protected storage | Existing secure_file DPAPI layer; temporary-fixture roundtrip/plaintext-absence tests. |
| 29 | logging/privacy | No cookie values/profile paths/account email returned by discovery; generic import errors. |
| 30 | disconnect | Remove Quotalis imported copy; browser originals remain untouched. |
| 31 | supported providers | 41 key/token offers; 13 legacy settings-key definitions plus token-account-derived support. |
| 32 | masked entry | Password field, explicit reveal, cleared after save failure/success and method change. |
| 33 | validation | Nonempty, bounded single-line input; real connection test checks provider response. |
| 34 | storage | ApiKeys or selected TokenAccountStore; never Settings. |
| 35 | invalid | Rejected credentials state and retry; no raw backend error text. |
| 36 | permission | Permission denied distinct from invalid credentials. |
| 37 | rate-limit/network distinction | RateLimited and Offline/TimedOut are separate; no aggressive auto retry. |
| 38 | disconnect | Delete selected stored account/key, preserve unrelated accounts and history. |
| 39 | supported providers | GitHub device flow; four existing CLI-supervised login transports. No invented browser OAuth. |
| 40 | state | Device request/cancellation state uses existing login registry. No browser OAuth state parameter is claimed. |
| 41 | PKCE | NOT APPLICABLE: no Quotalis-owned authorization-code flow. |
| 42 | callback | NOT APPLICABLE: no callback listener/server added. |
| 43 | timeout | Existing bounded device polling / CLI supervisor timeout. |
| 44 | cancel | Existing request-scoped login cancellation plus flow cleanup and stale-completion suppression. |
| 45 | token storage | Existing protected token account store. |
| 46 | refresh | Provider-owned refresh behavior retained; no new generic refresh-token implementation. |
| 47 | disconnect/revoke | Local disconnect only; no unsupported provider-side revoke promise. |
| 48 | detection | 4 local application-session offers and 1 local gateway; local sessions can still require provider network access. |
| 49 | permissions | Failures are surfaced as source/access/auth states. Real local permission matrices not live-tested. |
| 50 | freshness | Cache-derived last verified and stale marker; no fabricated timestamps outside labeled fixtures. |
| 51 | scope truth | Local session/scanner evidence is not represented as universal account-wide activity. |
| 52 | single-flight | Shared RAII reservation before work, provider-scoped, including background Codex account lanes. |
| 53 | cancellation | Shared cancellation while queued/running; final save/publication linearized against cancellation. |
| 54 | timeouts | Typed timed-out outcome, distinct from invalid credentials. |
| 55 | retries | Explicit user retry. Nontransient failures are not auto-looped. |
| 56 | rate limiting | Typed throttling state; respects existing adapter/backoff logic. |
| 57 | stale state | Late provider responses ignored; closed dialog cannot call onConnected. |
| 58 | concurrency | Three shared I/O slots for probes/verification/account lanes; registry-wide synthetic concurrency test. |
| 59 | startup cost | Dependency probes start for selected method/provider, never an eager 70-process startup. |
| 60 | stress result | Automated: 50 connected/disconnect UI cycles, 100 provider switches with listener cleanup, 50 canceled verification late completions, 100 coalesced Verify clicks, 100 reservation cancel/retry cycles, Windows child-tree timeout/cancel. Full native 100-refresh process-growth proof remains deferred. |
| 61 | DPAPI/protection | Windows temporary secret files DPAPI roundtrip and plaintext absence tested. |
| 62 | settings secret check | Settings stores source/enablement metadata; no secret field introduced. Serialization regression is fixture-based, not a live-account audit. |
| 63 | history secret check | Notification journal rejects secret-bearing free text; real usage history not modified for testing. |
| 64 | log sanitization | Shared UserFacingText redaction and generic UI errors. |
| 65 | command injection safety | Provenance/argument/env/process tests; manual installer fallback. |
| 66 | provider URL safety | Curated HTTPS only; URL userinfo rejected. Device verification button accepts the existing GitHub device URL. |
| 67 | fixture isolation | Dev-only in-memory fixture setter; mutation guards, simulated key/cookie/verify/disconnect; Codex account lanes covered. |
| 68 | Providers page | Unified Connect and derived connection status/disconnect integrated; original page design preserved. |
| 69 | search/filter | Existing filtering retained; all registry rows render. Native synthetic search latency not measured. |
| 70 | Arabic | English/Arabic locale entries; locale parity and Arabic-script checks. |
| 71 | RTL | Logical CSS and bdi/dir for external values; real RTL pixels deferred. |
| 72 | Light/Dark | Shared theme tokens; real light/dark screenshot proof deferred. |
| 73 | accessibility | Dialog naming, focus trap, Escape, focus cleanup, keyboard method navigation and live regions tested in jsdom; native accessibility deferred. |
| 74 | loading states | Shared refresh/loading visuals and busy state prevent duplicate submissions. |
| 75 | capability matrix path | PROVIDER_CONNECTION_CAPABILITY_MATRIX.md and .json in docs/validation. |
| 76 | actual provider rows | 70 |
| 77 | fixture verified count | 70 method-rendering rows; every provider through synthetic state classification. This is not full real-auth verification. |
| 78 | live verified count | 0 |
| 79 | credential-required count | All real credential-dependent flows require authorized disposable test accounts; 65 active non-local-only rows. Two deprecated and three local-only rows are separately classified. |
| 80 | unsupported count | 0 empty-method unsupported rows; 2 deprecated; CLI install layouts and dynamic metadata limitations remain explicit. |
| 81 | Wave3 handoff | docs/validation/WAVE3_NATIVE_QA_HANDOFF.md |
| 82 | matrix | docs/validation/WAVE3_NATIVE_QA_MATRIX.json (prepared cases; none passed natively). |
| 83 | local prompt | .local/handoff/WAVE3_NATIVE_QA_PROMPT.md |
| 84 | native status | DEFERRED — ENVIRONMENT BLOCKED; prohibited retry paths not attempted. |
| 85 | frontend | PASS: 1557 tests / 227 files; .local/wave3-frontend-all.log. |
| 86 | Desktop | PASS: 555 desktop tests; 1 existing ignored real-history test. |
| 87 | Core | PASS: 1858 tests. |
| 88 | CLI | PASS: 1 test. |
| 89 | ignored/doctests | One existing ignored desktop test reads real history.db; deliberately not run. Core doctests: zero. |
| 90 | tsc/build | tsc and Vite production build passed; .local/wave3-build.log. |
| 91 | locale | 1960 Rust/TS locale keys; core EN/AR completeness tests. |
| 92 | clippy/fmt | Final cargo clippy --workspace --all-targets -- -D warnings and cargo fmt --all -- --check, logs under .local. |
| 93 | secrets | node scripts/scan-secrets.mjs (no findings); rerun before final commit. |
| 94 | skip/focus | No new skip/focus markers; existing real-history ignore retained. |
| 95 | diff | git diff --check before commit; no whitespace defects. |
| 96 | final HEAD | Post-last-commit canonical build records actual HEAD in .local/wave3-final-build.log; no self-referential hash in this tracked document. |
| 97 | embedded HEAD | Must match final git HEAD; canonical build verifies. |
| 98 | hashes | Canonical build verifies source executable equals Dev proof copy SHA256; exact value in local final report. |
| 99 | channel | Required dev; canonical preflight verifies. |
| 100 | AUMID | Required app.quotalis.desktop.dev. |
| 101 | app_dir | Required QuotaArc-Dev. |
| 102 | Personal unchanged | UNCHANGED: no Personal launch, install or data writes. |
| 103 | Release gate | CLOSED: no publishing, no Personal promotion, Waves 1–3 native evidence still required. |

## Verdicts

| Area | Verdict |
|---|---|
| Provider capability model | PARTIAL — all methods modeled; static quota-window facts intentionally unknown |
| Provider onboarding | PARTIAL — implemented/tested flow, no live-account roundtrip |
| CLI dependency UX | PARTIAL — protected layouts only; manual install/update |
| CLI security | PASS for reviewed execution paths and automated fixtures; no signer attestation claim |
| Cookie/browser session UX | PARTIAL — profile selection implemented; real decryption/native proof pending |
| Cookie security | PASS for scoped import/storage/fixture isolation code checks |
| API key UX | PARTIAL — masked protected flow tested; live permissions pending |
| API key security | PASS for tested storage/redaction paths |
| OAuth | PARTIAL — existing device/CLI transport only; browser PKCE not applicable |
| Local source onboarding | PARTIAL — truthful local-session classification; live permissions pending |
| Connection reliability | PARTIAL — deterministic stress covered; native process/listener sweep pending |
| Provider privacy | PASS for fixture-based code checks; no real credentials accessed |
| Localization | PASS automated; visual RTL remains deferred |
| Accessibility | PARTIAL — DOM tests pass; native proof deferred |
| Dev fixtures | PARTIAL — in-memory sign-in transport and consumer isolation tested; native/live evidence remains pending |
| Wave 3 code | PARTIAL — remaining acceptance limits are explicit above |
| Wave 3 native | DEFERRED — ENVIRONMENT BLOCKED |
| Dev safety | Channel isolation required and checked by canonical final build |
| Dev candidate freshness | Post-commit canonical build required; see local final report |
| Personal | UNCHANGED |
| Release gate | CLOSED |

## Review closure

A fresh read-only critical review found six issues in CLI provenance, Codex fixture lanes, account attribution, queued cancellation, Cursor source mapping and settings transactions. Each was repaired. Recovery rereads caught and closed cancellation-vs-commit lock lifetime details. Final source review closed all six within that scope; no native or release approval was inferred.


## Goal continuation: simulated sign-in closure

The sign-in command now captures fixture provenance while reserving the provider, selecting an in-memory Dev transport before any real auth call. Pending remains cancellable and bounded; success/failure/timeout are deterministic. An empty verification URL and explicit simulation marker prevent actionable fake challenges. Terminal completion is serialized with operation cancellation, including the cancel-after-work/before-delivery boundary.

A reachable pre-existing verification callback refreshed all live providers after fixture success. The verification response now carries provenance and the real ProviderDetailPane consumer suppresses that refresh. Login completions also carry provenance. Its older switch-account handler currently has no caller; no reachable regression is claimed for that dead handler. The generic device challenge notice no longer renders raw clipboard/browser errors or opens arbitrary endpoints. Real missing-cookie results use a dedicated live constructor rather than fixture output.

Focused evidence: Rust transport outcome, two cancellation sources, 50 cancel/retry cycles, both terminal orderings, routing and real-cookie provenance tests; frontend flow cancellation/retry, challenge safety, raw-error suppression, bridge provenance and actual ProviderDetailPane callback isolation. Updated full-suite evidence is recorded below when complete. Native evidence remains DEFERRED — ENVIRONMENT BLOCKED. This packet is not whole-product or release acceptance.


Fresh continuation gates: frontend **1564 tests / 228 files**; desktop **561 passed / one existing ignored**; core **1858 passed**; CLI **one passed**; doctests **zero**. Full Rust suite includes locale completeness checks. TypeScript, production build, Clippy with warnings denied, formatting and diff checks passed. Secret scan: **4253 files clean**; no new skip/focus markers. Raw logs: `.local/wave3-fixture-full-front.log`, `wave3-fixture-full-rust.log`, `wave3-fixture-login-tsc.log`, `wave3-fixture-build.log`, `wave3-fixture-login-clippy.log`. These supersede the prior table counts for this increment. The post-commit Dev proof is recorded in `.local/wave3-fixture-dev-build.log` after this document is committed.

Review outcome: independent source review verified transport isolation, then found the terminal cancellation ordering gap and missing completion provenance. Repairs and deterministic tests landed; a recovery read confirmed them and identified a real missing-cookie response mislabeled as simulated. The final dedicated live constructor and regression test close that defect. No native or release verdict follows from this review.

## Reporting evidence continuation — 2026-09-22

Capability matrix schema 2 replaces optimistic reporting booleans with explicit response-evidence policies. Supported connection methods still derive from the existing registries. Policy is not per-provider live support: static quota/plan/monetary population remains unproven until observed. The success summary uses verified non-informational quota rows (including model-specific and extra rows), valid reset timestamps from all such rows, and the shared Spend/Balance/Credits classifier. Unknown monetary observations remain unlabeled. The count describes presentation rows, not unique physical quotas.

The independent review found two preexisting evidence losses: OpenRouter spend-only rows masqueraded as zero quota; Antigravity's unknown usage marker was dropped before verification. OpenRouter now constructs informational spend rows, Antigravity null/empty quota is informational, and bridge conversion honors the source's unknown-usage marker via the shared informational-row contract. Rows/descriptions remain available; explicitly reported zero remains a quota. Tests cover actual OpenRouter/Antigravity adapter helpers and the production snapshot/bridge/verification chain. `.local/wave3-reporting-regression-before.log` captures the failing pre-repair OpenRouter regression. Review accepted the propagation and identified the adjacent empty-response fallback, which was repaired and tested before final validation.

Full-suite validation exposed a synthetic CLI cancellation test whose 3-second watcher covered two process startups. Its startup budget now covers both, while cancellation itself must complete within the existing 2-second cleanup allowance. Both recorded process IDs must be gone. No production timeout, cancellation or trust boundary was changed.

Final automated results for this source increment: frontend **1568 / 228 files**, desktop **564 passed / one existing ignored**, core **1860 passed**, CLI **one**, doctests **zero**. TypeScript and production build passed; Vite retains its existing large-chunk advisory. Rust suite includes locale parity and matrix synchronization. Secret scan **4255 files clean**, no new skip/focus markers, formatting and diff checks passed. Clippy completion is recorded in `.local/wave3-reporting-clippy.log`; the canonical post-commit Dev build is recorded separately after source commits.

Logs: `.local/wave3-reporting-full-front.log`, `wave3-reporting-full-rust.log`, `wave3-reporting-tsc.log`, `wave3-reporting-build.log`, `wave3-reporting-clippy.log`. The cross-wave tracker is `CROSS_WAVE_REGRESSION_MATRIX.md`; all 22 required interactions remain open at their full scope. Wave 3 capability completeness, live auth and native acceptance remain PARTIAL/deferred. Release gate remains CLOSED and Personal unchanged.
# Credential cancellation repair — 2026-09-22

## Selected credential provenance repair

Copilot previously labeled every successful response `oauth`, causing explicit
API-key and CLI verification to be rejected as device flow. Grok's supplied
bearer had the same problem via the generic OAuth-to-CLI mapping. Copilot now
resolves a typed credential source before transport and exports an unambiguous
source label. Explicit CLI ignores supplied/legacy keys and cannot fall back to
Credential Manager. Explicit owned-token mode fails before ambient lookup when
missing. Grok distinguishes a supplied bearer from credentials loaded from its
CLI auth file. Persisted CLI/Web selections exclude legacy API keys in the shared
desktop fetch context as well as in verification.

Protected token accounts gain optional `origin` (`apiKey` / `deviceFlow`); old
accounts remain unknown and are never upgraded from their label/token shape.
Manual desktop/CLI creation shares one constructor; successful real GitHub device
flow tags its own token. Verification requires a configured token with the chosen
origin before fetching. Existing unknown accounts remain usable in normal reads;
explicit method verification requires reacquisition rather than a guessed claim.
Older readers ignore the additive field; older writers may drop it, which returns
origin to unknown on current reopen without deleting the credential. This is not
a claim of full cross-version credential-store rollback testing.

Independent review found two omissions in CLI acquisition/consumption. Both were
fixed and the bounded second review found no further actionable defect. New tests
cover no-ambient-lookup branches, known/legacy origins, active/name/index account
selection, absent selected-account refusal, stored-key fallback, and key-versus-
cookie acquisition. Complete source tests: frontend1568/228 files; desktop569
passed/1existingignored; core1868; CLI1; doctests0. Logs:
`.local/wave3-method-full-front.log`, `wave3-method-full-rust.log`,
`wave3-method-tsc.log`, `wave3-method-build.log`, `wave3-method-clippy.log`.
The full Rust run includes locale and capability matrix parity. TypeScript and
production build passed; existing large frontend chunk advisories remain.

The provenance checkpoint identified the adapter's old raw `gh auth token`
subprocess as a separate security follow-up. It is addressed in the bounded
credential-reader checkpoint below. Native/live-account testing, final
provider-wide stress and complete reporting-capability audit remain open.
Release stays closed.

Browser-offer follow-up: adapter inspection found Codex explicitly rejects Web,
Gemini reads CLI credentials, Kiro routes its historical Web value to CLI, and
Antigravity reads local application state. Their retained cookie-domain metadata
had incorrectly exposed browser onboarding. Offers now require the adapter's web
support or declared Web source in addition to a domain. LongCat's real Web source
remains offered even though it uses the default `supports_web` implementation.
Direct browser import rejects unsupported providers before discovery/extraction.
The generated 70-provider matrix and readable rows are updated. Eight capability
tests and 93 production-flow component tests passed; the initial failing transport
assertion is retained in `.local/wave3-browser-transport-red.log`. These checks do
not prove other declared web adapters work with a live account.

Independent source review of `04776618` found that `save_provider_connection_key`
reserved an operation without testing cancellation, and browser import checked
cancellation before an unprotected storage write. Both now place the entire
protected-store read/modify/write inside the existing `Operation::commit_if_active`
boundary. Cancellation accepted first prevents access; a write that commits first
finishes its reservation so a later cancel cannot claim it stopped that write.
No new credential store or destructive cleanup was introduced.

Focused evidence: six operation-registry tests, then all 18 `commands::connection`
tests passed. Three new cases cover cancellation before storage access, commit
before cancellation and failed-save retry ownership. Independent read-only review
found no new lock inversion or actionable defect in the three-file repair.
These are concurrency-contract tests plus source wiring review, not command-level
DPAPI fault injection or live browser authentication. No owner credentials used.
Copilot/Grok selected-source classification and invalid browser offerings were
separate findings at the cancellation checkpoint and were subsequently repaired
as described above. These packets do not establish Wave 3 PASS.

## Bounded CLI credential reader — 2026-09-22

Both Copilot usage entry points now resolve GitHub CLI through the existing
curated installation resolver. The process runs off the async executor, with a
15-second deadline, scrubbed environment, bounded capture and owned process tree.
Dropping the fetch future signals cancellation; the supervisor performs cleanup.
Explicit owned credentials still avoid all CLI/legacy reads, and explicit CLI
still cannot fall back to an unrelated stored key. Unsupported CLI layouts fail
closed and retain the existing manual setup instructions.

Credential stdout is private in-memory capture, with no Debug/Serialize interface.
It does not pass through diagnostic sanitization or IPC. Nonzero exit, oversized
stdout, invalid UTF-8 and unexpected pipe read errors reject the result; stderr
is discarded. Ordinary diagnostic probes continue to return capped, sanitized
text. No new dependency, credential store, UI or live-account action was added.

New Windows process fixtures exposed a preexisting test-helper defect: the slash
in `System32/cmd.exe` was interpreted by cmd as a switch. Correct path components
and positive startup/output assertions now prevent false success. The exact-PATH
test also distinguishes cmd's own PATHEXT. Timeout requires actual startup and
elapsed deadline; cancellation requires startup and absence of a delayed marker.
Two empty test-created directories (`rust/Bearer`, `rust/fixture.secret`) remain
locally because command-policy review rejected their optional cleanup. They are
not tracked or included in the product build.

Evidence: 19 supervisor tests and 22 Copilot tests; full workspace desktop569
passed/1existingignored, core1874, CLI1, doctests0. Logs:
`.local/wave3-gh-supervisor.log`, `.local/wave3-gh-copilot.log`,
`.local/wave3-gh-full-rust.log`. Independent read-only review first required
startup-aware timeout proof and rejection of unexpected read errors; both were
repaired and re-reviewed without new actionable findings. Reviewed blob hashes:
`cli_dependencies.rs` = `06594caa8dbb03851120d42697e4471842e60808`;
`copilot/api.rs` = `f42cb5dc1deda3817b7e24a2759640b65bc3e9f3`.
The final Clippy-only edit names the ignored cancellation-send result instead of
using `let _`; final supervisor blob is `40ebc142d234df8a1c59d42266227c227e2495e2`.
Formatting/diff checks and secret scan (4258 files) pass; no new skip/focus markers.
Full workspace Clippy passes (`.local/wave3-gh-clippy.log`). Exact post-commit Dev
build identity is recorded under `.local/wave3-gh-*` after the documentation commit.
Frontend remains the previously tested 1568/228 candidate; no frontend source
changed in this packet. The canonical Dev build rebuilds its production assets.
This is automated process evidence, not native UI or live GitHub authentication.

## Local-session source isolation — 2026-09-22

Source inspection found Cursor's local onboarding was routed to browser-cookie
discovery and successful local-app requests were always labeled `web`. Its local
selection now reads only the local app session, fails with authentication required
when absent/rejected, and reports `cursor-app` on success. Auto can retain its
existing browser fallback; explicit browser/manual selections do not read the
local profile. Persisting LocalScanner as the existing `cli`/cookie-off setting
also keeps ordinary refreshes from attaching an unrelated Quotalis token-account
credential/UUID. This is supported by all four local-scanner adapters; no new
source enum or broad settings migration was introduced.

The old Cursor test depended on the machine having no real cookies. It is replaced
by injected transport tests that never open owner profiles. Initial failures are
in `.local/wave3-cursor-source-red.log` and `wave3-cursor-persistence-red.log`.
Independent review found that the existing local-session helper swallowed network,
server and parse errors. It now returns a typed result: only absence becomes
`Ok(None)`; explicit local selection preserves failures and cannot read cookies.
Auto retains its previous fallback behavior. Eight injected Cursor tests pass,
including network/server/parse/auth failures with no real profile or network I/O.
Re-review found no remaining actionable defect in these two Rust files.

Final Rust: desktop570/1existingignored, core1878, CLI1, doctests0;
`.local/wave3-cursor-final-rust.log`. Full Clippy passes in
`.local/wave3-cursor-final-clippy.log`. The full frontend suite passes 1639 tests
across 229 files (`.local/wave3-registry-full-front.log`). The 71 new registry
scenarios exercise recommended-method failure, timeout and successful retry for
68 active providers plus render/close for two deprecated providers. These use
mocked IPC, do not perform real authentication, and do not establish adapter or
disconnect support. Existing device-flow tests cover actual flow state separately.

Compatibility: the source-setting correction applies to new/reverified connections;
existing `auto/off` selections are not migrated. Rollback must retain Cursor's
no-browser Cli guard or disable its polling before reverting. The last canonical
Dev build at `0cb25e4b4d89` passed with source/proof SHA256
`84fa886be3db33ac1066572c2ef3d80ede56e2d9788ca47e67685a99c441c9f8`;
it predates this repair. A fresh post-commit build is required. No native UI or
live-account evidence is claimed; broader Wave 3 and release gates remain open.

Concrete next adapter audit findings (not yet repaired at this checkpoint):
Amp offers API-key onboarding while rejecting OAuth and labeling its key-backed
request `web`; its CLI probe can fabricate 0% from configuration presence and its
parser supplies unobserved 500/Pro defaults. Alibaba and Mistral offer keys despite
their current adapters implementing only browser-session usage. These findings
must be repaired before capability/onboarding Code PASS; component IPC fixtures
cannot establish adapter-level support. Do not remove a real feature merely to
make tests pass, or invent a missing remote endpoint. Preserve existing credentials
while making the offered methods and observed reporting truthful.

## Cookie-backed onboarding and Alibaba unknown-data repair — 2026-09-22

The canonical key registry no longer advertises Alibaba key verification; its usage adapter accepts browser sessions. Mistral's account capability now describes its existing cookie-backed multi-account support instead of API-key support. Its stored accounts, concurrent monitoring, switching and cost flags are preserved. Both retained CookieHeader stores are unchanged. No credential migration, deletion, or provider-ID override in the derived connection model is used. The generated registry still contains all 70 providers; offers change from 41 to 39 API-key methods, with 28 browser methods retained.

Alibaba quota parsing now requires both valid nonnegative usage and a positive finite denominator. Missing/invalid pairs carry the shared informational/unknown flag instead of a fabricated 0%. Known zero stays known; independent weekly/reset evidence survives incomplete primary data. Missing plan names remain absent and an unreported billing duration no longer becomes 30 days. Quota counts retain precision without an unproven token unit. Two obsolete integer token-format utility tests retire with that helper; new regressions cover missing/invalid/overflow pairs, malformed objects and precision. Initial failing evidence: `.local/wave3-alibaba-truth-red.log`. Review and final gate outcomes are recorded below after integration.

Current native/build boundary: clean `39c60a44c881` passed canonical Dev build and preflight in `.local/wave3-cursor-dev-build.log`; SHA256 `94a3983d8f00cd7150efc8d3f9b711e99a609005b53e79ad1715f73bc4e5f509`. It is historical once the present packet changes source. No native UI, live account, installer or release acceptance is implied.

Remaining concrete adapter work:
- Amp still sends credentials to a Cody endpoint, fabricates configured-state usage, and declares inaccurate sources. A primary upstream implementation provides a concrete repair starting point: [AmpUsageFetcher at 9178377d](https://github.com/steipete/CodexBar/blob/9178377d7b3d15dc9a0fbcf5c75dd0b8b38a2d96/Sources/CodexBarCore/Providers/Amp/AmpUsageFetcher.swift) uses Amp's own balance RPC with a bearer token and parses `result.displayText`; its browser path reads Amp settings with an Amp session. This is source evidence, not a live service test or a documented public API guarantee. Correct domain/key metadata, strict credential selection, bounded responses, redirect refusal and fail-closed unsupported formats are required before wiring it. Preserve legal attribution. Do not reuse Cody data or silently move old credentials to another service.
- [Amp's public API](https://ampcode.com/api/external) is workspace-scoped and uses separate client credentials; do not substitute that contract for a personal Amp usage source. [Official SDK documentation](https://ampcode.com/docs/sdk) names `AMP_API_KEY`; the current `SRC_ACCESS_TOKEN` hint is not sufficient proof of an Amp credential.
- Mistral reporting still defaults missing currency/prices/usage to EUR/zero and creates a known-zero quota placeholder. This requires a separate data-truth repair, preserving observed token/billing evidence and distinguishing provider billing from an estimate.
- Doubao's default token probe calls chat completions; review its available read-only Coding Plan source and explicit credentials before treating onboarding verification as a free read-only operation. No such request was executed here.

Independent review reproduced two additional shared-consumer defects: unknown weekly quota with a future reset generated a pace/reserve, and Average included an unknown secondary's zero placeholder. Shared `UsagePace::weekly` now rejects informational/non-finite inputs; Average uses only observed operands and preserves a sole known window's reset/duration. Known zero remains valid. Real bridge and serialized presentation tests cover these cases. Pre-repair failures are retained in `.local/wave3-unknown-pace-red.log`, `wave3-unknown-average-red.log`, and `wave3-unknown-bridge-red.log`.

After repair, full workspace tests pass: desktop573/1existingignored, core1883, CLI1, doctests0 (`.local/wave3-cookie-truth-final-rust.log`). Full Clippy passes (`.local/wave3-cookie-truth-final-clippy.log`), as do formatting/diff checks and the 4259-file secret scan. No added skipped/focused tests. The unchanged frontend passed all1639 tests across229 files after the capability-matrix update (`.local/wave3-cookie-truth-front.log`). These are offline automated checks, not live authentication or native visual evidence. Independent re-review confirmed both required findings closed on the four frozen source blobs, with no new actionable defect. No storage/schema change or added rollback requirement; historical incorrect observations are not rewritten.

Wave 3 Code remains PARTIAL; whole-product, native, security/OSS, RC and release gates remain open.

## Mistral billing evidence repair — 2026-09-23

The live adapter now calls a separate pure billing interpreter. It no longer turns absent rates/quantities/currency into zero EUR, represents billing as a physical zero-percent quota, or presents a completion-model count as the account plan. Observed billed token lanes and model count remain informational. Unknown lanes are omitted; integer overflow does not wrap into plausible counts. An independently reported period end remains a billing detail (and cost-period boundary when cost is available), without the former inferred extra second or a physical quota reset.

The existing Spend/Cumulative classification is preserved: amounts reconstruct provider-returned billed units times provider-returned rates, never local catalog prices. Source: [pinned upstream Mistral billing implementation](https://github.com/steipete/CodexBar/blob/9178377d7b3d15dc9a0fbcf5c75dd0b8b38a2d96/Sources/CodexBarCore/Providers/Mistral/MistralUsageFetcher.swift). No public schema established omitted billing categories/lanes as zero. A monthly total therefore requires explicit coverage, a valid reported currency, and unambiguous finite nonnegative rates for all billed rows. Explicit empty coverage/zero quantities/zero prices retain known-zero Spend. Missing or unfamiliar response sections fail monetary totals closed while keeping independent known token details. The complete fixture is synthetic; compatibility frequency with live private billing responses is not verified.

Independent review found a nested-wrapper completeness gap; all three wrapper kinds now retain unknown children and reject partial monetary sums. The added counterexample failed before repair, and read-only re-review closed the finding without another Required defect. Initial failures: `.local/wave3-mistral-reporting-red.log`; wrapper failure: `.local/wave3-mistral-wrapper-red.log`. Final full workspace: desktop574/1existingignored, core1893, CLI1, doctests0 (`.local/wave3-mistral-reporting-final-rust.log`); full Clippy passes (`.local/wave3-mistral-reporting-final-clippy.log`). Earlier 12 focused tests preceded the added wrapper case; there are now13 Mistral tests. History regression proves informational billing creates no physical quota rows; only present Spend amounts, including known zero, produce monetary rows. It uses bridge-shaped inputs, not a live HTTP response. Frontend source is unchanged from1639/229 tests; final static/build evidence follows below.

Final formatting/diff checks and the 4261-file secret scan pass (`.local/wave3-mistral-reporting-final-secrets.log`). The last canonical Dev binary predates this repair; a new build is required before claiming current binary provenance.

No owner data, credentials, schema, history migration or native app were touched. Rollback restores the old adapter and removes its extracted billing modules together; this does not correct historical false samples. Wave3/product/security/native/release gates remain open.

### Next: credential-lane history isolation

Read-only tracing confirmed a separate problem: refresh selects a token-account UUID independently of the credential actually injected; history discards it and groups identity-free Mistral observations under provider:mistral/unresolved. A UUID is not remote account identity. Bind a non-secret local lane to the resolved fetch only when Mistral's managed cookie was actually selected; do not compare/hash secrets, re-read current selection after I/O, or mark that lane observed. Persist distinct lane keys with unresolved scope using existing columns; keep provider-reported identity precedence and leave old rows unchanged.

The fix must also carry account scope through spend buckets/bridge and refuse a combined Spend KPI when the same provider has multiple series whose independence is unproven. Separate keys alone would still sum aliases and old/new lanes. Existing quota comparison already rejects non-observed identity. Source descriptors must not promise resolved Account scope for all provider observations. Required tests: exact injection vs cookie-off/manual/browser fallback, stable non-secret lanes, stale/generation boundaries, distinct unresolved history, one-lane latest value, multiple unresolved series unavailable, observed independent accounts still additive, and no alteration of monetary quantity/measurement/currency gates. This remains pending, not accepted by the parser tests above.
# Managed billing attribution and bounded Mistral transport — 2026-09-23

Managed Mistral cookie fetches capture their selected local credential lane before the asynchronous request. History keeps that lane unresolved unless the provider supplies an observed identity. Other providers, fallback cookies, errors, and unsupported sources do not inherit the managed lane. Existing history is not rewritten. The spend bridge preserves observed/unresolved/legacy scope; aggregation does not borrow missing currency or sum potentially aliased identities. Monetary tables and history charts preserve those separate series and hide raw local identifiers.

Independent review identified two remaining consumers that collapsed identity lanes. Both were repaired. A subsequent regression in the default usage chart was reproduced and repaired by deriving the provider from the observation rather than parsing differently encoded group keys. Regression coverage includes usage → spend → usage. The PopOut integration test's first cold lazy import exceeded its interaction deadline while rendering the loading placeholder; the real module is now prepared in test setup, without mocking the page or increasing the interaction timeout. Focused recovery: 18/18 tests across three files (`.local/wave3-popout-preload-focused.log`).

Mistral HTTP reads now reject redirects, client initialization failure, invalid UTF-8 and bodies above 8 MiB, including streaming bodies. HTTP errors expose status rather than private response content. Four new transport tests use synthetic loopback responses, not live credentials. Existing auth-status behavior is preserved. See PROVIDER_CREDENTIAL_SECURITY_AUDIT.md for rollback constraints and exact coverage limits. Integrated gate results are recorded in the next checkpoint; this section alone is not a full Wave 3, native or release PASS.

## Billing attribution integration checkpoint — 2026-09-23

Commits c2b6e06e (scope propagation and alias-safe totals), 628486a6 (bounded/private Mistral responses) and 84392111 (real lazy-page test setup) are integrated. Independent scope review findings and the usage-chart recovery are closed. Final offline gates: frontend1649/230; desktop580+1existingignored, core1900, CLI1, doctests0; TypeScript, production build, 1966-key locale parity, Clippy and formatting pass. Secret scan4262files clean; no new focused/skipped tests. Logs: .local/wave3-scope-integrated-{front,tsc,build,rust,clippy,secrets}.log. PopOut focused recovery18/18 proves the actual dashboard renders after cold transformation outside its interaction deadline. Vite still reports existing large chunks; this is not native/performance acceptance.

No real credentials, Personal data, live provider calls or native UI were used. Remaining: Amp source/credential truth and Doubao read-only verification, broader Wave3/product/native/security/OSS/release gates. Publication remains CLOSED. The goal tool currently reports PAUSED although the user explicitly resumed work; manual work continues under that request, without claiming the tool's status was changed. Canonical Dev build provenance follows in .local/wave3-scope-dev-build.log; until successful, the prior binary is historical.

## Amp and Doubao source correction — 2026-09-23

Amp no longer reads Cody credentials or calls a Cody endpoint. Its API-key onboarding source reads the Amp balance RPC using an Amp-issued token, rejects cookie/CLI selection, caps responses and fails closed for unrecognized formats. The RPC shape is sourced from the pinned upstream Amp adapter cited above; no personal account or live endpoint was exercised, so current private-API compatibility is unverified. Existing stored credentials were not migrated or deleted.

Doubao connection verification now permits only read-only signed Coding Plan usage or supervised `arkcli usage plan`. It never falls through to the chat-completions probe used by ordinary monitoring. The Coding Plan reader rejects redirects, fails closed on client creation, caps declared and streamed responses at 2 MiB and never includes the remote body in HTTP error text. A missing session quota is informational, not 0%. The CLI command uses curated executable provenance, scrubbed environment, bounded output, cancellation and process-tree teardown; raw stderr is used only for local auth classification, never shown. A plain `ARK_API_KEY` remains a legacy monitoring input but is not advertised as a verifiable onboarding credential; the key offer explicitly requests signed Coding Plan credentials. The derived matrix was regenerated after this change.

Fresh read-only Sol Medium review found the previously advertised bare-key verification mismatch, which was closed by narrowing the offer/help to signed credentials. Offline tests include synthetic connection-verification rejection, missing-quota and HTTP privacy/size fixtures, registry/matrix checks, and the pre-existing shared CLI supervisor tests. No live account, paid request, native app or installer was touched. Full integrated gate and post-commit Dev binary results belong to the final local build record; this section alone does not grant Wave 3 or release acceptance. Goal status was rechecked and is now ACTIVE.

The next source audit found a concrete CLI reachability gap: Doubao's `arkcli` method was offered, but the shared trusted resolver treated every manually installed CLI except Copilot as undiscoverable. It now resolves the [official `@volcengine/ark-cli` npm package](https://github.com/volcengine/ark-cli) from a protected machine-wide Node root using exact package-name/bin metadata; manual installation remains manual. Current npm metadata identifies `arkcli` as `scripts/run.js`. A user-writable global npm tree remains excluded by the provenance policy, so that installation layout still requires manual remediation or signed Coding Plan credentials. A synthetic Windows resolver test covers protected success, wrong package rejection, user-writable rejection and absence of an automated install plan. No owner CLI was executed.

Kiro's three pre-existing direct subprocesses (`whoami`, non-interactive `/usage`, and `--version`) were also outside the shared timeout/capture/process-tree supervisor. They now use that supervisor with fixed arguments, a 15-second timeout, 16 KiB per-stream retained-output cap, environment scrubbing, and cancellation/owned-process cleanup; the usage call retains its `TERM=xterm-256color` hint. Auth failures remain distinguishable, while nonzero exits, oversized output, and process failures expose only generic errors and never raw CLI text. Focused Kiro parser/state tests and a synthetic supervised-command test pass. The integrated Rust workspace test gate passes (desktop: 582 passed, 1 pre-existing ignored; core: 1914 passed; CLI: 1 passed; doctests: 0); strict workspace Clippy and formatting checks pass. This does **not** verify a real Kiro login or prove that every owner-specific Kiro CLI installation works under the scrubbed environment; native owner-session QA remains open.

The next provider-source audit found two Augment defects. Its CLI `account status` wrapped unbounded `Command::output()` in a timeout that did not own/tear down a dropped child and returned raw stderr in a user-facing error. It now uses the shared 15-second, 16 KiB-per-stream process-tree supervisor and distinguishes authentication errors without exposing command output. Its web parser silently substituted `0` used credits and a `100`-credit limit when fields were missing; the CLI parser could convert a zero/contradictory limit or non-finite integer into a misleading 0% quota. Missing web quota fields now produce an informational row while preserving separately observed plan/email; an empty response fails parsing. A real observed `0` with a positive observed limit remains 0%. Zero, contradictory or overflowed CLI limits fail parsing. HTTP 401/403 remains authentication; HTTP 503 is a server error, and the web body is streamed with a 1 MiB bound and generic parse errors. The before-fix zero-limit and missing-web-limit tests failed as expected; after repair, all 12 Augment-focused tests pass. Full Rust: desktop 582 passed/1 existing ignored, core 1922 passed, CLI 1, doctests 0; full Clippy and formatting pass. The web response shapes are synthetic because Augment's private live schema and owner account were not accessed. Native/live compatibility remains unverified; this is not Wave 3 acceptance.

Antigravity's Windows process discovery and port lookup had also used unbounded, PATH-resolved PowerShell subprocesses. Process discovery previously printed complete command lines, including unrelated arguments, to capture the local CSRF flag. Both calls now use the SystemRoot PowerShell path and shared 15-second/16 KiB process-tree supervisor. The discovery projection emits only PID, process name, and substrings shaped like the four flags the existing parser needs; `-NoProfile` and `-NonInteractive` suppress profile execution and prompts. Synthetic Windows PowerShell fixtures cover whitespace/equals flags, IDE/CLI precedence in both orders, CLI-only/no-match results, and omission of unrelated private arguments. A separate read-only cmdlet lookup confirms `Get-CimInstance` and `Get-NetTCPConnection` are available on this host under the scrubbed environment. Because projection is lexical rather than a full Windows command-line parser, unrelated quoted text that itself resembles a required flag could still be selected; the result remains local and is never logged. The independent read-only security review found no confirmed blocking regression and requested the expanded tests and this precise privacy caveat. Full Rust: desktop 582 passed/1 existing ignored, core 1926 passed, CLI 1, doctests 0; strict Clippy, formatting, diff and 4262-file secret scan pass. No real owner process list or CSRF value was read during this audit. Real local-server compatibility and native UI remain unverified.

## Vertex AI source-truth closure — 2026-09-23

The CLI capability audit found that Vertex AI's adapter did not read a usage source. A successful Cloud Resource Manager **project-metadata** lookup, a failed lookup, and mere `gcloud` file presence each returned an ordinary `RateWindow::new(0.0)` before this change. That could show a fabricated 0%-used quota and mark a connection verified. An initial regression failed before repair; the final adapter returns unavailable for every source mode **before reading credentials or making a network request**. The obsolete project lookup and PATH-selected, unbounded access-token subprocess were removed from the fetch path. The adapter explicitly declares no currently supported usage source or credits.

The derived 70-provider matrix now keeps Vertex AI visible with `status: unsupported`, no offered onboarding method, and `verification: unavailable` (67 supported/auto-detected, 2 deprecated, 1 explicit unsupported). The separate legacy login transport and detail bridge agree with that status. Provider detail and quick actions hide a Connect button with no verifiable method; the old credential panel that labeled file existence “Authenticated” and exposed its path is no longer rendered. The public release description should not claim Vertex AI usage or connection verification from this adapter. Existing saved credentials were not read, migrated or deleted.

The initial regression failed before repair. Final offline gates: frontend **1649/230 files**; Rust desktop **582 passed/1 pre-existing ignored**, core **1928 passed**, CLI **1 passed**, doctests **0**; TypeScript, production build, strict workspace Clippy and locale parity **1966 keys** passed. The full Rust workspace suite and strict Clippy passed again after the final no-I/O simplification. Logs: `.local/vertexai-truth-{front,build,secrets}.log` and `.local/vertexai-truth-final-{rust,clippy}.log`; the secret scan covered **4261 files**. This is not a claim of live Google Cloud compatibility or native QA. Restoring a supported Vertex method requires an observed project/account-scoped usage endpoint and a compatible verification strategy; a project lookup or CLI install remains insufficient. The original CLI audit also still needs the Kiro/Grok CLI discovery paths reconciled with their respective runtime adapters. Wave 3, product, native and release gates remain open.

## Grok CLI version-probe boundary — 2026-09-23

The Grok adapter's optional version label used to execute bare `grok --version` from PATH with no timeout. It now resolves only a curated executable from the shared CLI dependency registry and uses the bounded, supervised read path. If no trusted executable resolves, the label is unavailable; Grok's existing auth-file/browser-session usage transports remain separate. Kiro still has a runtime PATH/environment-override resolver that differs from the curated login/detection resolver, so this CLI audit is not complete. A real Windows installation and account were not probed.

## Kiro CLI provenance alignment — 2026-09-23

Kiro usage and version detection previously accepted a same-name file from PATH, an environment override, or a user-writable local install, while the managed login and connection detector used the protected CLI resolver. All three now use the same curated decision: a canonical `kiro-cli.exe` under a protected Program Files Kiro directory on Windows, or `bin/kiro-cli` under a protected system prefix on Unix. A missing CLI is rechecked rather than cached forever. The login failure and credential helper now explain that PATH-only/per-user copies are not run, and the offered manual documentation points to Kiro's official CLI page. No CLI was installed, executed against an owner account, or used to read credentials.

The resolver's Windows fixture failed before the protected Kiro path was added and passes afterward; a Unix fixture covers its protected path but was not executed on this Windows host. A fresh read-only critical review found an initial Unix regression and misleading PATH guidance; both were repaired, and its second read found no further required runtime defect. Official installer layout compatibility remains unverified, particularly for per-user installations; this is a functional limitation requiring an explicit trust design rather than silently running arbitrary PATH files. The successful version cache may remain stale after an in-place CLI upgrade until restart. Full post-repair automated gates: frontend **1649/230 files**, Rust desktop **582 passed/1 pre-existing ignored**, core **1929 passed**, CLI **1**, doctests **0**, strict Clippy, production frontend build and locale tests. Logs: `.local/kiro-trust-{red,green,final-rust,final-front,final-clippy,front-build}.log`. This is not live Kiro or native UI acceptance; Wave 3 and release gates remain open.

## Bedrock AWS profile CLI boundary — 2026-09-23

The Bedrock profile adapter no longer executes `aws` from PATH or waits unbounded on `configure export-credentials`. It resolves official Windows current-user/all-users locations or an explicit absolute owner-selected AWS CLI path, then uses the shared process supervisor for a 15-second timeout, cancellation and tree cleanup, and a capped secret-output buffer. User-visible failures do not contain raw stderr, profile names or exported credentials. A fresh critical review caught a compatibility regression for `credential_source=Environment`; the AWS credential, role, web-identity and container source variables are now selectively preserved, while PATH stays removed. A synthetic compiler-owned child fixture exercises the exact wrapper arguments and output boundary without accessing an account. Post-repair tests: Rust desktop **582 passed/1 pre-existing ignored**, core **1933 passed**, CLI **1 passed**, doctests **0**; strict workspace Clippy and secret scan of **4261 files** passed. See `.local/bedrock-aws-final-{rust,clippy}.log` and `PROVIDER_CREDENTIAL_SECURITY_AUDIT.md` for trust limitations. The independent review found no further concrete P0/P1/P2 issue in this scope. Native Bedrock/SSO validation, PATH-dependent credential-process compatibility and full Wave 3 acceptance remain open.

## Claude interactive PTY output and cancellation checkpoint — 2026-09-23

The Claude CLI `/usage` PTY path now has a 256 KiB retained-output cap and a bounded reader queue. Its async owner signals cancellation when dropped; the worker checks the signal before more scripted input and while reading output, then kills and reaps the direct child. Synthetic PTY tests cover overflow, cancellation before a command can run, and abort of a live async owner. A fresh read-only review caught a remaining-input race; it was repaired and retested. No owner Claude process, account, or credential was accessed.

Final serial Rust suite for this checkpoint: desktop **582 passed/1 existing ignored**, core **1938 passed**, CLI **1 passed**, doctests **0**; strict workspace Clippy and formatting pass. Log: `.local/claude-pty-full-rust-serial.log`. An initial parallel suite run failed five timing-sensitive process fixtures; the serial rerun passed. This was **not** a Claude source PASS; the later provenance/version checkpoint below closes additional paths. Native UI, release, and whole-goal gates remain open.

## Claude Windows executable and version provenance checkpoint — 2026-09-23

The Claude CLI usage, managed connection/login and version paths now share a curated command decision. On Windows, native/current-npm `claude.exe` candidates require a valid Authenticode signature with the documented Anthropic, PBC signer; raw `where claude` and filename-only shims have been removed. A protected machine-wide older npm JS package can still run through its validated package entry and Node prefix. Version detection uses supervised, capped capture and accepts only a successful UTF-8 version. Source basis: [Anthropic's current setup and code-signing guidance](https://code.claude.com/docs/en/setup), plus current npm bin metadata checked during this work. Synthetic tests cover unsigned rejection, candidate layout and protected legacy package arguments; no owner Claude executable was launched.

The first independent security review found a user-module shadowing risk in PowerShell signature verification, plus cancellation gaps in login, detection and usage discovery. The repair disables module autoload, imports the OS security module by absolute path, qualifies the signature command, and adds an isolated shadow-module fixture. All three async callers now resolve off-executor with cancellation and aggregate deadlines; managed login shares its overall timeout with discovery. Unix legacy npm version probing retains PATH so `env node` can find a non-system interpreter. A focused independent re-review found no remaining concrete P0/P1/P2 regression in the repaired discovery paths.

The final integrated serial Rust suite passed desktop **582/1 existing ignored**, core **1944**, CLI **1**, doctests **0** (`.local/claude-trust-final-rust.log`); strict workspace Clippy, formatting, secret scan and diff checks passed. A positive Anthropic-signed installation was unavailable at the default locations on this host, so real native/npm compatibility is unverified. Cancellation during a live signature check and Unix runtime compatibility remain untested. Unix executable provenance, PTY blocking writes and descendant teardown remain open. This is not Wave 3, product or release acceptance.

## Codex CLI version-probe boundary — 2026-09-23

Codex PAT usage formerly ran a filename/PATH-selected CLI with unbounded `--version` capture to populate only the request's user-agent version. That metadata path now uses the curated dependency resolver and supervised 15-second/capped read. When no trusted CLI resolves, the existing version-unavailable user agent is used and the PAT fetch proceeds. The provider's actual OAuth/PAT authentication paths are unchanged. Claude's interactive CLI usage path remains a separate audit item; do not infer its safety from this metadata-only repair. Codex-specific tests passed (35). The first workspace suite, run concurrently with strict Clippy, failed seven unrelated process-start/timing fixtures; rerunning the workspace suite alone passed desktop **582/1 ignored**, core **1933**, CLI **1**, doctests **0**. Logs: `.local/codex-version-{final-rust,rust-serial,final-clippy}.log`. Stress reliability under concurrent heavy build load remains unproven.

## Gemini credential-location privacy in native Providers — 2026-09-26

The Dev-only native Providers → Gemini → Connections & accounts screenshot
exposed the absolute OAuth credential file path, including the Windows user
directory. The visible location is now `~/.gemini/oauth_creds.json` in an
isolated left-to-right span; the actual path is retained only for the
user-triggered Open Folder action. Status, folder and setup failures render a
generic localized retry message instead of a raw exception that may contain
private paths. Three focused frontend tests cover the displayed path, the
unchanged Open Folder argument and private-looking failure text. The fresh
Dev build passed preflight/freshness (SHA-256
`b5701b3f1943016e4f0fbb78d309a1d5284c29f5a09b4135d70a47409ea87db1`),
and its guarded six-step native scenario passed; the after screenshot was
visually inspected. This did not attempt a live Gemini sign-in, open the
credentials file, or validate other providers' credential surfaces.

## Gemini CLI OAuth source quarantine — 2026-09-26

Google's current [Gemini CLI FAQ](https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/faq.md)
warns against third-party software piggybacking on Gemini CLI OAuth to access
its backend services. The former Quotalune adapter read and could rewrite
`~/.gemini/oauth_creds.json`, then called Google's undocumented
`v1internal:loadCodeAssist` and `v1internal:retrieveUserQuota` endpoints.
That code pattern appears to fall within the warning; this is an engineering
policy assessment, not a formal legal opinion. No owner credential, CLI or
Google endpoint was accessed during the review.

The direct OAuth/private-endpoint adapter was removed. Gemini remains in the
70-provider registry but fetches fail closed for every source mode before
reading credentials or making a network call. Its connection capability and
verification now report unsupported/unavailable. The provider detail no
longer offers the Gemini CLI credential widget, browser cookie import, or an
AI Studio link posing as the CLI usage dashboard. Its connection pane shows
an explicit localized unsupported-source explanation. Existing stored credentials
are untouched. The nine older localized CLI setup hints were corrected to
run `gemini` per Google's [get-started guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/index.md),
but that setup surface is no longer offered as a working quota connection.
AI Studio API quotas are a separate billing channel and cannot stand in for
personal Gemini CLI subscription quota. A future adapter needs a documented
supported, plan-equivalent usage source and new verification evidence.

This closes the identified *runtime path*, not the whole-product release gate:
remaining providers and native/installer/security checks still need their own
evidence. Historical Gemini observations are not rewritten and must not be
described as fresh data from the new adapter.

The derived 70-provider matrix was regenerated; its Gemini row is unsupported
with no methods and unavailable verification. The full serial Rust suite
passed (desktop 586/1 existing ignored, core 1941, CLI 1, integration 2), as
did strict Clippy and formatting. The frontend registry fixture passed 69/69
after updating its explicit unsupported list; TypeScript, production build and
2037-key locale parity passed before the final empty-state key (2038 keys
now pass). An initial parallel Rust run failed seven
process-timing fixtures under simultaneous heavy frontend work; the serial
run passed. A verified Dev build and guarded six-step native scenario captured
an intermediate disabled-connection state. Visual review then found the
remaining cookie UI and misleading AI Studio link; these were removed. The
final explanation passed a fresh six-step native scenario in the verified
Dev build (SHA-256
`19a3d3180950e9ec5a4d533ea9944d9265b87f7d569e2425902540f107768dfc`).
The inspected Arabic screenshot shows one full-width explanatory card and no
CLI setup, browser-cookie or AI Studio usage action. The 2038-key parity and
TypeScript checks passed after the final copy/layout change. The final
frontend suite passed 1668 tests across 232 files, strict workspace Clippy
passed again, and the secret scan of 4794 tracked files was clean. This is
source/visual closure for Gemini, not a claim that every remaining provider or
the public installer is accepted.

Follow-up cleanup removed the now-unreachable Tauri `get_gemini_cli_signed_in`
command, its frontend bridge/type and the host helper that exposed the local
OAuth file path. This closes a stale credential-presence IPC surface after the
connection widget was removed; it does not alter stored credentials or the
already quarantined provider fetch. The general CLI dependency catalogue
still describes Google's separate Gemini CLI installation, but no Gemini
quota connection method is offered by Quotalune.
