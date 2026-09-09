import {physicalWindowLabel} from "../../../lib/analytics/metricLabels";
import {resetMarkerLanes} from "../../../lib/analytics/dashboardIntelligence";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";
import {useMemo, useState} from "react";
import {useLocale} from "../../../hooks/useLocale";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {formatResetPresentation} from "../../../lib/resetPresentation";
import type {CurrentProviderModel} from "../../../lib/analytics/currentProviders";
import type {SettingsSnapshot} from "../../../types/bridge";
import {AnalyticsSection, AnalyticsTable} from "../../../components/analytics/AnalyticsPrimitives";

export default function ResetHorizon({models, settings, now}: {models: CurrentProviderModel[]; settings: SettingsSnapshot; now: number}) {
  const {t, language} = useLocale();
  const options = useResetStageOptions(settings, "dashboard");
  const [days, setDays] = useState(1);
  const [selected,setSelected] = useState("");
  const resets = useMemo(() => models.flatMap(model => model.resets).sort((a,b) => a.time - b.time), [models]);
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
      <div className="reset-horizon__timeline" role="group" aria-label={t("V2ResetHorizon")}>
        <div className="reset-horizon__ticks">{[0,.25,.5,.75,1].map(fraction => <span key={fraction} style={{insetInlineStart:`${fraction*100}%`}}>{fraction === 0 ? t("V2Now") : `${number.format(fraction * days * 24)} ${t("V2HoursShort")}`}</span>)}</div>
        <div className="reset-horizon__lanes" style={{height:`${Math.max(2,...lanes.map(item=>item.lane+1))*28+18}px`}}>{visible.map((reset, index) => <button type="button" className="reset-horizon__marker" key={`${reset.provider.providerId}:${reset.key}`} onClick={()=>setSelected(`${reset.provider.providerId}:${reset.key}`)} onFocus={()=>setSelected(`${reset.provider.providerId}:${reset.key}`)} aria-pressed={selected===`${reset.provider.providerId}:${reset.key}`}
          aria-label={`${reset.provider.displayName} · ${physicalWindowLabel(reset.label,t)} · ${label(reset.time)}`}
          title={`${reset.provider.displayName} · ${physicalWindowLabel(reset.label,t)} · ${label(reset.time)}`}
          style={{insetInlineStart:`${(reset.time-now)/span*100}%`,top:`${10 + lanes[index].lane*28}px`}}><ProviderIcon providerId={reset.provider.providerId} size={14}/></button>)}</div>
      </div>
      {selectedReset && <p className="reset-horizon__selection" role="status">{t("V24ResetSelection")}: <bdi>{selectedReset.provider.displayName} · {physicalWindowLabel(selectedReset.label,t)} · {label(selectedReset.time)}</bdi></p>}
      <AnalyticsTable rows={resets} columns={columns} rowKey={row => `${row.provider.providerId}:${row.key}`} caption={t("V2ResetObservedCaption")} emptyLabel={t("DashboardValueUnavailable")}/>
    </> : <p className="analytics-empty">{t("DashboardResetScheduleEmpty")}</p>}
  </AnalyticsSection>;
}
