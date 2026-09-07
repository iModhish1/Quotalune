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
import { topOrbitLayout } from "./topOrbitLayout";
import "./TopOrbitStage.css";

interface TopOrbitStageProps {
  catalog: string;
  state: "idle" | "hover" | "expanded";
  providers: StageProvider[];
  focusedIndex?: number;
  onFocusProvider?: (index: number) => void;
  onToggleExpanded?: () => void;
}

function topHousingPath(width: number, expanded: boolean) {
  const center = width / 2;
  const bottom = expanded ? 214 : 174;
  const shoulder = expanded ? 108 : 96;
  const notchY = expanded ? 82 : 76;
  return [
    `M 0 0 H ${width} V 46`,
    `Q ${width - 20} ${bottom - 28} ${width - 128} ${bottom - 8}`,
    `Q ${center + 112} ${bottom + 8} ${center + 58} ${shoulder}`,
    `Q ${center + 40} ${notchY} ${center} ${notchY}`,
    `Q ${center - 40} ${notchY} ${center - 58} ${shoulder}`,
    `Q ${128} ${bottom + 8} 0 46 Z`,
  ].join(" ");
}

export default function TopOrbitStage({
  catalog,
  state,
  providers,
  focusedIndex = 0,
  onFocusProvider,
  onToggleExpanded,
}: TopOrbitStageProps) {
  const theme = catalogBySlug(catalog) ?? (catalogBySlug("01-obsidian-orbit") as CatalogTheme);
  const expanded = state === "expanded";
  const stageState = expanded ? "expanded" : "compact";
  const visibleProviders = providers.slice(0, 7);
  const baseLayout = topOrbitLayout(stageState, visibleProviders.length);
  const maximumNodeSize = baseLayout.nodeSize * 1.08;
  const horizontalFootprint = Math.max(maximumNodeSize, baseLayout.nodeFootprint) / 2;
  const nodeCenter = { x: baseLayout.width / 2, y: expanded ? 92 : 82 };
  const layout = {
    ...baseLayout,
    nodes: characterizeSurfaceNodes(
      baseLayout.nodes,
      nodeCenter,
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
  const gradientId = `qa-top-${theme.slug}-${stageState}`;
  const style = {
    width: layout.width,
    height: layout.height,
    "--qa-top-accent": theme.accent,
    "--qa-top-accent-2": theme.accent2,
    "--qa-top-accent-3": theme.accent3,
    "--qa-top-core": theme.core,
    "--qa-top-edge": theme.coreEdge,
    ...catalogMotionStyle(theme),
  } as CSSProperties;

  return (
    <section
      className="qa-top-orbit"
      data-state={stageState}
      data-light={light}
      data-theme={theme.slug}
      data-geometry={theme.geometry}
      data-motion={motion.character}
      style={style}
      aria-label={`${theme.name} top orbital notch`}
    >
      <svg className="qa-top-orbit__housing" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="15%" r="78%">
            <stop offset="0" stopColor={theme.coreEdge} stopOpacity={light ? 0.98 : 0.94} />
            <stop offset="0.58" stopColor={theme.bg[0]} stopOpacity={light ? 0.96 : 0.9} />
            <stop offset="1" stopColor={theme.bg[1]} stopOpacity={light ? 0.92 : 0.82} />
          </radialGradient>
          <radialGradient id={`${gradientId}-energy-a`} cx="14%" cy="28%" r="72%">
            <stop offset="0" stopColor={theme.accent2} stopOpacity={light ? 0.08 : 0.19} />
            <stop offset="1" stopColor={theme.accent2} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${gradientId}-energy-b`} cx="86%" cy="22%" r="72%">
            <stop offset="0" stopColor={theme.accent3} stopOpacity={light ? 0.07 : 0.16} />
            <stop offset="1" stopColor={theme.accent3} stopOpacity="0" />
          </radialGradient>
          <filter id={`${gradientId}-shadow`} x="-20%" y="-20%" width="140%" height="170%">
            <feDropShadow dx="0" dy="13" stdDeviation="16" floodColor="#000" floodOpacity={light ? 0.2 : 0.68} />
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor={theme.accent} floodOpacity="0.12" />
          </filter>
        </defs>
        <path
          d={topHousingPath(layout.width, expanded)}
          fill={`url(#${gradientId})`}
          stroke={light ? "rgba(30,58,95,0.28)" : "rgba(255,255,255,0.17)"}
          strokeWidth={1.2}
          filter={`url(#${gradientId}-shadow)`}
        />
        <path d={topHousingPath(layout.width, expanded)} fill={`url(#${gradientId}-energy-a)`} />
        <path d={topHousingPath(layout.width, expanded)} fill={`url(#${gradientId}-energy-b)`} />
        <path d={topHousingPath(layout.width, expanded)} fill="none" stroke={theme.accent} strokeOpacity={0.22} strokeWidth={2.2} />
        <path
          d={`M 18 58 Q ${layout.width / 2} ${expanded ? 252 : 204} ${layout.width - 18} 58`}
          fill="none"
          stroke={theme.hairline}
          strokeWidth={1}
        />
        {layout.nodes.map((node, index) => (
          <line
            key={index}
            x1={layout.width / 2}
            y1={expanded ? 74 : 68}
            x2={node.x}
            y2={node.y}
            stroke={theme.hairline}
            strokeOpacity={0.72}
            strokeWidth={0.8}
          />
        ))}
      </svg>

      <svg className="qa-top-orbit__texture" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
        <OrbitTexture
          theme={theme}
          cx={layout.width / 2}
          cy={expanded ? 170 : 148}
          radiusX={layout.width * 0.44}
          radiusY={expanded ? 144 : 112}
        />
      </svg>

      <button
        type="button"
        className="qa-top-orbit__brand"
        onClick={onToggleExpanded}
        aria-label={expanded ? "Collapse top orbital notch" : "Expand top orbital notch"}
      />

      {visibleProviders.map((provider, index) => {
        const node = layout.nodes[index];
        const color = providerColor(theme, provider.iconId);
        const nodeSize = layout.nodeSize * node.scale;
        const nodeStyle = {
          left: node.x,
          top: node.y,
          "--qa-top-footprint": `${layout.nodeFootprint}px`,
          "--qa-top-node-size": `${nodeSize}px`,
          "--qa-top-node-color": color,
          "--qa-theme-motion-delay": motionDelay(motion, index),
        } as CSSProperties;
        return (
          <button
            key={provider.id}
            type="button"
            className="qa-top-orbit__node"
            data-focused={index === boundedFocus}
            style={nodeStyle}
            onClick={() => onFocusProvider?.(index)}
            aria-pressed={index === boundedFocus}
            aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}`}
          >
            <span className="qa-top-orbit__node-ring">
              <ArcGaugeV3
                className="qa-top-orbit__gauge"
                remaining={provider.arcFraction}
                size={nodeSize}
                stroke={expanded ? 3.8 : 3.4}
                colorOverride={color}
                ariaLabel={`${provider.name} ${provider.primaryLabel} arc`}
              />
              <span className="qa-top-orbit__icon">
                <QaProviderIcon providerId={provider.iconId} size={providerGlyphSize(nodeSize)} />
              </span>
            </span>
            <span className="qa-top-orbit__value">{formatPercentage(provider.primaryValue)}</span>
            <span className="qa-top-orbit__name">{provider.name}</span>
          </button>
        );
      })}

      <div
        className="qa-top-orbit__summary"
        style={{
          left: layout.summary.x - layout.summary.radius,
          top: layout.summary.y - layout.summary.radius,
          width: layout.summary.radius * 2,
          height: layout.summary.radius * 2,
        }}
      >
        <div className="qa-top-orbit__summary-content">
          <span className="qa-top-orbit__summary-name">{focused?.name ?? "Quotalis"}</span>
          <span className="qa-top-orbit__summary-value">{formatPercentage(focused?.primaryValue)}</span>
          <span className="qa-top-orbit__summary-mode">{focused?.primaryLabel ?? "unavailable"}</span>
          <span className="qa-top-orbit__summary-reset">↻ {focused?.reset ?? "—"}</span>
        </div>
      </div>
    </section>
  );
}
