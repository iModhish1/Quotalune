import { useEffect, useMemo, useState, type ReactNode } from "react";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {defaultResetPresentationConfig,resolveResetTimeZone} from "../../../lib/resetPresentation";
import { useLocale } from "../../../hooks/useLocale";
import { useEffectiveDashboardSnapshot } from "../../../hooks/useEffectiveDashboardSnapshot";
import type { DataProvenance } from "../../../hooks/useEffectiveProviders";
import { useDashboardStructureTheme } from "./useDashboardStructureTheme";
import { availableHistoryDays, computeKpis } from "./dashboardSelectors";
import DashboardHeader from "./DashboardHeader";
import CurrentLimits from "./CurrentLimits";
import CoverageHeatmap from "./CoverageHeatmap";
import KpiRow from "./KpiRow";
import UsageTrendSection from "./UsageTrendSection";
import ResetHorizon from "./ResetHorizon";
import {QuotaComparison, QuotaHistory, QuotaCoverage} from "./QuotaInsights";
import ProviderOperationsTable from "./ProviderOperationsTable";
import {analyticsPreferences} from "../../../lib/analytics/preferences";
import {buildDashboardAnalyticsModel} from "../../../lib/analytics/dashboardModel";

import {AnalyticsSection} from "../../../components/analytics/AnalyticsPrimitives";
import AttentionQueue from "./AttentionQueue";
import TrendIntelligence from "./TrendIntelligence";

import DataStatusPanel from "./DataStatusPanel";
import DemoIndicator from "../../../demoMode/DemoIndicator";
import type {
  DashboardRangeKind,
  ProviderCatalogEntry,
  ProviderUsageSnapshot,
  SettingsSnapshot,
} from "../../../types/bridge";
import "./DashboardAnalyticsPanel.css";
import "./AnalyticsWorkstation.css";

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
  catalog = [],
  provenance = "live",
  onOpenProviders,
  onExitDemo,
}: {
  liveProviders: ProviderUsageSnapshot[];
  settings: SettingsSnapshot;
  /** Real provider registry catalog (`state.providers`) -- only needed
   *  when Demo Mode is on, to build the synthetic `DashboardSnapshot`.
   *  Optional so existing callers/tests that never exercise Demo Mode
   *  don't need updating. */
  catalog?: ProviderCatalogEntry[];
  /** Phase 5.2: whether `liveProviders` is real or Demo Mode's synthetic
   *  dataset -- drives the persistent DEMO indicator. */
  provenance?: DataProvenance;
  onOpenProviders: () => void;
  /** Turns Demo Mode off -- only ever called from the indicator, so a
   *  no-op default is safe for callers that never render it (provenance
   *  stays "live"). */
  onExitDemo?: () => void;
}) {
  const { t } = useLocale();
  const resetOptions=useResetStageOptions(settings,"dashboard");
  const metadataDate=new Intl.DateTimeFormat(resetOptions.locale,{dateStyle:"medium",numberingSystem:"latn",timeZone:resolveResetTimeZone({...defaultResetPresentationConfig(),...resetOptions.config})});
  const preferences = useMemo(() => analyticsPreferences(settings.analyticsPreferences), [settings.analyticsPreferences]);
  const [range, setRange] = useState<DashboardRangeKind>(preferences.defaultRange);
  useEffect(() => setRange(preferences.defaultRange), [preferences.defaultRange]);
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

  const { snapshot } = useEffectiveDashboardSnapshot(range, undefined, providersArg, settings, catalog);

  const currentProviders = useMemo(() => preferences.providerFilterScope === "all" && providerFilter
    ? liveProviders.filter(provider => provider.providerId === providerFilter) : liveProviders,
    [liveProviders, preferences.providerFilterScope, providerFilter]);
  const now = useMemo(() => Date.now(), [liveProviders, snapshot]);
  const model=useMemo(()=>buildDashboardAnalyticsModel(currentProviders,snapshot,settings,providerFilter,now),[currentProviders,snapshot,settings,providerFilter,now]);
  const {currentLimits:models,trends:series,attention,kpis}=model;

  const historyChip = useMemo(() => {
    if (!snapshot) return null;
    const { sampleCount } = snapshot.availability;
    if (sampleCount === 0) return t("DashboardHistoryChipCollecting");
    const days = availableHistoryDays(snapshot.availability);
    return days === 0
      ? t("DashboardHistoryChipToday")
      : t("DashboardHistoryChipDays").replace("{}", String(days));
  }, [snapshot, t]);

  const sections: Record<string, ReactNode> = {
    limits: <CurrentLimits providers={currentProviders} settings={settings} models={models} />,
    attention: <AttentionQueue items={attention} onOpenProviders={onOpenProviders} isDemo={provenance === "demo"} />,
    overview: <><TrendIntelligence series={series} range={model.range} providers={liveProviders} settings={settings} preferences={preferences}/></>,
    resets: <ResetHorizon models={models} settings={settings} now={now} resets={model.resetHorizon} />,
    comparison: <><ProviderOperationsTable models={models} settings={settings} now={now}/><QuotaComparison series={series} providers={liveProviders} settings={settings} /></>,
    history: <><QuotaHistory series={series} snapshot={snapshot} settings={settings} preferences={preferences} />
      <details className="analytics-coverage"><summary>{t("V2LegacyHistory")}</summary><p>{t("V2LegacyHistoryHelp")}</p><UsageTrendSection snapshot={snapshot} /></details></>,
    quality: <AnalyticsSection title={t("V2DataQuality")} description={t(provenance === "demo" ? "V2DemoQuality" : "V2LiveQuality")}><QuotaCoverage series={series} snapshot={snapshot} settings={settings}/><CoverageHeatmap model={model} settings={settings} preferences={preferences} providers={liveProviders}/><DataStatusPanel snapshot={snapshot} /></AnalyticsSection>,
  };
  return (
    <div className="dashboard-analytics" style={structureThemeStyle} data-performance={settings.dashboardPerformancePreset ?? "balanced"} data-chart-style={preferences.chartStyle}>
      <div className="dashboard-command-bar">{provenance === "demo" && <div className="dashboard-analytics__demo-indicator"><DemoIndicator providerCount={liveProviders.length} onExit={() => onExitDemo?.()} /></div>}
      <DashboardHeader range={range} onRangeChange={setRange} providerOptions={providerOptions} providerFilter={providerFilter} onProviderFilterChange={setProviderFilter} historyChip={historyChip} /></div>
      <KpiRow kpis={kpis} settings={settings} resetTimeRelative={settings.resetTimeRelative}/>
      <div className="dashboard-command-status">
        {snapshot?.availability.firstSampleAt != null && <span>{t("V24AvailableSince")}: <bdi>{metadataDate.format(snapshot.availability.firstSampleAt*1000)}</bdi></span>}
        {["fresh","aging","stale"].map(state=><span key={state}>{t(state==="fresh"?"V24Fresh":state==="aging"?"V24Aging":"V24Stale")}: <bdi>{models.filter(model=>model.freshness.state===state).length}</bdi></span>)}
      </div>
      <p className="dashboard-analytics__scope">{t(preferences.providerFilterScope === "all" ? "V2LiveScope" : "V2HistoryScope")}</p>
      <div className="dashboard-workstation-grid">{preferences.sectionOrder.filter(id => !preferences.hiddenSections.includes(id)).map(id => <div key={id} data-analytics-section={id}>{sections[id]}</div>)}</div>
    </div>
  );
}
