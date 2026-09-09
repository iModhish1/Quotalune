import {physicalWindowLabel} from "../../../lib/analytics/metricLabels";
import {resetMarkerLanes} from "../../../lib/analytics/dashboardIntelligence";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";
import {useMemo, useState} from "react";
import {useLocale} from "../../../hooks/useLocale";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {formatResetPresentation} from "../../../lib/resetPresentation";
import type {CurrentProviderModel} from "../../../lib/analytics/currentProviders";
import type {SettingsSnapshot} from "../../../types/bridge";
import {AnalyticsSection, AnalyticsTable, CoveragePanel} from "../../../components/analytics/AnalyticsPrimitives";

export default function ResetHorizon({models, settings, now, resets:providedResets}: {models: CurrentProviderModel[]; settings: SettingsSnapshot; now: number; resets?:CurrentProviderModel["resets"]}) {
  const {t, language} = useLocale();
  const options = useResetStageOptions(settings, "dashboard");
  const [days, setDays] = useState(1);
  const [selected,setSelected] = useState("");
  const resets = useMemo(() => providedResets ?? models.flatMap(model => model.resets).sort((a,b) => a.time - b.time), [models,providedResets]);
  const span = days * 86400_000;
  const number = new Intl.NumberFormat(options.locale, {numberingSystem: "latn", maximumFractionDigits: 1});
  const label = (time: number) => formatResetPresentation({...options, resetAt: time, now, locale: options.locale ?? language}).fullAriaLabel;
  const visible = resets.filter(reset => reset.time <= now + span);
  const lanes = resetMarkerLanes(visible.map(reset=>reset.time),now,span);
  const selectedReset = resets.find(reset=>`${reset.provider.providerId}:${reset.key}` === selected);
  const columns = [
    {id:"provider",title:t("TabProviders"),cell:(row:typeof resets[number])=><bdi>{row.provider.displayName}</bdi>,sortValue:(row:typeof resets[number])=>row.provider.displayName},
    {id:"window",title:t("V2LimitWindow"),cell:(row:typeof resets[number])=><bdi>{physicalWindowLabel(row.label,t)}</bdi>},
    {id:"reset",title:t("V2NextReset"),cell:(row:typeof resets[number])=><bdi>{label(row.time)}</bdi>,sortValue:(row:typeof resets[number])=>row.time},
  ];
  return <AnalyticsSection title={t("V2ResetHorizon")} description={t("V2ResetHorizonHelp")} className="reset-horizon"
    action={<select aria-label={t("V2ResetHorizon")} value={days} onChange={event => setDays(Number(event.target.value))}><option value="1">{t("V2Next24Hours")}</option><option value="7">{t("V2Next7Days")}</option></select>}>
    {resets.length ? <>
      <p className="chart-zoom-note">{t("V45ResetCalibration")}</p><div className="reset-horizon__timeline" dir="ltr" role="group" aria-label={t("V2ResetHorizon")}>
        <div className="reset-horizon__ticks">{(days===1?[0,0.5/24,2/24,6/24,12/24,1]:[0,.25,.5,1]).map((fraction,index) => <span key={fraction} style={{left:`${fraction*100}%`,top:index%2?"14px":"0px"}}>{fraction === 0 ? t("V2Now") : `${number.format(fraction * days * 24)} ${t("V2HoursShort")}`}</span>)}</div>
        <div className="reset-horizon__lanes" style={{height:`${Math.max(2,...lanes.map(item=>item.lane+1))*28+18}px`}}>{visible.map((reset, index) => <button type="button" className="reset-horizon__marker" key={`${reset.provider.providerId}:${reset.key}`} onClick={()=>setSelected(`${reset.provider.providerId}:${reset.key}`)} onFocus={()=>setSelected(`${reset.provider.providerId}:${reset.key}`)} aria-pressed={selected===`${reset.provider.providerId}:${reset.key}`}
          aria-label={`${reset.provider.displayName} · ${physicalWindowLabel(reset.label,t)} · ${label(reset.time)}`}
          title={`${reset.provider.displayName} · ${physicalWindowLabel(reset.label,t)} · ${label(reset.time)}`}
          style={{left:`${(reset.time-now)/span*100}%`,top:`${10 + lanes[index].lane*28}px`}}><ProviderIcon providerId={reset.provider.providerId} size={14}/></button>)}</div>
      </div>
      <div className="reset-horizon__agenda">{resets.slice(0,5).map(reset=><div key={`${reset.provider.providerId}:${reset.key}`}><ProviderIcon providerId={reset.provider.providerId} size={16}/><bdi>{reset.provider.displayName}</bdi><small>{physicalWindowLabel(reset.label,t)}</small><bdi>{label(reset.time)}</bdi></div>)}</div>
      {selectedReset && <p className="reset-horizon__selection" role="status">{t("V24ResetSelection")}: <bdi>{selectedReset.provider.displayName} · {physicalWindowLabel(selectedReset.label,t)} · {label(selectedReset.time)}</bdi></p>}
      <CoveragePanel title={t("V2ResetObservedCaption")}><AnalyticsTable copy={{columns:t("V45TableColumns"),previousPage:t("V45TablePreviousPage"),nextPage:t("V45TableNextPage"),page:t("V45TablePage")}} rows={resets} columns={columns} rowKey={row => `${row.provider.providerId}:${row.key}`} caption={t("V2ResetObservedCaption")} emptyLabel={t("DashboardValueUnavailable")}/></CoveragePanel>
    </> : <p className="analytics-empty">{t("DashboardResetScheduleEmpty")}</p>}
  </AnalyticsSection>;
}
