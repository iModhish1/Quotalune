import {physicalWindowLabel,observedAccountLabel} from "../../../lib/analytics/metricLabels";
import {useState,useMemo,type ReactNode} from "react";
import {useLocale} from "../../../hooks/useLocale";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {defaultResetPresentationConfig, resolveResetTimeZone} from "../../../lib/resetPresentation";
import {METRIC_REGISTRY, formatMetric, type MetricResult} from "../../../lib/analytics/metricRegistry";
import type {QuotaSeries,AnalyticsRange} from "../../../lib/analytics/quotaAnalytics";
import type {AnalyticsPreferences, ProviderUsageSnapshot, SettingsSnapshot} from "../../../types/bridge";
import {AnalyticsSection, ComparisonStat, MetricRibbon} from "../../../components/analytics/AnalyticsPrimitives";
import {ProfessionalChart} from "../../../components/analytics/charts/ProfessionalChart";
import {createTrendChartSpec} from "../../../components/analytics/charts/chartSpec";
import {useChartContext} from "../../../components/analytics/charts/useChartContext";
function ChartDisclosure({title,children}:{title:string;children:ReactNode}) {
 const [open,setOpen]=useState(false);
 return <details className="analytics-coverage" onToggle={event=>setOpen(event.currentTarget.open)}><summary>{title}</summary>{open && <div>{children}</div>}</details>;
}

export default function TrendIntelligence({series,range,providers,settings,preferences}: {
  series:QuotaSeries[]; range:AnalyticsRange; providers:ProviderUsageSnapshot[];
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
  const context=useChartContext(settings,range,preferences);
  const trend=useMemo(()=>createTrendChartSpec(active?[active]:[],title,context),[active,context]);
  const comparison=useMemo(()=>createTrendChartSpec(active?.comparison.value!=null?[active]:[],title,context,true),[active,context]);
  const small=series.filter(row=>!row.invalid && row.current.length).filter((row,i,all)=>all.findIndex(other=>other.provider===row.provider)===i).slice(0,8);
  return <AnalyticsSection title={t("V24Trends")} description={t("V24TrendsHelp")} className="trend-intelligence"
    action={series.length>0 && <select aria-label={t("V2HistorySeries")} value={active?.key ?? ""} onChange={event=>setSelected(event.target.value)}>{series.map(row=><option key={row.key} value={row.key}>{title(row)}</option>)}</select>}>
    {active ? <>
      <MetricRibbon>
        <ComparisonStat label={t("V24RangeStart")} value={percent(active.start)} state={active.start.state} detail={active.firstObservedAt===null ? "" : date.format(active.firstObservedAt*1000)}/>
        <ComparisonStat label={t("V24RangeEnd")} value={percent(active.end)} state={active.end.state} detail={active.lastObservedAt===null ? "" : date.format(active.lastObservedAt*1000)}/>
        <ComparisonStat label={t(METRIC_REGISTRY.quotaMean.labelKey)} value={percent(active.mean)} state={active.mean.state} detail={`${t("V24Minimum")}: ${percent(active.minimum)} · ${t("V24Peak")}: ${percent(active.maximum)}`}/>
        <ComparisonStat label={t("V24RangeChange")} value={active.change.value===null?t("V2InsufficientHistory"):`${formatMetric("quotaComparison",active.change.value,locale)} ${t("V2Points")}`} state={active.change.state} detail={t("V2ComparisonCaveat")}/>
      </MetricRibbon>
      <ProfessionalChart spec={trend} unavailable={t("V2InsufficientHistory")}/>
      {range.until-range.since>7*86400 && <small className="chart-zoom-note">{t("V45VisualZoom")}</small>}
      <ChartDisclosure title={t("V45PeriodComparison")}><ProfessionalChart spec={comparison} unavailable={t("V2ComparisonCaveat")+" · "+t("V2InsufficientHistory")}/></ChartDisclosure>
      {small.length>=4 && <ChartDisclosure title={t("V45SmallMultiples")}><div className="analytics-small-multiples">{small.map(row=><figure key={row.key}><figcaption><bdi>{title(row)}</bdi></figcaption><ProfessionalChart spec={createTrendChartSpec([row],title,context,false,true)} unavailable={t("V2InsufficientHistory")}/></figure>)}</div></ChartDisclosure>}
      <div className="trend-intelligence__rates">
        <span>{t(METRIC_REGISTRY.quotaVelocity.labelKey)} <strong>{active.velocity.value===null?t("V2InsufficientHistory"):`${formatMetric("quotaVelocity",active.velocity.value,locale)} ${t("V2PointsHour")}`}</strong></span>
        <span>{t(METRIC_REGISTRY.quotaComparison.labelKey)} <strong>{active.comparison.value===null?t("V2InsufficientHistory"):`${formatMetric("quotaComparison",active.comparison.value,locale)} ${t("V2Points")}`}</strong></span>
      </div>
      <small className="analytics-projection-policy">{t("V24Projection")}</small>
    </> : <p className="analytics-empty">{t("V2NoPhysicalHistory")}</p>}
  </AnalyticsSection>;
}
