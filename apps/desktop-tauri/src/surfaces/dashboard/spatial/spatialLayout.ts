/**
 * Phase S1 (Spatial Observatory prototype): a pure, deterministic layout
 * for the DOM/SVG/CSS "Provider Instrument Node" composition.
 *
 * Explicitly NOT a ring/orbit layout (owner section 17: "do NOT arrange
 * six nodes in a simple perfect circle") -- providers are grouped into
 * depth "tiers" (front/back/etc.), each tier's nodes spread across a
 * horizontal band with a small deterministic stagger, so a small
 * provider count reads as an intentional staggered composition (a
 * "3 + 3" front/back split at six providers) rather than a uniform grid
 * or a circle. Same input (provider ids, in the same order, same
 * viewport/selection) always produces the same output -- no
 * `Math.random()`, no per-launch variation (mirrors `providers3d/layout.ts`'s
 * own determinism discipline).
 *
 * Units are percentages of the stage's own box (0-100), not pixels, so
 * the same layout call is resolution-independent -- callers place nodes
 * with `left/top: <percent>%` (or an equivalent transform) inside a
 * container that itself changes size (see the responsive/narrow-mode
 * requirements, owner section 39).
 */
import { hashUnitInterval } from "../../../lib/deterministicHash";

export type SpatialTier = "hero" | "front" | "mid" | "back" | "far";

export interface SpatialPoint {
  x: number;
  y: number;
}

export interface SpatialNodeLayout {
  id: string;
  /** Percent (0-100) position within the stage. */
  x: number;
  y: number;
  /** 0 (nearest the viewer) .. 1 (furthest) -- drives the caller's
   *  `translateZ`/scale/opacity/blur, not computed here (owner section
   *  12: depth comes from CSS transforms, this module only decides the
   *  *logical* depth ordering). */
  depth: number;
  /** Final relative size multiplier a renderer should apply on top of
   *  its own base node size -- already folds in tier + hero sizing, so
   *  callers never need a second size table. */
  scale: number;
  tier: SpatialTier;
  /** Where a subtle connection/calibration trace from this node should
   *  land (owner section 26) -- a point on this node's own tier's
   *  horizontal calibration axis, never another provider's node (this
   *  layout never implies a fake provider-to-provider relationship). */
  connectionAnchor: SpatialPoint;
}

export interface SpatialLayoutOptions {
  /** The currently selected provider, if any -- selected nodes are
   *  nudged toward the front tier's depth (owner section 28: "moves
   *  slightly toward foreground") without changing anyone's `x`/`y`
   *  slot, so selecting a back-tier provider doesn't reshuffle the
   *  whole composition. */
  selectedId?: string | null;
}

const HERO_SCALE = 1.6;
const TIER_SCALE: Record<SpatialTier, number> = {
  hero: HERO_SCALE,
  front: 1,
  mid: 0.86,
  back: 0.74,
  far: 0.6,
};
const TIER_DEPTH: Record<SpatialTier, number> = {
  hero: 0,
  front: 0.12,
  mid: 0.42,
  back: 0.68,
  far: 0.9,
};
/** How much closer to the viewer a selected node reads, relative to its
 *  own tier's base depth -- bounded so a selected `far`-tier node still
 *  reads as further back than an unselected `front`-tier one (owner
 *  section 28 asks for "moves toward foreground," not "jumps to the
 *  front row"). */
const SELECTED_DEPTH_LIFT = 0.12;

/** Small deterministic horizontal/vertical stagger so a tier's nodes
 *  don't sit on a perfectly straight line (owner section 17: "slight
 *  asymmetry") -- bounded well below the spacing between nodes so it
 *  never causes overlap. */
const JITTER_X_RANGE = 2.5;
const JITTER_Y_RANGE = 3;

function jitter(id: string, axis: "x" | "y"): number {
  const range = axis === "x" ? JITTER_X_RANGE : JITTER_Y_RANGE;
  return (hashUnitInterval(`spatial:${axis}:${id}`) - 0.5) * 2 * range;
}

/** Splits a sorted id list into tiers by count, back-to-front. Chosen so
 *  the six-provider "golden" case is an explicit 3-back/3-front split
 *  (owner section 17), and larger counts add tiers rather than just
 *  cramming more nodes into two rows (owner sections 21/22). */
function tiersForCount(count: number): SpatialTier[] {
  if (count <= 1) return ["hero"];
  if (count <= 3) return ["front"];
  if (count <= 6) return ["back", "front"];
  if (count <= 12) return ["back", "mid", "front"];
  return ["far", "back", "mid", "front"];
}

/** Distributes `count` items across `tierCount` tiers, back tier first,
 *  filling front tiers slightly more (a stable, deterministic split --
 *  e.g. 6 across 2 tiers is exactly 3/3; 7 across 2 tiers is 3 back / 4
 *  front) so the front (largest, most legible) tier never ends up
 *  emptier than the back. */
function splitAcrossTiers(count: number, tierCount: number): number[] {
  const base = Math.floor(count / tierCount);
  const remainder = count % tierCount;
  const sizes = new Array(tierCount).fill(base);
  // Give the remainder to the front-most tiers first.
  for (let i = 0; i < remainder; i += 1) {
    sizes[tierCount - 1 - i] += 1;
  }
  return sizes;
}

/** Horizontal band a tier's nodes are spread across -- back tiers sit in
 *  a narrower, higher band; the front tier gets the widest, lowest band,
 *  since it carries the largest/most important nodes. */
const TIER_Y_BASE: Record<SpatialTier, number> = {
  // Widened from an earlier pass that put tiers too close together --
  // a real native capture at 12 providers showed back/mid/front node
  // housings visibly overlapping (owner section 21: "still readable,
  // no label collisions" -- this was a housing collision, worse than a
  // label one). Front sits lowest/most spread since it carries the
  // largest, most important nodes.
  far: 10,
  back: 26,
  mid: 50,
  front: 80,
  hero: 50,
};
const TIER_X_SPAN: Record<SpatialTier, [number, number]> = {
  far: [22, 78],
  back: [14, 86],
  mid: [10, 90],
  front: [8, 92],
  hero: [50, 50],
};

function positionsForTier(ids: string[], tier: SpatialTier): Map<string, SpatialPoint> {
  const positions = new Map<string, SpatialPoint>();
  // The hero tier (owner section 19) is a single centered "precision
  // instrument," never nudged off-center by the same stagger jitter
  // that gives multi-node tiers their intentional asymmetry.
  if (tier === "hero") {
    positions.set(ids[0], { x: TIER_X_SPAN.hero[0], y: TIER_Y_BASE.hero });
    return positions;
  }
  const [xStart, xEnd] = TIER_X_SPAN[tier];
  const yBase = TIER_Y_BASE[tier];
  const n = ids.length;
  ids.forEach((id, index) => {
    // Evenly spread across the tier's band; a lone node in a tier sits
    // centered rather than pinned to the band's start.
    const t = n <= 1 ? 0.5 : index / (n - 1);
    const x = xStart + (xEnd - xStart) * t;
    // Alternate every other node slightly forward/back within its own
    // tier band -- the "staggered," not perfectly aligned, read (owner
    // section 17) -- on top of the small per-id jitter below.
    const alternate = index % 2 === 0 ? -1 : 1;
    const y = yBase + alternate * (JITTER_Y_RANGE * 0.6);
    positions.set(id, {
      x: clampPercent(x + jitter(id, "x")),
      y: clampPercent(y + jitter(id, "y")),
    });
  });
  return positions;
}

function clampPercent(value: number): number {
  return Math.min(96, Math.max(4, value));
}

/**
 * Compute deterministic Spatial layout for a set of provider ids.
 * Returns a `Map` keyed by id, mirroring `providers3d/layout.ts`'s own
 * `computeProviderLayout` contract so callers never need to zip arrays
 * back together by index.
 */
export function computeSpatialLayout(
  providerIds: readonly string[],
  options: SpatialLayoutOptions = {},
): Map<string, SpatialNodeLayout> {
  const result = new Map<string, SpatialNodeLayout>();
  const sorted = [...providerIds].sort();
  if (sorted.length === 0) return result;

  const tiers = tiersForCount(sorted.length);
  const sizes =
    tiers.length === 1 ? [sorted.length] : splitAcrossTiers(sorted.length, tiers.length);

  let cursor = 0;
  for (let tierIndex = 0; tierIndex < tiers.length; tierIndex += 1) {
    const tier = tiers[tierIndex];
    const size = sizes[tierIndex];
    const idsInTier = sorted.slice(cursor, cursor + size);
    cursor += size;
    const positions = positionsForTier(idsInTier, tier);

    for (const id of idsInTier) {
      const point = positions.get(id)!;
      const isSelected = options.selectedId === id;
      const depth = isSelected
        ? Math.max(0, TIER_DEPTH[tier] - SELECTED_DEPTH_LIFT)
        : TIER_DEPTH[tier];
      result.set(id, {
        id,
        x: point.x,
        y: point.y,
        depth,
        scale: TIER_SCALE[tier] * (isSelected ? 1.08 : 1),
        tier,
        connectionAnchor: { x: point.x, y: TIER_Y_BASE[tier] },
      });
    }
  }

  return result;
}
