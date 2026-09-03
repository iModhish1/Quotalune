/**
 * QuotaArc Arc V3 — the signature capacity arc.
 *
 * Geometry language (recognizable without the product name):
 *  - origin at 200° (bottom-left), sweeping clockwise to close at 160°+360;
 *  - the origin carries a small perpendicular ORIGIN NOTCH (the "zero mark");
 *  - the head carries the ENDPOINT DOT (current position);
 *  - the track is a full hairline circle (dual-track: hairline + colored arc);
 *  - gap is asymmetric by construction (origin/head sit near the bottom).
 *
 * This replaces the generic equal-gap progress ring.
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

export interface ArcV3Props {
  /** Fraction of capacity REMAINING, 0..=1. Null renders unknown. */
  remaining: number | null;
  size?: number;
  stroke?: number;
  statusOverride?: QuotaStatus;
  showDot?: boolean;
  /** Show the origin notch (default on at >=24px). */
  showNotch?: boolean;
  /** Provider-color override (theme catalog: provider-color forward). */
  colorOverride?: string;
  ariaLabel: string;
  className?: string;
}

const ORIGIN_DEG = 200; // bottom-left
const SWEEP_DEG = 340; // leaves an asymmetric 20° mouth near the bottom

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const [sx, sy] = polar(cx, cy, r, startDeg);
  const [ex, ey] = polar(cx, cy, r, startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${sx.toFixed(3)} ${sy.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(3)} ${ey.toFixed(3)}`;
}

export const ArcGaugeV3 = memo(function ArcGaugeV3({
  remaining,
  size = 28,
  stroke = 3,
  statusOverride,
  showDot = true,
  showNotch = true,
  colorOverride,
  ariaLabel,
  className,
}: ArcV3Props) {
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
  const sw = stroke + STATUS_STROKE_BIAS[status];
  const r = (size - sw) / 2;
  const path = arcPath(cx, cy, r, ORIGIN_DEG, SWEEP_DEG);

  const [arcLen, setArcLen] = useState<number | null>(null);
  const pathRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    const len = pathRef.current?.getTotalLength?.();
    if (typeof len === "number" && Number.isFinite(len)) setArcLen(len);
  }, [path]);

  const filled = clamped == null || arcLen == null ? null : arcLen * clamped;
  const statusColor = colorOverride ?? STATUS_TOKEN[status];

  const [dotX, dotY] =
    clamped == null ? [0, 0] : polar(cx, cy, r, ORIGIN_DEG + SWEEP_DEG * clamped);

  const [nx, ny] = polar(cx, cy, r, ORIGIN_DEG);
  const [ntx, nty] = polar(cx, cy, r + sw * 0.9, ORIGIN_DEG);
  const [nbx, nby] = polar(cx, cy, r - sw * 0.9, ORIGIN_DEG);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {/* dual-track: full hairline circle */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--qa-track)" strokeWidth={Math.max(1, sw * 0.45)} />
      <motion.path
        ref={pathRef}
        d={path}
        fill="none"
        stroke={statusColor}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={arcLen == null ? undefined : `${arcLen} ${arcLen}`}
        initial={false}
        animate={
          filled == null
            ? { strokeDashoffset: arcLen ?? 0, opacity: 0.32 }
            : { strokeDashoffset: arcLen === null ? 0 : arcLen - filled, opacity: 1 }
        }
        transition={reduced ? { duration: 0 } : springSoft}
      />
      {showNotch && size >= 24 && (
        <line x1={nbx} y1={nby} x2={ntx} y2={nty} stroke="var(--qa-ink-3)" strokeWidth={Math.max(1, sw * 0.5)} strokeLinecap="round" />
      )}
      {showDot && clamped != null && (
        <motion.circle
          r={Math.max(2, sw * 0.62)}
          fill="var(--qa-ink-1)"
          initial={false}
          animate={{ cx: dotX, cy: dotY }}
          transition={reduced ? { duration: 0 } : springSoft}
        />
      )}
    </svg>
  );
});
