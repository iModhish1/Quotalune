# Quotalis 0.11.0 publication evidence — internal

Date: 2026-09-14. This report is excluded from the public source export.
Public README/release copy follows the owner's features-first instruction.

## Source and artifacts

- Owner/repository: iModhish1/Quotalis, verified against authenticated GitHub actor.
- Public runtime tag: v0.11.0, c1902e9a3df6c8c11eab2a2afae64cf03e5271bd.
- Subsequent main change dde6b26 changes only ThemeStructureMatrix.test.tsx;
  runtime, dependencies and installer source are identical to the release tag.
- Original private history, task ledger, internal QA reports, user settings and
  credentials are excluded. All 1294 exported files matched original source.
- Stable GUI build reports version 0.11.0, git_head=c1902e9a3df6,
  git_dirty=false, channel=stable. GUI SHA256:
  e1de008b3ab74784b7241b1ad6b7660ce079351105f0770322e448ed0b4672cf.
- Installer built using Inno Setup; included Microsoft prerequisites have valid
  Microsoft signatures. Separate console CLI and GUI PE subsystems verified.
- SHA256 manifests and GitHub uploaded asset sizes/digests match all four files.
  Final readback evidence: .local/publication/verified-release-assets.json.

## Checks performed

- Frontend: 1251 passed across 202 files on final public checkout. Increase from
  1204 reflects splitting one 48-combination-group matrix into 48 named cases;
  the theme/form/anchor/expanded Cartesian coverage and assertions are unchanged.
- Rust workspace: core 1774, desktop 504, CLI 1 passed; desktop retains one
  existing ignored Personal-only test; zero doc tests. Total Rust passes 2279.
- Typecheck, production frontend build, stable desktop build, locale parity
  (1694 keys), workspace formatting and Clippy with warnings denied passed.
- Hosted Windows Rust formatting, both crate Clippy checks and both crate test
  steps passed on c1902e9 (run 34784863088, Rust job success). Final hosted
  frontend locale/build/test job passed on dde6b26 (run 34785592902). That run's
  repeated Rust job was still in progress at publication; the only changed file
  is the frontend matrix test, and no Rust gate was omitted on the runtime tag.
- Windows clean checkout golden-fixture CRLF mismatch fixed with explicit LF
  attribute. Verified through a fresh checkout with core.autocrlf=true.
- CI's monolithic theme matrix exceeded 70 seconds; split by identity/view,
  preserving all render assertions with a bounded 15-second budget per case.
  Focused run: 48 passed; full frontend run above passed.
- GitHub mutation guard tests pass for actor/repo/tag binding, new-repo creation
  and draft URL handling. No writes to upstream.
- Custom export secret scan passed. Gitleaks history scan returned ten findings,
  individually reviewed as synthetic fixtures/UI key names, not exit-code zero.
  No actual credential confirmed; do not describe this as a zero-findings scan.

## Native evidence and scope

Native Dev notification center and planetary Demo dashboard were inspected via
guarded background UIA/PrintWindow. Full-width center and Demo read controls were
verified; screenshot/provenance details live in PRODUCT06_NOTIFICATION_CENTER.md.
Demo exited and owned native process stopped in cleanup. Physical user input,
Personal application and unrelated user work were not touched.

Installer packaging and executable structure are verified; installation/uninstall
on an isolated fresh Windows VM was not executed. Native pixels predate the final
stale-filter callback and wording repairs; those repairs have regression tests.
No claim of all original product requirements or all host/OS combinations passing.
Other notification producers/granular subscriptions and the complete feature QA
matrix remain tracked internally in tasks/MASTER_REQUIREMENTS.md.

## Publication status

Published 2026-09-13 22:07:57 UTC (2026-09-14 01:07:57 Riyadh), stable and latest:
https://github.com/iModhish1/Quotalis/releases/tag/v0.11.0

Public source: https://github.com/iModhish1/Quotalis
Main: dde6b2622b2c290c09d78dd8c91dbaf14429f6eb; release runtime tag unchanged.
Post-publication readback verifies draft=false, prerelease=false, exact tag/hash,
all four final asset sizes/SHA256 values, and anonymous HTTP 200 for every public
download. Final record: .local/publication/published-release.json.

Independent read-only reviewer accepted test-matrix coverage, runtime equality,
feature notes and independently recomputed artifact hashes. Reviewer stopped
after completion. No native QA session or owned application was left running.

This completes source/release publication and the public-copy request; it does
not mark the broader product/QA backlog complete.
