import type {DashboardSnapshot, ProviderUsageSnapshot, SettingsSnapshot} from "../../types/bridge";
import {currentProviderModel} from "./currentProviders";
import {buildQuotaAnalytics, type AnalyticsRange} from "./quotaAnalytics";
import {buildAttention, summarizeCoverage} from "./dashboardIntelligence";
import {computeKpis} from "../../surfaces/dashboard/analytics/dashboardSelectors";

/** Single derivation boundary. Widgets never scan the raw history independently. */
export function buildDashboardAnalyticsModel(providers: ProviderUsageSnapshot[], snapshot: DashboardSnapshot|null, settings: SettingsSnapshot, filter: string|null, now: number) {
  const range: AnalyticsRange = {since:snapshot?.rangeSince ?? 0,until:snapshot?.rangeUntil ?? 0,grainSeconds:snapshot?.grain === "hourly" ? 3600 : 86400};
  const currentLimits=currentProviderModel(providers,settings,now);
  const trends=buildQuotaAnalytics(snapshot?.quotaHistory ?? [],range,filter);
  const attention=buildAttention(currentLimits,trends,settings,now);
  return {range,currentLimits,trends,attention,coverage:summarizeCoverage(trends),
    resetHorizon:currentLimits.flatMap(model=>model.resets).sort((a,b)=>a.time-b.time),
    kpis:{...computeKpis({liveProviders:providers,snapshot,settings}),alertCount:attention.length},
    freshness:currentLimits.map(model=>({id:model.provider.providerId,...model.freshness})),
    dataQuality:snapshot?.availability ?? null};
}
export type DashboardAnalyticsModel=ReturnType<typeof buildDashboardAnalyticsModel>;
