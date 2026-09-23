# Master Goal execution — current checkpoint

The active objective is the owner's MASTER GOAL MODE EXECUTION and historical-wave appendix, supplied under attachment `30973175-78a8-4ab2-b7e5-1981bd967849`. This document tracks the whole objective, not just the latest passing packet. It does not replace `tasks/MASTER_REQUIREMENTS.md`.

## Gates and sequence

| Phase | Required outcome | Current evidence and next action |
|---|---|---|
| A — reconciliation | Preserve inherited work and establish actual source state | Preserved Claude's dirty Wave 3 implementation from `d066226d9edb`; integrated in `881d675d`, `2b21f848`, `7533a844`. No reset or history rewrite. |
| B — provider onboarding | Derived capability model, working supported onboarding, protected credentials, cancellation and isolated QA | All 70 provider method rows modeled; simulated login transport, cancellation and evidence-propagation repairs tested. Remaining closure includes full provider-specific reporting/scenario coverage. See `WAVE3_IMPLEMENTATION_REPORT.md`. Live-account acceptance is distinct from fixture coverage. |
| C — product completion | Backgrounds, navigation, studios, page consistency, responsive/accessibility/performance | OPEN. Audit current implementations against the product-completion sections of the master request; do not replace finished systems gratuitously or drop older owner requirements. |
| D — native closure | Fresh Dev Windows evidence for Waves 1–4 | ENVIRONMENT BLOCKED historically; no new native PASS. Do not retry prohibited capture/CDP/UIA routes without actual new capability. Continue independent code work. |
| E — security and OSS | Cross-wave privacy, dependencies, licenses and rollback | OPEN. Wave 3 focused checks are not a whole-product audit. |
| F — final RC and GitHub preparation | Exact source/build identity, packaging, public presentation and canonical CI | OPEN. Existing published v0.11.0 is immutable. Final release version and remote state require reconciliation. |
| G — publication | Every required code, native, security, OSS and CI gate passes | CLOSED. No publication or Personal promotion from a partial/native-blocked state. |
| Historical appendix | Every ledger wave explicitly reconciled and cross-wave regression tested | PARTIAL. Both matrices exist; all three historical ledgers were read and indexed. Full cross-wave acceptance is still open. Historical PASS prose alone is not fresh evidence. |

## Verified checkpoint before the next packet

`7533a844012a38d38c3fe4839af272b6c9ba5283`, clean worktree, canonical `node scripts/build-dev-verified.mjs` succeeded. Embedded HEAD `7533a844012a`; source and proof-copy SHA256 `52c03acc355074fe48ace5718b43c803e5459988408be3c7d78d4eaf1061ce63`. Channel `dev`, identifier `app.quotalis.desktop.dev`, data identity `QuotaArc-Dev`. Local log `.local/wave3-final-build.log` and report `.local/wave3-final-report.md` retain exact evidence. This is a historical checkpoint once source changes again; never use its binary as proof for later edits.

At that checkpoint: frontend 1557 tests / 227 files, desktop 555 passed / one existing real-history test ignored, core 1858, CLI one, doctests zero. Clippy, formatting, TypeScript, production build, locale parity (1960 keys), secret scan and diff checks passed. Counts are observations, not acceptance targets.

## Previous packet — simulated sign-in

Close the Dev sign-in simulation gap using the existing production login command and request-scoped phase events. Preserve the real transport branch; a fixture must select an in-memory transport before any credential/browser/process/network access. Simulated device codes must be unmistakable and non-actionable. Exercise pending cancellation, retry, timeout, failure and success without accessing owner accounts.

An adjacent source defect was found in `ProviderLoginChallengeNotice`: raw clipboard/browser errors were rendered verbatim. Replace them with localized generic errors and restrict actionable verification to the implemented GitHub device endpoint. Focused regression coverage must prove this.

The packet passed focused and full tests after review repairs: frontend 1564/228 files, desktop 561/one existing ignored, core 1858, CLI one. Exact logs are in WAVE3_IMPLEMENTATION_REPORT.md. Next: audit remaining capability reporting claims against adapter evidence and complete the per-provider scenario/refresh stress coverage before deciding Wave 3 Code PASS. Do not label native, live-auth, performance or release acceptance from component tests.

## Persistent boundaries

- Personal installation, accounts, settings, history and compatibility identifiers remain untouched.
- No WebGL/Three.js, video backgrounds, cloud credential relay or fabricated financial/usage metrics.
- No weakening safety or test gates to finish Goal mode.
- Any final native blocker prevents publication; it does not excuse unfinished independent code work.
- Goal remains ACTIVE until full requirement-by-requirement completion or the strict external-blocker threshold is met.

## Current packet — reporting evidence and unknown quota

Static capability schema 2 no longer turns legacy optimistic flags into reset/cost promises. The connection result inspects the verified response, includes model-specific/secondary/extra rows, validates reset timestamps and uses the existing monetary classifier. A monetary type is shown only when classified; no amount or price is inferred.

Independent review exposed preexisting OpenRouter spend-only rows and Antigravity unknown quota being counted as known percentages. The adapters and bridge now preserve their informational status; known zero remains valid. Antigravity empty responses no longer create a known-zero primary. Regression evidence includes a failing pre-repair OpenRouter test and actual snapshot-to-bridge-to-verification coverage. A full-suite cancellation-test startup failure was corrected by measuring cancellation latency separately from the two executable loads; production cancellation behavior was not changed.

Latest automated checkpoint: frontend 1568 tests / 228 files; desktop 564 passed / one existing ignored; core 1860 passed; CLI one; doctests zero. TypeScript and production build passed. Full Rust suite includes locale and matrix-drift checks. Remaining final static checks and post-commit Dev provenance are recorded in WAVE3_IMPLEMENTATION_REPORT.md/local build logs after completion. These checks are not native or live-provider acceptance.

`CROSS_WAVE_REGRESSION_MATRIX.md` now tracks all 22 mandatory appendix interactions plus the observed adapter/bridge defect. All broader interactions remain explicitly PARTIAL until their complete evidence exists. All three historical ledgers have now been read completely. `ALL_WAVES_RECONCILIATION_MATRIX.md` indexes their families, distinct phases and revisions against current implementation/test anchors, with explicit acceptance gaps. It does not label broad historical requirements PASS from old prose or aggregate test counts.

## Next repair — selected method and credential cancellation

Read-only review of clean `04776618` found three concrete defects: Copilot's API-key/CLI paths were misclassified from the ambiguous `oauth` source label (CLI could also consume a legacy key); Grok's explicit API-key response was misclassified as CLI; key saving and browser import did not linearize protected-store writes with accepted cancellation. Cancellation is repaired in `b5cae384`. Browser-offer inspection also excluded unsupported Web methods for Codex/Gemini/Kiro/Antigravity in `a61b6cab`, preserving LongCat's real Web path.

The current provenance repair distinguishes manually entered keys and device-flow acquisitions in optional protected token metadata, preserves unknown legacy origin, honors Copilot's explicit CLI versus owned-token selection, and labels Grok's supplied bearer as an API key. CLI and desktop share manual acquisition; CLI selection retains active/named account provenance and refuses absent explicit-account fallback. Two review findings in CLI propagation were repaired and independently re-reviewed. Full automated results: frontend1568/228; desktop569+1existingignored; core1868; CLI1; doctests0. Final static checks and fresh post-commit Dev identity are recorded in the wave report/local logs. No live credentials or native interactions occurred.

The next packet removes Copilot's raw `Command::new("gh").output()` reader. Both adapter entry points now use the curated executable resolver and shared supervised process capture asynchronously. Secret stdout stays in memory, outside sanitized diagnostic/IPC output; failed, oversized, invalid-UTF-8 or incomplete reads fail closed. A dropped provider future signals cancellation to the blocking supervisor. Focused tests exercise successful capture, actual process startup before cancellation/timeout, overflow and unexpected read failure. Exact gate results and Dev build provenance follow in the wave report/local logs.

Next: complete remaining provider-specific source/capability/scenario and stress coverage before Wave 3 Code PASS, followed by Product Completion. Do not mistake the provenance repair, bounded subprocess repair or historical matrix inventory for full product closure.

## Local-source and registry checkpoint — 2026-09-22

Cursor local selection now preserves source identity and transport errors without browser fallback. Newly verified local connections persist cli/off, excluding unrelated stored credentials/account UUIDs from refresh. Existing auto/off selections require re-verification; no migration or owner-profile access occurred. Independent review's error-classification finding was repaired and re-reviewed. Automated gates: desktop570+1existingignored, core1878, CLI1, frontend1639/229, full Clippy. Registry component tests cover all70 entries but use mocked IPC and do not prove live adapters. See WAVE3_IMPLEMENTATION_REPORT.md for exact scope, logs and rollback. Amp/Alibaba/Mistral method-truth findings remain next; whole Wave3/Product/Native/Security/Release objective stays ACTIVE and release CLOSED.
## Cookie-method and unknown-quota checkpoint — 2026-09-22

Alibaba/Mistral now offer their implemented browser-session methods without false API-key offers; existing protected cookies and Mistral multi-account support remain intact. Alibaba parsing preserves unknown quota and missing plan/currency-independent reset evidence. Review exposed and closed two shared defects: informational usage could produce a pace/reserve and could lower an Average metric. Regressions fail before repair and pass through the actual bridge/presentation after repair. Full Rust: desktop573+1existingignored, core1883, CLI1; frontend1639/229 post-matrix update; full Clippy/fmt/diff/4259-file secret scan pass. Independent re-review closed both findings. See WAVE3_IMPLEMENTATION_REPORT.md for exact evidence and historical Dev binary provenance. Next: Mistral missing billing evidence/fake quota/plan, Amp source repair, Doubao read-only verification; credential-scope history isolation is a separate newly verified audit item. Goal ACTIVE; native deferred and release CLOSED.

## Mistral reporting checkpoint — 2026-09-23

Source commit `894fa357` removes missing-evidence billing defaults and fictional quota/plan/reset fields while preserving independently observed token/billing details. A fresh review found and closed a nested-category completeness gap with a failing regression. Final offline gates: desktop574+1existingignored, core1893, CLI1, full Clippy/fmt/diff and 4261-file secret scan. Frontend unchanged from1639/229. The complete parser fixture is synthetic; live private-schema compatibility remains unverified. No credentials, data migrations or native app used. Last Dev binary predates this change. Next: bind Mistral's actual managed-cookie fetch to a local unresolved history lane, propagate spend scope and prevent alias double-counting; then remaining Amp/Doubao source fixes. Full Goal ACTIVE, native deferred, release CLOSED.

## Billing attribution integration checkpoint — 2026-09-23

Commits c2b6e06e (scope propagation and alias-safe totals), 628486a6 (bounded/private Mistral responses) and 84392111 (real lazy-page test setup) are integrated. Independent scope review findings and the usage-chart recovery are closed. Final offline gates: frontend1649/230; desktop580+1existingignored, core1900, CLI1, doctests0; TypeScript, production build, 1966-key locale parity, Clippy and formatting pass. Secret scan4262files clean; no new focused/skipped tests. Logs: .local/wave3-scope-integrated-{front,tsc,build,rust,clippy,secrets}.log. PopOut focused recovery18/18 proves the actual dashboard renders after cold transformation outside its interaction deadline. Vite still reports existing large chunks; this is not native/performance acceptance.

No real credentials, Personal data, live provider calls or native UI were used. Remaining: Amp source/credential truth and Doubao read-only verification, broader Wave3/product/native/security/OSS/release gates. Publication remains CLOSED. The goal tool currently reports PAUSED although the user explicitly resumed work; manual work continues under that request, without claiming the tool's status was changed. Canonical Dev build provenance follows in .local/wave3-scope-dev-build.log; until successful, the prior binary is historical.
