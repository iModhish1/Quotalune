/**
 * ArcGauge — the signature QuotaArc capacity arc.
 *
 * Geometry: ring gap centered at the bottom; remaining capacity fills
 * clockwise from the gap's left edge (7:30 position) — same grammar as the
 * brand mark. The endpoint dot marks the current position.
 *
 * Rendering: SVG stroke-dasharray animation only (no layout work); the arc
 * animates exclusively when the value changes. Color and stroke weight come
 * from status semantics so urgency survives without color vision.
 */
import { memo, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  statusForUsage,
  STATUS_TOKEN,
  STATUS_STROKE_BIAS,
  type QuotaStatus,
} from "./semantics";
import { springSoft } from "./motion";

export interface ArcGaugeProps {
  /** Fraction of capacity REMAINING, 0..=1. Null renders unknown. */
  remaining: number | null;
  /** Diameter in px (SVG user units; scale via CSS). */
  size?: number;
  /** Base stroke width in px. */
  stroke?: number;
  /** Gap in degrees centered at the bottom of the ring. */
  gapDeg?: number;
  /** Hide the track ring. */
  hideTrack?: boolean;
  /** Endpoint position dot (default on). */
  showDot?: boolean;
  /** Override derived status (offline/refreshing/unknown). */
  statusOverride?: QuotaStatus;
  /** Accessible label; required. */
  ariaLabel: string;
  className?: string;
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  // 0deg = 12 o'clock, increasing clockwise (SVG y-down).
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  sweepDeg: number,
): string {
  const [sx, sy] = polar(cx, cy, r, startDeg);
  const [ex, ey] = polar(cx, cy, r, startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  // sweep-flag 1 = clockwise on screen.
  return `M ${sx.toFixed(3)} ${sy.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(3)} ${ey.toFixed(3)}`;
}

export const ArcGauge = memo(function ArcGauge({
  remaining,
  size = 44,
  stroke = 6,
  gapDeg = 90,
  hideTrack = false,
  showDot = true,
  statusOverride,
  ariaLabel,
  className,
}: ArcGaugeProps) {
  const systemReduced = useReducedMotion();
  const reduced = systemReduced === true;

  const clamped =
    remaining == null || !Number.isFinite(remaining)
      ? null
      : Math.min(1, Math.max(0, remaining));
  const status: QuotaStatus =
    statusOverride ?? (clamped == null ? "unknown" : statusForUsage(1 - clamped));

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - Math.max(stroke, stroke + STATUS_STROKE_BIAS[status])) / 2;
  const startDeg = 180 + gapDeg / 2;
  const sweep = 360 - gapDeg;
  const path = arcPath(cx, cy, r, startDeg, sweep);

  const [arcLen, setArcLen] = useState<number | null>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    // jsdom and other non-SVG environments lack getTotalLength; the gauge
    // still renders (track-only) there.
    const len = pathRef.current?.getTotalLength?.();
    if (typeof len === "number" && Number.isFinite(len)) setArcLen(len);
  }, [path]); // re-measure when geometry changes

  const filled =
    clamped == null || arcLen == null ? null : arcLen * clamped;
  const statusColor = STATUS_TOKEN[status];
  const strokeW = stroke + STATUS_STROKE_BIAS[status];

  const [dotX, dotY] =
    clamped == null
      ? [0, 0]
      : polar(cx, cy, r, startDeg + sweep * clamped);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {!hideTrack && (
        <path
          d={path}
          fill="none"
          stroke="var(--qa-hairline-strong)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      )}
      <motion.path
        ref={pathRef}
        d={path}
        fill="none"
        stroke={statusColor}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeDasharray={arcLen == null ? undefined : `${arcLen} ${arcLen}`}
        initial={false}
        animate={
          filled == null
            ? { strokeDashoffset: arcLen ?? 0, opacity: 0.35 }
            : { strokeDashoffset: arcLen === null ? 0 : arcLen - filled, opacity: 1 }
        }
        transition={reduced ? { duration: 0 } : springSoft}
      />
      {showDot && clamped != null && (
        <motion.circle
          r={Math.max(2.4, stroke * 0.58)}
          fill="var(--qa-ink-1)"
          initial={false}
          animate={{ cx: dotX, cy: dotY }}
          transition={reduced ? { duration: 0 } : springSoft}
        />
      )}
    </svg>
  );
});
