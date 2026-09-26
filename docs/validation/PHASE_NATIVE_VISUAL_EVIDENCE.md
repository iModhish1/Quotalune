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

### Advanced settings Arabic verification — 2026-09-26

The Dev-only build from `197b85131463` passed `build-dev-verified.mjs` with
matching source/proof SHA-256
`2973bdb0b41f8cf53810373f4c3608631f981add8036b87df84a0b1ae6f691c2`.
The guarded Desktop Visual QA orchestrator launched this binary with `--tray`,
opened Settings through its UIA button, selected the Arabic «متقدم» item and
verified both «تسجيل» and «مسح» shortcut buttons. All five steps passed.
The final screenshot was inspected visually: the shortcut controls, proxy
fields, Codex log notice and agent-session controls are legible in Arabic and
the right-side RTL navigation remains visible. Evidence stays local:

- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T10-25-03-quotalune-arabic-shortcut-controls-197b8\s05-after.png`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T10-25-03-quotalune-arabic-shortcut-controls-197b8\summary.md`

The QA adapter was stopped afterward. This is visual verification of the
Advanced page's visible state, not an exhaustive native interaction pass or a
test of the production installer. At that checkpoint, Display and Usage & Spend
translations had source-backed tests but no native captures; the Usage & Spend
capture below closes only its visible initial state.

### Usage & Spend Arabic capture — 2026-09-26

The first native Usage & Spend capture from `197b8513` exposed an inconsistent
navigation label («الاستخدام والتكلفة»), English eyebrow/status text and `7d`/
`30d` buttons in the Arabic window. These were corrected in `be094b6f`.
`build-dev-verified.mjs` proved a fresh Dev-only binary with matching embedded
HEAD and SHA-256
`b379c11dc6e3b6e3eb2d53cf322081f01618fd63aea258628829eb22cfc82836`.
The guarded orchestrator opened Settings and the «الاستخدام والإنفاق» page;
five of five steps passed, including UIA verification of «رؤى الحصص»,
«بيانات محلية» and the «7 أيام» period button. The final screenshot was
visually inspected. Evidence remains local:

- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T10-35-59-quotalune-arabic-spend-labels-be094b6f\s05-after.png`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T10-35-59-quotalune-arabic-spend-labels-be094b6f\summary.md`

At 3.5 seconds after navigation the page was still scanning, so this capture
does not establish the final data or empty state, export correctness or scan
latency. The image is not suitable for the public project because the Dev app
uses local account data. The adapter was stopped after the run.

### About and Providers RTL inspection — 2026-09-26

`build-dev-verified.mjs` produced a fresh Dev binary from `64b779ea2eff`,
embedded HEAD matched, and source/proof SHA-256 was
`b714cde906c6cda073c2ff317d33bdadf916ac8c9f9dc6975ee7265e9cc44225`.
Two guarded native scenarios (five steps each) opened About and Providers in
the Arabic Light-mode window. The inspected About image shows «الإصدار» on
the version badge and Arabic update controls; the product, OS and license
names remain proper names. The Providers image confirms RTL layout and the
68-provider catalog but exposes English fallback inside nested detail widgets
(for example the account-switch button, quick actions and Pace card). A static
source scan found 158 distinct keys referenced in the Providers subtree that
lack Arabic values. These have not been translated or visually closed here.
Local-only evidence:

- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T11-02-46-quotalune-arabic-about-version-64b779ea\s05-after.png`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T11-03-55-quotalune-arabic-providers-64b779ea\s05-after.png`

Both adapters were stopped. The screenshots may contain local plan/usage data
and are not public release artwork. Native control interactions, provider
onboarding and installer behavior remain separate acceptance work.

### Providers Arabic detail follow-up — 2026-09-26

The 158 missing direct provider-detail keys were added in `7276e8ab`. The
`7276e8ab` native image showed their labels in Arabic but exposed further
fallback through state maps and canonical backend status text. Commit
`07517233` translated mapped pace/auth states, account switching and the
updated prefix. Commit `64ffac9a` localized only the known
`RateWindow::no_active_session()` description and the generic Session/Weekly
metadata labels; provider-authored descriptions remain untouched.

`build-dev-verified.mjs` verified a fresh Dev-isolated binary from
`64ffac9ac3ed`, SHA-256
`a3381470d6f21a2facaa1c97ccb55597bebd6533c56a9511ca426823dbf6bd1c`.
The guarded native scenario passed five of five steps and its final Arabic
Providers screenshot was inspected: «تبديل الحساب», «متأخر قليلًا»,
«الجلسة» and «لا توجد جلسة نشطة لخمس ساعات» are visible. Evidence is local:

- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T11-28-03-quotalune-arabic-session-final-64ffac9a\s05-after.png`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T11-28-03-quotalune-arabic-session-final-64ffac9a\summary.md`

This verifies one visible provider/detail state, not every provider, tab,
connection method, theme or Demo state. The image still contains intentionally
untranslated provider/plan/source proper names and a truncated Claude sidebar
subtitle at this window width. The screenshot is private because the Dev view
contains local plan and usage data. The adapter was stopped after the run.

Commit `33b21339` also localized the provider subtitle's elapsed-time unit
through `Intl.RelativeTimeFormat` while retaining the existing English compact
format. A second fresh Dev build embedded `33b213395785` with SHA-256
`ebcb25bb9ad4fe6b85cb37f2c2ee22581644981e00189ee6d8ab3c421bc697d0`.
Its five-step native scenario passed; the inspected screenshot shows
«آخر تحديث قبل 13 ثانية» where the prior capture showed `13s`. The UIA
adapter was stopped. Private evidence:

- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T11-38-25-quotalune-arabic-provider-age-33b21339\s05-after.png`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T11-38-25-quotalune-arabic-provider-age-33b21339\summary.md`

### Analytics source names and header contrast — 2026-09-26

The first Dev Analytics/Overview capture from `33b21339` exposed five English
source names from the structured Rust registry and an English freshness value.
It also showed white page-header text against a bright nebula region. The
`894dcbae` source-label adapter now maps the registry's five stable IDs to
localized presentation names in both Analytics Overview and Settings → Data
Sources, without changing the registry's scope, capabilities or availability.
Arabic relative-update strings were added. `df018353` gave the page header an
opaque analytics surface for readable text over any background.

`build-dev-verified.mjs` verified a fresh Dev-isolated binary from
`df018353afc2`, SHA-256
`aa70866dc2e79325b203236203439f66ac904a4b30c3797036ffe3a51244224d`.
The guarded five-step native scenario passed and its screenshot was visually
inspected: source names and freshness are Arabic, and the header/title/help
now sit on a dark surface. Evidence remains local because the Dev app shows
real availability/history data:

- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T11-56-30-quotalune-analytics-contrast-df018353\s05-after.png`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T11-56-30-quotalune-analytics-contrast-df018353\summary.md`

This single view does not establish visual quality or functional correctness
for all Analytics tabs, ranges, Demo states, backgrounds, themes or window
sizes. The adapter was stopped after the run.

### Analytics tab navigation and coverage dates — 2026-09-26

Two read-only guarded Dev scenarios navigated the Arabic Analytics tabs for
Tokens, Models, Reset Horizon, Activity, Monetary, History and Data Quality.
All 15 scenario steps passed. The inspected images show source-backed token
and model panels, an honest empty Monetary state, and quota-history/data-
quality disclosures. They also exposed English month names in Data Quality:
the quota coverage/history formatters were borrowing the reset-presentation
locale even when the UI language was Arabic. Commit `3028dc32` changed only
those analytics date formatters to the UI language, preserving the configured
timezone and the original observation timestamps.

`build-dev-verified.mjs` verified a fresh Dev-only binary from `3028dc325747`,
SHA-256 `23bd042b69d4b573498a08cd7ede8d48f9332cc0d8bbecbd0fe784792ed67c1d`.
A final five-step native scenario passed; its image shows Arabic-locale
numeric dates in Data Quality where the prior image showed English `Sep`.
The visible 70/71 sample count varied as real local observations continued;
the screenshots are not metric fixtures. Local-only evidence:

- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T12-00-05-quotalune-analytics-tabs-visual-audit-b4\summary.md`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T12-03-27-quotalune-analytics-more-tabs-b421a028\summary.md`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T12-11-22-quotalune-arabic-coverage-dates-3028dc32\s05-after.png`

These navigation checks do not prove the correctness of every chart value,
every filter/range, hidden disclosures, Demo fixtures or narrow layouts. The
adapter was stopped after each run; none of these images are public artwork.

### Analytics tab contrast — 2026-09-26

The Data Quality screenshot above also showed transparent Analytics tabs over
bright nebula art. `ProductV3.css` now puts the existing Structure Theme's
opaque analytics surface behind the tab row and keeps selected-state color
inside that surface. The change affects the tab chrome only; it does not alter
analytics data, navigation, or the user's chosen background.

The production frontend build and TypeScript check passed. A fresh Dev-only
binary was verified by `build-dev-verified.mjs` with SHA-256
`9cdeadbc82cc9411dabdf1438328dcc12a6c4e560063b334ffd60d4594f4f299`;
its source and embedded HEAD both reported `0277e230d9cb (dirty)`, matching
the then-uncommitted CSS change. The guarded four-step native scenario passed
and the screenshot was visually inspected: Arabic tab labels and the current
tab remain readable against the bright background. The adapter was stopped.
This is one theme, locale and window size, not a theme-matrix acceptance.

- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T12-25-20-quotalune-native-analytics-tab-contrast-\s04-after.png`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T12-25-20-quotalune-native-analytics-tab-contrast-\summary.md`

### Main-page scan and Arabic Collections controls — 2026-09-26

A guarded native scan visited Dashboard and Usage & Spend, then stopped at
Notifications because its UIA name includes the dynamic unread count. The
fallback vision request exceeded the local model's context limit; this was an
adapter selector failure, not evidence of an app crash. A second scan used
the stable `settings-tab-*` automation IDs and passed all nine steps through
Notifications, Providers, Profiles, Collections, Appearance and Settings.
The screenshots were visually inspected. Settings is an expandable navigation
parent; invoking it from Appearance left the child page visible, as designed.

The Collections screenshot exposed English editor/view/action/preview labels
in an Arabic UI. `CollectionsStudio` now reads these labels from locale keys,
including accessible names and status text. Locale parity reached 2027 keys;
focused frontend tests, TypeScript and 22 locale tests passed. A fresh
Dev-isolated binary from the then-dirty `35c8b062590a` tree had SHA-256
`6e259d82b050e86273cddbc191aae3bf1ce91bfc79f9b5461966ddc0b6184e9b`.
Its four-step native Collections scenario passed, and the inspected screenshot
shows Arabic view, field, action, save and preview labels. The adapter was
stopped after each run. Local-only evidence:

- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T12-28-21-quotalune-native-six-main-pages-20260926\summary.md`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T12-30-44-quotalune-native-stable-main-pages-20260\summary.md`
- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T12-39-42-quotalune-arabic-collections-controls-20\s04-after.png`

Navigation and screenshot inspection do not prove every control, save path,
provider connection, theme, keyboard flow or detached Collections window.

The same screenshot showed the editor help and save-status text too pale on
the white theme. A scoped CSS rule now uses the existing secondary-ink token.
The fresh Dev build after this one-rule change passed preflight/freshness
(SHA-256 `0f848d00fbe9513b4f5efcd1fc30f2198a6b7ffae4e036761b0259a456aec0e4`).
The guarded four-step Collections scenario passed and the inspected image
shows darker, readable help and status text. It remains a single-theme visual
check, not a measured contrast ratio across the full theme matrix:

- `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T12-48-29-quotalune-collections-help-contrast-2026\s04-after.png`

The detached Collections renderer was also audited in source. It now reuses
the editor's translated provider/detail labels, localizes its own live,
loading and empty states, and substitutes a generic localized error for raw
layout/settings error text that could include local paths. A focused failure
test supplies a private-looking path and proves it is absent from the rendered
alert. The detached native window itself has not yet been visually exercised;
this extension is supported by component tests and locale parity only.
The integrated offline gate after this extension passed frontend 1670/1670
across 232 files, Rust desktop 586 passed/1 pre-existing ignored, core 1945,
CLI 1, toast-resource tests 2 and doctests 0. TypeScript, production build,
strict workspace Clippy, formatting, 2032-key locale parity, 4796-file secret
scan and diff checks passed. The native binary/screenshot above predates this
detached-window-only extension; no detached-window pixel claim is made.

The editor's failed-save alert was then given the same boundary: it keeps the
unsaved draft and offers a localized retry instruction, without rendering a
raw persistence exception. A focused test injects a private-looking path and
proves it is absent from the alert. No real save was attempted in native QA.

### Demo Studio accessibility and contrast — 2026-09-26

The Arabic Dashboard Studio in a Dev-isolated, freshly verified native build
exposed a real readability defect: its Demo description sat directly over the
bright galaxy background. The Demo section now uses the existing raised
surface and ink theme tokens. Its provider-count stepper's accessible names
and custom-provider search placeholder are localized instead of English-only.

The guarded native scenario opened Dashboard Studio, turned Demo Mode on,
verified the localized stepper control appeared, then restored Demo Mode to
off; all six steps passed. The after-fix screenshot was inspected and shows
the description on a readable white surface. The Dev binary after the fix
passed freshness/preflight with SHA-256
`40de1d944c29cb1a6c9fef69c058ace13749e69dd6f04b7258eda7521461419d`.
The focused frontend suite passed 13/13 tests, Rust locale tests 23/23, and
the verified build reported 2036 matching locale keys. These runs do not
exercise the Demo Dashboard's full scenario matrix or prove other themes.

- Before: `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T13-27-02-quotalune-dev-demo-toggle-restore-202609\s05-after.png`
- After: `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T13-31-05-quotalune-dev-demo-contrast-after-202609\s05-after.png`
- Verification: `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T13-31-05-quotalune-dev-demo-contrast-after-202609\summary.md`

### Demo Dashboard provider-label contrast — 2026-09-26

A separate guarded Dev run followed Settings → Dashboard Studio → enable
Demo → Dashboard → exit Demo. All seven steps passed, and the exit button
restored live mode. The before screenshot showed provider names and primary
quota values rendered dark on the dark provider rail in the light Settings
theme. The light-theme Settings-wide button rule was overriding the rail's
own text color. The scoped rail-node rule now retains the analytics text
token and selected/hover background in this theme. A newly verified Dev
binary (SHA-256
`3f3a58abaf71295f500f6c6dc47ce6fee687f9457cefdeffb2bf47e37fe8a5dc`)
passed the same seven-step scenario. The inspected screenshot shows readable
provider names and quota values for three visible simulated providers.
This is not a claim that every Demo scenario or theme is visually accepted.

- Before: `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T13-35-34-quotalune-dev-demo-dashboard-exit-202609\s06-after.png`
- After: `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T13-40-14-quotalune-dev-demo-provider-contrast-aft\s06-after.png`
- Verification: `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T13-40-14-quotalune-dev-demo-provider-contrast-aft\summary.md`

### Gemini credential location in Providers — 2026-09-26

A guarded Dev run opened Providers, filtered to Gemini and selected its
Connections & accounts tab. The first successful screenshot displayed an
absolute OAuth credential path with the Windows account directory. A source
fix substituted a home-relative path and replaced raw credential-action
errors with a localized generic message. A second screenshot showed the
relative path but also exposed right-to-left character reordering; a
left-to-right isolated span corrected this. The final six-step native run
passed, and its screenshot was inspected. The credential itself was neither
opened nor modified; these local screenshots must not be published.

- Before: `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T13-57-36-quotalune-dev-gemini-tabitem-inspect-202\s06-after.png`
- Final: `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T14-10-47-quotalune-dev-gemini-bidi-after-20260926\s06-after.png`
- Verification: `N:\AI-Tools\Desktop-Visual-QA\reports\runs\2026-09-26T14-10-47-quotalune-dev-gemini-bidi-after-20260926\summary.md`
