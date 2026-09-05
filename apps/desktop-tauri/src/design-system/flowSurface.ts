/**
 * Shared, theme-neutral contract for the one live Flow Surface window.
 *
 * A form changes its compact silhouette and the direction that details open;
 * it never changes quota semantics or creates a second native window.
 */
export type FlowSurfaceForm = "flowline" | "horizon" | "petal";
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
  form: FlowSurfaceForm;
  anchor: FlowSurfaceAnchor;
  scale: number;
  autoHide: boolean;
  autoHideDelayMs: number;
}

export interface FlowSurfaceEnvelope {
  width: number;
  height: number;
}

export const DEFAULT_FLOW_SURFACE_SETTINGS: Readonly<FlowSurfaceSettings> = {
  form: "flowline",
  anchor: "right",
  scale: 100,
  autoHide: true,
  autoHideDelayMs: 900,
};

const VALID_FORMS = new Set<FlowSurfaceForm>(["flowline", "horizon", "petal"]);
const VALID_ANCHORS = new Set<FlowSurfaceAnchor>([
  "left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right", "free",
]);

const BASE_ENVELOPES: Record<FlowSurfaceForm, Record<Exclude<FlowSurfaceState, "hidden" | "peek" | "hover" | "pinned">, FlowSurfaceEnvelope>> = {
  flowline: {
    compact: { width: 56, height: 310 },
    expanded: { width: 330, height: 160 },
  },
  horizon: {
    compact: { width: 350, height: 58 },
    expanded: { width: 350, height: 208 },
  },
  petal: {
    compact: { width: 170, height: 118 },
    expanded: { width: 300, height: 160 },
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
): FlowSurfaceEnvelope {
  if (state === "hidden") {
    if (form === "horizon") return { width: 72, height: 10 };
    if (form === "petal") return { width: 18, height: 18 };
    return { width: 10, height: 56 };
  }
  if (state === "peek") {
    if (form === "horizon") return { width: 120, height: 16 };
    if (form === "petal") return { width: 32, height: 32 };
    return { width: 18, height: 72 };
  }
  const base = BASE_ENVELOPES[form][state === "expanded" || state === "pinned" ? "expanded" : "compact"];
  const factor = clamp(scale, 75, 125) / 100;
  return {
    width: Math.round(base.width * factor),
    height: Math.round(base.height * factor),
  };
}

/** Open the temporary detail bubble into workspace, never through an edge. */
export function resolveDetailDirection(form: FlowSurfaceForm, anchor: FlowSurfaceAnchor): DetailDirection {
  if (form === "flowline") return anchor === "left" ? "right" : "left";
  if (form === "horizon") return anchor === "bottom" ? "up" : "down";
  if (anchor === "bottom-left") return "up-right";
  if (anchor === "bottom-right") return "up-left";
  if (anchor === "top-left") return "right";
  if (anchor === "top-right") return "left";
  return "up-right";
}
