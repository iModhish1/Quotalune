import type { DashboardRangeKind, DashboardSnapshot } from "../types/bridge";

/** Scope the existing deterministic history; never generate new values on filter changes. */
export function scopeDemoSnapshot(snapshot: DashboardSnapshot, range: DashboardRangeKind, providerIds?: string[]): DashboardSnapshot {
  const until = snapshot.rangeUntil;
  const date = new Date(until * 1000);
  let since = snapshot.rangeSince;
  switch (range) {
    case "today": date.setHours(0, 0, 0, 0); since = date.getTime() / 1000; break;
    case "last7Days": since = until - 7 * 86400; break;
    case "last30Days": since = until - 30 * 86400; break;
    case "thisMonth": date.setDate(1); date.setHours(0, 0, 0, 0); since = date.getTime() / 1000; break;
    case "last3Months": date.setMonth(date.getMonth() - 3); since = date.getTime() / 1000; break;
    case "thisYear": date.setMonth(0, 1); date.setHours(0, 0, 0, 0); since = date.getTime() / 1000; break;
  }
  const matches = (id: string) => !providerIds?.length || providerIds.includes(id);
  const usageTrend = snapshot.usageTrend.filter(p => matches(p.provider) && p.bucketStart >= since);
  const spendTrend = snapshot.spendTrend.filter(p => matches(p.provider) && p.bucketStart >= since);
  // Current provider readings are invariant under historical range selection.
  const providers = snapshot.providers.filter(p => matches(p.provider));
  const quotaHistory = snapshot.quotaHistory?.filter(p => matches(p.provider) && p.observedAt >= since - (until - since) && p.observedAt < until);
  return {...snapshot, rangeSince: since, usageTrend, spendTrend, providers, quotaHistory,
    availability: {...snapshot.availability, sampleCount: usageTrend.reduce((sum, p) => sum + p.sampleCount, 0), hasCostData: spendTrend.length > 0},
    costContract: spendTrend.length ? snapshot.costContract : {...snapshot.costContract, origin: "unavailable", availability: "unavailable", currencyCode: null},
  };
}
