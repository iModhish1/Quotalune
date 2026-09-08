import { useMemo, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { useDashboardSnapshot } from "../../../hooks/useDashboardSnapshot";
import { useDashboardStructureTheme } from "./useDashboardStructureTheme";
import { availableHistoryDays, computeKpis } from "./dashboardSelectors";
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
 * (Phase 2's bridge hook) -- no widget re-fetches independently.
 *
 * Phase 3.5 section 8 (provider-filter semantics): the range/provider
 * filter genuinely scopes the "Selected Range" section (Usage Trend,
 * Historical Usage Share) below, since those are real range/provider-
 * scoped historical views. KPIs, Alerts, and Reset Schedule intentionally
 * stay unfiltered, live, "what's happening right now across everything"
 * indicators -- rather than silently ignoring the filter while sitting
 * next to it (the previous, misleading layout), they're now explicitly
 * grouped under their own "Current Status" heading so the one control
 * strip's scope is never visually ambiguous.
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
  const { t } = useLocale();
  const [range, setRange] = useState<DashboardRangeKind>("last7Days");
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  // Phase 3.6: the Dashboard's structural surfaces now follow the same
  // resolved Structure Theme every other themed surface uses -- see
  // docs/validation/DASHBOARD_STRUCTURE_THEME_INTEGRATION.md.
  const { style: structureThemeStyle } = useDashboardStructureTheme(settings);

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

  const historyChip = useMemo(() => {
    if (!snapshot) return null;
    const { sampleCount } = snapshot.availability;
    if (sampleCount === 0) return t("DashboardHistoryChipCollecting");
    const days = availableHistoryDays(snapshot.availability);
    return days === 0
      ? t("DashboardHistoryChipToday")
      : t("DashboardHistoryChipDays").replace("{}", String(days));
  }, [snapshot, t]);

  return (
    <div className="dashboard-analytics" style={structureThemeStyle}>
      <DashboardHeader
        range={range}
        onRangeChange={setRange}
        providerOptions={providerOptions}
        providerFilter={providerFilter}
        onProviderFilterChange={setProviderFilter}
        historyChip={historyChip}
      />
      <h3 className="dashboard-analytics__eyebrow">{t("DashboardSelectedRangeEyebrow")}</h3>
      <div className="dashboard-analytics__row dashboard-analytics__row--primary">
        <UsageTrendSection snapshot={snapshot} />
        <ProviderDistribution providers={snapshot?.providers ?? []} />
      </div>
      <h3 className="dashboard-analytics__eyebrow">{t("DashboardCurrentStatusEyebrow")}</h3>
      <KpiRow kpis={kpis} resetTimeRelative={settings.resetTimeRelative} />
      <div className="dashboard-analytics__row">
        <AlertsPanel providers={liveProviders} settings={settings} onOpenProviders={onOpenProviders} />
        <ResetSchedule providers={liveProviders} relative={settings.resetTimeRelative} />
      </div>
      <div className="dashboard-analytics__row dashboard-analytics__row--single">
        <DataStatusPanel snapshot={snapshot} />
      </div>
    </div>
  );
}
