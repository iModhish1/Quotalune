/**
 * 2D Analytics Dashboard -- the real, non-placeholder Dashboard mode.
 *
 * This is the pre-existing Dashboard content (`DashboardBody.tsx` +
 * `useDashboardState`), unchanged this phase and treated as the current
 * Analytics baseline (per Dashboard Studio Phase 2 scope: this phase is
 * structural registry/routing work, not a visual redesign -- that's
 * Phase 3). Mounted by `DashboardHost` only when `dashboardMode ===
 * "analytics2d"`.
 */
import { useMemo } from "react";
import { useProviders } from "../../hooks/useProviders";
import { useSettings } from "../../hooks/useSettings";
import { useDashboardState } from "../../hooks/useDashboardState";
import { useResetStageOptions } from "../../hooks/useResetStageOptions";
import DashboardBody from "../../components/DashboardBody";
import { toStageProviders, usageConfigFromSnapshot } from "../../components/orbit/stageProviders";
import { resolveCatalogTheme } from "../../design-system/themeResolution";
import type { DashboardModeProps } from "../../lib/dashboardRegistry";
import "./AnalyticsDashboard.css";

export default function AnalyticsDashboard({ state, onOpenProviders }: DashboardModeProps) {
  const { providers, isRefreshing, refreshingProviderIds, hasCachedData } = useProviders();
  const { settings } = useSettings(state.settings);

  const {
    sorted,
    visibleProviders,
    selectedProviderId,
    gridExpanded,
    setGridExpanded,
    handleGridClick,
    handleReorder,
    setCardRef,
  } = useDashboardState({ providers, bootstrapProviders: state.providers, settings });

  const resetOptions = useResetStageOptions(settings, "dashboard");
  const stageProviders = useMemo(
    () => toStageProviders(sorted, usageConfigFromSnapshot(settings), resetOptions),
    [sorted, settings, resetOptions],
  );
  const catalog = resolveCatalogTheme(settings, "dashboard").slug;

  return (
    <div className="dashboard-tab">
      <DashboardBody
        allProviders={sorted}
        visibleProviders={visibleProviders}
        stageProviders={stageProviders}
        isRefreshing={isRefreshing}
        hasCachedData={hasCachedData}
        refreshingProviderIds={refreshingProviderIds}
        selectedProviderId={selectedProviderId}
        gridExpanded={gridExpanded}
        onExpandedChange={setGridExpanded}
        onSelect={handleGridClick}
        onReorder={handleReorder}
        catalog={catalog}
        settings={settings}
        onSettings={onOpenProviders}
        cardRef={setCardRef}
      />
    </div>
  );
}
