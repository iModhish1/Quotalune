# Claude continuation validation — 2026-09-10

> **Update (same day, continuation wave):** ending HEAD for this document
> was `db13b224`. The owner then requested a further continuation wave
> ("QUOTALIS — CLAUDE CONTINUATION WAVE"), starting from that exact
> reconciled HEAD (confirmed identical via `git rev-parse HEAD`, no
> discrepancy — `db13b224` is simply the child commit of `03d55556`, both
> real). That wave added two more commits:
> `84c23e07` (fixed the residual chart duplicate-label overlap flagged
> below — see its own commit message for the full story, including a
> regression this fix initially introduced and caught via native
> re-test before landing) and `84f4c247` (real native notification toast
> validation — found and precisely root-caused a genuine "QuotaArc Dev"
> vs "Quotalis" branding defect via Windows' own
> `UserNotificationListener` API; see
> `docs/validation/CLAUDE_NOTIFICATION_VALIDATION.md`). **New ending HEAD:
> `84f4c247`.** The continuation wave's own further-requested scope (Waves
> B–G: 250k-history performance, deep analytics correctness bug-hunt,
> controls/settings/RTL/accessibility audit, systematic visual-quality
> audit, provider/auth re-audit, security review, all-pages consistency)
> was **not attempted** in the time available — each is real, substantial,
> multi-hour work in its own right, and is left explicitly open rather
> than given a rushed, shallow pass. A follow-up session should pick up
> directly at Wave B.
>
> **Second update (same day):** the owner explicitly required continuing
> past Wave A without stopping to ask. This pass: (1) **closed Wave A**
> properly — built and installed a real, isolated Quotalis Dev NSIS
> installer (current-user mode, a location fully distinct from Personal)
> specifically to test the officially-supported Start-Menu-shortcut fix
> for the stale "QuotaArc Dev" notification display name; the shortcut
> did **not** fix it, disproving the previous pass's "missing shortcut"
> hypothesis and proving this is a genuine Windows AUMID-identity-cache
> limitation, not an unattempted fix (test install fully removed
> afterward). (2) **Wave B**: re-measured the 250k-history backend
> pipeline with a real per-layer breakdown (SQLite read vs. Rust
> aggregate, no regression vs. the historical figure), found and
> documented that the actual IPC contract already only ever sends
> aggregated data (70-280 rows, never raw 250k) — the architecture concern
> in the request's own text does not apply to the real pipeline; added 7
> new adversarial regression tests for `aggregate_quota_history`'s
> defensive input-rejection paths (NaN/Infinite/>100%/negative/
> inconsistent-sum/out-of-order/missing-window-identity), all passing
> against the existing, unmodified production code; and ran a real
> 20-round concurrent alternating-write settings race test across two
> genuinely separate live windows (main + detached Settings), confirming
> no lost writes and correct persistence across a full Dev restart.
> Commits: `84c23e07`, `84f4c247`, `e13a1fc3` (from the first
> continuation), then `3d717a7a` (Wave A closure), `47530702` (250k
> breakdown), `2a4364b3` (adversarial tests). **New ending HEAD:
> `2a4364b3`.** Waves C-G (controls system audit, systematic visual
> quality audit with screenshots, providers/auth re-audit, security
> review, full RTL/accessibility/responsive re-verification, final native
> evidence matrix) were **not reached** this pass — each remains
> real, substantial, multi-hour work in its own right.

Final checkpoint for this session. Read this first if continuing the
project without the pasted Codex conversation — combined with
`CLAUDE_HANDOFF_RECONCILIATION.md` (forensic state proof) and
`CLAUDE_PRODUCT_HEALTH_AUDIT.md` (what was/wasn't re-verified), this
document is meant to be self-sufficient.

## Authoritative starting/ending state

- Repository: `N:\QuotaArc\quotaarc`, branch `feature/v9-theme-runtime`.
- Starting HEAD: `e94567f9` (independently proven identical to current HEAD
  at session start, not merely an ancestor — see reconciliation doc §2).
- Ending HEAD: `03d55556`.
- Commits this session:
  - `442db9b8` — `fix: enforce Quotalis Dev isolation with a provable preflight gate`
  - `03d55556` — `fix: format the high-fidelity trend chart's peak marker through the shared rounding formatter`
  - (this commit) — `docs: record Claude continuation validation`
- Working tree: clean before every commit; no destructive git operations
  were performed at any point (no `reset --hard`, no `clean`, no force
  checkout, no branch/worktree deletion) — both pre-existing worktrees and
  all branches remain exactly as found.

## Issues found / fixed / open

- **Fixed**: no provable way to verify a compiled binary's Dev-isolation
  from outside a real launch (the exact root cause of the Product V3
  Personal-channel incident). Closed with a new `--print-channel`
  diagnostic + `scripts/dev-preflight.mjs`, proven against both a real Dev
  binary and a reproduction of the original incident's exact shape.
- **Fixed**: Analytics "Trend intelligence" chart's peak-value marker
  rendered a raw unrounded float (`41.88331035648%`) instead of the shared
  1-decimal formatter every other label in the same chart uses, only
  reproducible with `dashboardPerformancePreset: highFidelity`. Root-caused
  to one literal ECharts `{c}%` template left in `chartSpec.ts`; fixed,
  regression-tested, and re-verified against a fresh native build.
- **Open, explicitly not attempted this pass** (see
  `CLAUDE_PRODUCT_HEALTH_AUDIT.md` for the full list): notification toast
  visual/click proof, 250k-row performance reproduction, full RTL/
  accessibility/responsive sweep, controls-system unification audit,
  security review, deep analytics-correctness bug hunt (double-counting,
  timezone/DST, reset-boundary errors), and the residual cosmetic
  double-label overlap left by the chart fix above.

## Visual evidence (this session)

`.local/proof/claude-audit/` (scratch, not committed — gitignored, ephemeral
per this project's established convention): `01-dashboard-overview.png`,
`02-providers-page.png` (Demo), `03-providers-real.png` (real data, 68
providers), `05-analytics-page.png` (defect visible), `08-analytics-clean.png`
(defect fixed, native re-capture), `chart-zoom2.png` (zoomed proof of the
raw-float defect before the fix).

## Test evidence (exact counts, this session's final run)

- Frontend: **173 files / 1047 tests passing** (`pnpm vitest run`).
- `tsc --noEmit`: clean.
- Production build: succeeds; main chunk 511.24 kB / analytics-engine chunk
  648.19 kB gzip 219.73 kB (pre-existing size-warning, unrelated to this
  session's changes, not newly introduced).
- Locale parity: **1357 keys** match between Rust and TypeScript
  (`check-locale-drift.mjs`).
- `cargo test --workspace`: desktop **473 passed, 1 pre-existing ignored**;
  `quotalis_core` **1643 passed**; CLI (`quotalis`) **1 passed**; doctests
  **0**. Exact match with the last recorded baseline — no drop.
- `cargo clippy --workspace --all-targets -- -D warnings`: clean.
- `cargo fmt --all -- --check`: clean.
- `node scripts/scan-secrets.mjs`: clean, **1955 files** scanned.
- Skip/focus scan (`.skip(`/`.only(` in test files): 0 matches.
- `git diff --check`: clean.

## Personal status

Read-only forensic re-check performed (no launch, no write). Personal's
executable (`QuotaArc.exe` v0.10.1) was last modified 2026-09-06, before the
incident window, and was never touched this session. Personal's config-root
files stop being modified exactly at the already-disclosed incident
timestamp (`00:59:01Z`/`00:59:08Z`) with nothing after it — the incident is
real, already fully disclosed in `PRODUCT_V3_CHANNEL_INCIDENT.md`, and was
**not compounded** by this session. `QuotaArc.exe` (Personal) is not
currently running. No rollback was attempted (none is proven safe, per the
incident doc's own conclusion, unchanged this session).

## Release readiness

**Not release-ready.** Product V3's own verdict (NOT PASSED, failed
Personal-channel condition) stands; this session closed the *mechanism*
that allowed that incident (the isolation gap) but did not and cannot
retroactively clear the incident itself. No release, install, or promotion
action was taken or is recommended.

## Hard pass matrix

| # | Area | Verdict |
|---|---|---|
| A | Handoff reconciliation | **PASS** — proven via Git ancestry, not inference; see reconciliation doc |
| B | Dev channel safety | **PASS** — provable preflight gate added and proven both directions |
| C | Product correctness | **NOT FULLY VERIFIED** — spot-checked surfaces (Dashboard, Providers, Analytics) showed correct behavior; ~70% of the requested surface area was not re-audited this pass |
| D | Analytics correctness | **NOT FULLY VERIFIED** — one real defect found and fixed; the deep bug-hunt (double-counting, timezone/DST, boundary errors) was not run |
| E | Provider / auth UX | **NOT FULLY VERIFIED** — one real provider pair (Codex/Claude) spot-checked and looked honest/correct; the full capability-matrix/device-flow fixture suite was not re-run |
| F | Notification branding | **NOT VERIFIED THIS PASS** — visual toast/click proof remains exactly as open as Product V3 left it |
| G | Visual quality | **NOT FULLY VERIFIED** — Dashboard/Analytics/Providers looked genuinely mature in this spot-check, one real visual defect found and fixed; no systematic per-page design review was performed |
| H | Performance | **NOT VERIFIED THIS PASS** — 250k-history reproduction not attempted |
| I | RTL / responsive / accessibility | **NOT VERIFIED THIS PASS** — no native re-check performed |
| J | Personal safety | **INCIDENT (disclosed, not compounded)** — see above; not "PASS" (the incident is real and stands), not "NOT PROVABLE" (this session proved exactly what did and didn't happen) |
| K | Overall continuation readiness | **READY** — the repository state is fully reconciled and explained, Dev-isolation is now provably enforced, and every open item is explicitly enumerated rather than hidden; a follow-up session can proceed directly into the still-open items listed in `CLAUDE_PRODUCT_HEALTH_AUDIT.md` without needing this session's own transcript |

## Settings multi-window race + persistence (updated this pass)

Real 20-round test: two genuinely separate live windows (the main window
and a detached Settings window, confirmed as distinct CDP targets/URLs)
fired concurrent (`Promise.all`, not sequentially-awaited)
`update_settings` calls each round, alternating which window wrote
`workspacePreferences.density` vs. `dashboardPerformancePreset` and
cycling through all valid values of each. After 20 rounds, both windows'
`get_settings_snapshot` agreed exactly with the last round's intended
values (`density: "comfortable"`, `dashboardPerformancePreset:
"balanced"`), and the unrelated `enabledProviders` array was untouched
(stayed at its original length throughout). Dev was then fully restarted
(process killed, preflight re-verified, relaunched) and the same values
were confirmed to have persisted to disk correctly. **No lost writes, no
stale overwrite, no unrelated-field corruption** — the existing
`SETTINGS_PATCH_LOCK` mutex-serialized patch-transaction design works as
intended under real concurrent multi-window load.

Note: an earlier attempt in this same pass used a `catalogTheme` field in
the patch and found it silently had no effect — traced this to a real API
fact, not a bug: `SettingsUpdate` (the actual Tauri command's patch
struct) has no `catalog_theme`/`catalogTheme` field at all; the global
Structure Theme is set through a different, dedicated command this pass
did not identify. Recorded here so a future pass doesn't repeat the same
false lead.

## Updated hard pass matrix (this continuation pass)

| Area | Verdict |
|---|---|
| DEV SAFETY | **PASS** — preflight gate proven both directions again this pass |
| NOTIFICATIONS | **NOT PASSED (ENVIRONMENT/PLATFORM-BLOCKED for display name)** — the supported fix (Start Menu shortcut via a real installed build) was tried and proven insufficient; not an unattempted gap |
| ANALYTICS | **PARTIAL** — 250k backend performance re-measured with a real layer breakdown and no regression; a real architectural finding closes the "raw 250k to UI" concern; 7 new adversarial input-rejection tests added and passing; the full adversarial corpus (DST/timezone-change/mixed-currency edge cases beyond what already existed, cross-surface consistency) was not completed |
| CONTROLS & SETTINGS | **PARTIAL** — settings multi-window race + restart-persistence proven clean this pass; the controls-system inventory/consolidation audit was not started |
| PERFORMANCE | **PARTIAL** — real backend breakdown done; frontend-side layers, interaction timings, idle CPU/memory not measured this pass |
| VISUAL QUALITY / PROVIDERS-AUTH / RTL-RESPONSIVE-A11Y / SECURITY | **NOT REACHED THIS PASS** — Waves D-F of the request; each is its own substantial undertaking |
| PERSONAL | **INCIDENT — NOT COMPOUNDED** — re-confirmed; no Personal process was run at any point this pass |
| OVERALL CONTINUATION READINESS | **NOT READY for release; READY to continue** — real, verified progress on Waves A and B; C-G remain open and are the correct next steps for a follow-up pass |
