import { useEffectiveProviders } from "../../hooks/useEffectiveProviders";
import { useSettings } from "../../hooks/useSettings";
import { useDashboardState } from "../../hooks/useDashboardState";
import { MenuEmpty } from "../../components/MenuSurface";
import DashboardAnalyticsPanel from "./analytics/DashboardAnalyticsPanel";
import type { DashboardProps } from "./DashboardHost";
import "./AnalyticsDashboard.css";
export default function AnalyticsDashboard({ state, onOpenProviders, view="overview",initialProvider,onAnalytics }: DashboardProps) {
  const { settings, update } = useSettings(state.settings);
  const { providers, provenance } = useEffectiveProviders(settings, state.providers);
  const { sorted } = useDashboardState({ providers, bootstrapProviders: state.providers, settings, bypassEnabledFilter: provenance === "demo" });
  if (sorted.length === 0 && provenance !== "demo") return <MenuEmpty isLoading={false} onSettings={onOpenProviders} />;
  return <div className="dashboard-tab"><DashboardAnalyticsPanel view={view} initialProvider={initialProvider} onAnalytics={onAnalytics} liveProviders={sorted} settings={settings} catalog={state.providers} provenance={provenance} onOpenProviders={onOpenProviders} onExitDemo={() => update({demoModeEnabled: false})} /></div>;
}
