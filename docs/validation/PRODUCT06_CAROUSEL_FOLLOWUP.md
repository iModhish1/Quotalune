# Provider carousel and badge placement follow-up

Requirement: P06-14. Base: `dec53a0948cd`; changes built as a dirty worktree.

The existing eight-position account/reset pickers and persisted three/four-card
foreground remain the implementation. This follow-up fixes two defects: circular
rearrangement previously clamped at the first/last item, and FLIP transitions did
not respect the application animation switch. Dashboard-only adjacent swaps now
cross the circle seam without changing other identities. Linear list ordering
elsewhere retains its existing behavior. OS reduced motion and shared motion
attributes also suppress rail animation. No original logo artwork changed.

## Verification

- Full frontend: **1191 tests / 200 files PASS**, log
  `.local/qa05/p06-14-frontend-final.log`.
- TypeScript: `pnpm exec tsc --noEmit` PASS.
- Current-tree secret scan: **3105 files clean**; this does not resolve the
  separate full-history publication audit. `git diff --check` and changed-test
  focus/skip scan PASS.
- Verified Dev build (includes production frontend build/locale validation): PASS,
  `.local/qa05/p06-14-dev-build.log`.
- Canonical Dev SHA256:
  `8b96cbadc9497dde22516174b447833c07d3096e5bee14fb04a62100aa033262`.
- No Rust implementation changed in this follow-up; prior workspace gates are
  recorded separately and are not represented as newly executed here.
- Tests cover 70-provider bounded rendering and wheel-anchor updates, eight
  physical positions, RTL reorder direction, circular seam identity preservation,
  app motion off, serialized writes and exact Demo foreground/position restoration
  after unmount/remount. Demo persistence remains separate from real settings.

## Native evidence

All paths below are under
`C:/Users/imodhish/AI-Tools/Desktop-Visual-QA/screenshots/`.
Actual Tauri Dev, 1846 x 1088, English/dark, original marks. Images inspected.

| State | Screenshot |
| --- | --- |
| Real dashboard: account number and +2 Resets | `window-3935290-b2b7315519d547d49d16afad2bc6852c.png` |
| Eight account positions, eight reset positions, 3/4 choices | `window-3935416-5790e50a01c44266a443283ff4294c0a.png` |
| Demo: four foreground providers from six | `window-9636592-a155a5dd7f2b4558820dada7d0f4d230.png` |
| Demo: three foreground providers after changing the control | `window-1903802-61e700e717894d96b369019b0ae986d3.png` |
| Demo: four providers, reset labels at middle-right | `window-1903802-fdf368b4426a47a58a6152a8951d5a32.png` |

The 3-button TogglePattern state changed to 1; subsequent inspection and pixels
showed Claude/Gemini/Perplexity only. Four was restored, middle-right was exercised
and restored to bottom-center. Left/right reorder controls were invoked in a
reversible pair; no separate final-order native readback was captured for that
pair, so its exact ordering is covered by tests, not asserted from RPC success.
Demo was disabled with Exit Demo afterward. Real accounts/auth data untouched.

The provider dialog uses ExpandCollapsePattern in WebView2. Legacy default-action
acknowledgements did not open it and are not counted as successful interactions.
The supported guarded expand action opened it; no adapter changes, physical
mouse, keyboard or clipboard input were used. All sessions stopped in finally.

Limits: six providers exercised natively, 70 in component tests. Wheel and RTL
ordering tested programmatically, not via physical host input. This is not a
claim of every position-pair/scale/theme combination or complete product QA.
