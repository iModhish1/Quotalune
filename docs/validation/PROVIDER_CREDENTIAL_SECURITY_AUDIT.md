# Wave 3 credential security audit

Scope: inherited onboarding work based on `d066226d9edb`, reviewed and repaired locally. No real credentials were entered, imported or used for live provider verification. Personal was not launched or modified. Native Windows UI evidence is deferred; this document describes code and automated evidence.

## Credential ownership

| Material | Storage / owner | Onboarding behavior |
|---|---|---|
| API key | Existing `ApiKeys` or `TokenAccountStore` protected files | Masked draft; save to the adapter-consumed store, select newly added token account; clear draft after success/failure |
| Imported cookie | `ManualCookies`, protected file | Select one browser profile before extraction, only provider domain (including regional selection), never return cookie values |
| Managed device token | Existing Copilot device-flow/token-account code | Provider-owned verification URL/code; existing expiry, poll/cancel and protected storage |
| CLI session | Official CLI owns external session files | No rewriting these files on disconnect; supervised process with timeout and owned process tree |
| Settings/history | Metadata only | Source selection / enablement, no key/cookie fields added to Settings; notification journal denies unapproved free text |

Windows protection reuses `secure_file`/DPAPI. Regression tests write only temporary fixture files, assert plaintext absence, and decrypt for exact roundtrip. This does not certify non-Windows protection or a real account exchange.

## Repairs from review

1. Arbitrary PATH/home shims no longer execute during detection/login. Only protected installation roots qualify; a user-controlled npm manifest is not provenance. Package root escape is rejected.
2. Detection and login scrub inherited environment, use argument arrays, bounded output, timeout and cancellation. Windows owned Job objects contain descendant processes before they run. A pre-canceled probe cannot spawn.
3. Nonzero version exits remain Broken even if stdout resembles a version. Authentication-file presence is not usage verification.
4. Automated npm/winget execution is disabled. Curated package identifiers and official links remain documentation; no silent installer fallback exists.
5. Shared per-provider reservation coordinates verify/detect/login/refresh/credential mutations. Three global I/O permits bound onboarding and account refreshes; canceled tasks retain ownership until cleanup.
6. Codex account refresh lanes now enter the same simulation/operation guard before loading credentials, obey cancellation and suppress persistence after cancellation.
7. Explicit source choice excludes unused token overrides and their account UUID. Ambient/manual-browser observations must not be labeled as another stored account.
8. Settings completion and disconnect use the existing shared settings-patch transaction lock to avoid cross-provider lost updates.
9. Browser import selects exactly one opaque profile ID; ambiguous/unknown profiles are rejected before opening cookie databases. No profile paths or account emails are exposed by discovery.
10. UI errors are localized generic messages, never raw credential-bearing IPC errors. Key drafts are cleared on failure and method switch. Output redaction covers keys, cookies, bearer/refresh tokens, private home paths, email and control sequences.
11. Dev fixtures short-circuit key saving, cookie importing, verification and disconnect. Other real mutations are refused while that provider is simulated or Demo is active. Fixture setters reject non-Dev channels.

## Boundaries requiring explicit follow-up evidence

- Native screenshots, real WebView2 keyboard interaction and actual provider authentication are not verified in this environment.
- Installation layouts outside protected roots use manual instructions. Executable signer/package hash verification and a trusted installer pipeline are not implemented.
- Browser cookie decryption is Windows/browser-version dependent; local profile-selection tests are not proof of decryption against a real browser. Expiry/reauth is derived from provider response.
- Local application sessions may require an external sign-in and network access; no generic OAuth is manufactured.
- Disconnect disables Quotalis monitoring and removes its selected owned credential copy. External browser/CLI sign-in and provider-side revocation are not performed.

## Evidence files

`cli_dependencies::tests`, `login::tests`, `connection_security::tests`, `connection_state::tests`, shell `commands::connection`, `connection_operations`, browser profile tests, and `ProviderConnectFlow.test.tsx`. Final counts and commands are recorded in `WAVE3_IMPLEMENTATION_REPORT.md`; local raw logs are under `.local/wave3-*.log` and contain fixture-only test output. Release gate remains CLOSED.

## Claude interactive PTY bounded-output checkpoint — 2026-09-23

The Claude `/usage` PTY probe now bounds its retained output at 256 KiB and its reader queue at 32 chunks of at most 4 KiB. Exceeding the cap terminates the direct child and returns an error without surfacing partial output. Dropping the async probe signals cancellation to its blocking PTY worker; startup delay, per-character input delay, the read loop and the settle loop observe it. An independent review found that the first version still wrote remaining script characters after cancellation; the input loop now checks before each character and before the line terminator. Synthetic PTY tests exercise output overflow, cancellation before command submission and async-owner abort with a live worker. No owner Claude account or CLI was invoked.

This checkpoint established bounded memory and cooperative cancellation, **not** complete process supervision. Synchronous PTY writes can still block independently of cancellation, and the existing teardown kills only the direct child before an unbounded wait. The later executable-discovery/version repair below closes additional paths; descendant containment, stalled-input recovery and native compatibility remain open.

## Claude Windows executable provenance and version checkpoint — 2026-09-23

[Anthropic's current installation guidance](https://code.claude.com/docs/en/setup) documents a native Windows executable under the user's `.local/bin`, a current npm package whose `claude` bin points to a native executable, and Windows code signing by **Anthropic, PBC**. Claude discovery now checks the native and current npm locations plus `claude.exe` PATH candidates only after a bounded, profile-free Windows Authenticode check reports a valid signature with that exact signer common name. The verification command is fixed, runs from the OS system directory under the existing 15-second process-tree supervisor, receives the candidate path via a dedicated environment variable and returns only a fixed success marker. Filename-only `.cmd`/`.bat` shims never qualify. If no signed native executable is found, the existing protected machine-wide npm package resolver can still supply a validated older JS entry with a protected Node prefix. The interactive usage probe, managed login/detection and synchronous version metadata now share this curated command decision. Version capture uses the existing bounded supervisor, requires a zero exit and valid UTF-8, and rejects output over 16 KiB.

Synthetic Windows tests reject an unsigned executable and a script, verify candidate locations and protected legacy npm prefix handling. No owner Claude executable or credentials were run or read. The positive Anthropic-signed path was **not** exercised because no such binary was present at the inspected default native/npm locations. Windows installations in other layouts may be missed; Unix still has its older PATH-based discovery and needs a separate provenance policy. A signed file can change between verification and PTY creation; this same-user race is not eliminated. The interactive PTY's blocking writes, unbounded direct-child wait and incomplete descendant teardown remain open. These limits prevent claiming full Claude CLI or Wave 3 security acceptance.
# Current credential provenance and cancellation checkpoint

The Wave 3 continuation makes onboarding key/browser-import read/modify/write
atomic with accepted cancellation through the existing operation registry.
No separate plaintext store was introduced. Protected token records now retain
optional acquisition origin for manually entered keys versus completed GitHub
device authorization; legacy origin remains unknown. CLI and desktop creation
share this rule. Explicit verification cannot reinterpret an unrelated key as
device flow, and selected CLI does not consume stored Quotalis API keys.

This is bounded source/test evidence, not live DPAPI/browser authentication or a
whole-product security PASS. Older writers may discard optional origin metadata;
the credential remains readable, but origin becomes unknown.

The subsequent bounded-reader repair removes Copilot's raw `gh auth token`
process path from both API entry points. It reuses curated resolution, process
containment and environment scrubbing, adds cancellation on async-future drop,
and keeps secret capture private and separate from sanitized diagnostic reports.
Failed, truncated, invalid-UTF-8 and unexpected-read-error outputs fail closed.
Six new tests exercise the capture contract and real synthetic Windows process
success/timeout/drop behavior. Existing test helpers were repaired so positive
startup and output assertions are mandatory. Independent review findings were
closed; no live account or owner credential was accessed. This is not an audit
of every other adapter subprocess. See WAVE3_IMPLEMENTATION_REPORT.md for exact
tests and the remaining native, provider-wide and release gates.

## Managed Mistral history attribution — 2026-09-23

History attribution now travels with the resolved fetch rather than re-reading the current account selection after I/O. Only a selected managed Mistral cookie on its supported Auto/Web path receives a local lane; explicit CLI/Web selections that exclude managed credentials, disabled cookies, stored/browser fallback and unsupported source paths do not. Mistral returns directly from the supplied cookie request. This limited guarantee is not generalized to adapters with unverified internal fallback behavior.

The lane key contains provider + existing local UUID, never a cookie/hash of a cookie, token, label or email. Scope stays unresolved. Provider-observed identity retains precedence. Existing error and refresh-generation gates remain ahead of history writes. Database fields are unchanged; no historical samples are rewritten. Frontend aggregation must retain the accompanying scope guard to avoid adding legacy ambient readings to potentially aliased local lanes.

Downgrade warning for private engineering use: no schema migration does not mean old readers are semantically safe. Keep the aggregation guard when reverting other pieces, or use an explicitly preserved pre-change Dev history copy. Never silently rewrite/erase owner history to make older readers appear correct. No owner data or credentials were accessed during these tests.

## Mistral HTTP boundary repair — 2026-09-23

A loopback-only regression reproduced private response-body text leaking through a provider error. Non-success responses now expose only the HTTP status, retaining existing 401/403 authentication classification; no response body is copied into the error. Successful response bodies are limited to8MiB both by declared length and incremental chunk accounting, then decoded as strict UTF-8 before the billing interpreter. Construction failure yields an explicit unavailable-client error, never a default unrestricted HTTP client. The Mistral client refuses redirects and retains its30-second request deadline. This changes no endpoint or credential selection.

RED: `.local/wave3-mistral-http-red.log` (body disclosure and oversized-response regressions failed). GREEN: `.local/wave3-mistral-http-green.log`, all17 Mistral tests pass, including declared/chunked oversize, auth statuses, valid unknown billing, invalid encoding and no-client failure. Fixtures bind only loopback and contain synthetic text; no provider credential or live request is used. Full integrated gate/review results are recorded separately. This bounded repair does not claim all70 adapters' HTTP paths have been audited.

## Bedrock AWS CLI profile export boundary — 2026-09-23

Bedrock profile mode previously executed a bare `aws` from PATH or an unchecked path override, waited without a deadline, retained unbounded output and could forward CLI stderr/profile text into a user-visible error. The adapter now resolves the AWS CLI from the [documented Windows current-user or all-users install directories](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), or from an explicitly configured absolute `aws.exe` path. It never executes a PATH-selected filename. The configured path is an owner choice and is not a signature attestation; per-user installations are writable by that user. Unix system paths are also recognized, but are not tested on this Windows host.

The [official `configure export-credentials --format process` output](https://docs.aws.amazon.com/cli/latest/reference/configure/export-credentials.html) is captured only inside the adapter's process boundary. The shared supervisor provides a 15-second deadline, cancellation on dropped fetch, process-tree cleanup and a 16 KiB plus-one-byte capture cap. Oversized output fails closed. The subprocess receives only minimal system variables plus AWS config/credentials file, region, CA bundle, proxy and source-credential variables. Access keys must be retained for profiles using `credential_source = Environment`; only the validated AWS executable receives them. PATH is removed. This can prevent a profile's `credential_process` that depends on PATH from running; an absolute helper command in AWS configuration avoids that limitation. The adapter classifies SSO/expired sessions without displaying raw stderr, profile names or credential JSON, and uses generic errors for other failures. Existing AWS CLI cache/profile files remain owned by AWS; Quotalis does not copy them. No live AWS profile or owner credential was accessed; synthetic unit tests verify path rejection and error redaction, while the shared supervisor's existing tests cover timeout, cancellation and capture bounds. Live SSO compatibility and Windows native UI verification remain open.

## Codex CLI version metadata boundary — 2026-09-23

The Codex adapter previously executed the first `codex` found on PATH or in a filename-only user shim with unbounded `--version` output. This is used for a PAT request's user-agent metadata, not for obtaining quota data or authenticating. Version detection now uses the existing curated Codex dependency resolver and the 15-second supervised, capped read path. If no trusted executable resolves or the command fails, the PAT request uses its existing version-unavailable user-agent fallback. No Codex credential is passed to the version command. The adjacent Claude CLI usage path is different: it invokes an interactive PTY and still requires a separate trust/output/cancellation review before Wave 3 can pass.

## Claude executable signature and discovery repair — 2026-09-23

The Windows native/current-npm Claude executable is accepted only after a valid Authenticode result whose certificate simple name is `Anthropic, PBC`, following [Anthropic's setup and signing guidance](https://code.claude.com/docs/en/setup). Signature verification runs the OS PowerShell binary, disables module autoload and imports the OS security module by absolute path before calling its qualified command. A synthetic user-module shadow fixture confirms the probe never loads that module. Signed-native acceptance still lacks an Anthropic-signed fixture on this host; no owner Claude executable or credential was used.

Detection, managed login and CLI usage now place discovery off the async executor and apply cancellation and an aggregate discovery deadline to signature subprocesses. Managed login shares its overall timeout with discovery. A read-only adversarial re-review found no remaining concrete regression in those paths; cancellation during a live signed-binary check was not exercised end-to-end. Unix legacy npm `env node` version probing retains the inherited interpreter PATH while keeping supervised output bounds, but Unix runtime compatibility is untested on this Windows host. The earlier PTY blocking-write and descendant-cleanup limitations remain open.
