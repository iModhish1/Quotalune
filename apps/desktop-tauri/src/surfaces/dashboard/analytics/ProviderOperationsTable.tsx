import {useLocale} from "../../../hooks/useLocale";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {formatResetPresentation} from "../../../lib/resetPresentation";
import type {CurrentProviderModel} from "../../../lib/analytics/currentProviders";
import type {SettingsSnapshot} from "../../../types/bridge";
import {AnalyticsTable} from "../../../components/analytics/AnalyticsPrimitives";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";

const FRESHNESS_ORDER = {fresh: 0, aging: 1, stale: 2, unavailable: 3} as const;

export default function ProviderOperationsTable({models,settings,now}: {models:CurrentProviderModel[];settings:SettingsSnapshot;now:number}) {
  const {t} = useLocale();
  const options=useResetStageOptions(settings,"dashboard");
  const number=new Intl.NumberFormat(options.locale,{numberingSystem:"latn",maximumFractionDigits:1});
  const unavailable=t("DashboardValueUnavailable");
  const freshnessLabel = (state: CurrentProviderModel["freshness"]["state"]) => t(state === "fresh" ? "V24Fresh" : state === "aging" ? "V24Aging" : state === "stale" ? "V24Stale" : "DashboardValueUnavailable");
  return <AnalyticsTable rows={models} rowKey={row=>row.provider.providerId} caption={t("DashboardCurrentStatusEyebrow")} emptyLabel={unavailable} columns={[
    {id:"provider",title:t("TabProviders"),cell:row=><span className="analytics-table__provider"><ProviderIcon providerId={row.provider.providerId} size={18}/><bdi>{row.provider.displayName}</bdi></span>,sortValue:row=>row.provider.displayName},
    {id:"status",title:t("V2CurrentState"),cell:row=>{const label=t(!row.ready ? "DashboardNeedsAttention" : "V2ProviderReady");return <span className={`analytics-table__status analytics-table__status--${row.ready ? "ready" : "attention"}`}><span aria-hidden="true">●</span>{label}</span>;},sortValue:row=>row.ready ? "ready" : "attention"},
    {id:"plan",title:t("Plan"),cell:row=><bdi>{row.provider.planName ?? unavailable}</bdi>,sortValue:row=>row.provider.planName},
    {id:"quota",title:t("DashboardKpiHighestUsage"),cell:row=>row.highest ? <><bdi>{number.format(row.highest.window.usedPercent)}%</bdi><small className="analytics-account-scope">{row.highest.label ?? t("V2PhysicalWindow")}</small></> : unavailable,sortValue:row=>row.highest?.window.usedPercent ?? null},
    {id:"remaining",title:t("FloatBarRemainingSuffix"),cell:row=>row.highest ? <bdi>{number.format(row.highest.window.remainingPercent)}%</bdi> : unavailable,sortValue:row=>row.highest?.window.remainingPercent ?? null},
    {id:"reset",title:t("V2NextReset"),cell:row=>row.nextReset ? <bdi>{formatResetPresentation({...options,locale:options.locale ?? "en-US",resetAt:row.nextReset,now}).fullAriaLabel}</bdi> : unavailable,sortValue:row=>row.nextReset},
    {id:"freshness",title:t("V45TableFreshness"),cell:row=><span className={`analytics-table__status analytics-table__status--${row.freshness.state}`}><span aria-hidden="true">●</span>{freshnessLabel(row.freshness.state)}{row.freshness.ageSeconds !== null && <small><bdi>{number.format(row.freshness.ageSeconds/60)} {t("V2MinutesShort")}</bdi></small>}</span>,sortValue:row=>FRESHNESS_ORDER[row.freshness.state]},
  ]} pageSize={70} copy={{columns:t("V45TableColumns"),previousPage:t("V45TablePreviousPage"),nextPage:t("V45TableNextPage"),page:t("V45TablePage")}}/>;
}
