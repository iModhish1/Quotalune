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
  const [days, setDays] = useState(7);
  const resets = useMemo(() => models.flatMap(model => model.resets).sort((a,b) => a.time - b.time), [models]);
  const span = days * 86400_000;
  const number = new Intl.NumberFormat(options.locale, {numberingSystem: "latn", maximumFractionDigits: 1});
  const label = (time: number) => formatResetPresentation({...options, resetAt: time, now, locale: options.locale ?? language}).fullAriaLabel;
  const visible = resets.filter(reset => reset.time <= now + span);
  const columns = [
    {id:"provider",title:t("TabProviders"),cell:(row:typeof resets[number])=><bdi>{row.provider.displayName}</bdi>,sortValue:(row:typeof resets[number])=>row.provider.displayName},
    {id:"window",title:t("V2LimitWindow"),cell:(row:typeof resets[number])=><bdi>{row.label ?? t("V2PhysicalWindow")}</bdi>},
    {id:"reset",title:t("V2NextReset"),cell:(row:typeof resets[number])=><bdi>{label(row.time)}</bdi>,sortValue:(row:typeof resets[number])=>row.time},
  ];
  return <AnalyticsSection title={t("V2ResetHorizon")} description={t("V2ResetHorizonHelp")} className="reset-horizon"
    action={<select aria-label={t("V2ResetHorizon")} value={days} onChange={event => setDays(Number(event.target.value))}><option value="1">{t("V2Next24Hours")}</option><option value="7">{t("V2Next7Days")}</option></select>}>
    {resets.length ? <>
      <div className="reset-horizon__timeline" role="group" aria-label={t("V2ResetHorizon")}>
        <div className="reset-horizon__ticks">{[0,.25,.5,.75,1].map(fraction => <span key={fraction} style={{insetInlineStart:`${fraction*100}%`}}>{fraction === 0 ? t("V2Now") : `${number.format(fraction * days * 24)} ${t("V2HoursShort")}`}</span>)}</div>
        <div className="reset-horizon__lanes">{visible.map((reset, index) => <span className="reset-horizon__marker" key={`${reset.provider.providerId}:${reset.key}`} tabIndex={0} role="img"
          aria-label={`${reset.provider.displayName} · ${reset.label ?? t("V2PhysicalWindow")} · ${label(reset.time)}`}
          title={`${reset.provider.displayName} · ${reset.label ?? t("V2PhysicalWindow")} · ${label(reset.time)}`}
          style={{insetInlineStart:`${(reset.time-now)/span*100}%`,top:`${10 + index%3*17}px`}} />)}</div>
      </div>
      <AnalyticsTable rows={resets} columns={columns} rowKey={row => `${row.provider.providerId}:${row.key}`} caption={t("V2ResetObservedCaption")} emptyLabel={t("DashboardValueUnavailable")}/>
    </> : <p className="analytics-empty">{t("DashboardResetScheduleEmpty")}</p>}
  </AnalyticsSection>;
}
