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
