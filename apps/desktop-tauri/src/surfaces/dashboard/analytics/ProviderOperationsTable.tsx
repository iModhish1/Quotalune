import {useLocale} from "../../../hooks/useLocale";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {formatResetPresentation} from "../../../lib/resetPresentation";
import type {CurrentProviderModel} from "../../../lib/analytics/currentProviders";
import type {SettingsSnapshot} from "../../../types/bridge";
import {AnalyticsTable} from "../../../components/analytics/AnalyticsPrimitives";

export default function ProviderOperationsTable({models,settings,now}: {models:CurrentProviderModel[];settings:SettingsSnapshot;now:number}) {
  const {t} = useLocale();
  const options=useResetStageOptions(settings,"dashboard");
  const number=new Intl.NumberFormat(options.locale,{numberingSystem:"latn",maximumFractionDigits:1});
  const unavailable=t("DashboardValueUnavailable");
  return <AnalyticsTable rows={models} rowKey={row=>row.provider.providerId} caption={t("DashboardCurrentStatusEyebrow")} emptyLabel={unavailable} columns={[
    {id:"provider",title:t("TabProviders"),cell:row=><bdi>{row.provider.displayName}</bdi>,sortValue:row=>row.provider.displayName},
    {id:"status",title:t("V2CurrentState"),cell:row=>t(!row.ready ? "DashboardNeedsAttention" : row.freshness.state === "stale" ? "V2Stale" : "V2ProviderReady"),sortValue:row=>row.ready ? row.freshness.state : "error"},
    {id:"plan",title:t("Plan"),cell:row=><bdi>{row.provider.planName ?? unavailable}</bdi>},
    {id:"quota",title:t("DashboardKpiHighestUsage"),cell:row=>row.highest ? <><bdi>{number.format(row.highest.window.usedPercent)}%</bdi><small className="analytics-account-scope">{row.highest.label ?? t("V2PhysicalWindow")}</small></> : unavailable,sortValue:row=>row.highest?.window.usedPercent ?? null},
    {id:"remaining",title:t("FloatBarRemainingSuffix"),cell:row=>row.highest ? <bdi>{number.format(row.highest.window.remainingPercent)}%</bdi> : unavailable,sortValue:row=>row.highest?.window.remainingPercent ?? null},
    {id:"reset",title:t("V2NextReset"),cell:row=>row.nextReset ? <bdi>{formatResetPresentation({...options,locale:options.locale ?? "en-US",resetAt:row.nextReset,now}).fullAriaLabel}</bdi> : unavailable,sortValue:row=>row.nextReset},
    {id:"age",title:t("V2ObservationAge"),cell:row=>row.freshness.ageSeconds === null ? unavailable : <bdi>{number.format(row.freshness.ageSeconds/60)} {t("V2MinutesShort")}</bdi>,sortValue:row=>row.freshness.ageSeconds},
  ]}/>;
}
