/**
 * QuotaArc V4 Physical Surface engine.
 *
 * Principle (from the TrackNotch study, docs/research/TRACKNOTCH_REFERENCE_STUDY.md):
 * the housing is a SHAPE, not a styled div. Asymmetric animatable radii —
 * small inward curl toward the physical anchor, generous outward flare on the
 * free side — make the surface look grown from the edge rather than placed.
 *
 * Layers are separated: the housing path (fill+stroke SVG) morphs first;
 * content choreographs after (instruments stagger, then secondary reveal).
 */
import { useMemo, type ReactNode } from "react";

export type QaAnchor = "top" | "bottom" | "left" | "right" | "float";

/**
 * TrackNotch-informed housing path, translated for the given anchor.
 *  - anchorTop: inward curl at top (toward the screen edge), outward flare
 *    at bottom — the notch silhouette.
 *  - anchorBottom (taskbar seam): mirrored vertically.
 *  - side anchors: rotated equivalents.
 */
export function housingPath(
  w: number,
  h: number,
  anchorRadius: number,
  freeRadius: number,
  anchor: QaAnchor,
): string {
  const a = anchorRadius; // curl toward the anchor edge
  const f = freeRadius; // flare on the free edge
  if (anchor === "top") {
    // flush top edge; inward top curls; outward bottom flare
    return [
      `M 0 0`,
      `L ${w} 0`,
      `Q ${w - a} 0 ${w - a} ${a}`,
      `L ${w - a} ${h - f}`,
      `Q ${w - a} ${h} ${w - a - f} ${h}`,
      `L ${a + f} ${h}`,
      `Q ${a} ${h} ${a} ${h - f}`,
      `L ${a} ${a}`,
      `Q ${a} 0 0 0`,
      `Z`,
    ].join(" ");
  }
  if (anchor === "bottom") {
    // flush bottom (taskbar seam); inward bottom curls; outward top flare
    return [
      `M 0 ${h}`,
      `L 0 ${f}`,
      `Q 0 0 ${a + f} 0`,
      `L ${w - a - f} 0`,
      `Q ${w - a} 0 ${w - a} ${f}`,
      `L ${w - a} ${h - a}`,
      `Q ${w - a} ${h} ${w} ${h}`,
      `L 0 ${h}`,
      `Z`,
    ].join(" ");
  }
  if (anchor === "right") {
    // flush right edge; inward curl right; outward flare left
    return [
      `M ${w} 0`,
      `L ${w} ${h}`,
      `L ${f} ${h}`,
      `Q 0 ${h} 0 ${h - f}`,
      `L 0 ${f}`,
      `Q 0 0 ${f} 0`,
      `L ${w - f} 0`,
      `Q ${w} 0 ${w} ${f}`,
      `L ${w} ${h}`,
      `Z`,
    ].join(" ");
  }
  // float: symmetric capsule-ish
  return `M ${f} 0 L ${w - f} 0 Q ${w} 0 ${w} ${f} L ${w} ${h - f} Q ${w} ${h} ${w - f} ${h} L ${f} ${h} Q 0 ${h} 0 ${h - f} L 0 ${f} Q 0 0 ${f} 0 Z`;
}

export interface QaPhysicalSurfaceProps {
  anchor: QaAnchor;
  width: number;
  height: number;
  /** Curl radius toward the anchor edge (small: 5–8). */
  anchorRadius?: number;
  /** Flare radius on the free edge (generous: 12–22). */
  freeRadius?: number;
  material?: "graphite" | "glass";
  children?: ReactNode;
  className?: string;
}

/** V4 housing: SVG shape fill + hairline stroke; content layered above. */
export function QaPhysicalSurface({
  anchor,
  width,
  height,
  anchorRadius = 6,
  freeRadius = 14,
  material = "graphite",
  children,
  className = "",
}: QaPhysicalSurfaceProps) {
  const d = useMemo(
    () => housingPath(width, height, anchorRadius, freeRadius, anchor),
    [width, height, anchorRadius, freeRadius, anchor],
  );
  const fill =
    material === "glass"
      ? "url(#qa-glass-v4)"
      : "url(#qa-graphite-v4)";
  return (
    <div className={`qa-v4 ${className}`} style={{ width, height, position: "relative" }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, display: "block", overflow: "visible" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="qa-graphite-v4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#161c26" />
            <stop offset="1" stopColor="#0b0f15" />
          </linearGradient>
          <linearGradient id="qa-glass-v4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(30,38,52,0.92)" />
            <stop offset="1" stopColor="rgba(13,18,26,0.94)" />
          </linearGradient>
        </defs>
        <path d={d} fill={fill} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <path d={d} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} transform="translate(0,-1)" />
      </svg>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </div>
  );
}

/**
 * Choreography (TrackNotch principle, Windows-tuned):
 *   T0            housing morphs
 *   T+80ms        instruments emerge, 25ms stagger each
 *   T+180ms       secondary content fades in
 * Opening is springy; closing is controlled (shorter, no overshoot).
 */
export const CHOREOGRAPHY = {
  instrumentDelay: (index: number) => 0.08 + index * 0.025,
  contentDelay: 0.18,
  openSpring: { type: "spring" as const, stiffness: 420, damping: 30, mass: 0.9 },
  closeEase: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const },
  instrumentSpring: { type: "spring" as const, stiffness: 500, damping: 32 },
  contentEase: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
};
