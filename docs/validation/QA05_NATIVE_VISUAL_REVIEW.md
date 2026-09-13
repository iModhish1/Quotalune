# QA05 native visual review — verified repair checkpoint

Date: 2026-09-13. Base commit: `3be750a0`, with uncommitted QA05 repairs.

## Execution plan and evidence

The user's latest priority is native screenshots, visual analysis, shared layout
repairs, then fresh native before/after comparison. Security and installer gates
remain part of the task; this document does not declare product acceptance.

Before captures came from the actual Tauri/WebView2 Dev executable, PID 40196,
HWND 134266. PrintWindow screenshots were captured through the guarded Desktop
Visual QA adapter; no physical mouse/keyboard or browser screenshot substitution.
The window was inspected before each action. Every client released the adapter
in finally. The original Dev instance was closed through its own Quit control
before building the updated candidate.

Local evidence: `.local/qa05/visual-atlas/index.html`, with a JSON manifest and
112 copied native screenshots through the final gallery regression round. The atlas may include local
data: it is not a publication asset. Capture count is not a feature-pass count.

Covered primary destinations: Dashboard, Analytics, Usage & Spend, Providers,
Profiles, Collections, Appearance, Surfaces, Provider tray studio, Settings,
and About. Additional captures include nine Analytics sections, General,
Notifications (top and sound/quiet-hour sections), Advanced (top/proxy/bottom),
Data Sources (top/bottom), Appearance's three sections, Menu, lower Tray controls,
Collections details, and a dropdown near the viewport edge. Galleries and all
individual provider/auth states are not yet exhaustively captured.

## Confirmed visual findings and source repairs

| Finding | Before evidence suffix | Source repair | Native after |
| --- | --- | --- | --- |
| Alibaba's black artwork disappears on dark plates | `df0baaf0d1514694a76801e724aeb921` | Light contrast plate for the original artwork | See updated comparison below; unlisted items remain pending |
| Collections repeats page introduction and shows QuotaArc | `6114731f4b714f52b19a67e82e682e03` | Omit standalone preview header when embedded; correct standalone name | See updated comparison below; unlisted items remain pending |
| Surface hero and preview consume excessive height | `d0be68b221554a6a876355c12ad92d08` | Bounded 96px preview and compact header | See updated comparison below; unlisted items remain pending |
| Temporary Surface demo card stretches into empty space | same | Align introductory cards to their own content | See updated comparison below; unlisted items remain pending |
| Single-provider Demo stretches usage values across panel | `df0baaf0d1514694a76801e724aeb921` | Bounded detail instrument with logo/readings columns; expanded real window details | See updated comparison below; unlisted items remain pending |
| Tray preview spacing pushes controls below viewport | `b672f5617a5b4a2d8d8bfbb753179f60` | Compact preview, emblem spacing and template cards | See updated comparison below; unlisted items remain pending |
| Data Sources uses full-width cards with large blank areas | `e746b74f206840ef88af12ad0f57334d` | Responsive card columns, single column when narrow | See updated comparison below; unlisted items remain pending |
| Reset controls and preview are disconnected; disclosure lacks cue | `b6b95b0524994b38b01134855c363ef7` | Editor spacing, side-by-side standard preview, explicit disclosure cue | See updated comparison below; unlisted items remain pending |
| Advanced grid leaves half-page gaps beside long Proxy card | `67c6209219614bd4bd02b2667ab2c4e7` | Independent column flow for unequal cards | See updated comparison below; unlisted items remain pending |
| Usage & Spend introduction is disproportionate | `5371051250cc47599faa404d55f16be5` | Remove hero minimum height and reduce padding | See updated comparison below; unlisted items remain pending |

Suffixes refer to `window-134266-<suffix>.png` in the local atlas and the global
Desktop-Visual-QA screenshots directory. Original logo source assets are intact.

## Native behavior evidence

- Sidebar collapse/expand passed with ExpandCollapsePattern and explicit changed
  accessible labels. Earlier LegacyIAccessible invocation returned success without
  changing state; that attempt is not an application defect or a PASS.
- Settings search accepted `reset` using ValuePattern and returned results; the
  original empty query was restored with an expected-value check.
- Demo count increments/decrements were checked against the displayed count at
  each step. Requested 70 produced 68 providers because the real catalog has 68.
  Source now caps the editor to actual unique catalog entries. No fake provider
  was added. Original count 12 and Demo OFF were restored.
- Rail next/previous controls changed selection. Planet activation exposed an
  incorrect option/listbox semantic; source now uses buttons in a toolbar with
  dialog semantics. Rebuilt native activation subsequently passed using the
  exposed ExpandCollapsePattern: Codex details opened, showed its Demo quota and
  reset windows, and closed with the exact `Close details` control. Legacy Invoke
  alone was a no-op and is not counted as a pass.
- Collections' provider-details button displayed the details card. No collection
  layout was saved by QA. User changes observed concurrently are preserved.
- General low-power dropdown opened above its trigger within the visible window.
  Option selection and all possible dropdown values are not yet accepted.

## Validation and limits

Frontend suite: 1,144 tests / 192 files passed. TypeScript passed. Rust formatting
passed. These do not replace native visual acceptance; final build and full Rust
workspace/security/installer gates are still in progress.

Windows Sandbox executable is absent. Hyper-V services are present, but Get-VM
returned an authorization error for the current execution account. No disposable
VM is certified ready and no installer was run on this host. Personal installation
and credentials were not deliberately opened or migrated. Independent review did
find that an initial tempfile snapshot test could call an idempotent default
account-directory creation; the explicit-path stores now create only their own
parent directory. No claim is made that a Personal file was changed.

## Updated native comparison, dependency and security evidence

The first rebuilt candidate was launched by the guarded fixed-path Dev launcher,
with SHA256 `fea55bc27a9f3301a5ae32233e48733a46650f7d5f251c6680671cbb0c19c24a`.
Its process, Dev identity and job ownership were verified. All automation-owned
instances were released in finally. This build predates the final dependency and
updater repairs; it is not evidence for those later changes.

Reviewed native after captures (`window-2361964-<suffix>.png`):

- Providers `2737d562ce814549973b28ed124c3fb4`: compact introduction and safe panel edges.
- Collections `bb43c971dbcf4c1398becd1ca9718ae9`: duplicated legacy introduction removed.
- Surfaces `af009718068f44e8bc3c0859e9ab7677`: bounded preview; introductory card no longer stretches.
- Tray studio `5553a770b84b4f52a464369fcf59cf58`: compact preview and template spacing. This is not OS tray-hover proof.
- Appearance `2ddc987bb7624a4ea54f1bbbb645e96e`: real gallery screenshots, clear selection, visible safe margins.
- Usage & Spend `7e721f66e0a64d31aa27b13a7de179c3`: compact introduction; captured while scanning, so loaded-result acceptance is pending.

Reviewed deeper after captures (`window-4195348-<suffix>.png`):
Advanced/Proxy `4341450ce03e4b62babb37b13ebfa28d`, Data Sources
`13f763d41a1b45f9a5335c0b593c3f43`, Reset Display
`05828a1a4a7f4c2caff2ac589b6377e3`. The independent columns, responsive cards and
side-by-side reset preview respectively resolved the observed empty areas.

Rebuilt native Demo showed six configured providers. QA preserved this observed
count (the earlier baseline had twelve), enabled Demo temporarily and restored
it OFF. Details evidence: `window-3082780-72588727eff7472e8be1151d0c665f55.png`;
Providers: `window-3082780-f824cf36f90646d396ad50ce56112700.png`. The latter revealed
Grok's dark artwork and over-separated Demo readings; a light contrast plate and
bounded reading gap were then added without editing logo assets.

Security repairs include user-bound DPAPI writes with compatible legacy reads,
explicit-path store writes, bounded settings-only native export via Save dialog,
production CSP separation, installer-family matching with exact installation
evidence, checksum validation, guarded disposable installer tests, and removal
of the duplicate unsafe release workflow. No production installation was run.
MSI locale hyphens and the shipped `quotalis-desktop.exe` alias received updater
regressions after independent review.

Frontend dependency audit: 17 findings before, zero after compatible updates and
Vite 6.4.3 / Vitest 4.1.11. Full suite after adapting constructible test doubles:
1,144 tests in 192 files passed; no assertions were removed. Rust audit: five
vulnerabilities before, zero after targeted lockfile updates. Seven unmaintained
and two unsound transitive dependency warnings remain (including glib 0.18.5 and
rand 0.7.3); zero vulnerabilities does not mean no dependency risk. No advisories
were suppressed. Logs are under `.local/qa05/`.

Remaining acceptance gaps: full gallery/narrow/RTL combinations, native OS
tray/toast rendering, all option and provider/auth workflows, file-picker flows,
loaded long-running analytics, animation/performance stress, font consistency
in older embedded panels, and disposable install/upgrade/uninstall execution.
There is no independent Windows sandbox in this runtime and no global QA PASS.

### Final integrated gates and defect-driven retest

The candidate with all backend repairs passed `cargo test --workspace --
--test-threads=2`: desktop 483 passed / 1 intentionally ignored, core library
1,736 passed, CLI binary 1 passed, doctests 0. The preceding default-concurrency
run failed two 2-second login fixture startup deadlines during concurrent native
build activity. All nine login tests passed in isolation; the complete reduced
concurrency run then passed. No test timeout, assertion or product behavior was
weakened to obtain this result. Both runs remain in the evidence directory.
Workspace Clippy all targets with warnings denied, Rust formatting and diff
checks passed. Secret scan found no secrets across 3,029 scanned files.
Disposable installer guard tests (including a junction above the test root) and
release guard tests passed; these are safety tests, not executed installer proof.

The next verified build had SHA256
`ca45c9982cc3861dc1b41b02860e8910bba2762f80009c4ecb1c1b1726449af4`.
Its native provider screenshot `window-1837816-8929abb4d64b49a89a51cb5cb9219241.png`
confirmed compact readings but disproved the proposed Grok plate-only fix: the
registry's tint conversion changed the white foreground to its dark brand color.
The repair now preserves the bundled Grok SVG unchanged, with a regression test
comparing rendered registry content to that original asset. No logo geometry or
source asset was changed. The failed plate-only attempt is not claimed as passed.

The subsequent build (`becaaa399ce243cdc51fc7b55a1bb33fc1004b814725fb0c9b25f324dc560408`)
visibly restored Grok in native Providers evidence
`window-9307172-61569358fccd4bd2b261f69522c497b4.png`. Its two registry tests passed.
The last full frontend suite had 1,144 tests; the additional preservation
regression passed separately, not as a claimed full 1,145-test run.

Background filter invocation through LegacyIAccessible returned without changing
the page and was rejected as proof. The inspected controls expose TogglePattern;
using it with expected-state checks changed all four filters correctly. Reviewed
screenshots `window-10357326-52f81c9ea27447a1b6551edc46d17c42.png` (static),
`1a4f76101d444a62b4bc845287e21466` (animated),
`32d9d0510b3e4427be57182c5c531fd4` (custom), and
`649a814ef8ad4a2f8b2c42b6c2b73a12` (all). This proves filtering, not background motion.
The custom-only screenshot exposed a single thumbnail stretching across the full
page. The grid was changed from auto-fit to auto-fill so sparse libraries retain
the same card scale as the complete gallery. Existing user backgrounds were not
selected, imported or deleted during this round.

The final secret scan was clean across 3,030 files. The guarded launcher and its
supervisor job verification changes live in the global Desktop-Visual-QA stack,
outside the Quotalis repository; ten launcher tests passed there. General native
launch and physical input restrictions were not disabled. This checkpoint does
not certify every control, native notification or supported Windows version.

### Delivered checkpoint

Final verified Dev executable: `target/debug/QuotalisDev.exe`, SHA256
`6226295899e7b7cbd600659f26d7a517fc2627b71c70235ada0cd3f2ce7b51c2`.
Build proof is `.local/qa05/build-dev-gallery-final.log`. It embeds base
`d8b3836916c1` plus the then-uncommitted visual repairs subsequently committed as
`a3fffef9`; committing those sources does not rebuild embedded revision metadata.
Native final gallery regression passed; reviewed custom thumbnail evidence is
`window-15075692-66b31214e8a34fb0bfcae795bb49a669.png`. The original thumbnail is
now shown in a bounded card instead of a page-wide cropped strip. Filters were
returned to All, Demo remained OFF, and the adapter released its owned processes.
Final full frontend rerun: **1,145 passed / 192 files**, log
`.local/qa05/frontend-accepted-tests.log`. Final native build also passed locale
parity, TypeScript and production frontend bundling. No installer was executed,
no independent Windows VM was available, and no universal compatibility or
all-features acceptance is claimed.

### Native notification and tray continuation — 2026-09-13

Added an explicit Settings test-notification action. It sends fixed localized
test text and an optional catalog provider name, never frontend-supplied account
data. The backend accepts only the Settings window and known destinations and
rate-limits requests. The UI acknowledges a request, not guaranteed delivery:
Windows may suppress a banner. No test runs automatically on mount.

Actual Windows notification evidence (read-only Helix full-desktop capture):
`C:/Users/imodhish/AI-Tools/Desktop-Visual-QA/screenshots/helix/quotalis-qa06-app-notification.png`.
Visual inspection confirms Quotalis in the Windows header, the app icon in the
header, and a larger original app logo beside the fixed test body. This closes
app-notification pixel proof on this host; it does not certify provider icons or
other Windows versions. Full-desktop captures remain local because they include
surrounding desktop content.

Native provider selection remains unverified. Claude exposes InvokePattern and
SelectionItemPattern, but both calls returned Windows COM error -2147220991.
The trial selection mutation was removed from the global adapter. Only read-only
SelectionItem inspection remains added. No input-policy, Pause, ownership, mutex,
physical-input or launch boundary was weakened. The global ownership and guarded
launcher tests still pass (20 tests). The error is a native automation limitation
until reproduced through ordinary app interaction; it is not declared a product
failure or a successful provider notification.

The shared Select wrapper now inherits its enclosing Field name. Previously its
accessible name could be only the selected value (such as Off), which changed
when the value changed. Explicit labels still take precedence. Regression tests
cover stable names, changed values and explicit overrides; existing language,
low-power and floating-bar tests now locate the actual field names.

Tray Studio native run exercised Orbit ring, Open arc, Horizon bar and Number
badge through inspected TogglePattern controls, with a capture after each state.
The pin switch was tested off-to-on-to-off, and the original Open arc style was
restored. All four preview states were visually reviewed. Evidence under the
global `screenshots/` directory:

- `window-983810-d57fdc96968144ec8e6166b2e82e154d.png` — ring.
- `window-983810-a348e0e369794635936509fdd4f4a856.png` — arc.
- `window-983810-408b85ba87f545d584b27f88975e11f0.png` — bar.
- `window-983810-7cdd9831220a4769b274fafb2c04b934.png` — badge.

The full-desktop capture `helix/quotalis-qa06-tray-pinned.png` does not expose a
recognizable provider icon in the visible taskbar; Windows overflow was not
opened. Therefore these results prove settings and previews, not final tray
pixels, hover contents or tray-click routing. The arc preview had a full
background track despite the native renderer using an 80% open track. Its SVG
track now uses that same 80% extent and starting angle. No clipping was seen in the
captured upper Tray Studio area; lower controls are outside these captures.

Source inventory `.local/qa05/control-inventory.json` lists 317 JSX control
templates across 73 files (109 surface files scanned). This is not a tested
feature count; dynamic providers/options require separate runtime coverage.
Frontend final suite: 1,148 passed across 193 files. Workspace Clippy with
warnings denied and formatting passed. Logs are
`.local/qa05/continuation-frontend-tests-final.log` and
`.local/qa05/continuation-clippy.log`. Installer execution, exhaustive option
coverage and cross-version Windows validation remain open.

The repaired arc was rebuilt and visually verified in native capture
`window-1048838-3a6228c0472f4630ba34d8f7a39b46b9.png`. The same native run exposed
the stable `Icon limit` accessible name and confirmed the original Open arc/off
settings survived restart. Final verified Dev SHA256:
`d45dbc24431a3f48c051dca8889842c58393ae78d0c2f77a7f865a5e021c6371`.
Build log `.local/qa05/continuation-build-dev-arc.log` proves TypeScript, locale
parity, production frontend bundling and Dev identity. It embeds base `68ae01e6`
plus these working-tree changes. Full Rust workspace results: desktop 484 passed
and one existing ignored test; core 1,736 passed; CLI one passed; doc tests zero.
Secret scan was clean across 3,042 files. The full frontend run preceded only the
one-line SVG track repair; the final build and native screenshot validate that
repair. No accounts, credentials or original logo assets were modified.
