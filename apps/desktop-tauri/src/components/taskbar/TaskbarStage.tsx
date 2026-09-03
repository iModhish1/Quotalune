import type { CSSProperties } from "react";
import { ArcGaugeV3, QaProviderIcon, formatPercentage } from "../../design-system";
import {
  catalogBySlug,
  providerColor,
  type CatalogTheme,
} from "../../design-system/themeCatalog";
import {
  taskbarLayout,
  type TaskbarStageState,
} from "./taskbarLayout";
import "./TaskbarStage.css";

export type UsageMode = "used" | "remaining" | "hybrid";
export type ProviderStatus = "ok" | "attention" | "offline";

export interface StageProvider {
  id: string;
  name: string;
  iconId: string;
  resolvedMode: UsageMode;
  arcFraction: number | null;
  primaryValue: number | null;
  secondaryValue: number | null;
  primaryLabel: "used" | "remaining";
  reset: string;
  status: ProviderStatus;
  accountLabel?: string | null;
}

export interface TaskbarStageProps {
  catalog: string;
  state: "idle" | "hover" | "expanded";
  providers: StageProvider[];
  focusedIndex?: number;
  onFocusProvider?: (index: number) => void;
  onToggleExpanded?: () => void;
}

const DEFAULT_THEME = "01-obsidian-orbit";

function polar(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.sin(radians),
    y: cy - radius * Math.cos(radians),
  };
}

function housingPath(state: TaskbarStageState): string {
  if (state === "expanded") {
    return "M 410 8 A 358 262 0 1 1 409.9 8 Z";
  }
  return [
    "M 64 304",
    "Q 132 66 410 18",
    "Q 688 66 756 304",
    "Q 702 330 646 344",
    "Q 548 252 410 252",
    "Q 272 252 174 344",
    "Q 118 330 64 304 Z",
  ].join(" ");
}

function BaseStructure({
  theme,
  state,
  nodes,
  core,
}: {
  theme: CatalogTheme;
  state: TaskbarStageState;
  nodes: ReturnType<typeof taskbarLayout>["nodes"];
  core: ReturnType<typeof taskbarLayout>["core"];
}) {
  const expanded = state === "expanded";
  const connectorStart = expanded ? core.radius + 12 : core.radius - 4;
  return (
    <g>
      {expanded ? (
        <>
          {[
            [142, 112],
            [205, 151],
            [288, 205],
            [334, 238],
          ].map(([rx, ry], index) => (
            <ellipse
              key={`${rx}-${ry}`}
              cx={core.x}
              cy={core.y}
              rx={rx}
              ry={ry}
              fill="none"
              stroke={index === 2 ? theme.accent : theme.hairline}
              strokeOpacity={index === 2 ? 0.22 : 0.78}
              strokeWidth={index === 2 ? 1.2 : 0.8}
              strokeDasharray={index === 3 ? "2 7" : undefined}
            />
          ))}
        </>
      ) : (
        <>
          <path
            d="M 83 294 Q 151 83 410 40 Q 669 83 737 294"
            fill="none"
            stroke={theme.accent}
            strokeOpacity={0.28}
            strokeWidth={1.2}
          />
          <path
            d="M 132 314 Q 201 139 410 102 Q 619 139 688 314"
            fill="none"
            stroke={theme.hairline}
            strokeWidth={1}
          />
        </>
      )}
      {nodes.map((node, index) => {
        const dx = node.x - core.x;
        const dy = node.y - core.y;
        const distance = Math.hypot(dx, dy) || 1;
        const start = {
          x: core.x + (dx / distance) * connectorStart,
          y: core.y + (dy / distance) * connectorStart,
        };
        const end = {
          x: node.x - (dx / distance) * 36,
          y: node.y - (dy / distance) * 36,
        };
        return (
          <line
            key={`${node.angle}-${index}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={theme.hairline}
            strokeWidth={0.9}
          />
        );
      })}
    </g>
  );
}

function ThemeOrnament({
  theme,
  state,
  core,
}: {
  theme: CatalogTheme;
  state: TaskbarStageState;
  core: ReturnType<typeof taskbarLayout>["core"];
}) {
  const { x: cx, y: cy } = core;
  const radius = state === "expanded" ? 232 : 300;
  const accent = theme.accent;

  switch (theme.geometry) {
    case "petals":
    case "orchid": {
      const count = theme.geometry === "petals" ? 7 : 5;
      return (
        <g opacity={0.64}>
          {Array.from({ length: count }, (_, index) => {
            const angle = -72 + (144 * index) / Math.max(1, count - 1);
            const p = polar(cx, cy + 16, radius * 0.6, angle);
            return (
              <ellipse
                key={index}
                cx={p.x}
                cy={p.y}
                rx={theme.geometry === "petals" ? 82 : 68}
                ry={theme.geometry === "petals" ? 26 : 34}
                transform={`rotate(${angle} ${p.x} ${p.y})`}
                fill="none"
                stroke={accent}
                strokeOpacity={0.48}
                strokeWidth={1.4}
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
            const outer = polar(cx, cy, radius, angle);
            const inner = polar(cx, cy, radius - (index % 4 === 0 ? 13 : 7), angle);
            return (
              <line
                key={index}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={accent}
                strokeOpacity={index % 4 === 0 ? 0.5 : 0.22}
                strokeWidth={index % 4 === 0 ? 1.3 : 0.8}
              />
            );
          })}
        </g>
      );
    case "constellation": {
      const points = Array.from({ length: 22 }, (_, index) => ({
        x: cx + ((index * 97) % 436) - 218,
        y: cy + ((index * 61) % 360) - 180,
      }));
      return (
        <g>
          <polyline
            points={points.slice(0, 12).map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={accent}
            strokeOpacity={0.18}
            strokeWidth={0.8}
          />
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={index % 5 === 0 ? 1.8 : 0.9}
              fill={index % 3 === 0 ? accent : "#f8fafc"}
              fillOpacity={index % 5 === 0 ? 0.85 : 0.5}
            />
          ))}
        </g>
      );
    }
    case "spine":
      return (
        <g opacity={0.58}>
          <line x1={cx} y1={28} x2={cx} y2={cy + 56} stroke={accent} strokeWidth={2} />
          {Array.from({ length: 8 }, (_, index) => (
            <circle key={index} cx={cx} cy={48 + index * 32} r={index % 2 === 0 ? 3 : 1.7} fill={accent} />
          ))}
        </g>
      );
    case "eclipse":
      return (
        <g>
          <circle cx={cx - 18} cy={cy - 12} r={radius - 8} fill="none" stroke="#f8fafc" strokeOpacity={0.28} strokeWidth={3} />
          <circle cx={cx + 14} cy={cy + 8} r={radius - 16} fill="none" stroke={accent} strokeOpacity={0.12} strokeWidth={12} />
        </g>
      );
    case "facets":
    case "aperture":
      return (
        <g opacity={0.5}>
          {Array.from({ length: 10 }, (_, index) => {
            const a = (360 * index) / 10;
            const p1 = polar(cx, cy, radius, a);
            const p2 = polar(cx, cy, radius, a + (theme.geometry === "aperture" ? 24 : 36));
            return (
              <path
                key={index}
                d={`M ${cx} ${cy} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} Z`}
                fill={theme.geometry === "aperture" ? "rgba(255,255,255,0.018)" : "none"}
                stroke={accent}
                strokeOpacity={0.32}
                strokeWidth={0.9}
              />
            );
          })}
        </g>
      );
    case "ice":
    case "nova":
      return (
        <g opacity={0.58}>
          {Array.from({ length: theme.geometry === "nova" ? 16 : 12 }, (_, index) => {
            const angle = (360 * index) / (theme.geometry === "nova" ? 16 : 12);
            const inner = polar(cx, cy, 102, angle);
            const outer = polar(cx, cy, radius, angle);
            return <line key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={accent} strokeOpacity={0.38} strokeWidth={index % 3 === 0 ? 1.5 : 0.8} />;
          })}
          {theme.geometry === "nova" && <circle cx={cx} cy={cy} r={radius} fill="none" stroke={accent} strokeOpacity={0.45} strokeDasharray="9 7" />}
        </g>
      );
    case "lens":
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={radius} ry={radius * 0.42} fill="none" stroke={accent} strokeOpacity={0.32} />
          <ellipse cx={cx} cy={cy} rx={radius * 0.62} ry={radius} fill="none" stroke={accent} strokeOpacity={0.14} />
        </g>
      );
    case "astrolabe":
      return (
        <g opacity={0.62}>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke={accent} strokeOpacity={0.34} strokeDasharray="3 6" />
          <ellipse cx={cx} cy={cy} rx={radius} ry={radius * 0.38} fill="none" stroke={accent} strokeOpacity={0.3} />
          <line x1={cx - radius} y1={cy} x2={cx + radius} y2={cy} stroke={accent} strokeOpacity={0.24} />
          <line x1={cx} y1={cy - radius} x2={cx} y2={cy + radius} stroke={accent} strokeOpacity={0.24} />
        </g>
      );
    case "dunes":
      return (
        <g fill="none" stroke={accent}>
          <path d={`M 80 ${cy + 20} Q 250 ${cy - 76} 410 ${cy + 12} T 740 ${cy + 4}`} strokeOpacity={0.42} strokeWidth={1.5} />
          <path d={`M 46 ${cy + 62} Q 230 ${cy - 26} 410 ${cy + 46} T 774 ${cy + 36}`} strokeOpacity={0.24} />
        </g>
      );
    default:
      return (
        <g>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke={accent} strokeOpacity={0.2} />
          <circle cx={cx} cy={cy} r={radius - 16} fill="none" stroke={theme.hairline} />
        </g>
      );
  }
}

export default function TaskbarStage({
  catalog,
  state,
  providers,
  focusedIndex = 0,
  onFocusProvider,
  onToggleExpanded,
}: TaskbarStageProps) {
  const theme = catalogBySlug(catalog) ?? (catalogBySlug(DEFAULT_THEME) as CatalogTheme);
  const stageState: TaskbarStageState = state === "expanded" ? "expanded" : "compact";
  const visibleProviders = providers.slice(0, 7);
  const layout = taskbarLayout(stageState, visibleProviders.length);
  const boundedFocus = visibleProviders.length === 0
    ? -1
    : Math.max(0, Math.min(focusedIndex, visibleProviders.length - 1));
  const focused = visibleProviders[boundedFocus];
  const light = theme.slug === "04-porcelain-halo";
  const gradientId = `qa-stage-${theme.slug}-${stageState}`;
  const style = {
    width: layout.width,
    height: layout.height,
    "--qa-stage-accent": theme.accent,
    "--qa-stage-core": theme.core,
    "--qa-stage-edge": theme.coreEdge,
  } as CSSProperties;

  return (
    <section
      className="qa-taskbar-stage"
      data-state={stageState}
      data-theme={theme.slug}
      data-light={light}
      style={style}
      aria-label={`${theme.name} taskbar quota instrument`}
    >
      <svg className="qa-taskbar-stage__housing" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
        <defs>
          <radialGradient id={gradientId} cx="50%" cy={stageState === "expanded" ? "42%" : "68%"} r="68%">
            <stop offset="0" stopColor={theme.coreEdge} stopOpacity={light ? 0.96 : 0.94} />
            <stop offset="0.52" stopColor={theme.bg[0]} stopOpacity={light ? 0.94 : 0.91} />
            <stop offset="1" stopColor={theme.bg[1]} stopOpacity={light ? 0.9 : 0.84} />
          </radialGradient>
          <filter id={`${gradientId}-shadow`} x="-25%" y="-25%" width="150%" height="160%">
            <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#000" floodOpacity={light ? 0.22 : 0.7} />
            <feDropShadow dx="0" dy="0" stdDeviation="9" floodColor={theme.accent} floodOpacity="0.13" />
          </filter>
        </defs>
        <path
          d={housingPath(stageState)}
          fill={`url(#${gradientId})`}
          stroke={light ? "rgba(30,58,95,0.26)" : "rgba(255,255,255,0.16)"}
          strokeWidth={1.2}
          filter={`url(#${gradientId}-shadow)`}
        />
        <path
          d={housingPath(stageState)}
          fill="none"
          stroke={theme.accent}
          strokeOpacity={0.2}
          strokeWidth={3}
        />
        <BaseStructure theme={theme} state={stageState} nodes={layout.nodes} core={layout.core} />
      </svg>

      <svg className="qa-taskbar-stage__ornament" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
        <ThemeOrnament theme={theme} state={stageState} core={layout.core} />
      </svg>

      {visibleProviders.map((provider, index) => {
        const node = layout.nodes[index];
        const color = providerColor(theme, provider.iconId);
        const nodeStyle = {
          left: node.x,
          top: node.y,
          width: Math.max(layout.nodeSize, layout.labelWidth),
          "--qa-node-size": `${layout.nodeSize}px`,
          "--qa-node-color": color,
        } as CSSProperties;
        return (
          <button
            key={provider.id}
            type="button"
            className="qa-taskbar-node"
            data-focused={index === boundedFocus}
            data-status={provider.status}
            style={nodeStyle}
            onClick={() => onFocusProvider?.(index)}
            aria-pressed={index === boundedFocus}
            aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}`}
          >
            <span className="qa-taskbar-node__instrument">
              <ArcGaugeV3
                className="qa-taskbar-node__gauge"
                remaining={provider.arcFraction}
                size={layout.nodeSize}
                stroke={stageState === "expanded" ? 4.4 : 4}
                colorOverride={color}
                ariaLabel={`${provider.name} ${provider.primaryLabel} arc`}
              />
              <span className="qa-taskbar-node__icon">
                <QaProviderIcon providerId={provider.iconId} size={Math.round(layout.nodeSize * 0.32)} />
              </span>
            </span>
            <span className="qa-taskbar-node__value" style={{ color }}>{formatPercentage(provider.primaryValue)}</span>
            <span className="qa-taskbar-node__name">{provider.name}</span>
            <span className="qa-taskbar-node__reset">↻ {provider.reset}</span>
          </button>
        );
      })}

      <button
        type="button"
        className="qa-taskbar-core"
        style={{
          left: layout.core.x - layout.core.radius,
          top: layout.core.y - layout.core.radius,
          width: layout.core.radius * 2,
          height: layout.core.radius * 2,
        }}
        onClick={onToggleExpanded}
        aria-label={stageState === "expanded" ? "Collapse quota instrument" : "Expand quota instrument"}
      >
        <span className="qa-taskbar-core__content">
          <span className="qa-taskbar-core__name">{focused?.name ?? "QuotaArc"}</span>
          <span className="qa-taskbar-core__value">{formatPercentage(focused?.primaryValue)}</span>
          <span className="qa-taskbar-core__mode">{focused?.primaryLabel ?? "unavailable"}</span>
          <span className="qa-taskbar-core__reset">{focused ? `Resets ${focused.reset}` : "No providers connected"}</span>
        </span>
      </button>

      {visibleProviders.length === 0 && <div className="qa-taskbar-stage__empty">No providers connected</div>}
    </section>
  );
}
