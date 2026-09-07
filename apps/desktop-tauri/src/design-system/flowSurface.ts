/**
 * Shared, theme-neutral contract for the one live Flow Surface window.
 *
 * A form changes its compact silhouette and the direction that details open;
 * it never changes quota semantics or creates a second native window.
 */
import { isNotchForm, notchLayout, type NotchForm } from "../surfaces/notch/notchGeometry";
import {normalizeSurfaceInteractions,type SurfaceInteractions} from "./surfaceInteractions";
export type FlowSurfaceForm = "flowline" | "horizon" | "petal" | "orbital" | "lens" | "reel" | NotchForm;
export type FlowSurfaceAnchor =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "free";
export type FlowSurfaceState = "hidden" | "peek" | "compact" | "hover" | "expanded" | "pinned";
export type DetailDirection = "left" | "right" | "up" | "down" | "up-right" | "up-left";

export interface FlowSurfaceSettings {
  interactions?: SurfaceInteractions;
  form: FlowSurfaceForm;
  anchor: FlowSurfaceAnchor;
  scale: number;
  autoHide: boolean;
  autoHideDelayMs: number;
}

/**
 * The structure catalog is presentation-only. Each entry declares the small
 * set of anchors where its geometry remains readable and unobtrusive.
 */
export interface FlowSurfaceFormDefinition {
  id: FlowSurfaceForm;
  name: string;
  description: string;
  defaultAnchor: FlowSurfaceAnchor;
  anchors: readonly FlowSurfaceAnchor[];
}

export const ALL_FLOW_SURFACE_ANCHORS = [
  "right","left","top","bottom","top-left","top-right","bottom-left","bottom-right","free",
] as const satisfies readonly FlowSurfaceAnchor[];

export const FLOW_SURFACE_FORM_CATALOG = [
  {id:'crescent',name:'Crescent Rail',description:'Narrow curved rail with independent provider wells',defaultAnchor:'right',
    anchors:['right','left','top','bottom','top-left','top-right','bottom-left','bottom-right','free']},
  {
    id: "pebble", name: "Pebble", description: "Soft three-lobe provider cluster",
    defaultAnchor: "right",
    anchors: ["right","left","top","bottom","top-left","top-right","bottom-left","bottom-right","free"],
  },
  {
    id: "fan", name: "Fan", description: "Soft scalloped provider fan",
    defaultAnchor: "bottom",
    anchors: ["right","left","top","bottom","top-left","top-right","bottom-left","bottom-right","free"],
  },
  ...(["seam", "ribbon", "cradle", "deck", "satellite"] as const).map((id,index) => ({
    id, name: ["Seam", "Ribbon", "Cradle", "Deck", "Satellite"][index],
    description: ["Sculpted edge notch", "Three-instrument ribbon", "Corner-hugging curve", "Stacked provider switcher", "Compact curved orbit"][index],
    defaultAnchor: (id === "ribbon" ? "top" : id === "cradle" ? "bottom-right" : "right") as FlowSurfaceAnchor,
    anchors: ["right","left","top","bottom","top-left","top-right","bottom-left","bottom-right","free"] as FlowSurfaceAnchor[],
  })),
  {
    id: "flowline",
    name: "Flowline",
    description: "Quiet vertical rail",
    defaultAnchor: "right",
    anchors: ALL_FLOW_SURFACE_ANCHORS,
  },
  {
    id: "reel",
    name: "Orbit Reel",
    description: "Curved provider carousel",
    defaultAnchor: "right",
    anchors: ["right", "left", "top", "bottom", "bottom-right", "bottom-left", "top-right", "top-left", "free"],
  },
  {
    id: "horizon",
    name: "Horizon",
    description: "Low-profile edge ribbon",
    defaultAnchor: "top",
    anchors: ALL_FLOW_SURFACE_ANCHORS,
  },
  {
    id: "petal",
    name: "Petal",
    description: "Compact corner island",
    defaultAnchor: "bottom-right",
    anchors: ["right", "left", "top", "bottom", "bottom-right", "bottom-left", "top-right", "top-left", "free"],
  },
  {
    id: "orbital",
    name: "Orbital",
    description: "Soft floating instrument",
    defaultAnchor: "bottom-right",
    anchors: ["right", "left", "top", "bottom", "bottom-right", "bottom-left", "top-right", "top-left", "free"],
  },
  {
    id: "lens",
    name: "Lens",
    description: "Low-profile responsive capsule",
    defaultAnchor: "bottom-right",
    anchors: ["right", "left", "top", "bottom", "bottom-right", "bottom-left", "top-right", "top-left", "free"],
  },
] as const satisfies readonly FlowSurfaceFormDefinition[];

const FLOW_SURFACE_FORM_BY_ID = new Map(
  FLOW_SURFACE_FORM_CATALOG.map((form) => [form.id, form] as const),
);

const FLOW_SURFACE_ANCHOR_LABELS: Readonly<Record<FlowSurfaceAnchor, string>> = {
  left: "Left wall",
  right: "Right wall",
  top: "Top wall",
  bottom: "Bottom wall",
  "bottom-right": "Bottom right",
  "bottom-left": "Bottom left",
  "top-right": "Top right",
  "top-left": "Top left",
  free: "Free placement",
};

export function flowSurfaceFormDefinition(form: FlowSurfaceForm): FlowSurfaceFormDefinition {
  return FLOW_SURFACE_FORM_BY_ID.get(form) ?? FLOW_SURFACE_FORM_CATALOG.find(entry => entry.id === "flowline")!;
}

export function flowSurfaceDefaultAnchor(form: FlowSurfaceForm): FlowSurfaceAnchor {
  return flowSurfaceFormDefinition(form).defaultAnchor;
}

export function flowSurfaceAnchorOptions(form: FlowSurfaceForm): readonly FlowSurfaceAnchor[] {
  return flowSurfaceFormDefinition(form).anchors;
}

export function flowSurfaceAnchorLabel(form: FlowSurfaceForm, anchor: FlowSurfaceAnchor): string {
  if (form === "flowline" && anchor === "right") return "Right edge";
  if (form === "flowline" && anchor === "left") return "Left edge";
  if (form === "horizon" && anchor === "top") return "Top edge";
  if (form === "horizon" && anchor === "bottom") return "Bottom edge";

  return FLOW_SURFACE_ANCHOR_LABELS[anchor];
}

export interface FlowSurfaceEnvelope {
  width: number;
  height: number;
}

/** The minimum truthful payload required to earn space on a compact surface. */
export interface SurfaceQuotaValue {
  arcFraction: number | null;
  primaryValue: number | null;
}

/**
 * A provider registration is not a quota reading. Keep offline placeholders
 * out of the compact surface until the runtime has an actual resolved value.
 */
export function hasSurfaceQuotaValue(value: SurfaceQuotaValue): boolean {
  return Number.isFinite(value.arcFraction)
    && Number.isFinite(value.primaryValue)
    && value.arcFraction !== null
    && value.primaryValue !== null;
}

export const DEFAULT_FLOW_SURFACE_SETTINGS: Readonly<FlowSurfaceSettings> = {
  form: "flowline",
  anchor: "right",
  scale: 100,
  autoHide: true,
  autoHideDelayMs: 900,
};

const VALID_FORMS = new Set<FlowSurfaceForm>(FLOW_SURFACE_FORM_CATALOG.map((form) => form.id));
const VALID_ANCHORS = new Set<FlowSurfaceAnchor>([
  "left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right", "free",
]);

const BASE_ENVELOPES: Record<Exclude<FlowSurfaceForm,NotchForm>, Record<Exclude<FlowSurfaceState, "hidden" | "peek" | "hover" | "pinned">, FlowSurfaceEnvelope>> = {
  reel: {
    compact: { width: 112, height: 208 },
    expanded: { width: 320, height: 224 },
  },
  flowline: {
    compact: { width: 56, height: 310 },
    // Wave 6 Phase 4 (owner-reported): 160 was too short for a left/right
    // anchor — .flow-surface__quick-providers stacks its 3 satellite
    // gauges in a vertical column here (flex-direction:column, unrotated),
    // whose real content height (measured live: ~42px top offset + 157px
    // of gauges/gaps) is ~200px, clipping the third gauge's percentage by
    // ~40px against the window's bottom edge — the third satellite (which
    // could be any provider position-wise, reported live as "Gemini") had
    // its value text pushed past the window boundary. 210 leaves a small
    // margin. Top/bottom anchors rotate width<->height and use a row
    // layout for quick-providers instead, so the extra height (becoming
    // width there) is harmless slack, not a new problem.
    expanded: { width: 330, height: 210 },
  },
  horizon: {
    compact: { width: 350, height: 58 },
    expanded: { width: 350, height: 208 },
  },
  petal: {
    compact: { width: 170, height: 118 },
    expanded: { width: 300, height: 160 },
  },
  orbital: {
    compact: { width: 104, height: 104 },
    expanded: { width: 288, height: 174 },
  },
  lens: {
    compact: { width: 178, height: 76 },
    expanded: { width: 310, height: 176 },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isForm(value: unknown): value is FlowSurfaceForm {
  return typeof value === "string" && VALID_FORMS.has(value as FlowSurfaceForm);
}

function isAnchor(value: unknown): value is FlowSurfaceAnchor {
  return typeof value === "string" && VALID_ANCHORS.has(value as FlowSurfaceAnchor);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Normalize untrusted persisted settings into a safe, compact presentation. */
export function normalizeFlowSurfaceSettings(value: unknown): FlowSurfaceSettings {
  if (!isRecord(value) || !isForm(value.form) || !isAnchor(value.anchor)) {
    return { ...DEFAULT_FLOW_SURFACE_SETTINGS };
  }
  return {
    form: value.form,
    interactions: normalizeSurfaceInteractions(isRecord(value.interactions)?value.interactions:undefined),
    anchor: value.anchor,
    scale: clamp(Math.round(finiteNumber(value.scale, DEFAULT_FLOW_SURFACE_SETTINGS.scale)), 75, 125),
    autoHide: typeof value.autoHide === "boolean" ? value.autoHide : DEFAULT_FLOW_SURFACE_SETTINGS.autoHide,
    autoHideDelayMs: clamp(
      Math.round(finiteNumber(value.autoHideDelayMs, DEFAULT_FLOW_SURFACE_SETTINGS.autoHideDelayMs)),
      300,
      3_000,
    ),
  };
}

/** Return logical native-window bounds for the requested visual state. */
export function flowSurfaceEnvelope(
  form: FlowSurfaceForm,
  state: FlowSurfaceState,
  scale: number,
  providerCount = 3,
  anchor: FlowSurfaceAnchor = flowSurfaceDefaultAnchor(form),
): FlowSurfaceEnvelope {
  if (isNotchForm(form)) {
    const size=notchLayout(form,state,anchor,providerCount);
    const factor=state === "hidden" || state === "peek" ? 1 : clamp(scale,75,125)/100;
    return {width:Math.round(size.width*factor),height:Math.round(size.height*factor)};
  }
  const rotateFlowline=form==='flowline'&&(anchor==='top'||anchor==='bottom');
  const rotateHorizon=form==='horizon'&&(anchor==='left'||anchor==='right');
  const orient=(size:FlowSurfaceEnvelope):FlowSurfaceEnvelope=>rotateFlowline||rotateHorizon?{width:size.height,height:size.width}:size;
  if (state === "hidden") {
    if (form === "horizon") return orient({ width: 96, height: 14 });
    if (form === "petal" || form === "orbital" || form === "lens") return { width: 28, height: 28 };
    return orient({ width: 28, height: 58 });
  }
  if (state === "peek") {
    if (form === "horizon") return orient({ width: 120, height: 16 });
    if (form === "petal" || form === "orbital" || form === "lens") return { width: 32, height: 32 };
    return orient({ width: 18, height: 72 });
  }
  const compact = state !== "expanded" && state !== "pinned";
  const providers = Math.max(0, Math.min(3, Math.floor(providerCount)));
  const emptyEnvelope: Record<Exclude<FlowSurfaceForm,NotchForm>, FlowSurfaceEnvelope> = {
    reel: { width: 112, height: 208 },
    flowline: { width: 56, height: 84 },
    horizon: { width: 138, height: 52 },
    petal: { width: 64, height: 64 },
    orbital: { width: 64, height: 64 },
    lens: { width: 76, height: 56 },
  };
  const base = compact && providers === 0
    ? emptyEnvelope[form]
    : compact && form === "flowline"
      ? { width: 56, height: 76 + providers * 50 }
      : BASE_ENVELOPES[form][compact ? "compact" : "expanded"];
  const factor = clamp(scale, 75, 125) / 100;
  const envelope={
    width: Math.round(base.width * factor),
    height: Math.round(base.height * factor),
  };
  return rotateHorizon || rotateFlowline && compact ? {width:envelope.height,height:envelope.width}:envelope;
}

/** Open the temporary detail bubble into workspace, never through an edge. */
export function resolveDetailDirection(form: FlowSurfaceForm, anchor: FlowSurfaceAnchor): DetailDirection {
  if (form === "flowline" || form === "horizon") {
    if (anchor.includes("left")) return "right";
    if (anchor.includes("right")) return "left";
    return anchor === "bottom" ? "up" : "down";
  }
  if (form === "orbital") {
    if (anchor === "bottom-left") return "up-right";
    if (anchor === "top-right") return "left";
    if (anchor === "top-left") return "right";
    return "up-left";
  }
  if (form === "lens") {
    if (anchor === "left" || anchor === "top-left" || anchor === "bottom-left") return "right";
    if (anchor === "right" || anchor === "top-right" || anchor === "bottom-right") return "left";
    return anchor === "bottom" ? "up" : "down";
  }
  if (anchor === "bottom-left") return "up-right";
  if (anchor === "bottom-right") return "up-left";
  if (anchor === "top-left") return "right";
  if (anchor === "top-right") return "left";
  return "up-right";
}
