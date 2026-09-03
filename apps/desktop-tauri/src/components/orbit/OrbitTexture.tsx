import type { CatalogTheme } from "../../design-system/themeCatalog";

interface OrbitTextureProps {
  theme: CatalogTheme;
  cx: number;
  cy: number;
  radiusX: number;
  radiusY: number;
}

function pointOnEllipse(
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  degrees: number,
) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: cx + radiusX * Math.sin(radians),
    y: cy - radiusY * Math.cos(radians),
  };
}

/** Bounded geometry texture reused by taskbar, top, edge and HUD stages. */
export default function OrbitTexture({
  theme,
  cx,
  cy,
  radiusX,
  radiusY,
}: OrbitTextureProps) {
  const accent = theme.accent;
  const accent2 = theme.accent2;
  const accent3 = theme.accent3;

  switch (theme.geometry) {
    case "petals":
    case "orchid": {
      const count = theme.geometry === "petals" ? 7 : 5;
      return (
        <g opacity={0.62}>
          {Array.from({ length: count }, (_, index) => {
            const angle = -72 + (144 * index) / Math.max(1, count - 1);
            const point = pointOnEllipse(cx, cy, radiusX * 0.6, radiusY * 0.6, angle);
            return (
              <ellipse
                key={index}
                cx={point.x}
                cy={point.y}
                rx={radiusX * (theme.geometry === "petals" ? 0.25 : 0.2)}
                ry={radiusY * (theme.geometry === "petals" ? 0.11 : 0.15)}
                transform={`rotate(${angle} ${point.x} ${point.y})`}
                fill="none"
                stroke={index % 3 === 0 ? accent3 : index % 2 === 0 ? accent : accent2}
                strokeOpacity={0.48}
                strokeWidth={1.35}
              />
            );
          })}
        </g>
      );
    }
    case "dial":
      return (
        <g>
          {Array.from({ length: 48 }, (_, index) => {
            const angle = index * 7.5;
            const outer = pointOnEllipse(cx, cy, radiusX, radiusY, angle);
            const inner = pointOnEllipse(
              cx,
              cy,
              radiusX - (index % 4 === 0 ? 13 : 7),
              radiusY - (index % 4 === 0 ? 13 : 7),
              angle,
            );
            return (
              <line
                key={index}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={index % 4 === 0 ? accent2 : accent}
                strokeOpacity={index % 4 === 0 ? 0.5 : 0.22}
                strokeWidth={index % 4 === 0 ? 1.3 : 0.8}
              />
            );
          })}
        </g>
      );
    case "constellation": {
      const points = Array.from({ length: 22 }, (_, index) => ({
        x: cx + ((index * 97) % Math.max(2, radiusX * 1.8)) - radiusX * 0.9,
        y: cy + ((index * 61) % Math.max(2, radiusY * 1.7)) - radiusY * 0.85,
      }));
      return (
        <g>
          <polyline
            points={points.slice(0, 12).map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={accent}
            strokeOpacity={0.2}
            strokeWidth={0.8}
          />
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={index % 5 === 0 ? 1.8 : 0.9}
              fill={index % 5 === 0 ? accent3 : index % 3 === 0 ? accent : "#f8fafc"}
              fillOpacity={index % 5 === 0 ? 0.85 : 0.5}
            />
          ))}
        </g>
      );
    }
    case "spine":
      return (
        <g opacity={0.58}>
          <line x1={cx} y1={cy - radiusY} x2={cx} y2={cy + radiusY} stroke={accent2} strokeWidth={2} />
          {Array.from({ length: 8 }, (_, index) => (
            <circle
              key={index}
              cx={cx}
              cy={cy - radiusY + (radiusY * 2 * index) / 7}
              r={index % 2 === 0 ? 3 : 1.7}
              fill={index % 2 === 0 ? accent : accent3}
            />
          ))}
        </g>
      );
    case "eclipse":
      return (
        <g>
          <ellipse cx={cx - 14} cy={cy - 9} rx={radiusX - 8} ry={radiusY - 8} fill="none" stroke={accent} strokeOpacity={0.3} strokeWidth={3} />
          <ellipse cx={cx + 12} cy={cy + 7} rx={radiusX - 16} ry={radiusY - 16} fill="none" stroke={accent2} strokeOpacity={0.17} strokeWidth={11} />
        </g>
      );
    case "facets":
    case "aperture":
      return (
        <g opacity={0.48}>
          {Array.from({ length: 10 }, (_, index) => {
            const angle = (360 * index) / 10;
            const first = pointOnEllipse(cx, cy, radiusX, radiusY, angle);
            const second = pointOnEllipse(cx, cy, radiusX, radiusY, angle + (theme.geometry === "aperture" ? 24 : 36));
            return (
              <path
                key={index}
                d={`M ${cx} ${cy} L ${first.x} ${first.y} L ${second.x} ${second.y} Z`}
                fill={theme.geometry === "aperture" ? "rgba(255,255,255,0.018)" : "none"}
                stroke={index % 2 === 0 ? accent2 : accent3}
                strokeOpacity={0.32}
                strokeWidth={0.9}
              />
            );
          })}
        </g>
      );
    case "ice":
    case "nova": {
      const count = theme.geometry === "nova" ? 16 : 12;
      return (
        <g opacity={0.56}>
          {Array.from({ length: count }, (_, index) => {
            const angle = (360 * index) / count;
            const inner = pointOnEllipse(cx, cy, radiusX * 0.42, radiusY * 0.42, angle);
            const outer = pointOnEllipse(cx, cy, radiusX, radiusY, angle);
            return <line key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={index % 3 === 0 ? accent3 : index % 2 === 0 ? accent2 : accent} strokeOpacity={0.42} strokeWidth={index % 3 === 0 ? 1.5 : 0.8} />;
          })}
          {theme.geometry === "nova" && <ellipse cx={cx} cy={cy} rx={radiusX} ry={radiusY} fill="none" stroke={accent2} strokeOpacity={0.5} strokeDasharray="9 7" />}
        </g>
      );
    }
    case "lens":
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={radiusX} ry={radiusY * 0.42} fill="none" stroke={accent} strokeOpacity={0.32} />
          <ellipse cx={cx} cy={cy} rx={radiusX * 0.62} ry={radiusY} fill="none" stroke={accent2} strokeOpacity={0.2} />
        </g>
      );
    case "astrolabe":
      return (
        <g opacity={0.62}>
          <ellipse cx={cx} cy={cy} rx={radiusX} ry={radiusY} fill="none" stroke={accent} strokeOpacity={0.34} strokeDasharray="3 6" />
          <ellipse cx={cx} cy={cy} rx={radiusX} ry={radiusY * 0.38} fill="none" stroke={accent3} strokeOpacity={0.38} />
          <line x1={cx - radiusX} y1={cy} x2={cx + radiusX} y2={cy} stroke={accent} strokeOpacity={0.24} />
          <line x1={cx} y1={cy - radiusY} x2={cx} y2={cy + radiusY} stroke={accent} strokeOpacity={0.24} />
        </g>
      );
    case "dunes":
      return (
        <g fill="none">
          <path d={`M ${cx - radiusX} ${cy + radiusY * 0.08} Q ${cx - radiusX * 0.4} ${cy - radiusY * 0.42} ${cx} ${cy + radiusY * 0.05} T ${cx + radiusX} ${cy + radiusY * 0.04}`} stroke={accent} strokeOpacity={0.46} strokeWidth={1.5} />
          <path d={`M ${cx - radiusX} ${cy + radiusY * 0.3} Q ${cx - radiusX * 0.4} ${cy - radiusY * 0.12} ${cx} ${cy + radiusY * 0.22} T ${cx + radiusX} ${cy + radiusY * 0.18}`} stroke={accent3} strokeOpacity={0.34} />
        </g>
      );
    default:
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={radiusX} ry={radiusY} fill="none" stroke={accent} strokeOpacity={0.2} />
          <ellipse cx={cx} cy={cy} rx={radiusX - 16} ry={radiusY - 16} fill="none" stroke={theme.hairline} />
        </g>
      );
  }
}
