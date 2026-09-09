/**
 * Adaptive label-density policy for the Spatial Observatory (owner
 * section 23) -- deliberately the same numeric thresholds as the 3D
 * scene's own `providers3d/labelPolicy.ts` (8 / 16), since both surfaces
 * share the same underlying "how many providers is too many to label
 * all of them" judgment call; kept as a separate module (not a shared
 * import) because Spatial's third input is a *tier*, not a *ring*, and
 * forcing one shared type would couple two otherwise-independent
 * rendering surfaces together for no real benefit.
 *
 * Policy:
 *  - 1-8 providers: every node keeps its full name label.
 *  - 9-16 providers: front-tier nodes keep full names; back/mid/far
 *    nodes show a compact (glyph-only) label unless selected/hovered.
 *  - 17-24 providers: only the selected or hovered node shows a name at
 *    all; everyone else is glyph-only.
 *
 * Selection and hover always win regardless of count (owner section 23:
 * mirrors the 3D scene's "selection/hover label always wins" rule).
 */
import type { SpatialTier } from "./spatialLayout";

export const LABEL_ALL_THRESHOLD = 8;
export const LABEL_FRONT_ONLY_THRESHOLD = 16;

export type SpatialLabelDensity = "all" | "frontOnly" | "selectedHoverOnly";

export function spatialLabelDensityFor(count: number): SpatialLabelDensity {
  if (count <= LABEL_ALL_THRESHOLD) return "all";
  if (count <= LABEL_FRONT_ONLY_THRESHOLD) return "frontOnly";
  return "selectedHoverOnly";
}

/** Whether this node shows its full provider name. When `false`, callers
 *  still show the provider glyph (owner section 24: "Provider glyph
 *  remains visible where practical") -- this only governs the text
 *  label, never the icon. */
export function shouldShowSpatialLabel(
  count: number,
  tier: SpatialTier,
  isSelected: boolean,
  isHovered: boolean,
): boolean {
  if (isSelected || isHovered) return true;
  const density = spatialLabelDensityFor(count);
  if (density === "all") return true;
  if (density === "frontOnly") return tier === "front" || tier === "hero";
  return false;
}
