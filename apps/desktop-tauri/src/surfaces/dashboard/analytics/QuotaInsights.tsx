import {physicalWindowLabel,observedAccountLabel} from "../../../lib/analytics/metricLabels";
import {defaultResetPresentationConfig, resolveResetTimeZone} from "../../../lib/resetPresentation";
import {summarizeCoverage} from "../../../lib/analytics/dashboardIntelligence";
import {useMemo, useState} from "react";
import {useLocale} from "../../../hooks/useLocale";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {AnalyticsSection, AnalyticsTable, CoveragePanel, MetricRibbon, ComparisonStat} from "../../../components/analytics/AnalyticsPrimitives";
import {Select} from "../../../components/FormControls";

import type {QuotaSeries} from "../../../lib/analytics/quotaAnalytics";
import type {MetricResult} from "../../../lib/analytics/metricRegistry";
import type {LocaleKey} from "../../../i18n/keys";
import type {AnalyticsPreferences, DashboardSnapshot, ProviderUsageSnapshot, SettingsSnapshot} from "../../../types/bridge";

const REASONS: Record<NonNullable<MetricResult["reason"]>, LocaleKey> = {
  identityUnknown: "V2IdentityUnknown", windowUnknown: "V2WindowUnknown", invalidSamples: "V2InvalidSamples",
  insufficientSamples: "V2InsufficientHistory", historyGap: "V2HistoryGap", resetBoundary: "V2ResetBoundary",
  counterDecrease: "V2CounterDecrease", missingData: "DashboardValueUnavailable",
};
export function QuotaCoverage({series, snapshot, settings}: {series: QuotaSeries[]; snapshot: DashboardSnapshot | null; settings: SettingsSnapshot}) {
  const {t} = useLocale();
  const options = useResetStageOptions(settings,"dashboard");
  const number = new Intl.NumberFormat(options.locale,{maximumFractionDigits:0,numberingSystem:"latn"});
  const date = new Intl.DateTimeFormat(options.locale,{dateStyle:"medium",timeZone:resolveResetTimeZone({...defaultResetPresentationConfig(),...options.config}),numberingSystem:"latn"});
  const {samples,first,last,missingBuckets}=summarizeCoverage(series);
  return <MetricRibbon>
    <ComparisonStat label={t("DashboardSelectedRangeEyebrow")} state={snapshot ? "available" : "unavailable"} value={snapshot ? <bdi>{date.format(snapshot.rangeSince*1000)} — {date.format(snapshot.rangeUntil*1000)}</bdi> : t("DashboardValueUnavailable")} detail={t("V2PhysicalWindow")}/>
    <ComparisonStat label={t("V2Samples")} state={samples ? "available" : "insufficientHistory"} value={samples ? number.format(samples) : t("V2InsufficientHistory")} detail={t("V2HistoryValues")}/>
    <ComparisonStat label={t("V2ObservedAt")} state={first !== null ? "partial" : "insufficientHistory"} value={first !== null && last !== null ? <bdi>{date.format(first*1000)} — {date.format(last*1000)}</bdi> : t("V2InsufficientHistory")} detail={t("V2HistoryHelp")}/>
    <ComparisonStat label={t("V24MissingBuckets")} state={samples ? "partial" : "insufficientHistory"} value={samples ? number.format(missingBuckets) : t("V2InsufficientHistory")} detail={t("V24CoverageHelp")}/>
  </MetricRibbon>;
}
export function QuotaComparison({series, providers, settings}: {series: QuotaSeries[]; providers: ProviderUsageSnapshot[]; settings: SettingsSnapshot}) {
  const {t} = useLocale();
  const {locale} = useResetStageOptions(settings, "dashboard");
  const number = new Intl.NumberFormat(locale, {maximumFractionDigits: 1, numberingSystem:"latn"});
  const signed = new Intl.NumberFormat(locale, {maximumFractionDigits: 1, numberingSystem:"latn", signDisplay: "exceptZero"});
  const names = new Map(providers.map(p => [p.providerId, p.displayName]));
  const metric = (result: MetricResult, unit: string, sign = false) => result.value === null
    ? <span className="analytics-unavailable" data-state={result.state}>{t(result.reason ? REASONS[result.reason] : "DashboardValueUnavailable")}</span>
    : <bdi>{(sign ? signed : number).format(result.value)} {unit}</bdi>;
  return <AnalyticsSection title={t("V2ProviderComparison")} description={t("V2ComparisonHelp")}>
    <AnalyticsTable copy={{columns:t("V45TableColumns"),previousPage:t("V45TablePreviousPage"),nextPage:t("V45TableNextPage"),page:t("V45TablePage")}} rows={series} rowKey={row => row.key} caption={t("V2ComparisonCaveat")} emptyLabel={t("V2NoPhysicalHistory")} columns={[
      {id:"provider",title:t("TabProviders"),cell:row=><bdi>{names.get(row.provider) ?? row.provider}</bdi>,sortValue:row=>names.get(row.provider) ?? row.provider},
      {id:"window",title:t("V2LimitWindow"),cell:row=><><bdi>{physicalWindowLabel(row.windowLabel,t)}</bdi><small className="analytics-account-scope">{observedAccountLabel(row,series,t)}</small></>},
      {id:"mean",title:t("V2QuotaMean"),cell:row=>metric(row.mean,"%"),sortValue:row=>row.mean.value},
      {id:"comparison",title:t("V2PeriodDifference"),cell:row=>metric(row.comparison,t("V2Points"),true),sortValue:row=>row.comparison.value},
      {id:"velocity",title:t("V2Velocity"),cell:row=>metric(row.velocity,t("V2PointsHour")),sortValue:row=>row.velocity.value},
      {id:"samples",title:t("V2Samples"),cell:row=>row.invalid?t("V2InvalidSamples"):number.format(row.sampleCount),sortValue:row=>row.invalid?null:row.sampleCount},
    ]}/>
  </AnalyticsSection>;
}

export function QuotaHistory({series, snapshot, settings, preferences}: {series: QuotaSeries[]; snapshot: DashboardSnapshot | null; settings: SettingsSnapshot; preferences: AnalyticsPreferences}) {
  const {t} = useLocale();
  const options = useResetStageOptions(settings,"dashboard");
  const [selected, setSelected] = useState("");
  const candidates = series.filter(row => row.current.length && !row.invalid);
  const active = candidates.find(row => row.key === selected) ?? candidates[0];
  const time = new Intl.DateTimeFormat(options.locale, {numberingSystem:"latn",month:"short",day:"numeric",hour:"numeric",minute:"2-digit", timeZone: resolveResetTimeZone({...defaultResetPresentationConfig(), ...options.config})});
  const number = new Intl.NumberFormat(options.locale,{maximumFractionDigits:1,numberingSystem:"latn"});
  const points = useMemo(() => active?.current.map(p => ({time:p.observedAt,value:p.usedPercent,cycle:p.resetsAt})) ?? [],[active]);
  return <AnalyticsSection title={t("V2DetailedHistory")} description={t("V2HistoryHelp")} action={candidates.length > 0 && <Select ariaLabel={t("V2HistorySeries")} value={active?.key ?? ""} onChange={setSelected} options={candidates.map(row=>({value:row.key, label:`${row.provider} · ${physicalWindowLabel(row.windowLabel,t)} · ${observedAccountLabel(row,series,t)}`}))}/>}>
    {active && snapshot ? <>
      <CoveragePanel title={t("V2HistoryValues")}><AnalyticsTable copy={{columns:t("V45TableColumns"),previousPage:t("V45TablePreviousPage"),nextPage:t("V45TableNextPage"),page:t("V45TablePage")}} rows={active.current} rowKey={row=>String(row.observedAt)} caption={t("V2HistoryValues")} emptyLabel={t("V2InsufficientHistory")} columns={[
        {id:"time",title:t("V2ObservedAt"),cell:row=><bdi>{time.format(row.observedAt*1000)}</bdi>,sortValue:row=>row.observedAt},
        {id:"quota",title:t("V2UsedQuota"),cell:row=><bdi>{number.format(row.usedPercent)}%</bdi>,sortValue:row=>row.usedPercent},
        {id:"samples",title:t("V2Samples"),cell:row=>number.format(row.sampleCount),sortValue:row=>row.sampleCount},
      ]}/></CoveragePanel>
    </> : <p className="analytics-empty">{t("V2NoPhysicalHistory")}</p>}
  </AnalyticsSection>;
}
