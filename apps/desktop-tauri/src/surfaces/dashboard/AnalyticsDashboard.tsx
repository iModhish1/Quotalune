/**
 * 2D Analytics Dashboard -- the real, non-placeholder Dashboard mode.
 *
 * Phase 3 recomposition: a real analytics hierarchy (header/range/filter,
 * KPIs, usage-trend, provider distribution, alerts, data status) sits
 * above the existing, unchanged provider-switcher-grid + provider-card
 * stack (`DashboardBody`, reframed here as "Provider Overview" -- kept
 * because it already provides real, tested functionality: reordering,
 * deep-linking, per-provider detail views, and the full reset/pace/cost
 * display this phase does not need to rebuild). The orbital usage hero is
 * turned off in this mode (`hideHero`) -- "No giant empty orbital hero in
 * 2D mode" once the real analytics rows above are the primary content.
 *
 * Phase 5.2: consumes `useEffectiveProviders()` instead of `useProviders()`
 * directly, so this same component renders Demo Mode's synthetic data
 * when enabled -- no duplicated Dashboard implementation (owner section
 * 18/19).
 */
import { useMemo } from "react";
import { useEffectiveProviders } from "../../hooks/useEffectiveProviders";
import { useSettings } from "../../hooks/useSettings";
import { useDashboardState } from "../../hooks/useDashboardState";
import { useResetStageOptions } from "../../hooks/useResetStageOptions";
import { useLocale } from "../../hooks/useLocale";
import DashboardBody from "../../components/DashboardBody";
import DashboardAnalyticsPanel from "./analytics/DashboardAnalyticsPanel";
import { toStageProviders, usageConfigFromSnapshot } from "../../components/orbit/stageProviders";
import { resolveCatalogTheme } from "../../design-system/themeResolution";
import type { DashboardModeProps } from "../../lib/dashboardRegistry";
import "./AnalyticsDashboard.css";

export default function AnalyticsDashboard({ state, onOpenProviders }: DashboardModeProps) {
  const { settings, update } = useSettings(state.settings);
  const {
    providers,
    isRefreshing,
    refreshingProviderIds,
    hasCachedData,
    provenance,
  } = useEffectiveProviders(settings, state.providers);
  const { t } = useLocale();

  const {
    sorted,
    visibleProviders,
    selectedProviderId,
    gridExpanded,
    setGridExpanded,
    handleGridClick,
    handleReorder,
    setCardRef,
  } = useDashboardState({
    providers,
    bootstrapProviders: state.providers,
    settings,
    bypassEnabledFilter: provenance === "demo",
  });

  const resetOptions = useResetStageOptions(settings, "dashboard");
  const stageProviders = useMemo(
    () => toStageProviders(sorted, usageConfigFromSnapshot(settings), resetOptions),
    [sorted, settings, resetOptions],
  );
  const catalog = resolveCatalogTheme(settings, "dashboard").slug;

  return (
    <div className="dashboard-tab">
      <DashboardAnalyticsPanel
        liveProviders={sorted}
        settings={settings}
        catalog={state.providers}
        provenance={provenance}
        onOpenProviders={onOpenProviders}
        onExitDemo={() => update({ demoModeEnabled: false })}
      />
      <h2 className="dashboard-tab__provider-overview-title">
        {t("DashboardProviderOverviewTitle")}
      </h2>
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
        hideHero
      />
    </div>
  );
}
