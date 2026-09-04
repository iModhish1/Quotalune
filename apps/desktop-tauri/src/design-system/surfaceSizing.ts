/**
 * QuotaArc V9 — shared responsive surface-sizing engine.
 *
 * ONE authoritative calculation consumed by Rust window management,
 * React surfaces, and the capture harness. No magic numbers anywhere else.
 *
 * All dimensions are LOGICAL pixels (CSS px). Physical = logical × dpiScale.
 *
 * Envelope rules (at 1280×752 CSS work area reference):
 *   Compact horizontal overlay: ≤35% work-area width, ≤20% height
 *   Compact edge rail:          ≤12% work-area width
 *   Expanded overlay:           ≤50% width, ≤45% height (non-topmost exempt)
 */

export type SurfaceKind = "taskbar" | "top" | "edge" | "hud" | "quick-panel" | "dashboard" | "settings";
export type SurfaceState = "compact" | "hover" | "expanded";
export type AnchorEdge = "top" | "bottom" | "left" | "right" | "none";

export interface SurfaceLayoutInput {
  surface: SurfaceKind;
  state: SurfaceState;
  /** Monitor work area in logical px. */
  workArea: { width: number; height: number };
  /** Device pixel ratio (1.0, 1.25, 1.5, 2.0...). */
  dpiScale: number;
  /** User-configured scale multiplier (0.75..2.0, default 1.0). */
  userScale: number;
  /** Number of providers to display. */
  providerCount: number;
  /** Which screen edge the surface is anchored to. */
  placement: AnchorEdge;
}

export interface SurfaceLayoutOutput {
  /** Logical window bounds for Tauri's set_size. */
  windowBounds: { width: number; height: number };
  /** Rendered content bounds inside the window (logical px). */
  contentBounds: { width: number; height: number };
  /** Effective scale after clamping. */
  scale: number;
  /** Safe insets the surface must respect (logical px). */
  safeArea: { top: number; bottom: number; left: number; right: number };
  /** Reserved label strip height (logical px). */
  labelArea: { height: number };
  /** Center point for positioning within the work area. */
  center: { x: number; y: number };
  /** Recommended orbit radius for instrument placement. */
  orbitRadius: number;
  /** Provider instrument size in px. */
  instrumentSize: number;
  /** Whether the surface is in its expanded state. */
  isExpanded: boolean;
  /** Provenance: which envelope constrained this layout. */
  clampedBy: string | null;
}

// ── Envelope table (logical px at reference 1280×752 work area) ─────────

const ENVELOPES: Record<
  string,
  { compact: [number, number]; expanded: [number, number]; maxWr: number; maxHr: number }
> = {
  taskbar:     { compact: [440, 140], expanded: [640, 340], maxWr: 0.35, maxHr: 0.20 },
  top:         { compact: [480, 110], expanded: [560, 260], maxWr: 0.35, maxHr: 0.20 },
  edge:        { compact: [110, 480], expanded: [260, 520], maxWr: 0.12, maxHr: 0.65 },
  hud:         { compact: [360, 400], expanded: [360, 400], maxWr: 0.30, maxHr: 0.55 },
  "quick-panel": { compact: [380, 520], expanded: [380, 520], maxWr: 0.32, maxHr: 0.70 },
  dashboard:   { compact: [520, 620], expanded: [520, 620], maxWr: 0.45, maxHr: 0.85 },
  settings:    { compact: [915, 758], expanded: [915, 758], maxWr: 0.75, maxHr: 0.95 },
};

const FALLBACK_ENVELOPE = ENVELOPES.taskbar;

/**
 * Compute the surface layout for a given set of inputs.
 * Pure, deterministic, DPI-aware. Clamps to work-area proportional caps.
 */
export function computeSurfaceLayout(input: SurfaceLayoutInput): SurfaceLayoutOutput {
  const envelope = ENVELOPES[input.surface] ?? FALLBACK_ENVELOPE;
  const isExpanded = input.state === "expanded";
  const [maxW, maxH] = isExpanded ? envelope.expanded : envelope.compact;

  // Scale: user scale × DPI normalization (Tauri works in logical px).
  const scale = Math.max(0.5, Math.min(2.0, input.userScale));

  // Base size from envelope.
  let width = maxW * scale;
  let height = maxH * scale;

  // Edge rails are authored directly in their vertical orientation:
  // width is the thickness crossing the screen edge, height the length
  // running along it. No dimension swap — the proportional caps below
  // then constrain thickness by maxWr and length by maxHr naturally.
  const isVerticalRail = input.surface === "edge";

  // Provider count density adjustment (compact only).
  if (!isExpanded && input.providerCount > 3) {
    const extra = Math.min(3, input.providerCount - 3) * 24;
    if (!isVerticalRail) width += extra;
    else height += extra;
  }

  // Proportional caps against the work area.
  const maxAllowedW = input.workArea.width * envelope.maxWr;
  const maxAllowedH = input.workArea.height * envelope.maxHr;
  let clampedBy: string | null = null;

  if (width > maxAllowedW) {
    width = Math.max(40, Math.floor(maxAllowedW));
    clampedBy = "work-area-width";
  }
  if (height > maxAllowedH) {
    height = Math.max(60, Math.floor(maxAllowedH));
    clampedBy = clampedBy ?? "work-area-height";
  }

  // Instrument sizing scales with the stage.
  const instrumentSize = isExpanded
    ? Math.round(Math.min(56, Math.max(36, width / 12)))
    : Math.round(Math.min(42, Math.max(28, width / 14)));
  const orbitRadius = Math.round(
    isVerticalRail
      ? height * 0.36
      : Math.min(width * 0.38, height * 0.36),
  );

  return {
    windowBounds: { width: Math.round(width), height: Math.round(height) },
    contentBounds: { width: Math.round(width), height: Math.round(height) },
    center: { x: Math.round(width / 2), y: Math.round(height / 2) },
    scale,
    safeArea: { top: 8, bottom: 8, left: 8, right: 8 },
    labelArea: { height: isExpanded ? 24 : 18 },
    orbitRadius,
    instrumentSize,
    isExpanded,
    clampedBy,
  };
}
