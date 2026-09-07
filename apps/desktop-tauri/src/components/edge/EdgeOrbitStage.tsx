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
import { edgeOrbitLayout } from "./edgeOrbitLayout";
import "./EdgeOrbitStage.css";

interface EdgeOrbitStageProps {
  catalog: string;
  state: "idle" | "expanded";
  providers: StageProvider[];
  focusedIndex?: number;
  onFocusProvider?: (index: number) => void;
  onToggleExpanded?: () => void;
}

function edgeHousingPath(width: number, height: number, expanded: boolean) {
  if (expanded) {
    return `M ${width} 14 C 242 14 94 126 82 ${height / 2} C 94 ${height - 126} 242 ${height - 14} ${width} ${height - 14} Z`;
  }
  return `M ${width} 14 C 92 64 54 166 54 ${height / 2} C 54 ${height - 166} 92 ${height - 64} ${width} ${height - 14} Z`;
}

export default function EdgeOrbitStage({
  catalog,
  state,
  providers,
  focusedIndex = 0,
  onFocusProvider,
  onToggleExpanded,
}: EdgeOrbitStageProps) {
  const theme = catalogBySlug(catalog) ?? (catalogBySlug("01-obsidian-orbit") as CatalogTheme);
  const stageState = state === "expanded" ? "expanded" : "compact";
  const expanded = stageState === "expanded";
  const visibleProviders = providers.slice(0, 7);
  const baseLayout = edgeOrbitLayout(stageState, visibleProviders.length);
  const maximumNodeSize = baseLayout.nodeSize * 1.08;
  const layout = {
    ...baseLayout,
    nodes: characterizeSurfaceNodes(
      baseLayout.nodes,
      baseLayout.core,
      theme.geometry,
      {
        left: maximumNodeSize / 2,
        right: baseLayout.width - baseLayout.detailWidth - maximumNodeSize / 2 - 8,
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
  const gradientId = `qa-edge-${theme.slug}-${stageState}`;
  const style = {
    width: layout.width,
    height: layout.height,
    "--qa-edge-accent": theme.accent,
    "--qa-edge-accent-2": theme.accent2,
    "--qa-edge-accent-3": theme.accent3,
    "--qa-edge-core": theme.core,
    "--qa-edge-surface": theme.coreEdge,
    ...catalogMotionStyle(theme),
  } as CSSProperties;

  return (
    <section
      className="qa-edge-orbit"
      data-state={stageState}
      data-light={light}
      data-theme={theme.slug}
      data-geometry={theme.geometry}
      data-motion={motion.character}
      style={style}
      aria-label={`${theme.name} right edge half orbit`}
    >
      <svg className="qa-edge-orbit__housing" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
        <defs>
          <radialGradient id={gradientId} cx="100%" cy="50%" r="92%">
            <stop offset="0" stopColor={theme.coreEdge} stopOpacity={light ? 0.98 : 0.95} />
            <stop offset="0.56" stopColor={theme.bg[0]} stopOpacity={light ? 0.96 : 0.91} />
            <stop offset="1" stopColor={theme.bg[1]} stopOpacity={light ? 0.92 : 0.83} />
          </radialGradient>
          <radialGradient id={`${gradientId}-energy-a`} cx="100%" cy="18%" r="70%">
            <stop offset="0" stopColor={theme.accent2} stopOpacity={light ? 0.08 : 0.2} />
            <stop offset="1" stopColor={theme.accent2} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${gradientId}-energy-b`} cx="72%" cy="86%" r="68%">
            <stop offset="0" stopColor={theme.accent3} stopOpacity={light ? 0.07 : 0.17} />
            <stop offset="1" stopColor={theme.accent3} stopOpacity="0" />
          </radialGradient>
          <filter id={`${gradientId}-shadow`} x="-45%" y="-15%" width="155%" height="130%">
            <feDropShadow dx="-13" dy="0" stdDeviation="17" floodColor="#000" floodOpacity={light ? 0.22 : 0.7} />
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor={theme.accent} floodOpacity="0.13" />
          </filter>
        </defs>
        <path
          d={edgeHousingPath(layout.width, layout.height, expanded)}
          fill={`url(#${gradientId})`}
          stroke={light ? "rgba(30,58,95,0.28)" : "rgba(255,255,255,0.17)"}
          strokeWidth={1.2}
          filter={`url(#${gradientId}-shadow)`}
        />
        <path d={edgeHousingPath(layout.width, layout.height, expanded)} fill={`url(#${gradientId}-energy-a)`} />
        <path d={edgeHousingPath(layout.width, layout.height, expanded)} fill={`url(#${gradientId}-energy-b)`} />
        <path d={edgeHousingPath(layout.width, layout.height, expanded)} fill="none" stroke={theme.accent} strokeOpacity={0.22} strokeWidth={2.2} />
        <path
          d={expanded
            ? `M ${layout.width} 38 C 260 42 126 140 112 ${layout.height / 2} C 126 ${layout.height - 140} 260 ${layout.height - 42} ${layout.width} ${layout.height - 38}`
            : `M ${layout.width} 42 C 112 90 78 176 78 ${layout.height / 2} C 78 ${layout.height - 176} 112 ${layout.height - 90} ${layout.width} ${layout.height - 42}`}
          fill="none"
          stroke={theme.hairline}
          strokeWidth={1}
        />
        {layout.nodes.map((node, index) => (
          <line
            key={index}
            x1={layout.core.x - layout.core.radius * 0.75}
            y1={layout.core.y}
            x2={node.x + layout.nodeSize * 0.38}
            y2={node.y}
            stroke={theme.hairline}
            strokeOpacity={0.7}
            strokeWidth={0.8}
          />
        ))}
      </svg>

      <svg className="qa-edge-orbit__texture" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
        <OrbitTexture
          theme={theme}
          cx={layout.core.x}
          cy={layout.core.y}
          radiusX={expanded ? 310 : 132}
          radiusY={expanded ? 270 : 246}
        />
      </svg>

      {visibleProviders.map((provider, index) => {
        const node = layout.nodes[index];
        const color = providerColor(theme, provider.iconId);
        const nodeSize = layout.nodeSize * node.scale;
        const nodeStyle = {
          left: node.x - nodeSize / 2,
          top: node.y - nodeSize / 2,
          width: nodeSize + layout.detailWidth,
          height: nodeSize,
          "--qa-edge-node-size": `${nodeSize}px`,
          "--qa-edge-node-color": color,
          "--qa-theme-motion-delay": motionDelay(motion, index),
        } as CSSProperties;
        return (
          <button
            key={provider.id}
            type="button"
            className="qa-edge-orbit__node"
            data-focused={index === boundedFocus}
            style={nodeStyle}
            onClick={() => onFocusProvider?.(index)}
            aria-pressed={index === boundedFocus}
            aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}`}
          >
            <span className="qa-edge-orbit__node-ring">
              <ArcGaugeV3
                className="qa-edge-orbit__gauge"
                remaining={provider.arcFraction}
                size={nodeSize}
                stroke={expanded ? 3.8 : 3.4}
                colorOverride={color}
                ariaLabel={`${provider.name} ${provider.primaryLabel} arc`}
              />
              <span className="qa-edge-orbit__icon">
                <QaProviderIcon providerId={provider.iconId} size={providerGlyphSize(nodeSize)} />
              </span>
            </span>
            <span className="qa-edge-orbit__compact-value">{formatPercentage(provider.primaryValue)}</span>
            <span className="qa-edge-orbit__detail">
              <span className="qa-edge-orbit__detail-head">
                <span className="qa-edge-orbit__name">{provider.name}</span>
                <span className="qa-edge-orbit__value">{formatPercentage(provider.primaryValue)}</span>
              </span>
              <span className="qa-edge-orbit__reset">↻ {provider.reset}</span>
            </span>
          </button>
        );
      })}

      <button
        type="button"
        className="qa-edge-orbit__core"
        style={{
          left: layout.core.x - layout.core.radius,
          top: layout.core.y - layout.core.radius,
          width: layout.core.radius * 2,
          height: layout.core.radius * 2,
        }}
        onClick={onToggleExpanded}
        aria-label={expanded ? "Collapse right edge orbit" : "Expand right edge orbit"}
      >
        <span className="qa-edge-orbit__core-content">
          <span className="qa-edge-orbit__core-name">{focused?.name ?? "Quotalis"}</span>
          <span className="qa-edge-orbit__core-value">{formatPercentage(focused?.primaryValue)}</span>
          <span className="qa-edge-orbit__core-mode">{focused?.primaryLabel ?? "unavailable"}</span>
          <span className="qa-edge-orbit__core-reset">↻ {focused?.reset ?? "—"}</span>
        </span>
      </button>
    </section>
  );
}
