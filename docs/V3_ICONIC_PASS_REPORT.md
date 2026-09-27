# V3 — Iconic Surface Pass report

Historical note (2026-09-27): V1–V6 images were withdrawn from the current
public tree. Unchanged local audit copies remain under ignored
`.local/historical-v1-v6-2026-09-27/`. The board paths below document the
original review, not current Quotalune release imagery.

Date: 2026-09-03 · Personal build untouched (Dev/demo only).

## What changed (V2 → V3)

- **Arc V3 engine** (`design-system/ArcGaugeV3.tsx`): asymmetric origin at
  200° with a small ORIGIN NOTCH, hairline full-circle dual track, endpoint
  dot riding the head — the ring reads as QuotaArc, not a generic progress
  circle.
- **Provider Instrument V3**: provider glyph centered INSIDE the capacity
  arc (identity + capacity = one object), tabular value beside the ring.
  Per-provider optical map retained.
- **Edge Arc V3**: giant half-capsule rejected → 64px edge-flush instrument
  rail; hover/expanded grows rows INWARD (rail stays anchored); glass on
  expand.
- **Taskbar V3**: V3 instruments; avatar only when >1 profile; content-driven
  slab width.
- **HUD Focus / Dashboard hero**: Arc V3 rings with glyph inside; HUD meta
  rows (remaining/session/reset/pace); dashboard best-capacity + needs-
  attention + reset-timeline zones.

## Boards (rendered from the actual demo-stage components)

- `docs/images/v3/QUOTAARC_V3_REVIEW_BOARD.png`
- `docs/images/v3/V2_VS_V3_BOARD.png`
- Individual: `01…13-*.png` (dark + light)

## Honest status / remaining

- External scores were 5.5–7.5; the V3 pass targets the named defects
  (dead Edge space, weak instrument identity, text-heavy Quick Panel,
  avatar noise). Next external review decides.
- Not yet done in this pass: real-Windows synthetic desktop captures of V3,
  motion frame recordings (docs/media/v3/), ARC_STUDY.png variant sheet
  (one chosen geometry shipped; alternates backlog), tray context-menu
  simplification.
- Gates: vite build + tsc green; full backend/frontend suites unchanged
  (1,404/371/297 green at last run).
