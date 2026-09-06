# Settings viewport and native window recovery — 2026-09-06

The reported screenshots exposed two distinct regressions:

- The Settings grid used `height: 100%` inside an auto-height parent, so long
  content expanded the grid beyond the WebView. The bottom nav escaped the
  viewport; inherited centered flex alignment hid tabs at the start of overflow.
- The detached window suppressed native decorations, and the main proof window
  retained the borderless DWM subclass after transitioning to decorated Settings.
  A custom caption provided no maximize control. React also reapplied size and
  position on mount, competing with native geometry ownership.

Changes: viewport-bound grid areas; independently scrollable, start-aligned nav
and content; native decorated Settings windows with subclass removal on the main
window; OS resize/maximize/Snap affordances; work-area-aware initial sizing;
no React size reset; explicit fullscreen toggle (F11) and Escape exit.

Validation:

- Browser regression fixture `scripts/check-settings-layout.cjs` failed before
  the CSS fix and passed 12 combinations: side/top/bottom × 520×440, 720×660,
  1280×720 and 1920×1080. It uses production CSS with structural fixture markup,
  not a live native backend.
- 477 frontend tests / 89 files passed, including three fullscreen action tests.
- 409 Tauri shell tests passed; TypeScript/Vite and Dev custom-protocol build passed.
- Shared Rust suite: 1,446 tests plus one doc-test passed.
- Fresh native UIA confirms Minimize, Maximize and Close caption controls plus
  the fullscreen control. Native screenshot remains black in the capture tool;
  attempted input fails `GetCursorPos: Access is denied (0x80070005)`.
  Interactive native resize/maximize/fullscreen and pixel verification remain
  unverified. This is not a release or whole-product PASS.
- Strict Clippy remains blocked by the two pre-existing discarded must-use
  results at `rust/src/notifications.rs` (toast icon initialization and legacy
  registration cleanup). No lint suppression added.

Personal installation, accounts, credentials, installer and notification behavior
were not changed in this recovery.
