# Brand

**QuotaArc** — "Your AI capacity, always in sight."

## Mark

The brand mark is a **capacity gauge**: a ring whose gap sits at the bottom, filled clockwise
from the gap's left edge by a teal→indigo arc, with an endpoint dot marking "where you are".
The mark *is* the product: an arc that shows remaining capacity.

- App icon: `assets/brand/quotaarc-icon.svg` (dark tile, arc mark)
- Tray marks (monochrome, tile-free): `assets/brand/tray-mark-light.svg` (light strokes for
  dark taskbars), `tray-mark-dark.svg` (dark strokes for light taskbars)
- Generated set: `assets/brand/icons/` (16/20/24/32/48/64/128/256/512 PNG) and `rust/icons/`
  (`icon.ico`, bundle PNGs), regenerated via `node scripts/generate-icons.mjs`.

Legibility was verified at 16×16 (tray) and 24/32 px; the mark works monochrome and in
dark/light contexts. Provider logos never appear inside the QuotaArc mark.

## Palette

| Role | Dark | Light |
|---|---|---|
| Accent (capacity) | `#2DD4BF` aurora teal | `#14A894` |
| Accent partner (depth) | `#6366F1` deep indigo | `#4F52D9` |
| Surface base | `#0E141D` navy glass | `#F3F6F9` |
| Ink (primary text) | `rgba(246,248,251,.96)` | `rgba(12,18,27,.96)` |

Status ramp and full token set: `apps/desktop-tauri/src/design-system/tokens.css`.

## Voice

Precise, quiet, honest. Product copy states observations ("73% remaining · resets in 3h 12m"),
never hype. When the data isn't there, the product says so ("Not enough history").
