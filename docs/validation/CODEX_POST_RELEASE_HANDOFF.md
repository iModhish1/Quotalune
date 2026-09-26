# Codex post-release continuation — 2026-09-12

## Reconciliation before implementation

- Starting/source HEAD: `0f1084372cfffe9a486d6e73e65191ec9c53c0ea`, exactly expected.
- Branch: `feature/v9-theme-runtime`; initially clean, no reset or checkout.
- Accepted application: `dfd81974c4a76922bbc1b5094b85468dc2d6f726`.
- Installer-only fix: `1b3a6db36446aa9472c89ea1f4cce9c1cba4d183`.
- Closeout: `499376b0`, `80ed5187`, `0f108437`; packaging did not replace application bits.
- Installed Personal: `%LOCALAPPDATA%/Programs/Quotalis/Quotalis.exe`, version
  `0.11.0`, stable, embedded `dfd81974c4a7`, clean. Read-only diagnostic flags
  occur before app initialization, independently checked in main.rs before use.
- Actual SHA256 matches accepted value:
  `47d537435caf23d21e5597fd007582bf7571dd603e0c36dae1f9de9f22989b8d`.
- Personal compatibility data root `QuotaArc` and AUMID `app.quotaarc.desktop` stay fixed.
- Dev: `QuotalisDev.exe`, `dev`, `QuotaArc-Dev`, `app.quotalis.desktop.dev`.
  Fresh native builds must use `scripts/build-dev-verified.mjs`.

## Current findings versus historical acceptance

Analytics Superstack, promotion and source installer AUMID fix remain closed.
The Phase 3I design document's "NOT YET DEFINED" sections predate implemented
Token/Model/Activity/Data Sources work and Phase 3N native checks; they are not
instructions to rebuild those accepted surfaces. Earlier Product V3 and installer
test incidents remain disclosed in their original reports.

The installed binary is correct, but the **current shortcut differs from closeout**:
direct Shell property read and Get-StartApps both return the executable path as
AUMID, not `app.quotaarc.desktop`; arguments are empty rather than `menubar`.
Shortcut last-write was 2026-09-12 06:20:46 local. Cause is not established.
The Start pin was historically owner-completed and verified; it has not been
re-pinned, clicked or freshly certified in this continuation. No shortcut repair
is authorized by this Dev-only task.

The rollback report's operational steps incorrectly refer to NSIS and deletion
of the old `Local/QuotaArc` directory. Actual new install uses Inno, lives at
`Local/Programs/Quotalis`, and registers `unins000.exe` in
`QuotaArcDesktop_is1`. Those instructions require correction before use.

## Open-work inventory / selected next task

| Priority | Evidence-backed item | Disposition |
| --- | --- | --- |
| P0 if executed | Wrong destructive rollback instructions | Selected: correct runbook; never execute rollback |
| P1 | Current installed shortcut identity/arguments drift | Selected: read-only detector; Personal repair requires a later authorized phase |
| P2 | Claude warm aggregation latency | Measured Phase 3H, explicitly deferred architecture investigation; no speculative cache rewrite |
| P2 | Reset presentation surface-override editor and formatter consolidation | Existing partial scope, separate future product slice |
| P3 | HTML title still QuotaArc | Confirmed cosmetic backlog; no broad replacement |
| P3 | Activity help still says "tokens and sessions" | Native copy residue; no Sessions metric was introduced or certified |
| DEFERRED | Physical notification banner in RDP | Historical environment limit; no new delivery regression established |
| DEFERRED | Session proxy, external analytics lab, inferred money | Unsupported/research-only; preserve truth contracts |

Initial proposed slice was read-only release/rollback verification. **Superseded
before implementation by a higher-priority, reproduced Dev baseline failure:**
the verified build script supplies `dev-channel` but omits `tauri.dev.conf.json`.
The resulting context still has Personal's `app.quotaarc.desktop` identifier.
The installed single-instance plugin 2.4.1 uses exactly this identifier for its
mutex/window and synchronous WM_COPYDATA forwarding. Dev PID 18640 remained
unresponsive without a window or CDP listener and was stopped by exact path/PID.
This is consistent with a cross-channel single-instance collision; a stack trace
was not taken. A Personal activation message cannot be ruled out. No installed
binary, shortcut or settings change was deliberately made; do not claim zero
runtime side effects from that attempted launch.

**Selected first slice: repair the baseline channel boundary.** Build using the
canonical Dev Tauri config; diagnose its actual embedded identifier; reject a
channel/config mismatch before logging/settings/plugin setup; require that identity
in preflight; keep source/copy hash and embedded HEAD checks. Acceptance includes
rejection of the old mixed build and native isolated launch/smoke of the repaired
candidate. Rollback runbook corrections remain a separate bounded documentation
fix; a general release detector is deferred rather than expanding this slice.

## Baseline source health

- Frontend: 182 files / 1,094 tests passed.
- Desktop: 474 passed / 1 existing ignored / 0 failed.
- Core: 1,696 passed / 0 ignored / 0 failed.
- CLI: 1 passed / 0 ignored / 0 failed. Doctests: 0.
- TypeScript, production build, Clippy workspace all-targets with warnings denied,
  Rust fmt passed. Locale parity: 1,459 keys. Secret scan: 2,180 files clean.
- Existing bundle warnings: index 511.41 kB, analytics engine 660.12 kB (223.52 kB gzip).
- Native Dev build at clean starting HEAD passed; SHA256 source/copy:
  `c1a60794b5d75b26637eb0ff79376a04e8f506403c2885ca17ce869c88b68887`.
  Embedded `0f1084372cff`, channel dev, OLD preflight passed. Native launch FAILED:
  that preflight did not cover Tauri identity. This build is not accepted evidence.

Evidence logs live in `.local/post-release-*`; final native evidence and slice
results will be recorded below. Normal writes by already-running Personal are not
claimed absent or attributed to this task. The attempted mixed launch is disclosed
above separately from the earlier historical incidents.

## Completed continuation slice

Application/source repair `7efe92d5`:

- Build with both `dev-channel` and `src-tauri/tauri.dev.conf.json`.
- Generate the actual Tauri context once, report `tauri_identifier` through pure
  diagnostic flags, and reject a mismatch with the channel's OS identity before
  logs, settings, registry/plugin initialization or single-instance forwarding.
- Remove the partial Dev `app.windows` override (JSON array replacement discarded
  the base hidden/dark/geometry flags). Set only the Dev main-window title in the
  context, preserving every other base window option.
- Require all four preflight fields; missing, mixed, historical or duplicate
  diagnostic fields fail closed. The previous Dev executable was actually rejected
  by the new preflight with exit 1 (missing Tauri identifier).
- Use Tauri's real `target/debug/QuotalisDev.exe` output beside its resources.
  Require exactly one reported canonical output path, preventing an alternate
  Cargo target from certifying an older same-HEAD default-path binary. Retain a
  byte-identical copy at `target/dev-verified/QuotalisDev.exe` for hash evidence.
  This copy is **not** a runnable rollback package; launch the original output.
- Preserve Personal compatibility identifiers, all analytics semantics and logos.

Separate documentation repair `4b7869cd`: corrected Inno rollback paths, removed
the unsafe recursive-delete fallback, required preservation of post-promotion data,
and qualified the backup self-entry mismatch. No rollback commands were executed.

## Final tests / review

| Gate | Result |
| --- | --- |
| Frontend baseline (no frontend code changed) | 182 files / 1,094 passed |
| Final desktop Rust | 475 passed / 1 existing ignored / 0 failed |
| Final core Rust | 1,696 passed / 0 ignored / 0 failed |
| Final CLI Rust | 1 passed / 0 ignored / 0 failed |
| Doctests | 0 passed / 0 ignored / 0 failed |
| New Node preflight/output tests | 13 passed / 0 skipped / 0 failed |
| TypeScript + production build | PASS; existing bundle warnings retained |
| Locale parity | 1,459 keys match |
| Final workspace Clippy all-targets, warnings denied | PASS |
| Final Rust fmt / diff whitespace | PASS |
| Test skip/focus scan | No focused/skipped JS tests; one pre-existing real-history Rust ignore |
| Secret scan | Existing project scanner passed: 2,194 files |

A fresh read-only Astra/high reviewer requested two corrections: base window-array
inheritance and actual output-path validation. Both were fixed and re-reviewed:
**PASS with stated native/evidence limits**, 13 tests independently repeated.
Reviewer performed no desktop launches or Personal operations and was stopped
after completion. Root model effort was unavailable; coordinator registration
rejected `unknown`, so only this one bounded reviewer was used. No effort was
invented or changed.

## Native Dev proof and artifact provenance

Final build: `scripts/build-dev-verified.mjs`, source HEAD `4b7869cde37a`,
application code `7efe92d5`. Embedded `git_dirty=true`: only the requirement ledger
was a tracked dirty file at build time, with no uncommitted application code.
Later checkpoint/evidence commits are documentation only.

- Original output and proof-copy SHA256:
  `2ccfebdb5c0ad070b3b3d0bae0a58cc4b352c05ee1e58681dab24a42aa873157`.
- `channel=dev`, `exe=QuotalisDev.exe`, `app_dir_name=QuotaArc-Dev`,
  `tauri_identifier=app.quotalis.desktop.dev`; fresh HEAD check passed.
- Final native PID 6648 launched only after preflight, with a dedicated local
  WebView2 proof port 9444. Earlier corrected candidate PID 12084 also passed.
- CUA Driver captured the real Dev window; a screenshot-grounded native click on
  Tokens was verified by the actual resulting page. UIA exposed only a shallow
  tree, so page inspection/surface PNGs used that same native WebView2's CDP.
  A later deep UIA walk on Data Sources timed out; the driver's documented
  depth-1 retry succeeded and produced the final native window screenshot.
  No browser substitute, synthetic provider seed or generated UI image was used.
- Six-page smoke: Dashboard, Analytics Overview, Tokens, Models, Activity/Heatmap,
  Settings → Data Sources. Real Dev data, Demo off, original logos, dark main
  window, 1216 × 688 CSS viewport; no root horizontal overflow or visible error
  boundary. Slow Activity loading was allowed to settle before final capture.
- Historical evidence is now retained only under ignored
  `.local/historical-images-post-release/`: `DEV_DASHBOARD.png`,
  `DEV_ANALYTICS_OVERVIEW.png`, `DEV_TOKENS.png`, `DEV_MODELS.png`,
  `DEV_ACTIVITY.png`, `DEV_DATA_SOURCES.png`, `DEV_NATIVE_WINDOW.png`.
  The seven public copies were withdrawn in the screenshot privacy audit
  because they contain the earlier brand and real activity readings. This is a
  smoke baseline, not a repeat of the closed full Analytics QA matrix,
  not an end-to-end re-audit of token totals and not performance acceptance.
- Privacy presentation was temporarily enabled for screenshots; the saved Dev
  privacy/last-tab fields were restored and read back. No credential/account
  connection flow was invoked. Only our exact Dev PIDs were stopped for rebuilds.
  The final proof process was stopped after validation, closing its debugging port.

## Personal read-only outcome / remaining work

Installed Personal executable still hashes to the accepted `47d53743…` value.
The current shortcut length (1,483 bytes) and last-write time (06:20:46 local)
remain as initially observed. Neither shortcut nor installer/pin/registry metadata
was repaired or replaced. Already-running Personal remains outside Dev QA.
These observations do not establish byte-for-byte unchanged live settings/history;
normal runtime writes and possible activation from the rejected baseline attempt
are explicitly not ruled out.

Next priorities: a separately authorized Personal shortcut/Start identity repair;
then the existing deferred Claude warm-aggregation work or reset-editor completion,
chosen from a fresh bounded scope. Title/Activity help residue is cosmetic/copy work.
No release/version bump, new Personal promotion, broad rebrand, cloud, third-party
analytics integration, fictitious Sessions metric or quota-to-money conversion.

## Verdicts

| Requested verdict | Current outcome |
| --- | --- |
| REPOSITORY RECONCILIATION | PASS — exact starting HEAD and lineage established |
| LATEST VERSION RECEIVED | PASS — no rollback to accepted application candidate |
| PERSONAL BASELINE | NOT PASSED in full — binary PASS, current shortcut identity differs |
| DEV BASELINE | PASS after repair; original baseline launch failure retained above |
| SOURCE HEALTH | PASS |
| FIRST CONTINUATION SLICE | PASS — actual isolation repair, tests and native proof completed |
| PERSONAL | Accepted release binary unchanged; shell drift outstanding; no new promotion |

The handoff is not reported as an unconditional all-dimensions PASS. Development
continued through a real verified correction without rewriting historical acceptance.
Starting HEAD is above; ending source consists of `7efe92d5`, `4b7869cd` and the
documentation-only closeout commit containing this report (exact ending hash is
reported in the delivery message rather than embedding a self-referential hash).
