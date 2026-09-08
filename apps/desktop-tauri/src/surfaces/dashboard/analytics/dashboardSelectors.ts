/**
 * Pure selectors for the 2D Analytics Dashboard.
 *
 * Every function here takes real data (a `DashboardSnapshot`, live
 * `ProviderUsageSnapshot[]`, or settings) and returns a derived value or
 * an explicit "not available"/"not enough data" result -- never a
 * fabricated number. Kept out of component render bodies per the Phase 3
 * spec (owner section 49/50): components call these, memoize the result,
 * and render it -- no ad-hoc math inline in JSX.
 */
import type {
  DashboardProviderSummary,
  DashboardSnapshot,
  ProviderUsageSnapshot,
  SettingsSnapshot,
  UsageTrendPoint,
} from "../../../types/bridge";
import { normalizePercentage } from "../../../design-system/percent";
import { selectSingleMetricUsageWindow } from "../../../lib/usageWindows";

export interface ProviderShare {
  provider: string;
  accountId: string;
  usedPercent: number;
  share: number;
}

/**
 * Rank providers by their current used-quota share within the snapshot's
 * provider set. `share` is usedPercent's proportion of the sum of all
 * providers' usedPercent -- a distribution measure, not a second quota
 * calculation. Returns `[]` when there is nothing to rank (never a
 * single fabricated 100% slice).
 */
export function rankProvidersByShare(
  providers: DashboardProviderSummary[],
): ProviderShare[] {
  const withUsage = providers
    .map((p) => ({ ...p, usedPercent: normalizePercentage(p.usedPercent) ?? 0 }))
    .filter((p) => p.usedPercent > 0);
  const total = withUsage.reduce((sum, p) => sum + p.usedPercent, 0);
  if (total <= 0) return [];
  return withUsage
    .map((p) => ({
      provider: p.provider,
      accountId: p.accountId,
      usedPercent: p.usedPercent,
      share: p.usedPercent / total,
    }))
    .sort((a, b) => b.share - a.share);
}

export type TrendComparisonResult =
  | { available: true; deltaPercentPoints: number }
  | { available: false };

/**
 * Compare the first half of the trend window against the second half.
 * Requires at least 4 buckets so each half has a meaningful sample --
 * below that, returns `{ available: false }` rather than computing a
 * comparison off 1-2 points (which the owner spec explicitly forbids:
 * "If history is too short: do not compute it").
 */
export function compareTrendHalves(trend: UsageTrendPoint[]): TrendComparisonResult {
  const sorted = [...trend].sort((a, b) => a.bucketStart - b.bucketStart);
  if (sorted.length < 4) return { available: false };
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);
  const avg = (points: UsageTrendPoint[]) =>
    points.reduce((sum, p) => sum + p.usedPercent, 0) / points.length;
  return { available: true, deltaPercentPoints: avg(secondHalf) - avg(firstHalf) };
}

export interface DashboardAlert {
  id: string;
  severity: "warning" | "critical";
  kind: "quotaWarning" | "quotaCritical" | "resetSoon" | "authRequired" | "unavailable";
  providerId: string;
  providerName: string;
}

const RESET_SOON_MS = 60 * 60 * 1000; // 1 hour

/**
 * Deterministic, local, rule-based alerts -- no cloud/AI involved. Reuses
 * the user's own configured thresholds (`highUsageThreshold`/
 * `criticalUsageThreshold`), never a hardcoded number.
 */
export function buildAlerts(
  providers: ProviderUsageSnapshot[],
  settings: Pick<SettingsSnapshot, "highUsageThreshold" | "criticalUsageThreshold">,
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const now = Date.now();
  for (const p of providers) {
    if (p.errorState === "needsAuthentication" || p.errorState === "expiredSession") {
      alerts.push({
        id: `auth-${p.providerId}`,
        severity: "critical",
        kind: "authRequired",
        providerId: p.providerId,
        providerName: p.displayName,
      });
      continue;
    }
    if (p.errorState === "localRuntimeOffline" || p.errorState === "unknown") {
      alerts.push({
        id: `unavailable-${p.providerId}`,
        severity: "warning",
        kind: "unavailable",
        providerId: p.providerId,
        providerName: p.displayName,
      });
      continue;
    }
    const metric = selectSingleMetricUsageWindow(p);
    const used = normalizePercentage(metric.usedPercent);
    if (used !== null) {
      if (used >= settings.criticalUsageThreshold) {
        alerts.push({
          id: `quota-critical-${p.providerId}`,
          severity: "critical",
          kind: "quotaCritical",
          providerId: p.providerId,
          providerName: p.displayName,
        });
      } else if (used >= settings.highUsageThreshold) {
        alerts.push({
          id: `quota-warning-${p.providerId}`,
          severity: "warning",
          kind: "quotaWarning",
          providerId: p.providerId,
          providerName: p.displayName,
        });
      }
    }
    if (metric.resetsAt) {
      const resetMs = Date.parse(metric.resetsAt);
      if (!Number.isNaN(resetMs) && resetMs > now && resetMs - now <= RESET_SOON_MS) {
        alerts.push({
          id: `reset-soon-${p.providerId}`,
          severity: "warning",
          kind: "resetSoon",
          providerId: p.providerId,
          providerName: p.displayName,
        });
      }
    }
  }
  // Critical first, then warnings; stable within each severity.
  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
}

export interface ProviderResetSchedule {
  providerId: string;
  providerName: string;
  resetsAt: string;
}

/**
 * Every connected provider with a real, still-future reset instant,
 * ordered soonest-first (owner build-order item F: a dedicated
 * cross-provider "sorted by soonest reset" widget, distinct from the
 * single next-reset KPI and from any one provider's own detail card).
 * Generalizes the same soonest-reset logic `computeKpis` uses for its
 * single `nextReset` KPI into the full ranked list. Providers with no
 * reset data, an unparseable timestamp, or an already-past reset are
 * left out rather than shown as a fabricated "now".
 */
export function rankProvidersByResetTime(
  providers: ProviderUsageSnapshot[],
): ProviderResetSchedule[] {
  const now = Date.now();
  const connected = providers.filter((p) => p.errorState === "ready");
  const withResets: ProviderResetSchedule[] = [];
  for (const p of connected) {
    const metric = selectSingleMetricUsageWindow(p);
    if (!metric.resetsAt) continue;
    const resetMs = Date.parse(metric.resetsAt);
    if (Number.isNaN(resetMs) || resetMs <= now) continue;
    withResets.push({ providerId: p.providerId, providerName: p.displayName, resetsAt: metric.resetsAt });
  }
  return withResets.sort((a, b) => Date.parse(a.resetsAt) - Date.parse(b.resetsAt));
}

export interface DataStatus {
  historyState: "active" | "collecting";
  quotaState: "live";
  costState: "estimated" | "unavailable";
  pricingState: "notVerified";
}

/**
 * Honest data-status classification (owner section 26). Never reports
 * "verified" pricing -- that requires the Phase 4 pricing audit, not yet
 * done, so `pricingState` is always `"notVerified"` today.
 */
export function resolveDataStatus(availability: DashboardSnapshot["availability"]): DataStatus {
  return {
    historyState: availability.sampleCount > 0 ? "active" : "collecting",
    quotaState: "live",
    costState: availability.hasCostData ? "estimated" : "unavailable",
    pricingState: "notVerified",
  };
}

/** Real elapsed span of available history, in whole days (0 if same day
 *  or unavailable). Used to render "N days of data available" rather than
 *  implying a full year/month of history exists. */
export function availableHistoryDays(availability: DashboardSnapshot["availability"]): number {
  if (availability.firstSampleAt == null || availability.lastSampleAt == null) return 0;
  const spanMs = (availability.lastSampleAt - availability.firstSampleAt) * 1000;
  return Math.max(0, Math.floor(spanMs / (24 * 60 * 60 * 1000)));
}

export interface KpiInputs {
  liveProviders: ProviderUsageSnapshot[];
  snapshot: DashboardSnapshot | null;
  settings: Pick<SettingsSnapshot, "highUsageThreshold" | "criticalUsageThreshold">;
}

export interface KpiValues {
  activeProviderCount: number;
  highestUsageProvider: { providerId: string; providerName: string; usedPercent: number } | null;
  nextReset: { providerId: string; providerName: string; resetsAt: string } | null;
  alertCount: number;
  estimatedSpendTotal: number | null;
}

/**
 * Compute every KPI value from real live-provider/snapshot data. Each
 * field is independently nullable -- a widget renders "unavailable" for
 * whichever fields come back null/empty rather than a fabricated zero.
 */
export function computeKpis({ liveProviders, snapshot, settings }: KpiInputs): KpiValues {
  const connected = liveProviders.filter((p) => p.errorState === "ready");

  let highest: KpiValues["highestUsageProvider"] = null;
  for (const p of connected) {
    const metric = selectSingleMetricUsageWindow(p);
    const used = normalizePercentage(metric.usedPercent);
    if (used !== null && (highest === null || used > highest.usedPercent)) {
      highest = { providerId: p.providerId, providerName: p.displayName, usedPercent: used };
    }
  }

  let nextReset: KpiValues["nextReset"] = null;
  const now = Date.now();
  for (const p of connected) {
    const metric = selectSingleMetricUsageWindow(p);
    if (!metric.resetsAt) continue;
    const resetMs = Date.parse(metric.resetsAt);
    if (Number.isNaN(resetMs) || resetMs <= now) continue;
    if (nextReset === null || resetMs < Date.parse(nextReset.resetsAt)) {
      nextReset = { providerId: p.providerId, providerName: p.displayName, resetsAt: metric.resetsAt };
    }
  }

  return {
    activeProviderCount: connected.length,
    highestUsageProvider: highest,
    nextReset,
    alertCount: buildAlerts(liveProviders, settings).length,
    estimatedSpendTotal: totalReportedSpend(snapshot),
  };
}

/**
 * Phase 4 fix (docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md, defect #1):
 * `SpendTrendPoint.costUsed` is a point-in-time/period-cumulative reading
 * -- "whatever the provider reported as its own dollar-usage figure" for
 * that bucket (see `SpendDailyPoint`'s doc comment in
 * `rust/src/dashboard_data.rs`), NOT a per-bucket delta. Summing every
 * bucket in the trend (the old behavior) summed the same running total
 * N times over and inflated the KPI roughly Nx -- exactly the "never sum
 * cumulative snapshots" mistake the owner's Phase 4 spec calls out.
 *
 * The correct total is: for each independent (provider, accountId)
 * series, take only its MOST RECENT bucket (that series' current
 * cumulative reading) -- then sum those latest-per-series values across
 * providers/accounts. Summing *across independent series* is legitimate
 * (each provider/account reports its own real total, and totals from
 * genuinely different sources are additive); summing *across time within
 * one series* is not (that's the same total counted repeatedly).
 */
function totalReportedSpend(snapshot: DashboardSnapshot | null): number | null {
  const spendPoints = snapshot?.spendTrend ?? [];
  if (!snapshot?.availability.hasCostData || spendPoints.length === 0) return null;

  const latestBySeries = new Map<string, (typeof spendPoints)[number]>();
  for (const point of spendPoints) {
    const key = `${point.provider}::${point.accountId}`;
    const existing = latestBySeries.get(key);
    if (!existing || point.bucketStart > existing.bucketStart) {
      latestBySeries.set(key, point);
    }
  }
  if (latestBySeries.size === 0) return null;
  return Array.from(latestBySeries.values()).reduce((sum, p) => sum + p.costUsed, 0);
}
