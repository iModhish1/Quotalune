import type { CSSProperties } from "react";

import { ArcGaugeV3, QaProviderIcon, formatPercentage, providerGlyphSize } from "../../design-system";
import {
  catalogBySlug,
  providerColor,
  type CatalogTheme,
} from "../../design-system/themeCatalog";
import { catalogMotion, catalogMotionStyle, motionDelay } from "../../design-system/themeMotion";
import { characterizeSurfaceNodes } from "../../design-system/surfaceGeometry";
import OrbitTexture from "../orbit/OrbitTexture";
import type { StageProvider } from "../orbit/stageTypes";
import { taskbarLayout, type TaskbarStageState } from "./taskbarLayout";
import "./TaskbarStage.css";

export type { StageProvider } from "../orbit/stageTypes";

export interface TaskbarStageProps {
  catalog: string;
  state: "idle" | "hover" | "expanded";
  providers: StageProvider[];
  focusedIndex?: number;
  onFocusProvider?: (index: number) => void;
  onToggleExpanded?: () => void;
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
          <path d="M 83 294 Q 151 83 410 40 Q 669 83 737 294" fill="none" stroke={theme.accent} strokeOpacity={0.28} strokeWidth={1.2} />
          <path d="M 132 314 Q 201 139 410 102 Q 619 139 688 314" fill="none" stroke={theme.hairline} strokeWidth={1} />
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

export default function TaskbarStage({
  catalog,
  state,
  providers,
  focusedIndex = 0,
  onFocusProvider,
  onToggleExpanded,
}: TaskbarStageProps) {
  const theme = catalogBySlug(catalog) ?? (catalogBySlug("01-obsidian-orbit") as CatalogTheme);
  const stageState: TaskbarStageState = state === "expanded" ? "expanded" : "compact";
  const visibleProviders = providers.slice(0, 7);
  const baseLayout = taskbarLayout(stageState, visibleProviders.length);
  const maximumNodeSize = baseLayout.nodeSize * 1.08;
  const horizontalFootprint = Math.max(maximumNodeSize, baseLayout.labelWidth) / 2;
  const layout = {
    ...baseLayout,
    nodes: characterizeSurfaceNodes(
      baseLayout.nodes,
      baseLayout.core,
      theme.geometry,
      {
        left: horizontalFootprint,
        right: baseLayout.width - horizontalFootprint,
        top: maximumNodeSize / 2,
        bottom: baseLayout.height - maximumNodeSize / 2 - baseLayout.labelDepth,
      },
    ),
  };
  const boundedFocus = visibleProviders.length === 0
    ? -1
    : Math.max(0, Math.min(focusedIndex, visibleProviders.length - 1));
  const focused = visibleProviders[boundedFocus];
  const light = theme.slug === "04-porcelain-halo";
  const motion = catalogMotion(theme);
  const gradientId = `qa-stage-${theme.slug}-${stageState}`;
  const style = {
    width: layout.width,
    height: layout.height,
    "--qa-stage-accent": theme.accent,
    "--qa-stage-accent-2": theme.accent2,
    "--qa-stage-accent-3": theme.accent3,
    "--qa-stage-core": theme.core,
    "--qa-stage-edge": theme.coreEdge,
    ...catalogMotionStyle(theme),
  } as CSSProperties;

  return (
    <section
      className="qa-taskbar-stage"
      data-state={stageState}
      data-theme={theme.slug}
      data-geometry={theme.geometry}
      data-motion={motion.character}
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
          <radialGradient id={`${gradientId}-energy-a`} cx="18%" cy="28%" r="76%">
            <stop offset="0" stopColor={theme.accent2} stopOpacity={light ? 0.1 : 0.2} />
            <stop offset="1" stopColor={theme.accent2} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${gradientId}-energy-b`} cx="84%" cy="78%" r="72%">
            <stop offset="0" stopColor={theme.accent3} stopOpacity={light ? 0.08 : 0.17} />
            <stop offset="1" stopColor={theme.accent3} stopOpacity="0" />
          </radialGradient>
          <filter id={`${gradientId}-shadow`} x="-25%" y="-25%" width="150%" height="160%">
            <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#000" floodOpacity={light ? 0.22 : 0.7} />
            <feDropShadow dx="0" dy="0" stdDeviation="9" floodColor={theme.accent} floodOpacity="0.13" />
          </filter>
        </defs>
        <path d={housingPath(stageState)} fill={`url(#${gradientId})`} stroke={light ? "rgba(30,58,95,0.26)" : "rgba(255,255,255,0.16)"} strokeWidth={1.2} filter={`url(#${gradientId}-shadow)`} />
        <path d={housingPath(stageState)} fill={`url(#${gradientId}-energy-a)`} />
        <path d={housingPath(stageState)} fill={`url(#${gradientId}-energy-b)`} />
        <path d={housingPath(stageState)} fill="none" stroke={theme.accent} strokeOpacity={0.2} strokeWidth={3} />
        <BaseStructure theme={theme} state={stageState} nodes={layout.nodes} core={layout.core} />
      </svg>

      <svg className="qa-taskbar-stage__ornament" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
        <OrbitTexture
          theme={theme}
          cx={layout.core.x}
          cy={layout.core.y}
          radiusX={stageState === "expanded" ? 330 : 300}
          radiusY={stageState === "expanded" ? 230 : 292}
        />
      </svg>

      {visibleProviders.map((provider, index) => {
        const node = layout.nodes[index];
        const color = providerColor(theme, provider.iconId);
        const nodeSize = layout.nodeSize * node.scale;
        const nodeStyle = {
          left: node.x,
          top: node.y,
          width: Math.max(layout.nodeSize, layout.labelWidth),
          "--qa-node-size": `${nodeSize}px`,
          "--qa-node-color": color,
          "--qa-theme-motion-delay": motionDelay(motion, index),
        } as CSSProperties;
        const hybridDetail =
          provider.resolvedMode === "hybrid" && provider.secondaryValue != null
            ? `, ${formatPercentage(provider.secondaryValue)} remaining`
            : "";
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
            aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}${hybridDetail}`}
          >
            <span className="qa-taskbar-node__instrument">
              <ArcGaugeV3 className="qa-taskbar-node__gauge" remaining={provider.arcFraction} size={nodeSize} stroke={stageState === "expanded" ? 4.4 : 4} colorOverride={color} ariaLabel={`${provider.name} ${provider.primaryLabel} arc`} />
              <span className="qa-taskbar-node__icon">
                <QaProviderIcon providerId={provider.iconId} size={providerGlyphSize(nodeSize)} />
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
        style={{ left: layout.core.x - layout.core.radius, top: layout.core.y - layout.core.radius, width: layout.core.radius * 2, height: layout.core.radius * 2 }}
        onClick={onToggleExpanded}
        aria-label={stageState === "expanded" ? "Collapse quota instrument" : "Expand quota instrument"}
      >
        <span className="qa-taskbar-core__content">
          <span className="qa-taskbar-core__name">{focused?.name ?? "Quotalis"}</span>
          <span className="qa-taskbar-core__value">{formatPercentage(focused?.primaryValue)}</span>
          <span className="qa-taskbar-core__mode">
            {focused?.resolvedMode === "hybrid" && focused.secondaryValue != null
              ? `${focused.primaryLabel} · ${formatPercentage(focused.secondaryValue)} remaining`
              : (focused?.primaryLabel ?? "unavailable")}
          </span>
          <span className="qa-taskbar-core__reset">{focused ? `Resets ${focused.reset}` : "No providers connected"}</span>
        </span>
      </button>

      {visibleProviders.length === 0 && <div className="qa-taskbar-stage__empty">No providers connected</div>}
    </section>
  );
}
