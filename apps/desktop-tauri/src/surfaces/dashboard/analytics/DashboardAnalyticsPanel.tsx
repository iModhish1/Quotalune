import { useMemo, useState } from "react";
import { useDashboardSnapshot } from "../../../hooks/useDashboardSnapshot";
import { computeKpis } from "./dashboardSelectors";
import DashboardHeader from "./DashboardHeader";
import KpiRow from "./KpiRow";
import UsageTrendSection from "./UsageTrendSection";
import ProviderDistribution from "./ProviderDistribution";
import ResetSchedule from "./ResetSchedule";
import AlertsPanel from "./AlertsPanel";
import DataStatusPanel from "./DataStatusPanel";
import type { DashboardRangeKind, ProviderUsageSnapshot, SettingsSnapshot } from "../../../types/bridge";
import "./DashboardAnalyticsPanel.css";

/**
 * Owns the one global range/provider-filter state every widget below
 * shares (owner section 7) and the single `useDashboardSnapshot()` call
 * (Phase 2's bridge hook) -- no widget re-fetches independently. KPIs and
 * alerts intentionally use the full live provider list regardless of the
 * range/provider filter (they are "what's happening right now across
 * everything" indicators); the trend chart and distribution respect the
 * filter since they are range/provider-scoped historical views.
 */
export default function DashboardAnalyticsPanel({
  liveProviders,
  settings,
  onOpenProviders,
}: {
  liveProviders: ProviderUsageSnapshot[];
  settings: SettingsSnapshot;
  onOpenProviders: () => void;
}) {
  const [range, setRange] = useState<DashboardRangeKind>("last7Days");
  const [providerFilter, setProviderFilter] = useState<string | null>(null);

  const providerOptions = useMemo(
    () => liveProviders.map((p) => ({ id: p.providerId, name: p.displayName })),
    [liveProviders],
  );
  const providersArg = useMemo(
    () => (providerFilter ? [providerFilter] : undefined),
    [providerFilter],
  );

  const { snapshot } = useDashboardSnapshot(range, undefined, providersArg);

  const kpis = useMemo(
    () =>
      computeKpis({
        liveProviders,
        snapshot,
        settings,
      }),
    [liveProviders, snapshot, settings],
  );

  return (
    <div className="dashboard-analytics">
      <DashboardHeader
        range={range}
        onRangeChange={setRange}
        providerOptions={providerOptions}
        providerFilter={providerFilter}
        onProviderFilterChange={setProviderFilter}
      />
      <KpiRow kpis={kpis} resetTimeRelative={settings.resetTimeRelative} />
      <div className="dashboard-analytics__row">
        <UsageTrendSection snapshot={snapshot} />
        <ProviderDistribution providers={snapshot?.providers ?? []} />
      </div>
      <div className="dashboard-analytics__row">
        <ResetSchedule providers={liveProviders} relative={settings.resetTimeRelative} />
        <AlertsPanel providers={liveProviders} settings={settings} onOpenProviders={onOpenProviders} />
      </div>
      <div className="dashboard-analytics__row dashboard-analytics__row--single">
        <DataStatusPanel snapshot={snapshot} />
      </div>
    </div>
  );
}
