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
the app was running and the adapter reported `ok` immediately afterwards.

The alternate capture engine was then tried. `windows-mcp` exposes its own
`Screenshot` tool, which does not monitor the cursor at all, so it should not be
subject to that cutoff — but it is refused by the stack's background-only
guard, which classifies it alongside the input-capable tools:

```
BACKGROUND_ONLY: This tool can move the real pointer, steal focus, type
globally, or run unrestricted actions.
```

So both capture routes are closed to this session for reasons that are
deliberate safety behaviour rather than application faults:

| Engine | Blocked by | Can it be cleared without input? |
| --- | --- | --- |
| helix-pilot `screenshot` | `PilotEmergencyStop` — physical cursor in the top-left corner | No. Only the user moving their mouse clears it; no tool or config exposes a reset |
| windows-mcp `Screenshot` | background-only input guard | No, by design |

The cursor was not moved and no guard was bypassed, because doing either would
mean taking the user's physical mouse or defeating a safety control. Those four
surfaces were therefore recorded as not captured rather than claimed.

### Those four surfaces were subsequently captured — 2026-09-26

The emergency stop later cleared on its own, because the cursor was moved
outside the corner by the user rather than by any agent. The four surfaces
were then captured with the same method as the rest of the gallery: one
`CODEXBAR_PROOF_MODE=settings:<tab>` launch and one screenshot each, with no
synthetic input.

| Surface | File | Bytes | Luminance variance |
| --- | --- | --- | --- |
| Provider Display | `PHASE_NATIVE_provider_display_2026-09-26.png` | 1,418,856 | 1296.0 |
| Themes | `PHASE_NATIVE_themes_2026-09-26.png` | 1,439,588 | 1230.6 |
| Surfaces | `PHASE_NATIVE_surfaces_2026-09-26.png` | 1,170,374 | 746.2 |
| Dashboard Studio | `PHASE_NATIVE_dashboard_studio_2026-09-26.png` | 1,164,120 | 669.5 |

The display scale had changed to 250% by this point, so the Settings window
rendered full-screen at 3072x1944 device pixels; the crop rect was scaled
into image coordinates rather than reused from the earlier 150% session.

The local vision model read the Themes surface back as application "Quotalune
Dev", window title "QUOTALUNE Appearance", with Themes / Provider Display /
Reset Display tabs and the workspace background categories (All, Static,
Animated, My backgrounds) — confirming the captures show the product and not
incidental desktop content.

The gallery now holds ten verified captures, and every README image path was
checked to resolve to a tracked file.

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

### Light mode and Arabic/RTL — attempted, not captured

Both were attempted and **both are recorded as not captured**. The reason is
worth stating precisely, because the first attempt produced a plausible-looking
image that was wrong.

The Dev channel's `settings.json` is not plain JSON. It is a DPAPI-protected
envelope written by `secure_file::write_string_atomic`, which passes the
serialised JSON through `protected_file_bytes` and stores the ciphertext as
`payload`. The file on disk reads:

```json
{
  "format": "codexbar.secure-file",
  "version": 1,
  "protection": "windows-dpapi-user",
  "payload": "AQAAANCMnd8BFdERj..."
}
```

So writing `theme` or `ui_language` at the top level cannot work: the app
decrypts the `payload`, not the visible keys, found nothing usable, and
persisted the defaults back. The attempt was reverted from a backup taken
first, and only the Dev-isolated file was ever touched; Personal settings were
not read or written.

A capture taken after that write looked superficially fine but was **not
Light**: its mean luminance was 26.1 against 28.0 for a known-dark capture,
i.e. no brighter than dark. Publishing it would have been a mislabelled
screenshot, so it was discarded rather than used.

There is no CLI surface for `theme` or `ui_language`. The only writer is
the Tauri command `update_settings` in `commands/settings.rs`, reachable only
from the application's own settings UI.

The background UIA route was then tested directly rather than assumed. The
adapter's `desktop_qa_background_control` inspect path works and returns a
real, populated control tree for the running WebView2 window — 83 Text, 56
Button, 31 Group, 14 Pane, 7 ListItem and others, including addressable
controls such as `Silver` / `Arctic` / `Aurora` (Buttons), `Compact` /
`Balanced` / `Prominent` (Buttons) and `All` / `Static backgrounds` /
`Animated backgrounds` (Buttons).

So the UIA ceiling is narrower than an earlier note suggested, and that earlier
note was corrected for the same reason.

The `invoke` mechanism itself works, so this is not a UIA-accessibility
ceiling. Invoking the `Color Mode` ListItem succeeded via
`LegacyIAccessible.DoDefaultAction` with no pointer movement, which shows
background activation is available in general.

The contrast inside that same panel identifies the obstacle. Every native
control on the Appearance page is exposed as an invokable `Button`:
`Silver`, `Arctic`, `Aurora`, `Ember` and `Violet` for logo finish;
`Compact`, `Balanced` and `Prominent` for logo prominence; and `All`,
`Static backgrounds`, `Animated backgrounds`, `My backgrounds` and
`Add from device`. The colour-mode selector alone exposes no Buttons and
renders only its current value, `Auto (system)`, as `Text`. `Light` and
`Dark` appear solely inside the helper prose "Light and Dark override it".
Re-inspecting after invoking the section does not change this.

That earlier reading was wrong, and it is retracted. Reading the source
settled it: the colour-mode control is a `Select` in `GeneralTab.tsx`
rendering `QuotalisSelect`, which is correctly built. The trigger is a real
`<button>` carrying `aria-haspopup="listbox"` and `aria-expanded`, and the
panel renders `role="listbox"` with each option as a
`<button role="option">` carrying `aria-selected`.

The options are absent from the UIA tree simply because the dropdown was
closed, which is correct ARIA behaviour rather than a defect: the panel is
rendered only while open, and the trigger is invokable. Invoking the `Themes`
sub-tab succeeded through `InvokePattern`, confirming background activation
works on this surface.

There is therefore no accessibility defect in this control, and the earlier
commit in this session claiming one is withdrawn. The practical consequence
is that the Light and Arabic/RTL captures need the dropdown to be open, which
is a pointer-driven interaction the desktop guard refuses. The setting is
reachable and correctly implemented; it is the capture that is unavailable.

Every sanctioned route has now been tested rather than assumed: the protected
settings envelope, the absence of a CLI writer, and the UIA tree. All three
close the same way, on requiring the application's own settings UI, which needs
the activation and click input the desktop guard correctly refuses. Theme
preference and language are left at their defaults and no Light or Arabic/RTL
image is published.

### Note on background activation (2026-09-26, later session)

Background activation works on this surface. Invoking the `Themes` sub-tab
succeeded through the adapter's `InvokePattern` with no pointer movement, and
invoking the `Color Mode` ListItem succeeded through
`LegacyIAccessible.DoDefaultAction`. The `Select` trigger is also a real
`<button>` with `aria-haspopup="listbox"`.

The one control the trigger could not be reached by name is the colour-mode
`Select`, whose accessible name `Theme` also matches the field's `Text` label
and helper copy, so the adapter's "match exactly once" rule rejects the
ambiguous selector. Resolving it by screen point is possible in principle, but
the point tool expects window-image-relative coordinates and the device-pixel
rectangles reported here are in a different space under 250% DPI, so a
reliable point could not be derived. The control was not forced.

This does not change the conclusion: the colour-mode and language selectors are
correctly implemented, and capturing Light or Arabic requires the dropdown to
be open, which is the pointer-driven step the desktop guard refuses.

### Native correction — 2026-09-26

A later inspection found the running Dev window already configured for Arabic
and Light mode. The background UIA tree exposed Arabic dashboard controls, and
the Desktop Visual QA orchestrator captured and verified both the dashboard
(`2026-09-26T08-46-37-quotalune-dev-arabic-rtl-current-window-`) and Settings
(`2026-09-26T08-48-18-quotalune-dev-arabic-settings-visual-cap`). These are
local QA artifacts, not public screenshots: the dashboard includes real usage
and plan data. The earlier statement that Arabic/RTL and Light could not be
captured is superseded for this observed Dev process. These captures do not
prove every page or the final release binary.

The Settings capture exposed English fallback text in the Arabic General
section, including the startup destination and refresh controls. The missing
Arabic locale entries were added in the source after the capture. Locale tests
and key parity passed; a native capture from a rebuilt binary is still needed
to verify those new strings visually.

### Rebuilt Dev verification — 2026-09-26

`node scripts/build-dev-verified.mjs` produced `QuotalisDev.exe` from
`f1d758cfdcd9` with SHA-256
`a8a9026cdf8739561fcda3127efde418b8b570beecc7c1e4460ffe8f1caeb9e9`.
Its embedded HEAD matched the worktree, and `dev-preflight` confirmed the Dev
channel, `app.quotalis.desktop.dev`, and `QuotaArc-Dev` data root. The guarded
desktop adapter launched it with `--tray`, captured the Arabic compact dashboard,
then invoked its Settings control and captured the Settings window in Light/RTL.
The General controls in that fresh capture now display Arabic startup and
refresh text. Local QA evidence:

- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T09-23-09-quotalune-fresh-dev-dashboard-real\s01-after.png`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T09-26-23-quotalune-fresh-dev-settings-visual\s04-after.png`

The dashboard image contains live provider usage; it remains local and is not
part of the public README. This capture verifies the rebuilt General section,
not the remaining untranslated Arabic settings pages or every app control.
