# SHELL-02 — workspace backgrounds and related navigation

Implemented on `feature/v9-theme-runtime`, starting at `e126e8ab`. Final application
candidate: `a42f1ab65e61`. This slice extends SHELL-01's adjustable sidebar and compact
toolbar. Original app/provider artwork and provider data contracts are preserved.
Personal remains frozen; all runtime work below uses the isolated Dev channel.

## Navigation and layout

The main navigation now has four destinations. Dashboard groups Overview, Analytics
and Usage & Spend. Providers retains direct access to connections and accounts.
Workspace groups Profiles and Collections. Settings groups the existing editors:

| Group | Editors |
| --- | --- |
| General & alerts | General, Notifications |
| Appearance | Themes, Provider Display, Reset Display |
| Analytics & data | Dashboard Studio, Data Sources |
| Navigation & Surfaces | Menu bar, Menu, Surfaces |
| Advanced | Advanced, About |

Native route IDs are unchanged. The navigation registry is the shared grouping
source; deep-link coverage tests include every existing editor. Search ranks the
matching editor within a group: `sound` opens Notifications, `sessions` opens Data
Sources, and Arabic time terms open Reset Display. Search results name that editor.

Dashboard/Analytics no longer override the entire workspace background, sidebar or
toolbar height. The shared toolbar now measures 48.67 CSS px on those pages and
Settings at 1216px width, correcting the previous 64px Dashboard exception.
Provider Display loses redundant banner text and uses a smaller heading. Theme
gallery headings wrap. Profile/collection forms have an opaque theme surface so
background artwork cannot compete with form labels. Existing sidebar drag,
keyboard resize, collapse, logical direction and narrow overlay behavior remain.

## Background architecture

Settings → Appearance → Themes contains four choices: the original Cosmic
observatory, procedural Aurora, procedural Star map, and plain Theme color.
Three intensities and optional Follow pointer are independent choices. Colors use
the existing profile/global Structure Theme resolver; this is not another theme
catalog. The app/logo artwork is unchanged. The shared layer covers workspace
pages, not auxiliary tray/floating windows.

`WorkspaceBackdrop` mounts once under the Settings root, outside page content.
Cosmic reuses the existing bundled asset; other backgrounds use static CSS radial
gradients. Cards retain readable theme surfaces. Light-theme choice/segment text
explicitly uses the resolved text color. No dependency, remote content, video,
canvas, WebGL, animated gradient or blur filter was added.

Rust `WorkspacePreferences` persists background, backgroundMotion and
backgroundIntensity. Missing/invalid fields default independently to
cosmic/static/balanced. Lenient loading, normalization and roundtrip tests preserve
existing sidebar/density/navigation fields. Controls update through the existing
settings bridge and preserve unrelated preferences.

Follow pointer transforms one 360px decorative glow. Input coalesces into at most
one pending animation frame and is throttled to 30Hz using the actual callback
clock. There is no timer or recursive frame loop in the implementation. Blur,
hidden visibility, pointer exit and unmount clear pending work. Touch is ignored.
Reduced motion, disabled animations, plain background and Low CPU disable the
interaction. The shared reduced-motion hook now subscribes to media-query changes:
the installed motion/react 13.1.1 hook previously captured only the mount value.

## Native verification and measurements

Final executable: `target/debug/QuotalisDev.exe`, embedded source `a42f1ab65e61`.
SHA256: `2c9af458f249baf9dd4b69ed9976ee822f5f70a85d26764fe4a867f749c36d79`.
Verified identity: Dev / `QuotaArc-Dev` / `app.quotalis.desktop.dev`.
Built with `scripts/build-dev-verified.mjs`; no installer or Personal promotion.

Most screenshots are from candidate `18df8ba31889`; the subsequent application
change only adds the profile/collection form surface and was rebuilt/retested on
`a42f1ab65e61`. Historical evidence was withdrawn from the public
`docs/images/shell02/` directory because it shows the former Quotalis brand;
audit copies and `measurements.json` are in ignored
`.local/historical-shell01-04-2026-09-27/shell02/`. These captures are not
current Quotalune release proof.

Native CUA on candidate `18df8ba31889`, PID 4776 / HWND 1313414, changed Aurora to
Star map through the visible choice card. Settings readback and a native screenshot
confirmed the result; the driver's `effect: unverifiable` alone was not accepted
as evidence. Earlier background clicks on a scaled capture were ineffective and a
foreground attempt was unavailable; those attempts are not counted as successes.
The successful native capture is `FINAL_NATIVE_SELECTION.png`.

Final candidate `a42f1ab65e61`, PID 26608 / HWND 920052, was also exercised through
CUA: selecting Collections navigated from Profiles and displayed the readable form
surface at 800px native width (`FINAL_NATIVE_COLLECTIONS.png`). Temporary Dev
presentation/language settings and the global theme were restored and read back;
the owned proof instance exited through its native Quit command.

Page captures cover General, Providers, Workspace, Dashboard, Analytics, Usage &
Spend, all four backgrounds and the Ceramic Pearl light theme. Arabic is captured
at 1216px, actual 800px and actual 520px native widths. The 520px case collapses the
sidebar to give the editor full width. No captured document horizontal overflow
or error boundary occurred. Background selection survived a WebView reload.

The initial static comparison on candidate `75f645fdc32d` used three 8-second
samples per mode on General, measuring WebView2 renderer task time through CDP.
These are whole-renderer samples, not isolated GPU or whole-machine CPU readings.

| Mode | Median task time per 8s | Range | Background style changes | Layouts |
| --- | ---: | ---: | ---: | ---: |
| Plain, static | 0.553 ms | 0.446–1.059 ms | 0 | 0 |
| Cosmic, static | 0.691 ms | 0.441–0.894 ms | 0 | 0 |
| Aurora, interactive requested, OS reduced motion active | 0.680 ms | 0.281–2.769 ms | 0 | 0 |

The third row proves the reduced-motion guard, not active interaction performance.
JS heaps were approximately 8.4–8.5 MiB; these are snapshots, not a leak test.

Active interaction was separately tested on `18df8ba31889` in the real Dev
WebView2 with emulated focus/no-reduced-motion and synthetic pointer input.
375 input events over 3.118s caused 72 style recalculations, 73 attribute mutations
(including initial opacity), zero layouts, 153.266ms total renderer task time and
51.844ms script time. This includes the test input timer and page work; it is not
an isolated decoration benchmark or native-mouse FPS claim. No trusted pointer
events overlapped that accepted sample. The next eight seconds recorded **zero
background mutations**. Blur cleared opacity, and switching reduced motion on
disabled interaction immediately. Separate native bridge checks confirmed Low CPU
and disabled animations both disable the layer. One earlier sample with activity
during its nominal idle period was discarded instead of reported as idle proof.

These results support bounded, event-driven work on this device. They do not
certify every GPU, battery impact or zero total CPU use. Static remains default.

## Quality gates

- Frontend: **187 files / 1,116 passed**. A first high-concurrency run timed out in
  the existing provider/theme matrix test; the complete suite passed with two
  workers without increasing timeouts or skipping coverage.
- Rust workspace: desktop **475 passed / 1 pre-existing ignored**; core **1,698
  passed / 0 ignored**; CLI **1 passed**; doctests **0**; no failures.
- Clippy workspace/all targets with warnings denied; Rust formatting; TypeScript;
  production frontend build and verified Dev native build: passed.
- Locale parity: **1,487 keys**; Dev identity test suite: **13 passed**.
- Secret scan, added skip/focus scan and whitespace checks: passed.

No new dependency or pricing/auth/data behavior is introduced. Existing large
bundle warnings remain: this change does not claim to solve the analytics engine
chunk size. Source/evidence acceptance for SHELL-02 is complete; visual preference
acceptance belongs to the owner. Broader earlier product work and Personal release
remain governed by their existing separate requirements.
