/**
 * Phase 5: the 3D Provider Universe prototype scene.
 *
 * One stable engine instance for the component's lifetime (owner section
 * 40) -- created on mount, updated via `updateData`/`updateTheme` as real
 * props change, disposed on unmount. Never re-created on every snapshot
 * refresh.
 *
 * Accessibility (owner sections 26-28): the canvas carries a real
 * `aria-label`/`aria-describedby`; a parallel semantic provider list and
 * a selected-provider detail panel exist as plain DOM, fully keyboard-
 * operable, independent of any raycast picking. A screen-reader user
 * never needs 3D interaction to reach the same information a sighted
 * mouse user gets from clicking a body.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { useReducedMotion } from "../../../design-system/motion";
import { useFormattedResetTime } from "../../../hooks/useFormattedResetTime";
import { formatPercentage } from "../../../design-system/percent";
import type { ProviderUsageSnapshot, SettingsSnapshot } from "../../../types/bridge";
import type { CatalogTheme } from "../../../design-system/themeCatalog";
import { resolveVisualComposition } from "../../../design-system/visualComposition";
import {
  buildProviderSceneNodes,
  structureColorsFromTheme,
  type ProviderSceneNode,
} from "./sceneModel";
import { resolveProviderIdentityColor } from "./identity";
import { createProvidersUniverseEngine, type ProvidersUniverseEngine } from "./engine";
import "./ProvidersUniverseScene.css";

export interface ProvidersUniverseSceneProps {
  liveProviders: ProviderUsageSnapshot[];
  settings: SettingsSnapshot;
  theme: CatalogTheme;
  /** Opens the Providers settings tab (e.g. from the empty-state "manage
   *  providers" action) -- distinct from `onSwitchToAnalytics2D` below. */
  onOpenProviders: () => void;
  /** Switches the Dashboard mode itself back to 2D -- used by the
   *  WebGL-unavailable fallback (Phase 5.1 owner section 18 fix: this
   *  used to call `onOpenProviders`, which actually opens the Providers
   *  tab, not the 2D Dashboard -- caught by clicking the real button in
   *  a native capture with WebGL genuinely disabled). */
  onSwitchToAnalytics2D: () => void;
}

function monetaryText(node: ProviderSceneNode, t: (key: import("../../../i18n/keys").LocaleKey) => string): string {
  if (node.monetary.amount == null) {
    return node.monetary.kind === "balance"
      ? t("Providers3DMonetaryBalanceUnavailable")
      : node.monetary.kind === "credits"
        ? t("Providers3DMonetaryCreditsUnavailable")
        : t("DashboardValueUnavailable");
  }
  const amount = node.monetary.amount.toFixed(2);
  const currency = node.monetary.currencyCode ?? "";
  if (node.monetary.kind === "spend") return `${t("Providers3DMonetarySpend")}: ${currency} ${amount}`;
  if (node.monetary.kind === "balance") return `${t("Providers3DMonetaryBalance")}: ${currency} ${amount}`;
  return `${t("Providers3DMonetaryCredits")}: ${amount}`;
}

function SelectedProviderPanel({ node }: { node: ProviderSceneNode }) {
  const { t } = useLocale();
  const resetText = useFormattedResetTime(node.resetsAt, null, true, "reset");
  return (
    <section
      className="providers3d__detail"
      aria-label={t("Providers3DSelectedProviderDetail")}
      data-testid="providers3d-detail"
    >
      <h3>
        <bdi>{node.displayName}</bdi>
      </h3>
      <dl>
        <div>
          <dt>{t("Providers3DUsage")}</dt>
          <dd>
            {node.usedPercent == null ? t("DashboardValueUnavailable") : formatPercentage(node.usedPercent)}
          </dd>
        </div>
        <div>
          <dt>{t("DashboardKpiNextReset")}</dt>
          <dd>{resetText ?? t("DashboardValueUnavailable")}</dd>
        </div>
        <div>
          <dt>{t("Providers3DAuthStatus")}</dt>
          <dd>
            {node.authState === "ready"
              ? t("Providers3DAuthReady")
              : node.authState === "needsAuth"
                ? t("DashboardAlertAuthRequired").replace("{}", node.displayName)
                : t("DashboardAlertUnavailable").replace("{}", node.displayName)}
          </dd>
        </div>
        <div>
          <dt>{t("Providers3DMonetaryState")}</dt>
          <dd>{monetaryText(node, t)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function ProvidersUniverseScene({
  liveProviders,
  settings,
  theme,
  onOpenProviders,
  onSwitchToAnalytics2D,
}: ProvidersUniverseSceneProps) {
  const { t } = useLocale();
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(systemReducedMotion);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ProvidersUniverseEngine | null>(null);
  const [engineFailed, setEngineFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const preset = settings.dashboardPerformancePreset ?? "balanced";

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

  // Engine creation -- once per mount, never re-created by a data/theme
  // change (owner section 40).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const result = createProvidersUniverseEngine(canvas, {
      performancePreset: preset,
      reducedMotion,
      onSelect: setSelectedId,
      onHover: setHoveredId,
    });
    if (!result.ok) {
      setEngineFailed(true);
      return;
    }
    engineRef.current = result.engine;
    const container = containerRef.current;
    if (container) {
      result.engine.mount(container.clientWidth, container.clientHeight);
    }
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount-once; see updates below.
  }, []);

  // Resize observer -- real dirty-render trigger on container size change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      engineRef.current?.resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    engineRef.current?.updateData(nodes);
  }, [nodes]);

  useEffect(() => {
    engineRef.current?.updateTheme(structureColorsFromTheme(theme));
  }, [theme]);

  useEffect(() => {
    engineRef.current?.updatePerformancePreset(preset);
  }, [preset]);

  useEffect(() => {
    engineRef.current?.updateReducedMotion(reducedMotion);
  }, [reducedMotion]);

  const selectProvider = useCallback((id: string | null) => {
    setSelectedId(id);
    engineRef.current?.select(id);
  }, []);

  const resetView = useCallback(() => {
    engineRef.current?.resetView();
  }, []);

  const handleListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      if (nodes.length === 0) return;
      const currentIndex = nodes.findIndex((n) => n.id === selectedId);
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        const next = nodes[(currentIndex + 1 + nodes.length) % nodes.length];
        selectProvider(next.id);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        const prev = nodes[(currentIndex - 1 + nodes.length) % nodes.length];
        selectProvider(prev.id);
      } else if (event.key === "Escape") {
        selectProvider(null);
      }
    },
    [nodes, selectedId, selectProvider],
  );

  if (engineFailed) {
    return (
      <div className="providers3d__fallback" role="status">
        <h3>{t("Providers3DUnavailableTitle")}</h3>
        <p>{t("Providers3DUnavailableBody")}</p>
        <button type="button" className="credential-btn credential-btn--secondary" onClick={onSwitchToAnalytics2D}>
          {t("Providers3DOpen2DFallback")}
        </button>
      </div>
    );
  }

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const hoveredNode = nodes.find((n) => n.id === hoveredId) ?? null;

  return (
    <div className="providers3d" data-qa-motion={reducedMotion ? "reduced" : "full"}>
      <div className="providers3d__canvas-wrap" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="providers3d__canvas"
          role="img"
          aria-label={t("Providers3DCanvasLabel")}
          aria-describedby="providers3d-canvas-desc"
        />
        <p id="providers3d-canvas-desc" className="providers3d__sr-only">
          {t("Providers3DCanvasDescription")}
        </p>
        {hoveredNode && !selectedNode && (
          <div className="providers3d__hover-label" aria-hidden="true">
            <bdi>{hoveredNode.displayName}</bdi>
            {hoveredNode.usedPercent != null ? ` · ${formatPercentage(hoveredNode.usedPercent)}` : ""}
          </div>
        )}
        {nodes.length === 0 && (
          <div className="providers3d__empty">
            <p>{t("Providers3DEmptyTitle")}</p>
            <button type="button" className="credential-btn credential-btn--secondary" onClick={onOpenProviders}>
              {t("Providers3DManageProviders")}
            </button>
          </div>
        )}
        <button type="button" className="providers3d__reset-view" onClick={resetView}>
          {t("Providers3DResetView")}
        </button>
      </div>

      <nav className="providers3d__navigator" aria-label={t("Providers3DProviderNavigator")}>
        <ul onKeyDown={handleListKeyDown}>
          {nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                aria-pressed={node.id === selectedId}
                className={node.id === selectedId ? "providers3d__nav-item providers3d__nav-item--selected" : "providers3d__nav-item"}
                onClick={() => selectProvider(node.id)}
              >
                <bdi>{node.displayName}</bdi>
                {node.alertLevel !== "none" && (
                  <span className={`providers3d__alert-dot providers3d__alert-dot--${node.alertLevel}`} aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {selectedNode && <SelectedProviderPanel node={selectedNode} />}
    </div>
  );
}
