import { useId, type ReactNode } from "react";

import type { CatalogTheme } from "../../design-system/themeCatalog";

interface OrbitTextureProps {
  theme: CatalogTheme;
  cx: number;
  cy: number;
  radiusX: number;
  radiusY: number;
}

function pointOnEllipse(cx: number, cy: number, radiusX: number, radiusY: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + radiusX * Math.sin(radians), y: cy - radiusY * Math.cos(radians) };
}

function ellipsePoints(cx: number, cy: number, radiusX: number, radiusY: number, count: number, phase = 0) {
  return Array.from({ length: count }, (_, index) =>
    pointOnEllipse(cx, cy, radiusX, radiusY, phase + (360 * index) / count),
  );
}

/**
 * Bounded material-and-geometry texture reused by every catalog surface.
 * It contains no animation and no data labels: motion and quota semantics stay
 * owned by their production stages, while this layer carries theme identity.
 */
export default function OrbitTexture({ theme, cx, cy, radiusX, radiusY }: OrbitTextureProps) {
  const reactId = useId().replace(/:/g, "");
  const id = `qa-texture-${theme.slug}-${reactId}`;
  const accent = theme.accent;
  const accent2 = theme.accent2;
  const accent3 = theme.accent3;
  const structureStroke = `url(#${id}-structure)`;
  let structure: ReactNode;

  switch (theme.geometry) {
    case "petals": {
      structure = (
        <g opacity={0.82} filter={`url(#${id}-soft-glow)`}>
          {Array.from({ length: 9 }, (_, index) => {
            const angle = -78 + (156 * index) / 8;
            const point = pointOnEllipse(cx, cy, radiusX * 0.52, radiusY * 0.52, angle);
            return (
              <ellipse key={index} cx={point.x} cy={point.y} rx={radiusX * 0.23} ry={radiusY * 0.105}
                transform={`rotate(${angle} ${point.x} ${point.y})`} fill={`url(#${id}-petal)`}
                stroke={index % 3 === 0 ? accent3 : structureStroke} strokeOpacity={0.66} strokeWidth={1.35} />
            );
          })}
          <path d={`M ${cx - radiusX * 0.55} ${cy + radiusY * 0.17} Q ${cx} ${cy - radiusY * 0.28} ${cx + radiusX * 0.55} ${cy + radiusY * 0.17}`}
            fill="none" stroke={accent} strokeOpacity={0.38} strokeWidth={1.4} />
        </g>
      );
      break;
    }
    case "orchid": {
      structure = (
        <g opacity={0.82} filter={`url(#${id}-soft-glow)`}>
          {Array.from({ length: 8 }, (_, index) => {
            const angle = index * 45;
            const point = pointOnEllipse(cx, cy, radiusX * 0.33, radiusY * 0.33, angle);
            return (
              <ellipse key={index} cx={point.x} cy={point.y}
                rx={radiusX * (index % 2 === 0 ? 0.24 : 0.18)} ry={radiusY * 0.12}
                transform={`rotate(${angle} ${point.x} ${point.y})`} fill={`url(#${id}-petal)`}
                stroke={index % 2 === 0 ? accent : accent2} strokeOpacity={0.55} />
            );
          })}
          <ellipse cx={cx} cy={cy} rx={radiusX * 0.16} ry={radiusY * 0.16} fill={accent3} fillOpacity={0.08} stroke={accent3} strokeOpacity={0.45} />
        </g>
      );
      break;
    }
    case "dial": {
      structure = (
        <g>
          {[0.98, 0.86, 0.68].map((scale, index) => (
            <ellipse key={scale} cx={cx} cy={cy} rx={radiusX * scale} ry={radiusY * scale} fill="none"
              stroke={index === 1 ? accent2 : structureStroke} strokeOpacity={0.34 - index * 0.05} strokeWidth={index === 0 ? 2.2 : 1} />
          ))}
          {Array.from({ length: 60 }, (_, index) => {
            const angle = index * 6;
            const major = index % 5 === 0;
            const outer = pointOnEllipse(cx, cy, radiusX, radiusY, angle);
            const inner = pointOnEllipse(cx, cy, radiusX - (major ? 17 : 8), radiusY - (major ? 17 : 8), angle);
            return <line key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke={major ? accent3 : accent} strokeOpacity={major ? 0.76 : 0.3} strokeWidth={major ? 1.5 : 0.7} />;
          })}
        </g>
      );
      break;
    }
    case "constellation": {
      const points = Array.from({ length: 30 }, (_, index) => ({
        x: cx + ((index * 97) % Math.max(2, radiusX * 1.82)) - radiusX * 0.91,
        y: cy + ((index * 61) % Math.max(2, radiusY * 1.76)) - radiusY * 0.88,
      }));
      structure = (
        <g>
          <polyline points={points.slice(0, 15).map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={accent} strokeOpacity={0.28} strokeWidth={0.8} />
          <polyline points={points.slice(12, 25).map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={accent3} strokeOpacity={0.2} strokeWidth={0.65} />
          {points.map((point, index) => (
            <g key={index}>
              {index % 6 === 0 && <circle cx={point.x} cy={point.y} r={5.5} fill={index % 12 === 0 ? accent3 : accent} fillOpacity={0.08} />}
              <circle cx={point.x} cy={point.y} r={index % 6 === 0 ? 1.9 : 0.85}
                fill={index % 6 === 0 ? accent : index % 4 === 0 ? accent3 : "#f8fafc"} fillOpacity={index % 6 === 0 ? 0.95 : 0.55} />
            </g>
          ))}
        </g>
      );
      break;
    }
    case "spine": {
      structure = (
        <g opacity={0.78} filter={`url(#${id}-soft-glow)`}>
          <line x1={cx - 5} y1={cy - radiusY} x2={cx - 5} y2={cy + radiusY} stroke={accent2} strokeOpacity={0.44} strokeWidth={2.2} />
          <line x1={cx + 5} y1={cy - radiusY} x2={cx + 5} y2={cy + radiusY} stroke={accent3} strokeOpacity={0.28} strokeWidth={1} />
          {Array.from({ length: 9 }, (_, index) => {
            const y = cy - radiusY + (radiusY * 2 * index) / 8;
            const direction = index % 2 === 0 ? 1 : -1;
            return (
              <g key={index}>
                <line x1={cx - 5} y1={y} x2={cx + direction * radiusX * 0.24} y2={y + direction * 5}
                  stroke={index % 3 === 0 ? accent3 : accent} strokeOpacity={0.38} />
                <circle cx={cx - 5} cy={y} r={index % 2 === 0 ? 3.2 : 1.8} fill={index % 3 === 0 ? accent3 : accent} />
              </g>
            );
          })}
        </g>
      );
      break;
    }
    case "eclipse": {
      structure = (
        <g>
          <ellipse cx={cx - 15} cy={cy - 9} rx={radiusX - 8} ry={radiusY - 8} fill="none" stroke={accent}
            strokeOpacity={0.52} strokeWidth={2.6} filter={`url(#${id}-soft-glow)`} />
          <ellipse cx={cx + 13} cy={cy + 8} rx={radiusX - 17} ry={radiusY - 17} fill="none" stroke={accent2} strokeOpacity={0.22} strokeWidth={12} />
          <path d={`M ${cx - radiusX * 0.76} ${cy + radiusY * 0.43} A ${radiusX * 0.92} ${radiusY * 0.92} 0 0 0 ${cx + radiusX * 0.65} ${cy - radiusY * 0.58}`}
            fill="none" stroke={accent3} strokeOpacity={0.64} strokeWidth={3.2} filter={`url(#${id}-soft-glow)`} />
        </g>
      );
      break;
    }
    case "facets": {
      const points = ellipsePoints(cx, cy, radiusX, radiusY, 12, 15);
      structure = (
        <g opacity={0.78}>
          <polygon points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill={`url(#${id}-facet)`} stroke={accent} strokeOpacity={0.54} />
          {points.map((point, index) => (
            <path key={index} d={`M ${cx} ${cy} L ${point.x} ${point.y} L ${points[(index + 1) % points.length].x} ${points[(index + 1) % points.length].y} Z`}
              fill={index % 3 === 0 ? accent3 : index % 2 === 0 ? accent2 : accent} fillOpacity={index % 3 === 0 ? 0.055 : 0.026}
              stroke={structureStroke} strokeOpacity={0.35} strokeWidth={0.85} />
          ))}
        </g>
      );
      break;
    }
    case "aperture": {
      structure = (
        <g opacity={0.78}>
          {Array.from({ length: 10 }, (_, index) => {
            const angle = index * 36;
            const first = pointOnEllipse(cx, cy, radiusX * 0.92, radiusY * 0.92, angle);
            const second = pointOnEllipse(cx, cy, radiusX * 0.92, radiusY * 0.92, angle + 27);
            const inner = pointOnEllipse(cx, cy, radiusX * 0.28, radiusY * 0.28, angle + 18);
            return <path key={index} d={`M ${inner.x} ${inner.y} L ${first.x} ${first.y} L ${second.x} ${second.y} Z`}
              fill={index % 2 === 0 ? accent2 : accent3} fillOpacity={0.045} stroke={index % 2 === 0 ? accent : accent2} strokeOpacity={0.34} strokeWidth={0.9} />;
          })}
          <ellipse cx={cx} cy={cy} rx={radiusX * 0.29} ry={radiusY * 0.29} fill="none" stroke={accent2} strokeOpacity={0.48} />
        </g>
      );
      break;
    }
    case "ice": {
      structure = (
        <g opacity={0.78} filter={`url(#${id}-soft-glow)`}>
          {Array.from({ length: 16 }, (_, index) => {
            const angle = index * 22.5;
            const inner = pointOnEllipse(cx, cy, radiusX * 0.33, radiusY * 0.33, angle);
            const outer = pointOnEllipse(cx, cy, radiusX, radiusY, angle);
            const branchA = pointOnEllipse(cx, cy, radiusX * 0.74, radiusY * 0.74, angle - 5);
            const branchB = pointOnEllipse(cx, cy, radiusX * 0.74, radiusY * 0.74, angle + 5);
            return (
              <g key={index}>
                <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={index % 4 === 0 ? accent2 : accent}
                  strokeOpacity={index % 4 === 0 ? 0.62 : 0.34} strokeWidth={index % 4 === 0 ? 1.5 : 0.75} />
                {index % 2 === 0 && <line x1={branchA.x} y1={branchA.y} x2={branchB.x} y2={branchB.y} stroke={accent3} strokeOpacity={0.42} />}
              </g>
            );
          })}
          <ellipse cx={cx} cy={cy} rx={radiusX * 0.5} ry={radiusY * 0.5} fill="none" stroke={accent2} strokeOpacity={0.28} strokeDasharray="2 5" />
        </g>
      );
      break;
    }
    case "nova": {
      structure = (
        <g opacity={0.84} filter={`url(#${id}-soft-glow)`}>
          {Array.from({ length: 20 }, (_, index) => {
            const angle = index * 18;
            const innerScale = index % 2 === 0 ? 0.31 : 0.43;
            const inner = pointOnEllipse(cx, cy, radiusX * innerScale, radiusY * innerScale, angle);
            const outerScale = index % 4 === 0 ? 1 : 0.88;
            const outer = pointOnEllipse(cx, cy, radiusX * outerScale, radiusY * outerScale, angle);
            return <line key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke={index % 4 === 0 ? accent3 : index % 2 === 0 ? accent2 : accent}
              strokeOpacity={index % 4 === 0 ? 0.68 : 0.34} strokeWidth={index % 4 === 0 ? 1.8 : 0.8} />;
          })}
          <ellipse cx={cx} cy={cy} rx={radiusX} ry={radiusY} fill="none" stroke={accent2} strokeOpacity={0.58} strokeDasharray="10 7" />
          <ellipse cx={cx} cy={cy} rx={radiusX * 0.37} ry={radiusY * 0.37} fill={accent} fillOpacity={0.055} stroke={accent3} strokeOpacity={0.48} />
        </g>
      );
      break;
    }
    case "lens": {
      structure = (
        <g filter={`url(#${id}-soft-glow)`}>
          <ellipse cx={cx} cy={cy} rx={radiusX * 0.94} ry={radiusY * 0.4} fill={`url(#${id}-lens)`} stroke={accent} strokeOpacity={0.5} strokeWidth={1.4} />
          <ellipse cx={cx} cy={cy} rx={radiusX * 0.72} ry={radiusY * 0.28} fill="none" stroke={accent2} strokeOpacity={0.44} />
          <ellipse cx={cx} cy={cy} rx={radiusX * 0.5} ry={radiusY * 0.96} fill="none" stroke={accent3} strokeOpacity={0.23} />
          <line x1={cx - radiusX} y1={cy} x2={cx + radiusX} y2={cy} stroke={accent} strokeOpacity={0.22} />
        </g>
      );
      break;
    }
    case "astrolabe": {
      structure = (
        <g opacity={0.78} filter={`url(#${id}-soft-glow)`}>
          {[1, 0.78, 0.56].map((scale, index) => (
            <ellipse key={scale} cx={cx} cy={cy} rx={radiusX * scale} ry={radiusY * (index === 1 ? 0.4 : scale)} fill="none"
              stroke={index === 1 ? accent3 : index === 2 ? accent2 : accent} strokeOpacity={0.48 - index * 0.06}
              strokeDasharray={index === 0 ? "3 6" : undefined} />
          ))}
          <line x1={cx - radiusX} y1={cy} x2={cx + radiusX} y2={cy} stroke={accent} strokeOpacity={0.32} />
          <line x1={cx} y1={cy - radiusY} x2={cx} y2={cy + radiusY} stroke={accent} strokeOpacity={0.32} />
          {ellipsePoints(cx, cy, radiusX, radiusY, 24).map((point, index) => index % 2 === 0 && (
            <circle key={index} cx={point.x} cy={point.y} r={index % 4 === 0 ? 2.2 : 1.1} fill={index % 4 === 0 ? accent3 : accent2} />
          ))}
        </g>
      );
      break;
    }
    case "dunes": {
      structure = (
        <g fill="none" filter={`url(#${id}-soft-glow)`}>
          {[-0.16, 0.02, 0.2, 0.38].map((offset, index) => (
            <path key={offset} d={`M ${cx - radiusX} ${cy + radiusY * offset} Q ${cx - radiusX * 0.42} ${cy - radiusY * (0.43 - index * 0.04)} ${cx} ${cy + radiusY * (0.03 + offset * 0.32)} T ${cx + radiusX} ${cy + radiusY * (offset * 0.72)}`}
              stroke={index % 3 === 0 ? accent3 : index % 2 === 0 ? accent2 : accent}
              strokeOpacity={0.58 - index * 0.075} strokeWidth={index === 0 ? 1.8 : 1.05} />
          ))}
          <path d={`M ${cx - radiusX} ${cy + radiusY * 0.46} Q ${cx - radiusX * 0.1} ${cy + radiusY * 0.08} ${cx + radiusX} ${cy + radiusY * 0.4}`}
            stroke={accent3} strokeOpacity={0.28} strokeDasharray="4 7" />
        </g>
      );
      break;
    }
    case "orbit":
    default: {
      structure = (
        <g>
          <ellipse cx={cx} cy={cy} rx={radiusX} ry={radiusY} fill="none" stroke={accent} strokeOpacity={0.34} strokeWidth={1.3} />
          <ellipse cx={cx} cy={cy} rx={radiusX * 0.78} ry={radiusY * 0.78} fill="none" stroke={accent2} strokeOpacity={0.3} />
          <ellipse cx={cx} cy={cy} rx={radiusX * 0.56} ry={radiusY * 0.56} fill="none" stroke={accent3} strokeOpacity={0.22} strokeDasharray="3 7" />
          {[-54, 118].map((angle, index) => {
            const scale = index === 0 ? 0.78 : 1;
            const point = pointOnEllipse(cx, cy, radiusX * scale, radiusY * scale, angle);
            return <circle key={angle} cx={point.x} cy={point.y} r={index === 0 ? 3 : 2}
              fill={index === 0 ? accent3 : accent} filter={`url(#${id}-soft-glow)`} />;
          })}
        </g>
      );
      break;
    }
  }

  return (
    <g data-geometry-texture={theme.geometry}>
      <defs>
        <radialGradient id={`${id}-ambient`} cx="50%" cy="45%" r="62%">
          <stop offset="0" stopColor={accent2} stopOpacity={0.2} />
          <stop offset="0.58" stopColor={accent} stopOpacity={0.07} />
          <stop offset="1" stopColor={accent3} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-structure`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={accent2} /><stop offset="0.52" stopColor={accent} /><stop offset="1" stopColor={accent3} />
        </linearGradient>
        <radialGradient id={`${id}-petal`} cx="46%" cy="42%" r="62%">
          <stop offset="0" stopColor={accent3} stopOpacity={0.18} /><stop offset="0.7" stopColor={accent2} stopOpacity={0.05} /><stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-facet`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={accent2} stopOpacity={0.08} /><stop offset="0.5" stopColor={accent3} stopOpacity={0.045} /><stop offset="1" stopColor={accent} stopOpacity={0.02} />
        </linearGradient>
        <radialGradient id={`${id}-lens`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={accent} stopOpacity={0.14} /><stop offset="0.72" stopColor={accent2} stopOpacity={0.05} /><stop offset="1" stopColor={accent3} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx={cx} cy={cy} rx={radiusX * 0.96} ry={radiusY * 0.96} fill={`url(#${id}-ambient)`} />
      {structure}
    </g>
  );
}
