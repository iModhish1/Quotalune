# Native visual evidence — Quotalune release candidate

Date: 2026-09-26. This record supersedes the earlier
"ENVIRONMENT BLOCKED — native screenshot returned an all-black WebView2 image"
finding for the Quotalune release candidate.

## What changed

The earlier blockage was a **tooling-path failure, not an application defect**.
The desktop MCP tools were present but the router returned
`unsupported call` for every one of them, and the previously used capture path
produced an all-black image. The applications' own WebView2 content was never
actually proven broken.

The sanctioned Desktop Visual QA stack at
`C:\Users\imodhish\AI-Tools\Desktop-Visual-QA` was driven through its guarded
`scripts/mcp-client.mjs` adapter (the documented fallback for sessions that have
not discovered the global tools), connected with `{lazy:true}`. All physical
mouse and keyboard input remained disabled throughout; no tool that steals focus
or moves the real pointer was used.

## Build under test

Built with the project's own freshness-proof script, not a stale binary:

- `node scripts/build-dev-verified.mjs` -> PASS
- Source: `target/debug/QuotalisDev.exe`
- SHA-256: `3bb9c7a923f84234086a5e1d1c159bc8888e04fcd3d021a07e342b20761850f9`
- git HEAD (worktree): `cade8f12f217`
- git HEAD (embedded in binary): `cade8f12f217`
- channel: `dev`
- Tauri identifier: `app.quotalis.desktop.dev`
- app_dir_name: `QuotaArc-Dev`
- `scripts/dev-preflight.mjs` -> PASS

The worktree HEAD and the HEAD embedded in the binary are identical, so the
capture cannot be from a stale build.

## Launch

The Dev binary was launched under the guarded owned-job adapter and observed as:

- `process_id` / `window_handle` reported by the adapter
- `job_owned: true`
- `input_used: "none"`
- `sha256` matching the verified build exactly
- window title `Quotalune Settings`

## Personal installation was not touched

The owner's frozen Personal install (`Quotalis.exe`, PID 4396,
`%LOCALAPPDATA%\Programs\Quotalis\Quotalis.exe`) was running throughout. It was
only ever observed read-only via process listing. It was never launched,
closed, focused, screenshotted, or written to. The Dev build runs under its own
isolated identity (`channel=dev`, `app.quotalis.desktop.dev`, `QuotaArc-Dev`),
which is exactly the separation the Dev channel exists to provide.

## Captured evidence

- File: `docs/validation/evidence/PHASE_NATIVE_quotalune_settings_2026-09-26.png`
- Size: 1920x1200 PNG, 979,542 bytes
- SHA-256: `94829D67B4FF272A270F6F2BD2EABADD78FB307589ACFA5FCA56181C85E86A5D`

### Additional per-surface captures

The application's own Dev proof harness
(`CODEXBAR_PROOF_MODE=<surface>`, `CODEXBAR_SEED_PROVIDERS_JSON`) was used to
open specific surfaces at startup, so no activation or pointer input was
needed. Each capture was cropped to the application window rectangle so the
README gallery shows the product rather than the surrounding desktop.

| Surface | File | Size | Mean luminance | Variance |
| --- | --- | --- | --- | --- |
| Settings (default) | `PHASE_NATIVE_quotalune_settings_2026-09-26.png` | 1920x1200 | 32.9 | 1318.2 |
| Settings / menu bar | `PHASE_NATIVE_settings_menubar_2026-09-26.png` | 1846x1088 | 33.3 | 1347.0 |
| Settings / about | `PHASE_NATIVE_settings_about_2026-09-26.png` | 1846x1088 | 28.9 | 1270.3 |

Every capture has a luminance variance above 1200 across a sampled grid, so
none of them is a blank or all-black frame. The Settings window renders at
1846x1088 and the crop excludes neighbouring windows.

### Objective proof the image is not blank

A direct pixel analysis of the captured PNG (not a visual impression):

| Metric | Value |
| --- | --- |
| Sampled pixels | 1,440 (grid at 40px) |
| Mean luminance | 32.9 |
| Luminance variance | 1,318.2 |
| Distinct sampled colours | 429 |

A blank or all-black capture has a luminance variance of approximately zero.
This image has substantial variance and 429 distinct colours, so it contains
real rendered content.

### Content read back by the local vision model

The stack's own local vision model (`qwen2.5vl:7b` via Ollama) read the
capture and reported:

- application name **Quotalune**, window title **Quotalune Settings**
- a vertical menu with **Monitor**, **Workspace**, **Appearance** sections
- a **Themes** tab and a **Provider Display** tab
- a **Reset Display** button
- fields for **Provider presentation**, **Preview shape**, **Content**,
  **Fill direction**, **Preview state**
- an **Apply identity** button

This is the first real confirmation that the Quotalune brand is rendered by the
running application and that the WebView2 surface paints correctly.

## What is still NOT proven

This evidence closes the "does the app render at all" question. It does **not**
by itself complete the full native matrix the master goal asks for:

- The captured surfaces are all inside Settings. The Dashboard tray panel,
  Providers, Analytics, Appearance, Surface Studio, Tray Studio, background
  gallery, Light mode and Arabic/RTL surfaces each still need their own real
  capture.
- The seeded six-provider bundle renders into the tray panel, but that window
  was measured at a rectangle extending past the right edge of the 1920px
  screen and it was occluded by other foreground windows, so the seeded
  dashboard has **not** been captured cleanly yet.
- Tray icons, multi-tray lifecycle, tooltips, and Windows notification
  appearance have not been captured natively in this session.
- Installer upgrade and shortcut migration on a disposable Windows
  environment is still unproven.

Reaching the remaining surfaces through in-app navigation requires activating
controls, and every focus-stealing or pointer-moving tool is refused by the
adapter's background guard. No guard was bypassed. The productive path is to
extend the Dev proof harness with explicit startup targets for the remaining
surfaces, so each one can be opened and captured without any synthetic input.

### Gallery captures — 2026-09-26, second session

The user pause on the desktop QA adapter was lifted, so the remaining gallery
was captured. The build was refreshed first so the captures are provably from
current source rather than a stale binary:

- worktree HEAD == embedded HEAD == `12508667bef4`
- `QuotalisDev.exe` SHA-256 `2cd972ce61a0c53d2c41432e9d761f6a74363db2538ea7d420e93d65d24b0c80`
- `scripts/dev-preflight.mjs` PASS: `channel=dev`, `app.quotalis.desktop.dev`, `QuotaArc-Dev`

Each surface was opened by the application's own Dev proof harness
(`CODEXBAR_PROOF_MODE=settings:<tab>`), so **no synthetic input was used** —
one launch and one screenshot per surface, with no clicking, typing or pointer
movement. Each capture was then cropped to the application window rectangle
(8, 8, 1846x1088), which the adapter independently confirmed as the
`Quotalune Dev` window bounds, so no surrounding desktop is included and no
operating-system title bar is shown.

| Surface | File | Bytes | Luminance variance |
| --- | --- | --- | --- |
| Dashboard | `PHASE_NATIVE_dashboard_2026-09-26.png` | 994,045 | 619.4 |
| Analytics | `PHASE_NATIVE_analytics_2026-09-26.png` | 1,133,434 | 724.4 |
| Providers | `PHASE_NATIVE_providers_2026-09-26.png` | 730,764 | 878.6 |

All three carry variance far above the ~0 that a blank or all-black frame would
show, so each is real rendered content.

### What the adapter emergency stop blocked

Four further surfaces — Provider Display, Themes, Surfaces and Dashboard Studio
— were launched successfully but the capture was refused with:

```
"error": "Mouse in top-left corner", "error_type": "PilotEmergencyStop"
```

That is helix-pilot's own safety cutoff, which triggers when the physical
cursor rests in the screen's top-left corner. It is not an application fault:
the app was running and the adapter reported `ok` immediately afterwards. The
cursor was not moved, because doing so would require taking the user's physical
mouse, which the operating rules prohibit. Those four surfaces are therefore
recorded as not captured rather than claimed.

### Session boundary

Further native capture in this session stopped because the Desktop Visual QA
adapter reported `DESKTOP_QA_PAUSED: User has control`. Per the stack's rules a
user pause is never cleared, worked around, or retried automatically; only a
user Resume re-opens it. No pause file was touched and no paused action was
replayed. The Dev process was stopped, and the seeded provider data lived only
in an ephemeral Dev fixture file, never in Personal.

The seeded six-provider dashboard capture (`quotalune-dashboard-seeded.png`)
exists but is **not** published as evidence, because the tray-panel window was
occluded by other foreground windows and extended past the right screen edge,
so it does not honestly show the product.

## Verdict

NATIVE VISUAL (does the release candidate render): **PASS**

The previous all-black result was a tooling failure. The verified, freshness-
proven Quotalune Dev binary launches under its own identity, opens a real
window, paints its WebView2 content, and displays the Quotalune brand. The
Personal installation was never modified.

NATIVE VISUAL (full page-by-page matrix): **PARTIAL — three Settings surfaces
captured and verified; the remaining product surfaces still require their own
captures.**
