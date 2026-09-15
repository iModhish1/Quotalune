import { useEffectiveProviders } from "../../hooks/useEffectiveProviders";
import { useSettings } from "../../hooks/useSettings";
import { useDashboardState } from "../../hooks/useDashboardState";
import { MenuEmpty } from "../../components/MenuSurface";
import DashboardAnalyticsPanel from "./analytics/DashboardAnalyticsPanel";
import type { DashboardProps } from "./DashboardHost";
import "./AnalyticsDashboard.css";
export default function AnalyticsDashboard({ state, onOpenProviders, view="overview",initialProvider,onAnalytics }: DashboardProps) {
  const { settings, update } = useSettings(state.settings);
  const { providers, provenance, hasLoadedCache } = useEffectiveProviders(settings, state.providers);
  const { sorted } = useDashboardState({ providers, bootstrapProviders: state.providers, settings, bypassEnabledFilter: provenance === "demo" });
  // Wave 1F §4/§5: was hardcoded `isLoading={false}` -- MenuEmpty's spinner
  // branch could never render on this call path, so a genuinely-loading
  // first fetch and "no providers configured" looked identical here. Uses
  // the same real first-load signal (`hasLoadedCache`, from
  // `useProviders()`'s own `getCachedProviders()` resolution) Wave 1D
  // already proved correct for Floating Structures' `initialLoading`.
  if (sorted.length === 0 && provenance !== "demo") return <MenuEmpty isLoading={!hasLoadedCache} onSettings={onOpenProviders} />;
  return <div className="dashboard-tab"><DashboardAnalyticsPanel view={view} initialProvider={initialProvider} onAnalytics={onAnalytics} liveProviders={sorted} settings={settings} catalog={state.providers} provenance={provenance} onOpenProviders={onOpenProviders} onExitDemo={() => update({demoModeEnabled: false})} /></div>;
}
