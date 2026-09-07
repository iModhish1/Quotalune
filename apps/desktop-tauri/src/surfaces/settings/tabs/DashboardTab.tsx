/**
 * Dashboard — the in-shell, first-class Settings destination.
 *
 * Renders the exact same content (`DashboardBody.tsx` + `useDashboardState`)
 * as the detached "Open Dashboard in Separate Window" surface
 * (`PopOutPanel.tsx`), just without that surface's window chrome (title
 * bar, footer Settings/About/Quit actions, webview zoom scaling, standalone
 * keyboard shortcuts) — those are meaningless here since the user is
 * already inside the Settings window.
 */
import { useMemo } from "react";
import type { BootstrapState } from "../../../types/bridge";
import { useProviders } from "../../../hooks/useProviders";
import { useSettings } from "../../../hooks/useSettings";
import { useDashboardState } from "../../../hooks/useDashboardState";
import { useResetStageOptions } from "../../../hooks/useResetStageOptions";
import DashboardBody from "../../../components/DashboardBody";
import {
  toStageProviders,
  usageConfigFromSnapshot,
} from "../../../components/orbit/stageProviders";
import { resolveCatalogTheme } from "../../../design-system/themeResolution";
import "./DashboardTab.css";

export default function DashboardTab({
  state,
  onOpenProviders,
}: {
  state: BootstrapState;
  onOpenProviders: () => void;
}) {
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
