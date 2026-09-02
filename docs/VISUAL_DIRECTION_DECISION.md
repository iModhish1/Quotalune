# VISUAL_DIRECTION_DECISION

Date: 2026-09-03 · Prototypes: `design/prototypes/direction-{a,b,c}.html` (synthetic data,
backend-independent), rendered at 1920×1080 via headless Chromium
(`dir-{a,b,c}-1080.png`). 1440p/4K and 125–200% scaling checks run at V2 integration
(prototype geometry is logical-px and resolution-independent).

## Direction A — Arc Instrument

Graphite housings, thin luminous arcs, tabular values inside rings, surgical spacing.
- Distinctiveness 7 · Elegance 8 · Density **9** · Motion potential 8 · Windows integration 7 ·
  Codenotch-quality 7 · Performance **10** (no blur) · Accessibility 7
- Weakness: can read cold/technical; housings still "boxes".

## Direction B — Liquid Glass

Frosted translucent panels, colored glow, floating glass rail Edge Arc.
- Distinctiveness 6 · Elegance **9** · Density 7 · Motion potential 8 · Windows integration
  **9** (matches Win11 material language) · Codenotch-quality 7 · Performance 6
  (backdrop-filter cost) · Accessibility 6 (contrast over busy backgrounds)
- Weakness: material consumes the identity; arcs compete with the glass.

## Direction C — Edge Object

Surfaces grafted to screen edges: taskbar slab rising out of the taskbar, top notch,
right-edge half-capsule pod, Quick Panel unfolding from the slab.
- Distinctiveness **10** · Elegance 7 · Density 7 · Motion potential **9** (edges define morph
  anchors) · Windows integration 8 (works with taskbar, no覆盖) · Codenotch-quality **8**
  (most original) · Performance **9** (solid materials) · Accessibility 7
- Weakness: raw prototype is less refined than A; needs A's discipline.

## Decision: MERGE — "Edge Object geometry, Instrument density, Glass material"

1. **Geometry from C**: Taskbar Arc rises from the taskbar (rounded top only, flush bottom);
   Top Arc is a top notch; Edge Arc is an edge-flush pod; Quick Panel unfolds from the object
   that was clicked. This is QuotaArc's signature.
2. **Density and arc discipline from A**: provider = icon + arc + tabular value; profile
   identity reduced to a small avatar (name only in expanded/panel); debug strings removed.
3. **Material from B, sparingly**: subtle translucency + inner highlight on expanded states
   only (Quick Panel, Edge expanded); compact idle states stay solid graphite for performance
   and legibility (no continuous blur cost on always-visible surfaces).

This beats the current design on every axis of the audit (overall 3–5/10 → target 8+), and is
conceived as one system rather than per-surface styling.

## V2 surface specifications (initial)

| Surface | Idle geometry | Expanded |
|---|---|---|
| Taskbar Arc | slab h=48 flush to taskbar edge, radius 18/18/0/0, chips: 24px arc + tabular % | Quick Panel unfolds upward from the slab, w=340 |
| Top Arc | notch h≈48 descending from top edge, radius 0/0/22/22 | provider summary rows, same width |
| Edge Arc | pod flush to screen edge, half-capsule radius, per-provider arc instruments | rows reveal alias + reset |
| Quick Panel | w=340, rows h=52, footer 3 actions | — |

Component system: `QaSurface` (material+geometry shell), `QaCapacityArc`, `QaProviderIcon`,
`QaValue`, `QaResetTime`, `QaProfileAvatar`, `QaQuickPanel`, `QaStatusDot`.
