import type { FlowSurfaceAnchor } from "./flowSurface";

/**
 * Wave 1D §20-21: accessible keyboard alternative to pointer drag for
 * repositioning a floating Structure. Pointer drag moves the native window
 * to an arbitrary pixel position and then snaps/records it as one of the
 * 9 `FlowSurfaceAnchor` values (`topArcAnchor` — see
 * `lib/surfaceBridge.ts`'s `SurfaceSettingsPatch`); this module reuses that
 * SAME discrete anchor as the target of keyboard movement rather than
 * inventing a second, pixel-based position store (§21's explicit
 * requirement).
 *
 * The 9 anchors (8 fixed + "free") form a conceptual 3x3 grid missing its
 * center cell (there is no "centered" anchor):
 *
 *   top-left     top     top-right
 *   left                 right
 *   bottom-left  bottom  bottom-right
 *
 * Arrow-key movement steps one cell in the pressed direction, clamped at
 * the grid edges (pressing further does nothing rather than wrapping,
 * matching ordinary keyboard-nudge conventions elsewhere). "free" (the
 * anchor pointer-drag itself uses while mid-drag) has no fixed grid cell,
 * so keyboard movement from "free" starts from "top" — the same
 * predictable position `resetQuotaIslandPosition()` already snaps to.
 */

type GridCell = FlowSurfaceAnchor | null;

const ANCHOR_GRID: readonly (readonly GridCell[])[] = [
  ["top-left", "top", "top-right"],
  ["left", null, "right"],
  ["bottom-left", "bottom", "bottom-right"],
];

function findCell(anchor: FlowSurfaceAnchor): { row: number; col: number } | null {
  for (let row = 0; row < ANCHOR_GRID.length; row += 1) {
    const col = ANCHOR_GRID[row].indexOf(anchor);
    if (col !== -1) return { row, col };
  }
  return null;
}

export type NudgeDirection = "left" | "right" | "up" | "down";

/**
 * Returns the anchor one grid step in `direction` from `current`, or
 * `current` unchanged if that step would leave the grid (clamped) or land
 * on the unused center cell (skipped — moving further in the same
 * direction if a next cell exists, otherwise clamped).
 */
export function nudgeStructureAnchor(
  current: FlowSurfaceAnchor,
  direction: NudgeDirection,
): FlowSurfaceAnchor {
  const cell = findCell(current) ?? findCell("top")!;
  const deltas: Record<NudgeDirection, [number, number]> = {
    left: [0, -1],
    right: [0, 1],
    up: [-1, 0],
    down: [1, 0],
  };
  const [dRow, dCol] = deltas[direction];
  let row = cell.row + dRow;
  let col = cell.col + dCol;
  if (row < 0 || row > 2 || col < 0 || col > 2) return current; // clamp at grid edge
  let next = ANCHOR_GRID[row][col];
  if (next === null) {
    // Stepped onto the unused center cell -- continue one more step in the
    // same direction (e.g. "left" from "right" goes to "left", not the
    // gap), clamping again if that would also leave the grid.
    row += dRow;
    col += dCol;
    if (row < 0 || row > 2 || col < 0 || col > 2) return current;
    next = ANCHOR_GRID[row][col];
  }
  return next ?? current;
}
