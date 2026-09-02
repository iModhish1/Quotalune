# QuotaArc Design System

Location: `apps/desktop-tauri/src/design-system/`. New surfaces must consume tokens; hardcoded
colors/spacing/motion in surface code are review-blocking.

## Layers

- **tokens.css** — `--qa-*` primitives (palette, alpha inks, materials, shadows, type scale,
  spacing, radii, motion timings) and semantic references. Dark is canonical
  (`:root`, `[data-qa-theme="dark"]`); light is the adapted counterpart.
- **semantics.ts** — quota status model (`healthy → moderate → high → critical` plus
  `unknown/offline/refreshing`). Every status has a color token AND a label AND a stroke-weight
  bias, so urgency never relies on color alone (WCAG-safe by construction).
- **motion.ts** — the motion contract (see docs/MOTION.md).
- **ArcGauge.tsx** — the signature capacity arc.
- **AnimatedNumber.tsx** — tween-on-change numeric text; rests completely between changes.
- **index.tsx** — public surface + `DesignSystemProvider` (theme + motion level context).

## Visual language

Quiet, high-information, precision-instrument. One accent family (aurora teal → deep indigo) on
deep navy glass; provider brand colors appear only in provider identity (icons), never as
surface chrome. Elevation is expressed with layered translucency + soft directional shadows,
never hard borders-only.

Status ramp: `#34d399` healthy · `#fbbf24` elevated · `#fb923c` high · `#f87171` critical —
desaturated on purpose.

## ArcGauge geometry

Ring gap centered at the bottom; remaining capacity fills clockwise from the gap's left edge
(the 7:30 position) — the same grammar as the brand mark. Implementation is pure SVG
stroke-dasharray with spring-animated dashoffset; the endpoint dot animates cx/cy. No layout
work, no rAF loops; renders identically at any DPI (SVG user units).
