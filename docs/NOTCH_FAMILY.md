# Compact notch family — 2026-09-06

Implemented directly by Astra against the user-supplied CodeNotch screenshots
and sampled frames from the 20.87-second reference video. Original SVG contours;
no upstream implementation or wallpaper assets are bundled.

## Five new structures

| Structure | Compact logical footprint, three providers | Intended placement |
| --- | --- | --- |
| Seam | 64 × 244 | Left/right edge, or free |
| Ribbon | 244 × 72 | Top/bottom edge, or free |
| Cradle | 144 × 144 | Four corners, or free |
| Deck | 168 × 88 | Any anchor, or free |
| Satellite | 108 × 172 | Left/right edge, or free |

Seam/Ribbon shrink for one or two providers. More providers do not grow the
window: page/cycle through six fixtures with wheel, arrows, Home/End. Satellite
retains keyed instruments and moves them around the compact curve. Deck shows
one provider with a named label and index dots. Other forms show up to three.

The palette follows provider identity: orange Claude, green OpenAI, blue Gemini,
yellow Cursor, blue DeepSeek, teal Perplexity. White icons, black filled contours,
and tabular percentages replace the previous silver instrument decoration.
Theme material is intentionally fixed for this family in this pass.

## Shared behavior

- Same resolved StageProvider data; no alternative usage computations.
- Shared 248 × 148 details card; no invented second quota window/plan data.
- Hover intent 180 ms, leave grace 220 ms, click, pin, Escape, reduced motion.
- Keyboard focus survives page replacement. Shape changes remount the geometry
  to prevent instruments travelling through an unrelated contour.
- Compact footprints are shared JSON consumed by Rust and TypeScript.
- Native envelopes uniformly fit 40% work-area width / 45% height, including
  temporary details. This is a cap, not the normal compact size.
- Existing native drag, docking and autohide are reused; form-specific anchors
  agree between Settings, Rust normalization and docking.
- Settings previews reuse actual contour components.

## Demonstration

Settings → Surfaces → Try Seam · six providers. Structure choice persists;
synthetic display does not. The process-local demo switch leaves credentials,
provider cache and history unchanged. Disable Use six demo providers to restore
real display. No fabricated login/account is created.

Browser preview: `/?window=demo&gen=reel`, now Structure Studio with a selector
for all five new forms and the previous Reel. It renders the shared components,
not mock screenshots. The soft background is preview context only.

## Verification and limits

- 84 frontend files / 454 tests passed, zero skipped; final locale/type/Vite build.
- 405 desktop Rust tests, 1,438 shared tests and one doc-test passed.
- Browser inspection: all five structures, compact/expanded, mirrored upper and
  lower corners, provider page two, keyboard cycling and clean console.
- Visual corrections during review: text escaping flipped corner contours,
  dim icons, old gauge decorations, shape-change travel, demo-label collisions,
  and the keyboard-focus rectangle covering transparent space.
- Strict Clippy remains blocked by pre-existing must-use findings at
  rust/src/notifications.rs:30 and :678. Not changed or suppressed here.
- Windows compositor, native dragging, DPI/multi-monitor and exact reference
  motion parity are not established by browser tests. See final task report for
  the current native automation result. Do not label this a Personal release.
- Fresh Dev process 72132 launched; native Settings accessibility exposes all
  five forms and the Try Seam button. Capture is black, and clicking the button
  fails with `GetCursorPos failed: Access is denied (0x80070005)`. The currently
  persisted older form was not changed by that failed action. Native activation
  and visual acceptance remain open; no bypass was attempted.

Existing older structures remain available for backward compatibility; no
accounts, installer identity or unrelated icon assets were modified.
