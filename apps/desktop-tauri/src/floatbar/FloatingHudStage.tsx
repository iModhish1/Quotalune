import type { CSSProperties } from "react";

import { ArcGaugeV3, QaProviderIcon, formatPercentage, providerGlyphSize } from "../design-system";
import {
  catalogBySlug,
  providerColor,
  type CatalogTheme,
} from "../design-system/themeCatalog";
import { catalogMotion, catalogMotionStyle, motionDelay } from "../design-system/themeMotion";
import { characterizeSurfaceNodes } from "../design-system/surfaceGeometry";
import OrbitTexture from "../components/orbit/OrbitTexture";
import type { StageProvider } from "../components/orbit/stageTypes";
import "./FloatingHudStage.css";

interface FloatingHudStageProps {
  catalog: string;
  providers: StageProvider[];
  selectedProviderId?: string | null;
  onSelectProvider?: (providerId: string) => void;
  showProviderIcons?: boolean;
}

const DEFAULT_THEME = "01-obsidian-orbit";

export default function FloatingHudStage({
  catalog,
  providers,
  selectedProviderId,
  onSelectProvider,
  showProviderIcons = true,
}: FloatingHudStageProps) {
  const theme = catalogBySlug(catalog) ?? (catalogBySlug(DEFAULT_THEME) as CatalogTheme);
  const visible = providers.slice(0, 7);
  const focused = visible.find((provider) => provider.id === selectedProviderId) ?? visible[0];
  const focusedColor = focused ? providerColor(theme, focused.iconId) : theme.accent;
  const light = theme.slug === "04-porcelain-halo";
  const motion = catalogMotion(theme);
  const nodeCenter = { x: 230, y: 241 };
  const baseNodes = visible.map((_, index) => {
    const angle = -90 + (360 * index) / Math.max(1, visible.length);
    const radians = (angle * Math.PI) / 180;
    return {
      x: nodeCenter.x + 178 * Math.cos(radians),
      y: nodeCenter.y + 178 * Math.sin(radians),
    };
  });
  const nodes = characterizeSurfaceNodes(
    baseNodes,
    nodeCenter,
    theme.geometry,
    { left: 43, right: 417, top: 43, bottom: 432 },
  );
  const style = {
    "--qa-hud-bg-0": theme.bg[0],
    "--qa-hud-bg-1": theme.bg[1],
    "--qa-hud-core": theme.core,
    "--qa-hud-edge": theme.coreEdge,
    "--qa-hud-accent": theme.accent,
    "--qa-hud-accent-2": theme.accent2,
    "--qa-hud-accent-3": theme.accent3,
    "--qa-hud-focus": focusedColor,
    "--qa-hud-hairline": theme.hairline,
    ...catalogMotionStyle(theme),
  } as CSSProperties;

  return (
    <section
      className="qa-floating-hud"
      data-theme={theme.slug}
      data-geometry={theme.geometry}
      data-motion={motion.character}
      data-light={light}
      style={style}
      aria-label={`${theme.name} floating HUD`}
      data-tauri-drag-region
    >
      <div className="qa-floating-hud__material" data-tauri-drag-region />
      <svg className="qa-floating-hud__orbit" viewBox="0 0 460 500" aria-hidden="true">
        <defs>
          <radialGradient id="hud-core-glow">
            <stop offset="0" stopColor={focusedColor} stopOpacity="0.22" />
            <stop offset="0.62" stopColor={focusedColor} stopOpacity="0.04" />
            <stop offset="1" stopColor={focusedColor} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="230" cy="241" rx="194" ry="192" fill="url(#hud-core-glow)" />
        <OrbitTexture theme={theme} cx={230} cy={241} radiusX={186} radiusY={189} />
        {[124, 157, 190].map((radius, index) => (
          <ellipse
            key={radius}
            cx="230"
            cy="241"
            rx={radius}
            ry={radius}
            fill="none"
            stroke={index === 1 ? theme.accent : theme.hairline}
            strokeOpacity={index === 1 ? 0.2 : 0.75}
            strokeWidth={index === 1 ? 1.25 : 0.8}
            strokeDasharray={index === 2 ? "2 7" : undefined}
          />
        ))}
        {nodes.map((node, index) => (
          <line
            key={index}
            x1={nodeCenter.x}
            y1={nodeCenter.y}
            x2={node.x}
            y2={node.y}
            stroke={theme.hairline}
            strokeWidth="0.8"
          />
        ))}
      </svg>

      {visible.map((provider, index) => {
        const node = nodes[index];
        const nodeColor = providerColor(theme, provider.iconId);
        const nodeSize = 58 * node.scale;
        return (
          <button
            key={provider.id}
            type="button"
            className="qa-floating-hud__node"
            data-focused={provider.id === focused?.id}
            data-status={provider.status}
            style={
              {
                left: `${(node.x / 460) * 100}%`,
                top: `${(node.y / 500) * 100}%`,
                "--qa-hud-node": nodeColor,
                "--qa-hud-node-size": `${nodeSize}px`,
                "--qa-theme-motion-delay": motionDelay(motion, index),
              } as CSSProperties
            }
            onClick={() => onSelectProvider?.(provider.id)}
            aria-pressed={provider.id === focused?.id}
            aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}`}
          >
            <span className="qa-floating-hud__node-ring">
              <ArcGaugeV3
                remaining={provider.arcFraction}
                size={nodeSize}
                stroke={3.5}
                colorOverride={nodeColor}
                ariaLabel={`${provider.name} usage arc`}
              />
              {showProviderIcons && (
                <span className="qa-floating-hud__node-icon">
                  <QaProviderIcon providerId={provider.iconId} size={providerGlyphSize(nodeSize)} />
                </span>
              )}
            </span>
            <span className="qa-floating-hud__node-name">{provider.name}</span>
            <strong className="qa-floating-hud__node-value">{formatPercentage(provider.primaryValue)}</strong>
          </button>
        );
      })}

      <div className="qa-floating-hud__focus" data-tauri-drag-region>
        <span className="qa-floating-hud__focus-provider" data-tauri-drag-region>
          {focused && showProviderIcons && <QaProviderIcon providerId={focused.iconId} size={22} />}
          <span>{focused?.name ?? "Quotalis"}</span>
        </span>
        <strong data-tauri-drag-region>{formatPercentage(focused?.primaryValue)}</strong>
        <span className="qa-floating-hud__focus-mode" data-tauri-drag-region>
          {focused?.primaryLabel ?? "unavailable"}
        </span>
        <span className="qa-floating-hud__focus-reset" data-tauri-drag-region>
          ↻ Resets {focused?.reset ?? "—"}
        </span>
      </div>

      <div className="qa-floating-hud__footer" data-tauri-drag-region>
        <span>{theme.name}</span>
        <span aria-hidden="true">•••</span>
      </div>
    </section>
  );
}
