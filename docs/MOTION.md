# Motion

Motion is a first-class product feature — and idle motion is a bug. The system is built on
**Motion for React** (`motion`, v13, actively maintained successor of Framer Motion).

## Rules

1. **Animate only on change.** No loops, no shimmer, no idle CPU. If nothing changed, nothing
   renders.
2. **Springs are the default.** Three canonical springs: `springSnappy` (controls),
   `springSoft` (surfaces/morphs), `springGentle` (large geometry). Durations exist only for
   fades (160 ms).
3. **Transforms and opacity only.** Arc drawing uses stroke-dashoffset (GPU-composited SVG);
   number text uses interpolated text content. No layout-thrashing properties.
4. **Three motion levels**: `full`, `reduced`, `off`. The system `prefers-reduced-motion`
   media query maps to `reduced`; the app can narrow it in settings. Level resolves through
   `motionLevelFor()` and is exposed as `[data-qa-motion]` for CSS.
5. **Reduced is not broken**: at `reduced`/`off`, transitions collapse to `{duration: 0}` —
   state changes still communicate instantly.

## Primitives

| Primitive | Purpose |
|---|---|
| `ArcGauge` | Capacity arc; springs dashoffset + dot position on value change |
| `AnimatedNumber` | Numeric tween with tabular numerals; plain text under reduced motion |
| `surfaceEnter()` | Standard surface enter/exit variant (opacity + 6 px translate + 1.5% scale) |
| `transitionFor()` | Resolve a preferred transition against the active motion level |

## Testing

Design-system tests cover the status model and motion-level resolution
(`src/design-system/design-system.test.tsx`). Motion QA for interactions (no jumping, no hover
loops) is part of the release checklist in docs/TESTING.md.
