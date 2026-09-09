/**
 * Adaptive label-density policy (Phase 6 owner sections 11/46). Pure and
 * deterministic -- the same `(count, ring, isSelected, isHovered)` input
 * always produces the same visibility decision, no per-frame recompute
 * beyond what `updateData`/selection/hover changes already trigger.
 *
 * Policy (owner section 11):
 *  - 1-8 providers: every label stays visible -- the scene is sparse
 *    enough that labels never compete with each other.
 *  - 9-16 providers: only the primary-ring bodies keep a permanent
 *    label; secondary-ring bodies drop theirs (still small/lightly
 *    scaled per `layout.ts`, so they'd be the most cluttered anyway).
 *  - 17+ providers: no permanent labels at all -- only the currently
 *    selected or hovered body shows one, so the scene stays readable at
 *    24 providers instead of showing 24 overlapping name tags.
 *
 * Selection and hover always win regardless of count (owner section 46:
 * "Selection/hover label always wins").
 */
import type { ProviderRing } from "./layout";

export const LABEL_ALL_THRESHOLD = 8;
export const LABEL_PRIMARY_ONLY_THRESHOLD = 16;

export type LabelDensityPolicy = "all" | "primaryOnly" | "selectedHoverOnly";

export function labelDensityPolicyFor(count: number): LabelDensityPolicy {
  if (count <= LABEL_ALL_THRESHOLD) return "all";
  if (count <= LABEL_PRIMARY_ONLY_THRESHOLD) return "primaryOnly";
  return "selectedHoverOnly";
}

export function shouldShowLabel(
  count: number,
  ring: ProviderRing,
  isSelected: boolean,
  isHovered: boolean,
): boolean {
  if (isSelected || isHovered) return true;
  const policy = labelDensityPolicyFor(count);
  if (policy === "all") return true;
  if (policy === "primaryOnly") return ring !== "secondary";
  return false;
}
