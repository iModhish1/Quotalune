import type { CSSProperties } from "react";
import type { ConnectorDecision } from "./structureConnector";

/**
 * Wave 1F §17-20: the ONE shared connector rendering primitive every
 * structure render family (Notch/FlowSurface/Reel) consumes, driven by a
 * `ConnectorDecision` (from `resolveStructureConnector`) rather than each
 * family inventing its own shape. Not rendered at all when the decision
 * says `attached` (already reads as one surface) or `exceedsMaximum`
 * (the fix is placement, not a longer bridge — see
 * `structureConnector.ts`'s own doc comment).
 *
 * Visual language (§19, explicit instruction): a quiet titanium/smoked-
 * silver material continuation, soft opacity, rounded geometry -- never a
 * bright line, neon, speech-bubble, arrow, or cartoon tether. §20 allows
 * (does not require identical visuals across) family-specific styling via
 * the `family` prop while sharing this one component and decision model.
 */
export interface StructureConnectorProps {
  decision: ConnectorDecision;
  /** Which render family is hosting this connector -- selects a CSS
   * modifier class for family-appropriate sizing/finish, not a different
   * shape language. */
  family: "notch" | "flow" | "reel";
  /** Absolute-position offset within the family's own positioned parent,
   * in that family's own coordinate space -- the family, not this
   * component, knows where its core/details actually sit. */
  style?: CSSProperties;
  /** The connector's size along its PERPENDICULAR axis (the dimension
   * that does not bridge the gap) -- e.g. how wide a vertical-gap bridge
   * reads, or how tall a horizontal-gap bridge reads. Family defaults
   * differ (Notch's existing tuned bridge reads wider than FlowSurface/
   * Reel's) -- pass explicitly to preserve a family's already-tuned
   * look; omit to use a conservative shared default. */
  span?: number;
  /** Minimum size along the gap-bridging axis itself, in case
   * `decision.length` is smaller than what still reads as a visible
   * bridge. */
  minGapAxis?: number;
}

/**
 * A rounded bridge shape between a structure's compact anchor and its
 * expanded detail region. Renders nothing when no connector is needed.
 */
export function StructureConnector({ decision, family, style, span = 16, minGapAxis = 8 }: StructureConnectorProps) {
  if (!decision.connectorRequired) return null;
  const horizontal = decision.orientation === "horizontal";
  // The dimension ALONG the gap axis equals the real measured gap
  // (decision.length) -- the bridge is exactly as long as the space it
  // crosses. The PERPENDICULAR dimension is `span`, a fixed "how
  // substantial does this bridge read" value, not derived from geometry.
  // "horizontal" orientation (core/details side by side, x-axis gap) ->
  // the bridge is narrow (width = gap) and tall (height = span).
  // "vertical" orientation (core/details stacked, y-axis gap) -> the
  // bridge is wide (width = span) and short (height = gap). "diagonal"
  // (rare: both axes contribute comparably) falls back to the vertical
  // convention.
  const gapAxis = Math.max(decision.length, minGapAxis);
  const width = horizontal ? gapAxis : span;
  const height = horizontal ? span : gapAxis;
  return (
    <svg
      className={`structure-connector structure-connector--${family}`}
      aria-hidden="true"
      style={{ position: "absolute", pointerEvents: "none", ...style }}
      width={width}
      height={height}
      data-orientation={decision.orientation}
    >
      <rect className="structure-connector__bridge" x={0} y={0} width={width} height={height} rx={Math.min(gapAxis, 6)} />
    </svg>
  );
}

export default StructureConnector;
