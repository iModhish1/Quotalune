/**
 * Phase S1: the Spatial Observatory prototype scene.
 *
 * A lightweight 2.5D dimensional provider overview built ONLY from
 * semantic HTML, SVG, and CSS transforms -- no `<canvas>`, no WebGL
 * context, no Three.js import anywhere in this module or its
 * dependencies (owner sections 2/47). There is no
 * `requestAnimationFrame` loop here at all: node position/depth/scale
 * are plain CSS properties that transition on state change (selection,
 * hover, provider-count change) via CSS `transition`, then settle --
 * idle CPU has nothing to do (owner section 13).
 *
 * Reuses the exact same business-logic layer the 3D scene uses
 * (`buildProviderSceneNodes`, `resolveProviderIdentityColor`,
 * `structureColorsFromTheme`, the shared `ProviderDetailPanel`) --
 * Spatial's own code is the layout (`spatialLayout.ts`) and the DOM/SVG
 * rendering of one node (`ProviderInstrumentNode.tsx`), nothing else
 * (owner sections 14/15).
 */
import { useMemo, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { useReducedMotion } from "../../../design-system/motion";
import type { ProviderUsageSnapshot, SettingsSnapshot } from "../../../types/bridge";
import type { CatalogTheme } from "../../../design-system/themeCatalog";
import { resolveVisualComposition } from "../../../design-system/visualComposition";
import { buildProviderSceneNodes, structureColorsFromTheme } from "../providers3d/sceneModel";
import { resolveProviderIdentityColor } from "../providers3d/identity";
import ProviderDetailPanel from "../shared/ProviderDetailPanel";
import DemoIndicator from "../../../demoMode/DemoIndicator";
import type { DataProvenance } from "../../../hooks/useEffectiveProviders";
import { computeSpatialLayout } from "./spatialLayout";
import { shouldShowSpatialLabel } from "./spatialLabelPolicy";
import ProviderInstrumentNode from "./ProviderInstrumentNode";
import "./SpatialObservatoryScene.css";

export interface SpatialObservatorySceneProps {
  liveProviders: ProviderUsageSnapshot[];
  settings: SettingsSnapshot;
  theme: CatalogTheme;
  onOpenProviders: () => void;
  provenance: DataProvenance;
  onExitDemo: () => void;
}

export default function SpatialObservatoryScene({
  liveProviders,
  settings,
  theme,
  onOpenProviders,
  provenance,
  onExitDemo,
}: SpatialObservatorySceneProps) {
  const { t } = useLocale();
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(systemReducedMotion);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const composition = useMemo(
    () =>
      resolveVisualComposition({
        structureThemeId: theme.slug,
        identity: settings.globalLimitPresentation?.identity,
      }),
    [theme.slug, settings.globalLimitPresentation],
  );

  const nodes = useMemo(
    () =>
      buildProviderSceneNodes(
        liveProviders,
        {
          highUsageThreshold: settings.highUsageThreshold,
          criticalUsageThreshold: settings.criticalUsageThreshold,
        },
        (providerId) =>
          resolveProviderIdentityColor(providerId, {
            theme,
            composition,
            domRoot: typeof document !== "undefined" ? document.documentElement : null,
          }),
      ),
    [liveProviders, settings.highUsageThreshold, settings.criticalUsageThreshold, theme, composition],
  );

  const layout = useMemo(
    () => computeSpatialLayout(nodes.map((n) => n.id), { selectedId }),
    [nodes, selectedId],
  );

  const colors = useMemo(() => structureColorsFromTheme(theme), [theme]);
  const stageStyle = {
    ["--spatial-bg-0" as string]: colors.chamberBg[0],
    ["--spatial-bg-1" as string]: colors.chamberBg[1],
    ["--spatial-housing" as string]: colors.core,
    ["--spatial-housing-hi" as string]: colors.coreEdge,
    ["--spatial-housing-edge" as string]: colors.hairline,
    ["--spatial-accent" as string]: colors.accent,
    ["--spatial-hairline" as string]: colors.hairline,
    ["--spatial-text" as string]: colors.textPrimary,
    ["--spatial-text-muted" as string]: colors.textMuted,
  };

  const selectProvider = (id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (nodes.length === 0) return;
    const currentIndex = nodes.findIndex((n) => n.id === selectedId);
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      const next = nodes[(currentIndex + 1 + nodes.length) % nodes.length];
      setSelectedId(next.id);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = nodes[(currentIndex - 1 + nodes.length) % nodes.length];
      setSelectedId(prev.id);
    } else if (event.key === "Escape") {
      setSelectedId(null);
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  // Distinct tier "calibration axes" -- a subtle horizontal guide per
  // occupied depth tier (owner section 26), never a line drawn between
  // two providers (which would imply a relationship that doesn't exist).
  const tierAxes = useMemo(() => {
    const seen = new Map<string, number>();
    for (const node of layout.values()) {
      if (!seen.has(node.tier)) seen.set(node.tier, node.connectionAnchor.y);
    }
    return Array.from(seen.values());
  }, [layout]);

  return (
    <div className="spatial" data-qa-motion={reducedMotion ? "reduced" : "full"}>
      <div className="spatial__stage-wrap" style={stageStyle}>
        {provenance === "demo" && (
          <div className="spatial__demo-indicator">
            <DemoIndicator providerCount={nodes.length} onExit={onExitDemo} />
          </div>
        )}
        <div
          className="spatial__stage"
          role="listbox"
          aria-label={t("SpatialStageLabel")}
          aria-describedby="spatial-stage-desc"
        >
          <svg className="spatial__traces" aria-hidden="true">
            {tierAxes.map((y) => (
              <line key={y} x1="4%" y1={`${y}%`} x2="96%" y2={`${y}%`} className="spatial__trace-axis" />
            ))}
            {Array.from(layout.values()).map((node) => (
              <line
                key={node.id}
                x1={`${node.x}%`}
                y1={`${node.y}%`}
                x2={`${node.connectionAnchor.x}%`}
                y2={`${node.connectionAnchor.y}%`}
                className="spatial__trace-tick"
              />
            ))}
          </svg>
          {nodes.map((node) => {
            const nodeLayout = layout.get(node.id);
            if (!nodeLayout) return null;
            const isSelected = node.id === selectedId;
            const isHovered = node.id === hoveredId;
            return (
              <ProviderInstrumentNode
                key={node.id}
                node={node}
                layout={nodeLayout}
                isSelected={isSelected}
                isHovered={isHovered}
                showLabel={shouldShowSpatialLabel(nodes.length, nodeLayout.tier, isSelected, isHovered)}
                onSelect={selectProvider}
                onHoverChange={setHoveredId}
                reducedMotion={reducedMotion}
              />
            );
          })}
          {nodes.length === 0 && (
            <div className="spatial__empty">
              <p>{t("Providers3DEmptyTitle")}</p>
              <button type="button" className="credential-btn credential-btn--secondary" onClick={onOpenProviders}>
                {t("Providers3DManageProviders")}
              </button>
            </div>
          )}
        </div>
        <p id="spatial-stage-desc" className="spatial__sr-only">
          {t("SpatialStageDescription")}
        </p>
      </div>

      <nav className="spatial__navigator" aria-label={t("Providers3DProviderNavigator")}>
        <ul onKeyDown={handleListKeyDown}>
          {nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                aria-pressed={node.id === selectedId}
                className={
                  node.id === selectedId ? "spatial__nav-item spatial__nav-item--selected" : "spatial__nav-item"
                }
                onClick={() => selectProvider(node.id)}
              >
                <bdi>{node.displayName}</bdi>
                {node.alertLevel !== "none" && (
                  <span className={`spatial__alert-dot spatial__alert-dot--${node.alertLevel}`} aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {selectedNode && (
        <ProviderDetailPanel node={selectedNode} isDemo={provenance === "demo"} className="spatial__detail-slot" />
      )}
    </div>
  );
}
