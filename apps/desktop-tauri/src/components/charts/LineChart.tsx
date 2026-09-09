import { useId, useRef, useState } from "react";
import { useChartAnimation } from "./useChartAnimation";
import {useWorkspacePresentation} from "../../design-system/WorkspacePresentation";

/**
 * LineChart — dependency-free SVG line chart with optional area fill,
 * entrance animation that sweeps the polyline up from the baseline,
 * and per-point hover tooltip.
 *
 * Port target: the credits-history line in
 * `rust/src/native_ui/charts.rs`.
 */

export interface LineChartPoint {
  label: string;
  value: number;
  timestamp?: number;
}

export interface LineChartProps {
  data: LineChartPoint[];
  color?: string;
  height?: number;
  valueFormatter?: (n: number) => string;
  ariaLabel: string;
  /** When true, render a faint filled area under the line. Defaults true. */
  area?: boolean;
  animations?: boolean;
  emptyMessage?: string;
  /**
   * Pre-translated prefix for the peak-value annotation (e.g. "Max",
   * caller-supplied like `ariaLabel`/`emptyMessage` -- this component has
   * no locale dependency of its own). When omitted, the peak value renders
   * with no prefix (previous behavior, preserved for any caller that
   * hasn't been updated yet).
   */
  maxLabel?: string;
  expectedStep?: number;
}

const DEFAULT_COLOR = "var(--chart-credits)";
const SVG_WIDTH = 280;

export function LineChart({
  data,
  color = DEFAULT_COLOR,
  height = 56,
  valueFormatter,
  ariaLabel,
  area = true,
  animations = true,
  emptyMessage,
  maxLabel,
  expectedStep,
}: LineChartProps) {
  const fmt = valueFormatter ?? ((v: number) => v.toFixed(2));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const gradientId = useId();
  const {chartStyle} = useWorkspacePresentation();

  const anim = useChartAnimation(data.length, animations, [
    data.length,
    data[0]?.label,
    data[data.length - 1]?.label,
  ]);

  if (data.length === 0 || !data.some(point => Number.isFinite(point.value))) {
    return (
      <div className="chart chart--line">
        <div className="chart__empty">{emptyMessage ?? ""}</div>
      </div>
    );
  }

  const values = data.map((p) => p.value);
  const max = values.reduce((result,value) => Number.isFinite(value) ? Math.max(result,value) : result, 0);
  const min = values.reduce((result,value) => Number.isFinite(value) ? Math.min(result,value) : result, 0);
  const range = Math.max(max - min, 0.0001);

  const plotHeight = Math.max(1, height - 4);
  const pad = 2;
  const usableWidth = SVG_WIDTH - pad * 2;

  // Baseline target Y (plot bottom) — the line animates from the
  // baseline up to its final Y, mirroring the bar entrance.
  const baselineY = pad + plotHeight;

  const step = data.length > 1 ? usableWidth / (data.length - 1) : 0;
  const temporal = data.every(point => Number.isFinite(point.timestamp)) && data[data.length-1].timestamp! > data[0].timestamp!;
  const coords = data.map((p, i) => {
    const x = temporal ? pad + (p.timestamp! - data[0].timestamp!) / (data[data.length-1].timestamp! - data[0].timestamp!) * usableWidth : pad + i * step;
    const finalY = pad + plotHeight - ((p.value - min) / range) * plotHeight;
    const t = anim.barProgress(i);
    const y = baselineY + (finalY - baselineY) * t;
    return { x, y, finalY };
  });



  // Anchor the peak-value annotation to the actual highest point's x
  // position (first occurrence), not a fixed center -- it previously sat at
  // a constant SVG_WIDTH/2 regardless of where the peak actually fell,
  // reading as an orphaned number disconnected from the data. Clamped away
  // from the two edge date labels so it never overlaps them.
  //
  // The axis row's `<span>` positions are expressed as PERCENTAGES of
  // SVG_WIDTH (via `toPercent` below), not raw pixels: the SVG itself
  // scales to fill its container via `width:100%`/viewBox, but a real
  // rendered card is usually far wider than SVG_WIDTH=280 -- raw
  // `left:${x}px` values (the previous behavior) never rescaled to match,
  // so the axis labels quietly clustered inside the leftmost ~280px of
  // whatever the real container width was, leaving the rest empty. This
  // surfaced as a real, reproduced bug: at a wide card width, Arabic's
  // longer "الأقصى 98%" max-value label and the "٧ سبتمبر" end-date label
  // sat close enough (in that stale absolute-pixel coordinate space) to
  // visually merge with no gap between them.
  const maxIndex = values.indexOf(max);
  const maxLabelMargin = SVG_WIDTH * 0.18;
  const maxLabelX = Math.min(
    Math.max(coords[maxIndex]?.x ?? SVG_WIDTH / 2, maxLabelMargin),
    SVG_WIDTH - maxLabelMargin,
  );
  const toPercent = (x: number) => `${((x / SVG_WIDTH) * 100).toFixed(2)}%`;

  const segments: typeof coords[] = [];
  let segment: typeof coords = [];
  data.forEach((point,index) => {
    const previous = data[index-1];
    if (!Number.isFinite(point.value)) { if(segment.length) segments.push(segment); segment=[]; return; }
    if (previous && temporal && (point.timestamp! <= previous.timestamp! || (expectedStep && point.timestamp! - previous.timestamp! > expectedStep * 1.5))) {
      if(segment.length) segments.push(segment); segment=[];
    }
    segment.push(coords[index]);
  });
  if(segment.length) segments.push(segment);
  const areaPath = area && chartStyle !== "minimal" ? segments.filter(group=>group.length>1).map(group=>`M ${group[0].x} ${baselineY} ${group.map(c=>`L ${c.x} ${c.y}`).join(" ")} L ${group[group.length-1].x} ${baselineY} Z`).join(" ") : null;

  const onPointMove = (e: React.MouseEvent<SVGCircleElement>, i: number) => {
    const host = containerRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    setHover({ i, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const onLeave = () => setHover(null);

  return (
    <div className="chart chart--line" ref={containerRef}>
      <svg
        width={SVG_WIDTH}
        height={height}
        viewBox={`0 0 ${SVG_WIDTH} ${height}`}
        className="chart__svg"
        role="img"
        aria-label={ariaLabel}
      >
        {areaPath && (
          <>
            {/* Restrained observatory-style fill (section 13): a gradient
                that fades toward the baseline instead of one flat block of
                opacity, so the plot reads as quiet depth rather than a
                heavy solid slab of color. */}
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gradientId})`} className="chart__area" />
          </>
        )}
        {/* Baseline hairline -- grounds the plot instead of letting the
            fill/line float with no lower reference edge. */}
        <line
          x1={pad}
          y1={baselineY}
          x2={pad + usableWidth}
          y2={baselineY}
          className="chart__baseline"
        />
        {segments.map((group,index)=><polyline key={index}
          points={group.map(c=>`${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.95}
          className="chart__line"
        />)}
        {data.map((p, i) => Number.isFinite(p.value) && (
          <circle
            key={`${p.label}-${i}`}
            cx={coords[i].x}
            cy={coords[i].y}
            r={hover?.i === i || chartStyle === "detailed" ? 3 : chartStyle === "minimal" ? 1 : 1.8}
            fill={color}
            className="chart__point"
            tabIndex={0}
            role="img"
            aria-label={`${p.label}: ${fmt(p.value)}`}
            onFocus={() => setHover({i,x:coords[i].x / SVG_WIDTH * (containerRef.current?.clientWidth ?? SVG_WIDTH),y:coords[i].y})}
            onBlur={onLeave}
            onKeyDown={event=>{if(event.key === "Escape") onLeave();}}
            onMouseMove={(e) => onPointMove(e, i)}
            onMouseLeave={onLeave}
          >
            <title>
              {p.label}: {fmt(p.value)}
            </title>
          </circle>
        ))}
        {/* Peak marker (section 13): a quiet outer ring ties the "Max"
            annotation below to the actual point it describes, instead of
            the peak looking identical to every other sample. */}
        <circle
          cx={coords[maxIndex]?.x}
          cy={coords[maxIndex]?.y}
          r={3.5}
          fill="none"
          stroke={color}
          strokeWidth={1}
          opacity={0.55}
          className="chart__peak-ring"
          aria-hidden="true"
        />
      </svg>
      <div className="chart__axis">
        {/* Previously `.label.slice(-5)` -- a hardcoded last-5-characters
            trim that silently assumed every caller's label was already
            English-length ("Sep 4"). A real Arabic screenshot caught this
            breaking: Intl's ar-SA short month name ("سبتمبر") is longer
            than 5 characters, so the trim sliced mid-word into "بتمبر"
            (missing its first letter). Labels are now trusted as-is --
            every real caller already formats its own locale-appropriate
            short label (UsageTrendSection's bucketFormatter,
            CreditsHistoryChart's date formatter). */}
        <span style={{ left: toPercent(pad) }}>
          <bdi>{data[0].label}</bdi>
        </span>
        <span className="chart__axis-max" style={{ left: toPercent(maxLabelX) }}>
          {maxLabel ? `${maxLabel} ` : null}
          <bdi>{fmt(max)}</bdi>
        </span>
        <span style={{ left: toPercent(SVG_WIDTH - pad) }}>
          <bdi>{data[data.length - 1].label}</bdi>
        </span>
      </div>
      {hover && data[hover.i] && !anim.running && (
        <div
          className="chart__tooltip"
          style={{ left: hover.x, top: hover.y }}
          role="tooltip"
        >
          <span className="chart__tooltip-label">{data[hover.i].label}</span>
          <strong>{fmt(data[hover.i].value)}</strong>
        </div>
      )}
    </div>
  );
}
