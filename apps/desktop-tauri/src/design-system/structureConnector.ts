/**
 * Wave 1E §7-9: a shared connector/attachment DECISION model — given the
 * real visual gap between a structure's compact anchor and its expanded
 * detail region, decide whether a connector is needed at all, and if so
 * its orientation/length/offset. Family-specific rendering (an SVG shape,
 * a CSS pseudo-element, whatever fits each render path's existing visual
 * language) consumes this model rather than each family inventing its own
 * threshold or reimplementing the geometry.
 *
 * Explicitly NOT a visual component — no SVG/JSX here, no hardcoded
 * "one shape for every Structure" (the wave's own instruction). Notch
 * already has a real connector element (`.notch-connector` in
 * `NotchSurface.tsx`, a small rounded-rect "surface continuation" bridge)
 * that currently renders unconditionally whenever the detail panel is
 * open; this model is available for it to consult (e.g. to suppress the
 * connector when the gap is at/below the attached threshold) but that
 * wiring was NOT changed this wave to avoid regressing an already-tuned,
 * currently-correct visual without native verification — see
 * `docs/validation/STRUCTURE_COORDINATE_MODEL.md`. FlowSurface/Reel have
 * no connector element at all today; adding one is real, disclosed,
 * unstarted follow-up work for whichever session can natively verify it.
 */

export interface ConnectorGap {
  /** Horizontal gap (px) between the anchor's facing edge and the
   * detail's facing edge. 0 (or negative, meaning overlap) = touching. */
  x: number;
  /** Vertical gap (px), same convention. */
  y: number;
}

export type ConnectorOrientation = "horizontal" | "vertical" | "diagonal";

export interface ConnectorDecision {
  /** True when the gap is small enough that the anchor and detail already
   * read as one continuous surface — no connector should be drawn. */
  attached: boolean;
  /** True when a connector should be drawn (gap exceeds the attached
   * threshold but is still within the maximum a connector should ever
   * visually bridge). */
  connectorRequired: boolean;
  /** True when the gap exceeds even the maximum connector length — the
   * real fix here is NOT a giant connector, it is shifting the detail
   * closer (§8's explicit instruction), so callers should treat this as
   * "placement problem," not "draw a bigger bridge." */
  exceedsMaximum: boolean;
  orientation: ConnectorOrientation;
  /** The connector's visual length (px) along its dominant axis, clamped
   * to [0, maxLength]. 0 when attached. */
  length: number;
}

export interface ConnectorThresholds {
  /** Gap at or below this (px) reads as attached; no connector drawn.
   * Matches `structurePlacement.ts`'s `DEFAULT_GAP` — the same "how close
   * counts as touching" number both modules use, so a placement decision
   * and a connector decision never disagree about it. */
  attachedThreshold: number;
  /** Gap above this (px) should not be bridged with a connector at all —
   * the placement itself should shift closer instead (§8). */
  maxConnectorLength: number;
}

export const DEFAULT_CONNECTOR_THRESHOLDS: ConnectorThresholds = {
  attachedThreshold: 6, // mirrors structurePlacement.ts's DEFAULT_GAP
  maxConnectorLength: 32,
};

function dominantOrientation(gap: ConnectorGap): ConnectorOrientation {
  const ax = Math.abs(gap.x);
  const ay = Math.abs(gap.y);
  if (ax <= 1 && ay <= 1) return "horizontal"; // both ~0: no meaningful axis, pick a stable default
  if (ax > ay * 2) return "horizontal";
  if (ay > ax * 2) return "vertical";
  return "diagonal";
}

/**
 * Decides whether/how a connector should bridge a structure's anchor and
 * detail region, given the real measured gap between them.
 */
export function resolveStructureConnector(
  gap: ConnectorGap,
  thresholds: ConnectorThresholds = DEFAULT_CONNECTOR_THRESHOLDS,
): ConnectorDecision {
  const distance = Math.max(Math.abs(gap.x), Math.abs(gap.y));
  const attached = distance <= thresholds.attachedThreshold;
  const exceedsMaximum = distance > thresholds.maxConnectorLength;
  const connectorRequired = !attached && !exceedsMaximum;
  const length = attached ? 0 : Math.min(distance, thresholds.maxConnectorLength);
  return {
    attached,
    connectorRequired,
    exceedsMaximum,
    orientation: dominantOrientation(gap),
    length,
  };
}
