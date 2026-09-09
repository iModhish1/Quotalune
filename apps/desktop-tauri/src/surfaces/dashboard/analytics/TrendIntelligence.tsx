import {physicalWindowLabel,observedAccountLabel} from "../../../lib/analytics/metricLabels";
import {useState} from "react";
import {useLocale} from "../../../hooks/useLocale";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {defaultResetPresentationConfig, resolveResetTimeZone} from "../../../lib/resetPresentation";
import {METRIC_REGISTRY, formatMetric, type MetricResult} from "../../../lib/analytics/metricRegistry";
import type {QuotaSeries} from "../../../lib/analytics/quotaAnalytics";
import type {AnalyticsPreferences, DashboardSnapshot, ProviderUsageSnapshot, SettingsSnapshot} from "../../../types/bridge";
import {AnalyticsSection, ComparisonStat, MetricRibbon} from "../../../components/analytics/AnalyticsPrimitives";
import {TimeSeriesChart} from "../../../components/charts/TimeSeriesChart";

export default function TrendIntelligence({series,snapshot,providers,settings,preferences}: {
  series:QuotaSeries[]; snapshot:DashboardSnapshot|null; providers:ProviderUsageSnapshot[];
  settings:SettingsSnapshot; preferences:AnalyticsPreferences;
}) {
  const {t}=useLocale();
  const options=useResetStageOptions(settings,"dashboard");
  const locale=options.locale ?? "en-US";
  const [selected,setSelected]=useState("");
  const active=series.find(row=>row.key===selected) ?? series.find(row=>row.current.length);
  const names=new Map(providers.map(provider=>[provider.providerId,provider.displayName]));
  const date=new Intl.DateTimeFormat(locale,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",numberingSystem:"latn",timeZone:resolveResetTimeZone({...defaultResetPresentationConfig(),...options.config})});
  const percent=(result:MetricResult)=>formatMetric("quotaUsed",result.value,locale) ?? t("V2InsufficientHistory");
  const title=(row:QuotaSeries)=>`${names.get(row.provider) ?? row.provider} · ${physicalWindowLabel(row.windowLabel,t)} · ${observedAccountLabel(row,series,t)}`;
  return <AnalyticsSection title={t("V24Trends")} description={t("V24TrendsHelp")} className="trend-intelligence"
    action={series.length>0 && <select aria-label={t("V2HistorySeries")} value={active?.key ?? ""} onChange={event=>setSelected(event.target.value)}>{series.map(row=><option key={row.key} value={row.key}>{title(row)}</option>)}</select>}>
    {active && snapshot ? <>
      <MetricRibbon>
        <ComparisonStat label={t("V24RangeStart")} value={percent(active.start)} state={active.start.state} detail={active.firstObservedAt===null ? "" : date.format(active.firstObservedAt*1000)}/>
        <ComparisonStat label={t("V24RangeEnd")} value={percent(active.end)} state={active.end.state} detail={active.lastObservedAt===null ? "" : date.format(active.lastObservedAt*1000)}/>
        <ComparisonStat label={t(METRIC_REGISTRY.quotaMean.labelKey)} value={percent(active.mean)} state={active.mean.state} detail={`${t("V24Minimum")}: ${percent(active.minimum)} · ${t("V24Peak")}: ${percent(active.maximum)}`}/>
        <ComparisonStat label={t("V24RangeChange")} value={active.change.value===null?t("V2InsufficientHistory"):`${formatMetric("quotaComparison",active.change.value,locale)} ${t("V2Points")}`} state={active.change.state} detail={t("V2ComparisonCaveat")}/>
      </MetricRibbon>
      {!active.invalid && <TimeSeriesChart points={active.current.map(point=>({time:point.observedAt,value:point.usedPercent,cycle:point.resetsAt}))}
        since={snapshot.rangeSince} until={snapshot.rangeUntil} step={snapshot.grain==="hourly"?3600:86400}
        label={`${title(active)} · ${t(METRIC_REGISTRY.quotaUsed.labelKey)}`} unit="%"
        formatTime={time=>date.format(time*1000)} formatValue={value=>new Intl.NumberFormat(locale,{numberingSystem:"latn",maximumFractionDigits:1}).format(value)} style={preferences.chartStyle}/>}
      <div className="trend-intelligence__rates">
        <span>{t(METRIC_REGISTRY.quotaVelocity.labelKey)} <strong>{active.velocity.value===null?t("V2InsufficientHistory"):`${formatMetric("quotaVelocity",active.velocity.value,locale)} ${t("V2PointsHour")}`}</strong></span>
        <span>{t(METRIC_REGISTRY.quotaComparison.labelKey)} <strong>{active.comparison.value===null?t("V2InsufficientHistory"):`${formatMetric("quotaComparison",active.comparison.value,locale)} ${t("V2Points")}`}</strong></span>
      </div>
      <small className="analytics-projection-policy">{t("V24Projection")}</small>
    </> : <p className="analytics-empty">{t("V2NoPhysicalHistory")}</p>}
  </AnalyticsSection>;
}
