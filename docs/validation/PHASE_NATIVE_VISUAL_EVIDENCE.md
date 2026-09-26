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

- Only the Settings surface was captured. The Dashboard, Providers, Analytics,
  Appearance, Surface Studio, Tray Studio, background gallery, Light mode and
  Arabic/RTL surfaces each still need their own real capture.
- Tray icons, multi-tray lifecycle, tooltips, and Windows notification
  appearance have not been captured natively in this session.
- Installer upgrade and shortcut migration on a disposable Windows
  environment is still unproven.

Page-to-page navigation inside the app requires activating controls, and every
focus-stealing or pointer-moving tool is refused by the adapter's background
guard. Reaching the remaining surfaces needs either an app-owned route argument
or a fresh, specific user approval for that one action. No guard was bypassed.

## Verdict

NATIVE VISUAL (does the release candidate render): **PASS**

The previous all-black result was a tooling failure. The verified, freshness-
proven Quotalune Dev binary launches under its own identity, opens a real
window, paints its WebView2 content, and displays the Quotalune brand. The
Personal installation was never modified.

NATIVE VISUAL (full page-by-page matrix): **PARTIAL — remaining surfaces
require per-surface captures that are not yet recorded.**