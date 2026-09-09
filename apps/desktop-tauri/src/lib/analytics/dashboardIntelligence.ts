import type {LocaleKey} from "../../i18n/keys";
import type {SettingsSnapshot} from "../../types/bridge";
import type {CurrentProviderModel} from "./currentProviders";
import type {QuotaSeries} from "./quotaAnalytics";

export interface AttentionItem {
  id: string; providerId: string; providerName: string; labelKey: LocaleKey;
  kind: "auth" | "failure" | "critical" | "stale" | "high" | "reset" | "gap";
}
const PRIORITY: Record<AttentionItem["kind"], number> = {auth:0,failure:1,critical:2,stale:3,high:4,reset:5,gap:6};
/** Priority is categorical and deterministic, never a fabricated severity score. */
export function buildAttention(models: readonly CurrentProviderModel[], series: readonly QuotaSeries[], settings: SettingsSnapshot, now: number): AttentionItem[] {
  const result: AttentionItem[] = [];
  for (const model of models) {
    const provider = model.provider;
    const add = (kind: AttentionItem["kind"], labelKey: LocaleKey) => result.push({id:`${provider.providerId}:${kind}`,providerId:provider.providerId,providerName:provider.displayName,kind,labelKey});
    if (["needsAuthentication","expiredSession"].includes(provider.errorState)) add("auth","DashboardAlertAuthRequired");
    else if (!model.ready) add("failure","DashboardAlertUnavailable");
    else {
      const used = model.highest?.window.usedPercent;
      if (used !== undefined && used >= settings.criticalUsageThreshold) add("critical","DashboardAlertQuotaCritical");
      else if (used !== undefined && used >= settings.highUsageThreshold) add("high","DashboardAlertQuotaWarning");
      if (model.freshness.state === "stale") add("stale","V24AttentionStale");
      if (model.nextReset !== null && model.nextReset-now <= 3600_000) add("reset","DashboardAlertResetSoon");
    }
    if (series.some(row => row.provider === provider.providerId && row.missingBucketCount > 0)) add("gap","V24AttentionGap");
  }
  return result.sort((a,b) => PRIORITY[a.kind]-PRIORITY[b.kind] || a.providerId.localeCompare(b.providerId));
}

export function summarizeCoverage(series: readonly QuotaSeries[]) {
  let samples=0, first:number|null=null, last:number|null=null, missingBuckets=0;
  for (const row of series) {
    samples+=row.sampleCount; missingBuckets+=row.missingBucketCount;
    if(row.firstObservedAt !== null) first=first===null?row.firstObservedAt:Math.min(first,row.firstObservedAt);
    if(row.lastObservedAt !== null) last=last===null?row.lastObservedAt:Math.max(last,row.lastObservedAt);
  }
  return {samples,first,last,missingBuckets};
}

/** Conservative policy: observed quota velocity does not prove a stable future workload. */
export const EXHAUSTION_PROJECTION = {state:"unsupported",value:null,reason:"workloadNotEstablished"} as const;

/** Allocate collision-free lanes for real reset markers on a linear time axis. */
export function resetMarkerLanes(times: readonly number[], since: number, span: number, minimumSeparation=0.055) {
  const ends:number[]=[];
  return times.map(time => {
    const fraction=(time-since)/span;
    let lane=ends.findIndex(end=>fraction-end>=minimumSeparation);
    if(lane<0) lane=ends.length;
    ends[lane]=fraction;
    return {fraction,lane};
  });
}
