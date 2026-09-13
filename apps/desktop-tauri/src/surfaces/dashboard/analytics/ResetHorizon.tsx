import {ProviderResetBadge,ProviderResetDetails} from '../../../components/providers/ProviderResets';
import {useMemo} from "react";
import {physicalWindowLabel} from "../../../lib/analytics/metricLabels";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";
import {useLocale} from "../../../hooks/useLocale";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {formatResetPresentation} from "../../../lib/resetPresentation";
import type {CurrentProviderModel} from "../../../lib/analytics/currentProviders";
import type {SettingsSnapshot} from "../../../types/bridge";
import {AnalyticsSection, AnalyticsTable, CoveragePanel} from "../../../components/analytics/AnalyticsPrimitives";

/** Ordered time bands are categorical, never drawn as a linear time axis. */
export function resetBand(time:number, now:number):number {
  const hours=(time-now)/3600000;
  return hours<1?0:hours<6?1:hours<12?2:hours<24?3:4;
}
export default function ResetHorizon({models,settings,now,resets:provided}: {
  models:CurrentProviderModel[];settings:SettingsSnapshot;now:number;resets?:CurrentProviderModel["resets"];
}) {
  const {t,language}=useLocale();
  const options=useResetStageOptions(settings,"dashboard");
  const resets=useMemo(()=>[...(provided??models.flatMap(model=>model.resets))].sort((a,b)=>a.time-b.time),[models,provided]);
  const labels=[`<1 ${t("V2HoursShort")}`,`1–6 ${t("V2HoursShort")}`,`6–12 ${t("V2HoursShort")}`,`12–24 ${t("V2HoursShort")}`,`≥24 ${t("V2HoursShort")}`];
  const formatted=(time:number)=>formatResetPresentation({...options,resetAt:time,now,locale:options.locale??language});
  const label=(time:number)=>formatted(time).fullAriaLabel;
  // One next reset per provider in the overview; every physical window remains
  // available in the details table and keeps its original absolute timestamp.
  const next=resets.filter((reset,i,all)=>all.findIndex(other=>other.provider.providerId===reset.provider.providerId)===i);
  return <AnalyticsSection title={t("V2ResetHorizon")} className="reset-horizon">
    {resets.length ? <>
      <div className="cosmic-reset-bands" style={{gridTemplateColumns:labels.map((_,index)=>`${Math.max(1,next.filter(reset=>resetBand(reset.time,now)===index).length)}fr`).join(" ")}}>{labels.map((text,index)=><div key={text}>
        <span className="cosmic-reset-bands__label"><bdi dir="ltr">{text}</bdi></span>
        {next.filter(reset=>resetBand(reset.time,now)===index).map(reset=><div className="cosmic-reset-provider" key={reset.provider.providerId} title={`${physicalWindowLabel(reset.label,t)} · ${label(reset.time)}`}>
          <ProviderIcon providerId={reset.provider.providerId} size={29}/><ProviderResetBadge facts={reset.provider.resetFacts}/><strong><bdi>{reset.provider.displayName}</bdi></strong>
          <time dateTime={new Date(reset.time).toISOString()} aria-label={label(reset.time)}><bdi>{formatted(reset.time).countdown?.short || formatted(reset.time).time?.short || label(reset.time)}</bdi></time>
        </div>)}
      </div>)}</div>
      <CoveragePanel title={t("V2ResetObservedCaption")}><p>{t("V2ResetHorizonHelp")}</p><AnalyticsTable rows={resets} rowKey={row=>`${row.provider.providerId}:${row.key}`} caption={t("V2ResetObservedCaption")} emptyLabel={t("DashboardValueUnavailable")}
        copy={{columns:t("V45TableColumns"),previousPage:t("V45TablePreviousPage"),nextPage:t("V45TableNextPage"),page:t("V45TablePage")}}
        columns={[
          {id:"provider",title:t("TabProviders"),cell:row=><bdi>{row.provider.displayName}</bdi>,sortValue:row=>row.provider.displayName},
          {id:"window",title:t("V2LimitWindow"),cell:row=><bdi>{physicalWindowLabel(row.label,t)}</bdi>},
          {id:"reset",title:t("V2NextReset"),cell:row=><bdi>{label(row.time)}</bdi>,sortValue:row=>row.time},
        ]}/></CoveragePanel>
    </> : <p className="analytics-empty">{t("DashboardResetScheduleEmpty")}</p>}
    <details className="reset-horizon__inventories"><summary>{t("ResetBanked")}</summary>{models.map(model=><div key={model.provider.providerId}><strong>{model.provider.displayName}</strong><ProviderResetDetails facts={model.provider.resetFacts} provider={model.provider}/></div>)}</details>
  </AnalyticsSection>;
}
