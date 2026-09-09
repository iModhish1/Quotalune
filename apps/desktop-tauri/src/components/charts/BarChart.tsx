import { useMemo, useRef, useState } from "react";
import {useWorkspacePresentation} from "../../design-system/WorkspacePresentation";
import { useChartAnimation } from "./useChartAnimation";

/**
 * BarChart — dependency-free SVG bar chart with entrance animation,
 * hover tooltip, and a yellow peak cap. Mirrors the visuals from
 * `rust/src/native_ui/charts.rs` (ChartBar::draw).
 *
 * Phase 10 additions:
 *   - entrance animation with staggered ease-out (respects
 *     `animations` prop and `prefers-reduced-motion`)
 *   - absolute-positioned hover tooltip
 *   - peak cap rendered as a separate rect filled with `--chart-peak`
 */

export interface BarChartPoint {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartPoint[];
  color?: string;
  height?: number;
  valueFormatter?: (n: number) => string;
  ariaLabel: string;
  /** When false, bars render at their final size immediately. */
  animations?: boolean;
  /** Optional empty-state message rendered when `data.length === 0`. */
  emptyMessage?: string;
}

const DEFAULT_COLOR = "var(--chart-cost)";
const BAR_GAP = 2;
const SVG_WIDTH = 280;
const CAP_HEIGHT = 5;

export function BarChart({
  data,
  color = DEFAULT_COLOR,
  height = 56,
  valueFormatter,
  ariaLabel,
  animations = true,
  emptyMessage,
}: BarChartProps) {
  const {chartStyle} = useWorkspacePresentation();
  const fmt = valueFormatter ?? ((v: number) => v.toFixed(2));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const anim = useChartAnimation(data.length, animations, [
    data.length,
    data[0]?.label,
    data[data.length - 1]?.label,
  ]);

  const { max, peakIndex } = useMemo(() => {
    let m = 0;
    let p = -1;
    for (let i = 0; i < data.length; i++) {
      const v = data[i].value;
      if (Number.isFinite(v) && v > m) {
        m = v;
        p = i;
      }
    }
    return { max: m, peakIndex: p };
  }, [data]);

  if (!data.some(point => Number.isFinite(point.value) && point.value >= 0)) {
    return (
      <div className="chart chart--bar">
        <div className="chart__empty">{emptyMessage ?? ""}</div>
      </div>
    );
  }

  const barWidth = Math.max(
    1,
    Math.floor((SVG_WIDTH - (data.length - 1) * BAR_GAP) / data.length),
  );
  const actualWidth = data.length * barWidth + (data.length - 1) * BAR_GAP;
  const plotHeight = Math.max(1, height - 4);

  const onMove = (e: React.MouseEvent<SVGRectElement>, i: number) => {
    const host = containerRef.current;
    if (!host) return;
    const hostRect = host.getBoundingClientRect();
    setHover({ i, x: e.clientX - hostRect.left, y: e.clientY - hostRect.top });
  };
  const onLeave = () => setHover(null);

  return (
    <div className="chart chart--bar" ref={containerRef}>
      <svg
        width={actualWidth}
        height={height}
        viewBox={`0 0 ${actualWidth} ${height}`}
        className="chart__svg"
        role="img"
        aria-label={ariaLabel}
      >
        {data.map((p, i) => {
          if (!Number.isFinite(p.value) || p.value < 0) return null;
          const base = p.value === 0 ? 0 : (p.value / max) * plotHeight;
          const eased = anim.barProgress(i);
          const barH = base * eased;
          const x = i * (barWidth + BAR_GAP);
          const y = height - barH;
          const isPeak = chartStyle !== "minimal" && i === peakIndex && barH > CAP_HEIGHT;
          const bodyH = isPeak ? Math.max(0, barH - CAP_HEIGHT) : barH;
          const bodyY = isPeak ? y + CAP_HEIGHT : y;
          const isHovered = hover?.i === i;

          return (
            <g key={`${p.label}-${i}`}>
              <rect
                x={x}
                y={bodyY}
                width={barWidth}
                height={bodyH}
                fill={color}
                opacity={p.value === 0 ? 0.25 : isHovered ? 1 : 0.9}
                rx={1}
                className="chart__bar"
                tabIndex={0}
                role="img"
                aria-label={`${p.label}: ${fmt(p.value)}`}
                onFocus={() => setHover({i,x:x / actualWidth * (containerRef.current?.clientWidth ?? actualWidth),y})}
                onBlur={onLeave}
                onKeyDown={event=>{if(event.key === "Escape") onLeave();}}
                onMouseMove={(e) => onMove(e, i)}
                onMouseLeave={onLeave}
              >
                <title>
                  {p.label}: {fmt(p.value)}
                </title>
              </rect>
              {isPeak && (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={CAP_HEIGHT}
                  fill="var(--chart-peak)"
                  rx={1}
                  className="chart__peak-cap"
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="chart__axis">
        {/* Previously `.label.slice(-5)` -- a hardcoded last-5-characters
            trim that silently assumed every caller's label was already
            English-length ("Sep 4"), the same bug fixed in the sibling
            LineChart. A real Arabic screenshot caught it there breaking:
            Intl's ar-SA short month name ("سبتمبر") is longer than 5
            characters, so the trim sliced mid-word into "بتمبر" (missing
            its first letter). Labels are now trusted as-is -- every real
            caller already formats its own locale-appropriate short label
            (CostHistoryChart's/TokensHistoryChart's date formatter).

            Positions are PERCENTAGES of `actualWidth`, not raw pixels --
            also mirroring a second real bug found and fixed in LineChart:
            the SVG scales to fill its container via `width:100%`, but raw
            `left:${x}px` values (the previous behavior here) never
            rescaled to match a real card's much wider rendered width, so
            axis labels quietly clustered inside the leftmost ~280px of
            whatever the true container width was. */}
        <span style={{ left: `${(barWidth / 2 / actualWidth) * 100}%` }}>
          <bdi>{data[0].label}</bdi>
        </span>
        <span className="chart__axis-max" style={{ left: "50%" }}>
          <bdi>{fmt(max)}</bdi>
        </span>
        <span style={{ left: `${((actualWidth - barWidth / 2) / actualWidth) * 100}%` }}>
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
