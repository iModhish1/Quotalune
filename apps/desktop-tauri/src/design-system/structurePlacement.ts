/**
 * Wave 1D §14-17: a pure, testable placement resolver for an auto-
 * flipping tooltip/popover-style attachment — preferred side wins if it
 * fits, otherwise flips, otherwise shifts within a work area.
 *
 * CORRECTION (Wave 1E, see `docs/validation/STRUCTURE_COORDINATE_MODEL.md`
 * for the full trace): this is NOT wired into native Flow Surface window
 * positioning, and should not be. That real production system already
 * exists in `apps/desktop-tauri/src-tauri/src/surfaces.rs`
 * (`anchored_top_arc_position` + `clamp_top_arc_position_to_work_area`),
 * is already tested, and deliberately does NOT auto-flip a user's chosen
 * anchor — flipping a deliberately-docked window's side because it
 * happens to be tall would be surprising, unwanted behavior, not a bug
 * this function should "fix." The detail panel's position WITHIN that one
 * window is separately owned by deliberately-tuned per-form CSS, which
 * already stays inside the window's own bounds by construction (the
 * window itself resizes to contain it).
 *
 * This function remains real, tested, and available for a genuinely new
 * floating-attachment UI pattern this codebase does not have yet (or the
 * Dev QA fixture panel's own layout) — it is not currently invoked by any
 * production render path, and forcing it into either existing layer would
 * mean fighting already-correct, already-tested code.
 */

export interface StructureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type StructurePlacementSide = "left" | "right" | "top" | "bottom";

export interface StructurePlacementInput {
  /** The compact structure's rect, in the same coordinate space as workArea. */
  anchor: StructureRect;
  /** The expanded/detail panel's own size (unpositioned). */
  detailSize: { width: number; height: number };
  /** The monitor work area (excludes taskbar etc.), same coordinate space. */
  workArea: StructureRect;
  /** The side the caller would prefer, absent any collision. */
  preferred: StructurePlacementSide;
  /** Right-to-left UI. Used only as a tie-breaker when a horizontal choice
   * must be made and neither the preferred nor its direct opposite fits
   * (§15/§17's "RTL where relevant") -- it does not silently reinterpret
   * "left"/"right" as "start"/"end", since callers already resolve that
   * upstream (structure anchors are physical, not logical, positions). */
  rtl?: boolean;
  /** Minimum clearance kept from the work-area edge. Default 8. */
  safeInset?: number;
  /** Preferred gap between the anchor's edge and the detail panel's
   * facing edge (§17's anchor-gap contract). Default 6. */
  gap?: number;
}

export interface StructurePlacementResult {
  /** The side actually used -- equal to `preferred` unless a flip was needed. */
  side: StructurePlacementSide;
  x: number;
  y: number;
  /** True when the resolver had to use the opposite side from `preferred`
   * because the preferred side did not fit within the work area. */
  flipped: boolean;
  /** True when, even after flipping (or without needing to), the detail
   * panel had to be shifted along the cross-axis to stay inside the work
   * area (a corner/small-work-area case). */
  shifted: boolean;
}

const DEFAULT_SAFE_INSET = 8;
const DEFAULT_GAP = 6;

function fitsHorizontally(x: number, width: number, workArea: StructureRect, inset: number): boolean {
  return x >= workArea.x + inset && x + width <= workArea.x + workArea.width - inset;
}
function fitsVertically(y: number, height: number, workArea: StructureRect, inset: number): boolean {
  return y >= workArea.y + inset && y + height <= workArea.y + workArea.height - inset;
}

function clamp(value: number, min: number, max: number): number {
  // A work area narrower/shorter than the detail panel itself (an
  // extreme small-work-area case) would make min > max; keep the panel
  // anchored at the safe-inset edge rather than producing an inverted
  // range, which is still the least-bad placement available.
  return max < min ? min : Math.min(max, Math.max(min, value));
}

/**
 * Resolves where a Structure's expanded/detail region should render.
 * Preferred side wins if it fits (§15 "Preferred side if it fits").
 * Otherwise flips to the opposite side (§15 "flip... where valid").
 * Otherwise -- or after flipping, if the cross-axis still overflows --
 * shifts within the work area, always preserving the safe inset (§15
 * "shift within work area... Always preserve: safe monitor inset").
 */
export function resolveStructurePlacement(input: StructurePlacementInput): StructurePlacementResult {
  const { anchor, detailSize, workArea, preferred, rtl = false } = input;
  const safeInset = input.safeInset ?? DEFAULT_SAFE_INSET;
  const gap = input.gap ?? DEFAULT_GAP;

  const isHorizontal = preferred === "left" || preferred === "right";

  function place(side: StructurePlacementSide): { x: number; y: number; fits: boolean } {
    let x: number;
    let y: number;
    if (side === "right") {
      x = anchor.x + anchor.width + gap;
      y = anchor.y + (anchor.height - detailSize.height) / 2;
    } else if (side === "left") {
      x = anchor.x - gap - detailSize.width;
      y = anchor.y + (anchor.height - detailSize.height) / 2;
    } else if (side === "bottom") {
      x = anchor.x + (anchor.width - detailSize.width) / 2;
      y = anchor.y + anchor.height + gap;
    } else {
      x = anchor.x + (anchor.width - detailSize.width) / 2;
      y = anchor.y - gap - detailSize.height;
    }
    const fits =
      side === "left" || side === "right"
        ? fitsHorizontally(x, detailSize.width, workArea, safeInset) && fitsVertically(y, detailSize.height, workArea, safeInset)
        : fitsVertically(y, detailSize.height, workArea, safeInset) && fitsHorizontally(x, detailSize.width, workArea, safeInset);
    return { x, y, fits };
  }

  const opposite: Record<StructurePlacementSide, StructurePlacementSide> = {
    left: "right",
    right: "left",
    top: "bottom",
    bottom: "top",
  };

  let side = preferred;
  let placed = place(preferred);
  let flipped = false;

  if (!placed.fits) {
    const flippedSide = opposite[preferred];
    const flippedPlacement = place(flippedSide);
    if (flippedPlacement.fits) {
      side = flippedSide;
      placed = flippedPlacement;
      flipped = true;
    } else {
      // Neither side cleanly fits (small work area / corner case). Keep the
      // side that gives the most room in its own axis; RTL only breaks the
      // tie for a horizontal preference, since a logically-"end"-preferring
      // RTL layout should default to shifting from the left rather than
      // the right when both are equally cramped.
      if (isHorizontal && rtl) {
        side = "left";
        placed = place("left");
      } else {
        side = preferred;
        placed = place(preferred);
      }
    }
  }

  const isSideHorizontal = side === "left" || side === "right";
  const clampedX = clamp(
    placed.x,
    workArea.x + safeInset,
    workArea.x + workArea.width - safeInset - detailSize.width,
  );
  const clampedY = clamp(
    placed.y,
    workArea.y + safeInset,
    workArea.y + workArea.height - safeInset - detailSize.height,
  );
  const shifted = isSideHorizontal ? clampedY !== placed.y : clampedX !== placed.x;
  // Even the anchor-facing axis can need a clamp in a genuinely tiny work
  // area (detail wider/taller than the available room); shifted covers
  // that too.
  const shiftedEither = shifted || clampedX !== placed.x || clampedY !== placed.y;

  return {
    side,
    x: clampedX,
    y: clampedY,
    flipped,
    shifted: shiftedEither,
  };
}
