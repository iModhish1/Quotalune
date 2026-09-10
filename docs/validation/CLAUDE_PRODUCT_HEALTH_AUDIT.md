# Claude product health audit — 2026-09-10

Scope note, stated up front rather than buried: the owner's request covers an
enormous surface (every page, every control system, notification toast
visual proof, 250k-row performance reproduction, full RTL/accessibility
sweep, security review). This pass did a **real, native, evidence-backed
spot-check** of the highest-priority items (Dev safety, the explicitly
flagged Product V3 blockers, Dashboard/Analytics/Providers) and found and
fixed one real, reproducible defect. It did **not** exhaustively re-verify
every one of the ~70 surfaces the request enumerates in one sitting — that
is explicitly out of scope for a single pass and is called out per-item
below as `NOT RE-VERIFIED THIS PASS` rather than silently assumed fine.

## Method

Real native Dev builds via `pnpm exec tauri build --config
src-tauri/tauri.dev.conf.json --features dev-channel --debug --no-bundle`,
gated by `node scripts/dev-preflight.mjs` before every launch (see
`CLAUDE_HANDOFF_RECONCILIATION.md` §9), driven via CDP
(`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`) using
the real Tauri IPC bridge (`window.__TAURI_INTERNALS__.invoke`), not mocks.
Screenshots captured via `Page.captureScreenshot`. Demo Mode (Connected
Showcase, 6 curated providers) used for rich visual states; real data
(disabling Demo) used to cross-check provider count/plan/status.

## Findings this pass

### Dashboard Overview — PASS (spot-checked)
Real native capture: "Limits now" (paginated provider quota cards with a
gauge, %, reset countdown), "Needs action" (high-usage/reset-soon triage),
"Reset horizon" (bucketed `<1h / 1-6h / 6-12h / 12-24h / ≥24h` timeline with
provider glyphs). This matches the owner's stated priority ("how much have I
used, what's left, when does it reset, who needs attention") directly and
keeps deep diagnostics out of the default view, consistent with the
requested Overview/Analytics separation. Cosmic background (a static
starfield/planet image, not photographic-glossy, not animated) sits behind
the content at low enough contrast that every card/text/number stayed fully
legible in the capture — no readability regression observed.

### Analytics — NEEDS REFINEMENT → one defect FIXED this pass
**Real defect found, root-caused, and fixed** (see the `fix:` commit
`03d55556`): the "Trend intelligence" chart's high-fidelity peak-value
marker used ECharts' literal `{c}%` template instead of this codebase's own
shared rounding formatter, rendering a raw unrounded float directly to the
UI ("41.88331035648%") overlapping the correctly-formatted mean-line label
next to it. Root cause: `chartSpec.ts`'s per-point label and the mean
markLine both route through `ctx.number(...)` (`Intl.NumberFormat` with
`maximumFractionDigits:1`); the peak `markPoint` alone did not. This path
only activates when `dashboardPerformancePreset` is `highFidelity`, which is
almost certainly why no prior test caught it. Fixed, tested (new regression
test asserting the formatter is a function and produces `"15.9%"` not the
raw float), and re-verified natively — the label now reads `41.9%` cleanly.

**Residual, lower-severity, NOT fixed this pass**: the fixed peak-marker
label and the line series' own last-point label now render the *same*
correct value stacked at the same position (a visible double-weight
character rather than a wrong one) — a real but cosmetic follow-up, not a
correctness bug. Flagged for a future pass rather than fixed blind under
time pressure in this same commit.

The rest of the Analytics page (KPI row, Provider usage matrix with a
per-day/per-provider status-dot legend, tab structure: Overview/Usage
trends/Local activity/Resets/Providers/History/Data quality) rendered
correctly in this spot-check. The deeper correctness audit the owner asked
for (double-counting, reset-boundary errors, timezone/DST, provider-filter
leakage, stale-snapshot reuse — §20 of the request) was **NOT exhaustively
re-run this pass** — it requires constructing adversarial fixtures per bug
class, which is real, multi-hour work beyond what this single pass covered.

### Providers page — PASS (spot-checked, both Demo and real data)
Real (non-Demo) capture: **68 real registered providers**, independently
re-confirmed via a fresh `get_bootstrap_state` IPC call (not read from a
stale doc) — matches the Product V3 report's own count exactly. Filter tabs
(`All providers 68 / Enabled 2 / Reporting 1 / Needs attention 1 / Disabled
66`) reflect real state. Codex showed its real plan badge (`ChatGPT Pro`),
real last-updated timestamp, and — critically — an honest primary action:
`Switch account...` (not a fake `Sign in`) because it's already connected;
Claude correctly showed `Sign in required`. This directly satisfies the
owner's "do not fake auth" requirement (§36 of the request) for the one
provider pair spot-checked. The full 70-item provider-rail/auth-capability
matrix (every capability type, device-flow timeout/cancel fixtures,
Copilot's public-vs-private device code) was **NOT re-verified this pass**.

### Dev-channel safety — PASS, closed a real gap
See `CLAUDE_HANDOFF_RECONCILIATION.md` §9 in full. Summary: added a
provable, side-effect-free `--print-channel` diagnostic and a checked-in
`scripts/dev-preflight.mjs` gate; proved it against both a genuine Dev
binary (PASS) and a binary reproducing the exact original incident's shape
(a non-`dev-channel` build literally renamed to `QuotalisDev.exe` — REFUSED,
as required).

### Personal incident — re-confirmed closed, not compounded
Read-only re-check (§8 of the reconciliation doc): Personal's config-root
write timestamps stop exactly at the already-disclosed incident window
(`00:59:01Z` / `00:59:08Z`, matching the incident report's local-time claim
converted to UTC precisely) and the executable itself was never
overwritten. No further mutation occurred, including during this session.

### Notification toast visual/click proof — `NOT RE-VERIFIED THIS PASS`
Explicitly flagged as open by Product V3's own report. Requires triggering
a real Dev notification and capturing the actual rendered Windows toast
(not just its registered XML) — a distinct, non-trivial proof exercise this
pass did not attempt given the time already spent on higher-priority items
(Dev safety, forensic reconciliation, the Analytics defect). Remains open.

### 250k-row history performance — `NOT REPRODUCED THIS PASS`
Product V3's own measurement stands as the last real evidence (Worker
round-trip median 1820.9ms at 250k points, documented as unmet). Not
independently reproduced this pass.

### Everything else the request enumerates (RTL sweep, narrow/maximized
matrix, accessibility audit, controls-system unification audit, ECharts
lifecycle re-verification, security review, notification deep-link
re-test, settings multi-window race re-test, etc.)
`NOT RE-VERIFIED THIS PASS.` These are real, legitimate asks — they are
each their own multi-hour verification exercise, and claiming to have done
all of them in this single pass would violate the same "evidence before
claims" standard this audit is trying to model. They remain open,
prioritized, for a follow-up pass.

## Severity summary (this pass only)

| Severity | Found | Fixed | Notes |
|---|---|---|---|
| P0 | 0 new | — | Dev-isolation gap (process-safety adjacent) closed — see above |
| P1 | 0 new | — | none newly found this pass |
| P2 | 1 | 1 | Analytics peak-marker raw-float label (fixed, tested, natively verified) |
| P3 | 1 | 0 | Residual double-label overlap after the P2 fix (cosmetic, documented, not fixed) |

No P0 (data loss, Personal contamination, credential leakage, incorrect
monetary semantics, crash/corruption) or P1 (broken auth, wrong analytics
value, dead action, major UI break) defect was found in the surfaces this
pass actually exercised. This is not a claim that none exist elsewhere in
the ~70% of the request's scope this pass didn't reach.
