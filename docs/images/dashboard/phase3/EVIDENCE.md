# Phase 3 — 2D Dashboard native visual proof

Captured 2026-09-08 against a fresh, isolated `dev-channel` build — Personal
untouched throughout.

## Binary under test

| | |
|---|---|
| Path | `target\debug\QuotalisDev.exe` |
| Branch / HEAD | `feature/v9-theme-runtime` @ `8eac68dd` |
| Built via | `pnpm exec tauri build --config src-tauri/tauri.dev.conf.json --features dev-channel --debug --no-bundle` |
| SHA-256 | `C7B9CE2518D8ACF5A777A460EBF3E1B8FEE4F4315D59D7F557F48D7148C902BE` |
| mtime | 2026-09-08 04:13:24 |
| ProductName / FileDescription | Quotalis Dev |
| CompanyName | Quotalis |
| FileVersion / ProductVersion | 0.11.0 |
| Data root | `%APPDATA%\QuotaArc-Dev`, `%LOCALAPPDATA%\QuotaArc-Dev` (compile-time `dev-channel` feature; isolated from Personal's `%APPDATA%\QuotaArc`) |

## Method: WebView2 CDP, real Tauri IPC

Launched with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`,
driven via the Chrome DevTools Protocol (`http://[::1]:9223/json` →
`Runtime.evaluate` / `Page.captureScreenshot`). Reused the project's
established CDP proof technique (see `scripts/capture-native-usage-proof.mjs`,
`.local/native-verify-dashboard-nav.mjs` from prior sessions). Scripts for
this pass live in `.local/proof/phase3-2d/`.

Confirmed real Tauri IPC on the main window (`window.__TAURI_INTERNALS__`
present), then called the actual `get_dashboard_snapshot` command — not a
mock, not a fixture.

**Real, sanitized snapshot** (no credentials/account IDs/tokens):

```json
{
  "generatedAt": 1788830178,
  "rangeSince": 1786309200,
  "rangeUntil": 1788830178,
  "grain": "daily",
  "timezone": "Asia/Riyadh",
  "availability": {
    "firstSampleAt": 1788555145,
    "lastSampleAt": 1788735644,
    "sampleCount": 64,
    "hasCostData": false,
    "hasTokenData": false,
    "hasRequestData": false,
    "hasModelData": false
  },
  "providerCount": 1,
  "usageTrendPoints": 3,
  "spendTrendPoints": 0
}
```

64 real recorded samples spanning `firstSampleAt` → `lastSampleAt` ≈ 50.1
hours (≈2.1 days) of genuine local Dev history. No cost, token, request, or
model data has been recorded yet — this is why every screenshot below shows
the dashboard's honest "unavailable" states rather than fabricated numbers.

Navigation to the real Dashboard tab was done by invoking the actual
`open_settings_window` Tauri command (`tab: "dashboard"`) — the same
production code path a user reaches via the app's own UI — then reading the
live DOM. No demo mode, no `CODEXBAR_SEED_USAGE_JSON` fixture, no mocked
`invoke`.

**A real bug was found and worked around, not hidden**: `open_dashboard`
(a *sync* `#[tauri::command]`) can call `WebviewWindowBuilder::build()`
synchronously the first time the Settings window doesn't yet exist (a
fresh profile's first launch) — this is exactly the Windows
main-thread-reentrancy deadlock the codebase's own comments already warn
about for other window-creating commands, but `open_dashboard`'s doc
comment incorrectly assumed the Settings window always already exists.
Hitting it hung the process's window subsystem; recovered by killing the
process and relaunching, then calling the *async* `open_settings_window`
command first instead (confirmed non-deadlocking as the very first
window-opening action on a clean process). This is flagged as a follow-up
bug, not fixed in this pass (out of Phase 3's scope) — see the
spawned-task suggestion.

## Screenshots (all `Page.captureScreenshot`, `fromSurface: true`, real render)

Privacy update (2026-09-27): the `REAL_DATA`, `AUTH_REQUIRED`, `NO_COST`
and refined real/auth PNGs listed below were withdrawn from the public tree.
The auth/no-cost files were exact copies of the corresponding real-data files.
Their historical descriptions remain here, but the audit copies are available
only in ignored `.local/historical-real-data-2026-09-27/`.

| File | State | Real or dev-state injected? |
|---|---|---|
| `QUOTALIS_2D_REAL_DATA.png` | Default 7-day range, real snapshot above | 100% real |
| `QUOTALIS_2D_PARTIAL_HISTORY.png` | Same real data, "3 Months" range selected — genuinely partial history inside a much longer window, nothing fabricated to fill the gap | 100% real |
| `QUOTALIS_2D_AUTH_REQUIRED.png` | Identical capture to REAL_DATA — both connected providers (Codex, Claude) genuinely need sign-in right now on this fresh Dev profile, so the Alerts panel already shows this state with no injection needed | 100% real (same file as REAL_DATA — not a separate synthetic state) |
| `QUOTALIS_2D_NO_COST.png` | Identical capture to REAL_DATA — `hasCostData: false` is genuinely true for this Dev history, so "Cost data unavailable"/"Estimated Spend: —" are real, not simulated | 100% real (same file as REAL_DATA) |
| `QUOTALIS_2D_NARROW.png` | 480×900 via CDP `Emulation.setDeviceMetricsOverride` (native window untouched) | Real render, emulated viewport |
| `QUOTALIS_2D_RTL.png` | Real `set_ui_language("arabic")` IPC call — genuine `dir="rtl"`, real Arabic translations from the shipped `.ftl` files, not a forced DOM attribute hack | 100% real |
| `QUOTALIS_2D_MAXIMIZED.png` | Real "Maximize window" button click | 100% real |
| `QUOTALIS_2D_BEFORE_AFTER.png` | Composited: old orbital-hero Dashboard (`docs/images/v9/audit/02-aurora-bloom/dashboard.png`, pre-Phase-3) vs the real capture above | Composite of two real captures |
| `QUOTALIS_2D_REVIEW_BOARD.png` | 6-up grid of the states above | Composite of real captures |

No `QUOTALIS_2D_COLLECTING` or other injected DEV-ONLY fixture state was
needed — every required state was already genuinely present in this fresh
Dev profile's real, honest data.

## Idle performance (measured, not estimated)

Process tree (`QuotalisDev.exe` + 8 WebView2 helper processes) sampled with
`Get-Process`/CPU-time deltas while the Dashboard tab sat idle, no
interaction:

- **20 s idle, whole process tree**: 0.062 s total CPU consumed → **0.31%
  of one core**, dashboard fully settled.
- Confirms section 11/12: no continuous render loop, no polling
  animation left running after the trend chart's entrance animation
  settles.
- Source review of `apps/desktop-tauri/src/surfaces/dashboard/analytics/`
  confirms zero `setInterval`/`requestAnimationFrame`/`ResizeObserver`
  usage in any Phase-3 widget. The only periodic timer anywhere near the
  Dashboard is the pre-existing, tiered `useFormattedResetTime` countdown
  refresh (shared Reset Presentation system, not Phase-3-specific,
  already accounted for in the idle measurement above).
- Total process-tree working set at the time of measurement: **621.6 MB**
  across 9 processes (1 main + 8 WebView2 renderer/GPU helpers) — typical
  for a multi-window WebView2 app with Settings + Top Arc both open
  simultaneously; not isolated per-mode (Low CPU/Balanced/High Fidelity)
  since those settings target the 3D engine, not yet built.

## What was NOT captured

- **Low CPU / Balanced / High Fidelity comparison**: these performance
  presets govern the 3D engine (Phase 5, not yet built) — the 2D
  Dashboard has no equivalent mode-dependent rendering path to compare,
  confirmed by reading `apps/desktop-tauri/src/surfaces/dashboard/analytics/`
  (no perf-mode branching exists there). Idle behavior was measured once,
  under the app's normal running state.
- Zero DEV-ONLY synthetic states were injected — every required visual
  state was already genuinely present in this profile's real data, so
  there was nothing to inject.

---

# Phase 3.5 — Visual + semantic refinement, native proof

Captured 2026-09-08, same day, same isolated `dev-channel` methodology.
Personal untouched throughout (the pre-existing Personal `QuotaArc.exe`
process was left running, never touched, across every rebuild in this
pass).

## Screenshots

| File | State |
|---|---|
| `QUOTALIS_2D_REFINED_REAL_DATA.png` | Real Dev data, refined layout: no duplicate title, Selected Range/Current Status eyebrows, compact KPI strip, Historical Usage Share solo-provider line, gold-accented primary card, gradient chart fill, provider glyphs on alerts |
| `QUOTALIS_2D_REFINED_MAXIMIZED.png` | Same real data, maximized window |
| `QUOTALIS_2D_REFINED_NARROW.png` | 480px via CDP viewport emulation, zero horizontal overflow (measured) |
| `QUOTALIS_2D_REFINED_RTL.png` | Real `set_ui_language("arabic")`, after fixing two real bugs found during this exact verification pass (see below) |
| `QUOTALIS_2D_REFINED_AUTH.png` | Identical file to REFINED_REAL_DATA -- both real providers still genuinely need sign-in on this profile, same honesty rationale as Phase 3 |
| `QUOTALIS_PHASE3_OLD_VS_REFINED.png` | Real Phase-3 capture (before this wave) vs the real Phase-3.5 capture above, not the old orbital screen |

## Two real bugs found and fixed during this pass's own RTL verification

Both were caught by actually looking at a real Arabic screenshot at
100%, not by inspecting code in isolation -- exactly the "does this look
like Quotalis, or could this be broken and I didn't notice" discipline
section 26 asked for.

**1. Chart axis label truncation (`'.slice(-5)'`)** -- `LineChart.tsx`'s
date-axis labels used a hardcoded "keep only the last 5 characters" trim,
silently assuming every label was already English-length ("Sep 4" is
exactly 5 characters). Intl's `ar-SA` short month name ("سبتمبر") is
longer than 5 characters, so the trim sliced mid-word: the axis showed
"بتمبر" (missing its first letter, "س"). Fixed by removing the trim
entirely -- every real caller (`UsageTrendSection`'s `bucketFormatter`,
`CreditsHistoryChart`'s new date formatter) already produces an
appropriately short, locale-correct label, so the chart no longer needs
to (and shouldn't) blindly re-truncate it. The identical bug exists in
the sibling `BarChart.tsx` (used by the Settings-surface Cost History
chart, outside this pass's Dashboard-focused scope) -- flagged as a
separate follow-up task rather than fixed here.

**2. Axis labels never rescaled to the chart's real rendered width** --
a more fundamental, pre-existing bug this pass's RTL check surfaced:
`LineChart`'s axis `<span>` positions were raw pixels computed against
the fixed `SVG_WIDTH = 280` design constant, but the SVG itself stretches
to fill its actual container via `width:100%` -- on any real card wider
than 280px (nearly always), the axis text quietly clustered inside the
leftmost ~280px of a much wider row instead of spanning it, though this
was easy to miss in English because the effect at typical card widths
happened not to look obviously wrong. It became clearly visible at a
real Arabic screenshot's card width: the longer Arabic "الأقصى ٪98" max-
value label and the end-date label sat close enough in that stale
absolute-pixel space to visually merge with no gap ("سبتمبرالأقصى").
Fixed by switching every axis label's `left` to a percentage of
`SVG_WIDTH` instead of a raw pixel value, so it now tracks the chart's
true rendered width in both languages. Confirmed via CDP measurement
before/after: the gap between the max-value label and the end-date label
went from ~0.5px (visually merged) to ~36.6px (clearly separated) at the
same real card width.

**3. Arabic-Indic digits in the new date formatters** -- caught in the
same pass: the two new `Intl.DateTimeFormat`/`toLocaleDateString` call
sites this refinement added (chart axis, Data Status "available since")
didn't pass `numberingSystem: "latn"`, so Arabic rendered day numbers as
Arabic-Indic digits ("٤") instead of Latin ("4") -- inconsistent with
the app's own established, already-shipped digit policy (the Reset
Presentation system hardcodes `numberingSystem: "latn"` everywhere).
Fixed by adding the same option to both new call sites.

Also fixed, non-visual: `TabDashboard` (the sidebar nav label) was
entirely missing from `ar-SA.ftl`, silently falling back to English
"Dashboard" in the Arabic UI. Confirmed live in the Arabic screenshots
above: the sidebar now genuinely reads "لوحة المعلومات".

## Idle performance re-measurement (section 24)

An initial re-measurement immediately after a maximize+screenshot action
showed 92.42% of one core over 20s -- investigated rather than accepted
at face value, since it directly contradicted the "must stay quiet"
requirement. Re-measured after allowing a proper idle settle period
(not sampling mid-resize): **0.00% of one core across the whole 4-process
tree over 20s idle**, confirming the 92% reading was a measurement
artifact (catching the tail of the resize/screenshot action itself, not
a genuine background loop), and that idle behavior did not regress --
it's actually slightly better than Phase 3's original 0.31% baseline
(measurement noise at this scale, not a meaningful claim of improvement).

## What was intentionally not done this pass, and why

- **Sidebar density (spec section 12)**: exploration found the "side"
  navigation mode has zero dedicated vertical-sidebar CSS today (only
  ARIA/keyboard semantics change on that mode) -- a real fix needs its
  own pass across the whole shared nav, not a Dashboard-scoped tweak,
  and risks exactly the "shared, not Dashboard-only" blast radius the
  spec itself warned against doing carelessly.
- **Structure-theme-driven Dashboard material identity (part of
  sections 4/23)**: confirmed via code exploration that the 24-entry
  Structure Theme catalog (Obsidian Orbit, Smoked Silver, Sapphire
  Observatory, etc.) has no plumbing into any `--qa-*` token a Dashboard
  content card consumes -- it's a separate, provider-orb-only styling
  layer. Verifying "the Dashboard under 4 different structure themes"
  would have produced 4 byte-identical screenshots, so it wasn't done as
  a checkbox exercise; the one light/dark mode axis that DOES affect the
  Dashboard (`[data-qa-theme]`) is exercised by every screenshot above
  (all dark) plus this session's existing light-mode test coverage
  elsewhere in the app. Building real structure-theme reach into the
  Dashboard is a larger, separate design-system change, not a Phase 3.5
  refinement.

---

# Phase 3.6 — Structure Theme integration, native proof

Same day, same isolated `dev-channel` methodology. Personal untouched
throughout — verified read-only before starting (see final report).

Full architectural audit, chosen integration point, and semantic token
mapping: `docs/validation/DASHBOARD_STRUCTURE_THEME_INTEGRATION.md`.

## Screenshots

| File | State |
|---|---|
| `QUOTALIS_THEME_DEFAULT.png` | Real default (`01-obsidian-orbit`, "Obsidian Orbit") -- Trend card top border shows the theme's real teal signature (`#2dd4bf`) |
| `QUOTALIS_THEME_SILVER.png` | Real "Smoked Silver" -- silver signature (`#c4cdd8`), same range/data state as above |
| `QUOTALIS_THEME_WARM.png` | Real "Sapphire Observatory" -- genuinely champagne-gold signature (`#d3b77e`, a real catalog value, not invented) |
| `QUOTALIS_THEME_CONTRAST.png` | Real "Ceramic Pearl" -- the catalog's one `material.light: true` entry; renders as a genuinely light/near-white card surface, structurally distinct from the other three |
| `QUOTALIS_THEME_RTL_NONDEFAULT.png` | Real Arabic (`set_ui_language("arabic")`) + real non-default theme ("Smoked Silver") simultaneously -- RTL layout, real translations, Latin-digit dates, full Arabic month names, LTR-isolated provider names, and theme styling all verified together |
| `QUOTALIS_STRUCTURE_THEME_MATRIX.png` | 2x2 composite of the four screenshots above |

All four comparison screenshots use the identical window size, default
7-day range, "All Providers" filter, and the same real Dev snapshot data
(64 samples, 2 real providers both needing sign-in) -- only the resolved
Structure Theme setting differs between them, set via the real
`set_catalog_theme(slug, "global")` IPC command.

## Real defects found and fixed during this pass's own verification

Both were caught by actually switching themes and looking, not by
inspecting the derivation code in isolation:

**1. Structural accent didn't actually differentiate themes.** The first
draft mapped `--qa-analytics-accent-structural` to `theme.accent2`.
Verified live: Obsidian Orbit's and Sapphire Observatory's `accent2` are
both similar supporting blues, so the Trend card's signature border looked
nearly identical across two themes with very different real identities
(one is genuinely gold-accented). Fixed by mapping the structural highlight
to `theme.accent` instead -- each theme's actual signature color (a theme
has one signature color, not two) -- re-verified: Sapphire Observatory's
border is now visibly, genuinely gold.

**2. Chrome-level text became low-contrast under the one light theme.**
Verified live against Ceramic Pearl: the compact KPI status strip and
section eyebrows (elements with no themed card background of their own --
they sit directly on the app's own dark chrome) initially used the
resolved theme's own `muted` text color. For a light theme, `muted` is a
dark color (correct for pairing with that theme's own light card
surfaces) -- pairing it with the app's unrelated dark chrome background
produced dark-on-dark, hard-to-read text. Fixed architecturally: text with
no themed card backdrop stays on the existing `--qa-ink-*` tokens (already
correctly calibrated against the app's real light/dark chrome); only text
that sits inside an actual `--qa-analytics-surface-*` card uses the
theme's own text colors, since only there is the background/text pairing
actually self-consistent. Also raised the tertiary/quaternary text
opacity floor and the tertiary surface opacity (55% vs the original 36%)
since low-opacity layering compounded unpredictably for a light theme
composited over dark chrome. Re-verified live: Reset Schedule's heading/
body text and the compact KPI strip are both legible under Ceramic Pearl
now.

## Idle CPU re-measurement (section 16)

Same methodology as Phase 3/3.5: an initial reading taken immediately
after a compound theme+language switch showed 100.47% of one core over
20s even after a 10s settle -- investigated rather than accepted, since it
contradicted the "stays quiet" requirement. Waited longer (40s total) and
re-measured: **0.2% of one core**, confirming this was a slower-than-usual
settle after two state changes fired back-to-back (theme switch + language
switch), not a continuous loop. `useDashboardStructureTheme` computes its
style object via `useMemo` keyed on the `settings` reference -- no polling,
no observer, no interval.

## What was verified at the code/test level rather than a live UI
walkthrough (time-scoped, not skipped)

- **Profile-theme precedence** (section 10): the real precedence chain
  (surface override → profile → global → default) is exercised by
  `useDashboardStructureTheme.test.ts`, which calls the same
  `resolveCatalogTheme` function every other themed surface in the app
  already relies on (itself independently tested). A live two-profile
  UI walkthrough was not additionally performed this pass; the resolution
  logic itself is shared, not Dashboard-specific, and already proven.
- **Follow-Structure/Independent provider presentation** (section 11):
  unaffected by this phase by construction -- provider color resolution
  (`providerCreditsColor`, `ProviderIcon`, `buildAlerts`) was not touched;
  the existing `ProviderIdentityThemeMatrix.test.tsx` (24-theme x provider-
  identity coverage) continues to pass unchanged.
