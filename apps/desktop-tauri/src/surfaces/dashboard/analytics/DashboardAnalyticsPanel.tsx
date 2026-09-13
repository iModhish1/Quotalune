import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { useEffectiveDashboardSnapshot } from "../../../hooks/useEffectiveDashboardSnapshot";
import type { DataProvenance } from "../../../hooks/useEffectiveProviders";
import { useDashboardStructureTheme } from "./useDashboardStructureTheme";
import { availableHistoryDays } from "./dashboardSelectors";
import DashboardHeader from "./DashboardHeader";
import ProviderRail from "./ProviderInstancesRail";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";
import {ProviderPlanBadge} from "../../../components/providers/ProviderPlanBadge";
import LocalActivity from "./LocalActivity";
import TokenAnalytics from "./TokenAnalytics";
import ModelAnalytics from "./ModelAnalytics";
import AnalyticsOverview from "./AnalyticsOverview";
import MonetaryAnalytics from "./MonetaryAnalytics";
import CoverageHeatmap from "./CoverageHeatmap";
import ProviderUsageMatrix from "./ProviderUsageMatrix";
import KpiRow from "./KpiRow";
import UsageTrendSection from "./UsageTrendSection";
import ResetHorizon from "./ResetHorizon";
import {QuotaComparison, QuotaHistory, QuotaCoverage} from "./QuotaInsights";
import ProviderOperationsTable from "./ProviderOperationsTable";
import {analyticsPreferences} from "../../../lib/analytics/preferences";
import {useDashboardAnalyticsModel} from "../../../hooks/useDashboardAnalyticsModel";
import {useAnalyticsSources} from "../../../hooks/useAnalyticsSources";

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
import "./CosmicDashboard.css";
import "./ProductV3.css";

/** One shared snapshot and truth model. Operational Overview is global;
 * Analytics scopes both live state and history to its selected provider.
 * Saved section order/visibility applies within each destination, never across
 * the boundary between operational monitoring and deep analysis. */
export default function DashboardAnalyticsPanel({
  liveProviders, view="analytics", initialProvider=null, onAnalytics,
  settings,
  catalog = [],
  provenance = "live",
  onOpenProviders,
  onExitDemo,
}: {
  liveProviders: ProviderUsageSnapshot[];
  view?:"overview"|"analytics";initialProvider?:string|null;onAnalytics?:(id?:string)=>void;
  settings: SettingsSnapshot;
  /** Real provider registry catalog (`state.providers`) -- only needed
   *  when Demo Mode is on, to build the synthetic `DashboardSnapshot`.
   *  Optional so existing callers/tests that never exercise Demo Mode
   *  don't need updating. */
  catalog?: ProviderCatalogEntry[];
  /** Phase 5.2: whether `liveProviders` is real or Demo Mode's synthetic
   *  dataset -- drives the persistent DEMO indicator. */
  provenance?: DataProvenance;
  onOpenProviders: (id?:string) => void;
  /** Turns Demo Mode off -- only ever called from the indicator, so a
   *  no-op default is safe for callers that never render it (provenance
   *  stays "live"). */
  onExitDemo?: () => void;
}) {
  const { t } = useLocale();
  const preferences = useMemo(() => analyticsPreferences(settings.analyticsPreferences), [settings.analyticsPreferences]);
  const [range, setRange] = useState<DashboardRangeKind>(preferences.defaultRange);
  useEffect(() => setRange(preferences.defaultRange), [preferences.defaultRange]);
  const [providerFilter, setProviderFilter] = useState<string | null>(view === "analytics" ? initialProvider : null);
  const [section,setSection]=useState("overview");
  // Capability-driven navigation (owner: "Analytics UI must NEVER show a
  // tab/filter simply because the design supports it"). The Local
  // activity tab requires a real available token/daily-activity source --
  // today that's Codex and/or Claude local scanning -- rather than
  // always being shown regardless of whether either has ever run on this
  // machine.
  const { hasCapability } = useAnalyticsSources();
  // Phase 3.6: the Dashboard's structural surfaces now follow the same
  // resolved Structure Theme every other themed surface uses -- see
  // docs/validation/DASHBOARD_STRUCTURE_THEME_INTEGRATION.md.
  const { style: structureThemeStyle, theme } = useDashboardStructureTheme(settings);

  const providerOptions = useMemo(
    () => liveProviders.map((p) => ({ id: p.providerId, name: p.displayName })),
    [liveProviders],
  );
  const providersArg = useMemo(
    () => (providerFilter ? [providerFilter] : undefined),
    [providerFilter],
  );

  const { snapshot } = useEffectiveDashboardSnapshot(range, undefined, providersArg, settings, catalog);

  const currentProviders = useMemo(() => (view === "analytics" || preferences.providerFilterScope === "all") && providerFilter
    ? liveProviders.filter(provider => provider.providerId === providerFilter) : liveProviders,
    [liveProviders, preferences.providerFilterScope, providerFilter,view]);
  const now = useMemo(() => Date.now(), [liveProviders, snapshot]);
  const {model,processing:historyProcessing,error:historyError}=useDashboardAnalyticsModel(currentProviders,snapshot,settings,providerFilter,now);
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

  const allTabs=[['overview','V3Overview'],['usage','V3Usage'],['tokens','V3Tokens'],['models','V3Models'],['activity','V3Activity'],['resets','V3Resets'],['providers','TabProviders'],['monetary','V3Monetary'],['history','V3History'],['quality','V2DataQuality']] as const;
  const tabs=allTabs.filter(([id])=>{
    if(id==='models')return hasCapability('models');
    if(id==='tokens')return hasCapability('tokens');
    if(id==='activity')return hasCapability('tokens')||hasCapability('dailyActivity');
    if(id==='monetary')return hasCapability('monetary');
    return true;
  });
  // If the selected section's capability disappears out from under it
  // (a source stops reporting, or Demo Mode is exited) the nav button for
  // that section vanishes, but without this the content pane would just
  // go blank with no tab marked current -- a dead-looking screen rather
  // than a real destination. Route back to the one section that always
  // exists instead.
  useEffect(() => {
    if (!tabs.some(([id]) => id === section)) setSection('overview');
  }, [tabs, section]);
  const selectedProvider=liveProviders.find(p=>p.providerId===providerFilter);
  return <div className={`dashboard-analytics dashboard-cosmic product-v3 ${view==='analytics'?'analytics-center':'operational-overview'}`} style={structureThemeStyle} data-light={Boolean(theme.material?.light)} data-density={settings.workspacePreferences?.density??'comfortable'} data-chart-style={preferences.chartStyle}>
    <header className="v3-page-header"><div><h2>{t(view==='analytics'?'V3Analytics':'V3Overview')}</h2><p>{t(view==='analytics'?'V3AnalyticsHelp':'V3OperationalHelp')}</p></div>{view==='overview'&&<button type="button" onClick={()=>onAnalytics?.()}>{t('V3ViewAnalytics')} ↗</button>}{provenance==='demo'&&<DemoIndicator providerCount={liveProviders.length} onExit={()=>onExitDemo?.()}/>}</header>
    {view==='overview'?<>
      <div className="v3-overview-modules">{preferences.sectionOrder.filter(id=>!preferences.hiddenSections.includes(id)).map(id=>{
        const content=id==='limits'?<ProviderRail providers={liveProviders} settings={settings} isDemo={provenance==='demo'} onOpenProviders={onOpenProviders} onAnalytics={id=>onAnalytics?.(id)}/>:id==='overview'?<KpiRow kpis={kpis} settings={settings} resetTimeRelative={settings.resetTimeRelative}/>:id==='attention'?<AttentionQueue items={attention} models={models} onOpenProviders={onOpenProviders} isDemo={provenance==='demo'}/>:id==='resets'?<ResetHorizon models={models} settings={settings} now={now} resets={model.resetHorizon}/>:null;
        return content?<div key={id} data-analytics-section={id}>{content}</div>:null;
      })}</div>
    </>:<>
      <DashboardHeader range={range} onRangeChange={setRange} providerOptions={providerOptions} providerFilter={providerFilter} onProviderFilterChange={setProviderFilter} historyChip={historyChip}/>
      {(historyProcessing||historyError)&&<p role="status" aria-live="polite">{t(historyProcessing?'UsageSpendLoading':'DashboardValueUnavailable')}</p>}
      {selectedProvider&&<div className="v3-provider-heading"><ProviderIcon providerId={selectedProvider.providerId} size={32}/><strong><bdi>{selectedProvider.displayName}</bdi></strong><ProviderPlanBadge plan={selectedProvider.planName}/><button type="button" onClick={()=>onOpenProviders(selectedProvider.providerId)}>{t('V3Details')}</button></div>}
      <nav className="v3-section-nav" aria-label={t('V3Analytics')}>{tabs.map(([id,key])=><button type="button" key={id} aria-current={section===id?'page':undefined} onClick={()=>setSection(id)}>{t(key)}</button>)}</nav>
      {section==='overview'&&<AnalyticsOverview settings={settings} snapshot={snapshot} resetCount={model.resetHorizon.length} isDemo={provenance==='demo'}/>}
      {section==='usage'&&<><TrendIntelligence series={series} range={model.range} providers={liveProviders} settings={settings} preferences={preferences}/><QuotaComparison series={series} providers={liveProviders} settings={settings}/></>}
      {section==='tokens'&&(provenance==='demo'||hasCapability('tokens'))&&<TokenAnalytics settings={settings} providerId={providerFilter} isDemo={provenance==='demo'}/>}
      {section==='models'&&(provenance==='demo'||hasCapability('models'))&&<ModelAnalytics settings={settings} providerId={providerFilter} isDemo={provenance==='demo'}/>}
      {section==='activity'&&(provenance==='demo'||hasCapability('tokens')||hasCapability('dailyActivity'))&&<LocalActivity settings={settings} isDemo={provenance==='demo'} providerId={providerFilter}/>}
      {section==='resets'&&<ResetHorizon models={models} settings={settings} now={now} resets={model.resetHorizon}/>}
      {section==='providers'&&<><div className="v3-provider-links">{liveProviders.map(p=><button type="button" key={p.providerId} onClick={()=>setProviderFilter(p.providerId)}><ProviderIcon providerId={p.providerId} size={18}/><bdi>{p.displayName}</bdi><ProviderPlanBadge plan={p.planName}/></button>)}</div><ProviderOperationsTable models={models} settings={settings} now={now}/><QuotaComparison series={series} providers={liveProviders} settings={settings}/></>}
      {section==='monetary'&&(provenance==='demo'||hasCapability('monetary'))&&<MonetaryAnalytics snapshot={snapshot} providerId={providerFilter} isDemo={provenance==='demo'}/>}
      {section==='history'&&<><QuotaHistory series={series} snapshot={snapshot} settings={settings} preferences={preferences}/><details className="cosmic-disclosure"><summary>{t('V2LegacyHistory')}</summary><p>{t('V2LegacyHistoryHelp')}</p><UsageTrendSection snapshot={snapshot}/></details></>}
      {section==='quality'&&<><ProviderUsageMatrix model={model} providers={liveProviders} settings={settings} onProvider={setProviderFilter}/><QuotaCoverage series={series} snapshot={snapshot} settings={settings}/><CoverageHeatmap model={model} settings={settings} preferences={preferences} providers={liveProviders}/><details className="cosmic-disclosure"><summary>{t('V2DataQuality')}</summary><DataStatusPanel snapshot={snapshot}/></details></>}
    </>}
  </div>;
}
