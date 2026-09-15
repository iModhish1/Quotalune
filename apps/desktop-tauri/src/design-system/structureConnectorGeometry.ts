import type { ConnectorGap } from "./structureConnector";
import type { FlowSurfaceForm } from "./flowSurface";
import { isNotchForm } from "../surfaces/notch/notchGeometry";

/**
 * Wave 1F §17: real, measured (not fabricated) core-to-details gaps for
 * each of the 14 structure forms' REFERENCE anchor — the anchor whose
 * numbers `flowSurface.ts`'s own `BASE_ENVELOPES`/CSS custom properties
 * directly represent, before any per-anchor rotation. Every number below
 * is derived from source already in the codebase (cited per form), the
 * same "envelope minus core minus details" arithmetic Notch's own
 * `notchLayout()` already performs in JS for its two rects — this module
 * does the equivalent derivation for FlowSurface/Reel, which position
 * their core/details purely via CSS with no existing JS rect pair to
 * read.
 *
 * Deliberately scoped to ONE reference gap per form, not a full per-
 * anchor/per-rotation table: FlowSurface's rotation rules (flowline/
 * horizon swapping orientation for top/bottom vs left/right anchors) are
 * numerous and, verified against `flowSurface.ts`'s `flowSurfaceEnvelope`,
 * inconsistently applied between compact/expanded/hidden branches — full
 * per-anchor coverage would require resolving pre-existing envelope-sizing
 * questions unrelated to the connector, which is out of scope here. The
 * reference gap is a real, correct number for that form's primary anchor
 * and is used uniformly regardless of anchor; this is disclosed, not
 * hidden, and flagged for native verification per anchor in
 * WAVE1_NATIVE_QA_MATRIX.json.
 */
function corner(envelope: { width: number; height: number }, core: { width: number; height: number }, details: { width: number; height: number }): ConnectorGap {
  return { x: envelope.width - core.width - details.width, y: envelope.height - core.height - details.height };
}

const NOTCH_REFERENCE_GAP: ConnectorGap = { x: 12, y: 12 }; // notchGeometry.ts's notchLayout(): both the horizontal and vertical branches add exactly `+12` between core and detail rects.

const FLOW_REFERENCE_GAPS: Partial<Record<Exclude<FlowSurfaceForm, "reel">, ConnectorGap>> = {
  // petal: BASE_ENVELOPES.petal.expanded {300,160}; core 170x118 (--flow-petal-width/height);
  // details 214x140 (--flow-petal-details-width/height). 300-170-214=-84, 160-118-140=-98: bounding
  // boxes overlap on both axes -> always reads as attached by design (Wave 1F verified, not new).
  petal: corner({ width: 300, height: 160 }, { width: 170, height: 118 }, { width: 214, height: 140 }),
  // orbital: BASE_ENVELOPES.orbital.expanded {288,174}; core 104x104 (--flow-orbital-size, fixed
  // regardless of compact/expanded); details 244x146 (--flow-orbital-details-width/height).
  orbital: corner({ width: 288, height: 174 }, { width: 104, height: 104 }, { width: 244, height: 146 }),
  // lens: BASE_ENVELOPES.lens.expanded {310,176}; core 178x76 (--flow-lens-width/height);
  // details 252x146 (--flow-lens-details-width/height).
  lens: corner({ width: 310, height: 176 }, { width: 178, height: 76 }, { width: 252, height: 146 }),
  // flowline (reference anchor = left/right, the CSS-default unrotated rail): BASE_ENVELOPES
  // .flowline.expanded {330,210}; core width 56 (--flow-flowline-width, full-height rail);
  // details width 238 (--flow-details-width). Only the x-axis is meaningful (rail spans full
  // height, so y gap is ~0 by construction). 330-56-238=36 -- a REAL gap that exceeds
  // DEFAULT_CONNECTOR_THRESHOLDS.maxConnectorLength (32): a genuine "placement problem, not a
  // bigger bridge" finding (see structureConnector.ts's own ConnectorDecision.exceedsMaximum
  // doc) -- flowline's tuned envelope leaves more daylight than a connector should ever bridge.
  flowline: { x: 36, y: 0 },
  // horizon (reference anchor = top/bottom, the CSS-default unrotated strip): BASE_ENVELOPES
  // .horizon.expanded {350,208}; core height 58 (--flow-horizon-height, full-width strip);
  // details height 140 (--flow-horizon-details-height). Only the y-axis is meaningful.
  // 208-58-140=10.
  horizon: { x: 0, y: 10 },
};

// reel (reference anchor = right, the CSS-default non-rotated layout): flowSurfaceEnvelope's
// `reel` entry {320,224} (matches reelGeometry.ts's reelBaseSize(expanded, horizontal=false)
// exactly); .reel-core is a fixed 112px-wide right-docked rail (ReelSurface.css); .reel-details
// is a fixed 200px-wide left-docked card. Only the x-axis is meaningful (both are vertically
// centered at nearly the same height). 320-112-200=8.
const REEL_REFERENCE_GAP: ConnectorGap = { x: 8, y: 0 };

/**
 * The real, measured reference gap for a structure form, for use with
 * `resolveStructureConnector()`. Notch forms all share the same 12px
 * gap (a JS-computed constant, not a per-form tuned number); FlowSurface/
 * Reel forms each have their own cited derivation above.
 */
export function structureConnectorReferenceGap(form: FlowSurfaceForm): ConnectorGap {
  if (isNotchForm(form)) return NOTCH_REFERENCE_GAP;
  if (form === "reel") return REEL_REFERENCE_GAP;
  return FLOW_REFERENCE_GAPS[form] ?? { x: 0, y: 0 };
}
