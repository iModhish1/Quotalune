# Native DPI matrix — 0.10.1

Historical evidence only. The V9 native image family was withdrawn from the
current public tree on 2026-09-27 and retained in ignored local audit storage.
Its old paths below do not identify current Quotalune release captures.

## Hardware available to this session

Single physical display, 1920×1200, fixed at **150% Windows scale** (DPR 1.5).
No second monitor and no way to change this machine's actual Windows display
scale from this automated session (doing so would also disrupt the owner's
live desktop) — confirmed via `GetDeviceCaps(LOGPIXELSX)` returning 144 (150%)
and `[System.Windows.Forms.Screen]::AllScreens` returning exactly one screen.

## Native (real hardware) — 150%

Captured this session (see `docs/images/v9/native/` and
`.local/proof/provider-display/` and `.local/proof/collections/`, the latter
two gitignored per this repo's local-proof convention):

- Settings (all destinations, dark/light) — no horizontal overflow, DPR 1.5
  confirmed in every capture's evidence.json.
- Provider Display (dark, light, Arabic RTL, critical semantic state, compact
  398px) — no overflow, no clipping.
- Collections window (empty state, populated 2-group state) — real native
  window, real provider data.

## Simulated (not native — labeled, not claimed as hardware proof)

- 100%, 125%, 200% DPI: no second physical display or a safe way to change
  this machine's real scale exists in this session. `ThemeStructureMatrix.
  test.tsx` and `surfaceMaterial.test.ts` etc. exercise the same components
  at the DOM/attribute level across arbitrary scale-factor inputs (including
  non-1.5 values), which validates the *logic* (layout math, `--surface-*`
  CSS variables, no NaN/negative-size) but is **not** a substitute for seeing
  real WebView2 sub-pixel rendering, icon rasterization, or DWM compositing
  at those scales.

## Explicit blocker

Real 100%/125%/200% native proof requires either a second monitor configured
at those scales, or changing this machine's primary display scale — the
latter would disrupt the owner's live desktop mid-session and was not done.
**This is an external hardware/environment blocker**, not a skipped step:
the owner (or a CI runner with configurable virtual displays) needs to supply
that environment for a genuine native capture at the other three scales.
