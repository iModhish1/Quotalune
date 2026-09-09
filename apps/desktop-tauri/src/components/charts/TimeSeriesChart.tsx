import {useMemo, useState} from "react";
import {timeSeriesGeometry, type TimeSeriesPoint} from "./timeSeriesGeometry";
import type {AnalyticsPreferences} from "../../types/bridge";

export function TimeSeriesChart({points, since, until, step, label, unit, formatTime, formatValue, style = "precision", color = "var(--qa-accent)"}: {
  points: readonly TimeSeriesPoint[]; since: number; until: number; step: number;
  label: string; unit: string; formatTime: (time: number) => string; formatValue: (value: number) => string;
  style?: AnalyticsPreferences["chartStyle"]; color?: string;
}) {
  const geometry = useMemo(() => timeSeriesGeometry(points, since, until, step, 560, 112, [0, 100]), [points, since, until, step]);
  const [active, setActive] = useState<TimeSeriesPoint | null>(null);
  const ticks = style === "minimal" ? [0, 100] : [0, 25, 50, 75, 100];
  return <figure className={`analytics-time-chart analytics-time-chart--${style}`}>
    <figcaption>{label}<span>{unit}</span></figcaption>
    <svg viewBox="-38 -6 610 144" role="img" aria-label={label} style={{width: "100%", overflow: "visible"}}>
      {ticks.map(value => <g key={value}><line x1="0" x2="560" y1={112 - value * 1.12} y2={112 - value * 1.12} stroke="currentColor" opacity=".12"/><text x="-8" y={116 - value * 1.12} textAnchor="end" fill="currentColor" fontSize="10">{formatValue(value)}</text></g>)}
      {geometry.segments.map((segment, i) => <g key={i}>
        {style === "detailed" && segment.length > 1 && <path d={`M${segment[0].x},112 ${segment.map(p => `L${p.x},${p.y}`).join(" ")} L${segment[segment.length - 1].x},112 Z`} fill={color} opacity=".08"/>}
        <polyline points={segment.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth="2"/>
        {segment.map(({x,y,point}, index) => <circle key={index} cx={x} cy={y} r={style === "detailed" || segment.length === 1 ? 3 : 1.8} fill={color} tabIndex={0} role="img"
          aria-label={`${label}, ${formatTime(point.time)}, ${formatValue(point.value)} ${unit}`}
          onFocus={() => setActive(point)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(point)} onMouseLeave={() => setActive(null)}
          onKeyDown={event => {if(event.key === "Escape") setActive(null);}}><title>{`${formatTime(point.time)} · ${formatValue(point.value)} ${unit}`}</title></circle>)}
      </g>)}
      <text x="0" y="134" fill="currentColor" fontSize="10" textAnchor="start">{formatTime(since)}</text>
      <text x="560" y="134" fill="currentColor" fontSize="10" textAnchor="end">{formatTime(until)}</text>
    </svg>
    <div className="analytics-time-chart__reading" aria-live="polite">{active ? `${formatTime(active.time)} · ${formatValue(active.value)} ${unit}` : "\u00a0"}</div>
  </figure>;
}
