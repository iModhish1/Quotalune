# Orbit Reel — implementation and verification

Second compact carousel structure, available from Settings → Surfaces → Try Orbit Reel.
The button persists the reel structure/right anchor and enables temporary demo rendering.
The demo switch itself is process-local: no synthetic accounts, credentials, usage history,
or provider snapshots are written. Normal restart disables it; the optional
QUOTAARC_SURFACE_DEMO=1 launch environment enables it for that process.

Six fixtures: Claude 73, OpenAI 21, Gemini 58, Cursor 42, DeepSeek 36,
Perplexity 64 percent USED. DEMO is displayed. Real data remains separate.

## Layout and interaction

- Compact vertical 112×208 logical pixels; top/bottom 208×112.
- Expanded vertical 320×224; horizontal 288×280. Native work-area caps and
  uniform frontend fit preserve the silhouette.
- One focused instrument and two neighbors; wheel detents, arrows, Home/End,
  click details, Escape collapse, pin and drag grip. No clock face or idle loop.
- Reduced-motion removes transitions. Existing drag/docking/autohide remains shared.

## Verified 2026-09-05

- Frontend: 82 files / 443 tests passed; locale check, TypeScript and Vite passed.
- Rust: shared 1,438 plus one doc-test; desktop 404 passed.
- Fresh Dev executable built with dev-channel,tauri/custom-protocol and launched.
- Actual shared component inspected in browser: vertical expanded, horizontal
  expanded/compact, all six provider selections; no browser warning/error logs.
- Native Settings accessibility tree exposes Orbit Reel and Try Orbit Reel.
- Native screenshot is black and input returns GetCursorPos Access denied.
  Native activation of the reel and desktop interaction acceptance are NOT proven.
- Existing unrelated strict-Clippy warnings in rust/src/notifications.rs remain
  baseline issues; do not describe all lint gates as clean.

Preview: /?window=demo&gen=reel (development server). Browser preview is not
evidence of native compositor, DPI, docking, or cross-monitor correctness.
