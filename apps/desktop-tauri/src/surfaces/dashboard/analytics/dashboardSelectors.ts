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
import {physicalQuotaWindows} from "../../../lib/analytics/currentProviders";

/** Quota percentages have provider-specific denominators: never sum into shares. */
export function rankProviderQuotas(providers: DashboardProviderSummary[]): DashboardProviderSummary[] {
  return providers.filter(p => Number.isFinite(p.usedPercent) && p.usedPercent >= 0 && p.usedPercent <= 100)
    .sort((a, b) => b.usedPercent - a.usedPercent || a.provider.localeCompare(b.provider) || a.accountId.localeCompare(b.accountId));
}

/** Last observed bucket per provider AND account inside the already-scoped range. */
export function summarizeUsageTrend(points: UsageTrendPoint[]): DashboardProviderSummary[] {
  const latest = new Map<string, UsageTrendPoint>();
  for (const point of points) {
    const key = JSON.stringify([point.provider, point.accountId]);
    if (!latest.has(key) || point.bucketStart > latest.get(key)!.bucketStart) latest.set(key, point);
  }
  return [...latest.values()].map(p => ({provider: p.provider, accountId: p.accountId,
    usedPercent: p.usedPercent, remainingPercent: p.remainingPercent, resetsAt: null, lastSampleAt: p.bucketStart}));
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
  if (sorted.length < 4 || new Set(sorted.map(p => JSON.stringify([p.provider, p.accountId]))).size !== 1
    || sorted.some(p => !Number.isFinite(p.usedPercent) || p.usedPercent < 0 || p.usedPercent > 100)
    || new Set(sorted.map(p => p.bucketStart)).size !== sorted.length) return { available: false };
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

/** Shared definition for reset proximity and Dashboard alerts. */
export const RESET_SOON_MS = 60 * 60 * 1000; // 1 hour

/**
 * Deterministic, local, rule-based alerts -- no cloud/AI involved. Reuses
 * the user's own configured thresholds (`highUsageThreshold`/
 * `criticalUsageThreshold`), never a hardcoded number.
 */
function highestPhysicalWindow(provider: ProviderUsageSnapshot) {
  return physicalQuotaWindows(provider).reduce<ReturnType<typeof physicalQuotaWindows>[number] | null>((highest,item) => !highest || item.window.usedPercent > highest.window.usedPercent ? item : highest,null)?.window;
}
function earliestPhysicalReset(provider: ProviderUsageSnapshot, now: number) {
  return physicalQuotaWindows(provider).map(item=>item.window).filter(window=>window.resetsAt && Date.parse(window.resetsAt)>now)
    .sort((a,b)=>Date.parse(a.resetsAt!)-Date.parse(b.resetsAt!))[0];
}

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
    if (p.errorState !== "ready" || !!p.error) {
      alerts.push({
        id: `unavailable-${p.providerId}`,
        severity: "warning",
        kind: "unavailable",
        providerId: p.providerId,
        providerName: p.displayName,
      });
      continue;
    }
    const metric = highestPhysicalWindow(p);
    const used = metric ? normalizePercentage(metric.usedPercent) : null;
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
    const resetWindow = earliestPhysicalReset(p, now);
    if (resetWindow?.resetsAt) {
      const resetMs = Date.parse(resetWindow.resetsAt);
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
  const connected = providers.filter((p) => p.errorState === "ready" && !p.error);
  const withResets: ProviderResetSchedule[] = [];
  for (const p of connected) {
    const metric = earliestPhysicalReset(p, now);
    if (!metric?.resetsAt) continue;
    const resetMs = Date.parse(metric.resetsAt);
    if (Number.isNaN(resetMs) || resetMs <= now) continue;
    withResets.push({ providerId: p.providerId, providerName: p.displayName, resetsAt: metric.resetsAt });
  }
  return withResets.sort((a, b) => Date.parse(a.resetsAt) - Date.parse(b.resetsAt));
}

export interface DataStatus {
  historyState: "active" | "collecting";
  quotaState: "live";
  /**
   * Phase 4A.1 (owner section 5): distinguishes real, trustworthy
   * provider-reported data by WHAT it represents -- spend, balance, or
   * provider-defined credits -- never a generic "providerReported" that
   * would let a balance masquerade as spend. "monetarySemanticsUnknown"
   * covers real cost rows whose quantity kind couldn't be established
   * (distinct from "legacyAmbiguous", which is specifically pre-Phase-4A
   * untagged rows). Never "estimated" -- Quotalis performs no local
   * estimation today (see `costContract.origin`).
   */
  costState:
    | "providerReportedSpend"
    | "providerReportedBalance"
    | "providerReportedCredits"
    | "monetarySemanticsUnknown"
    | "legacyAmbiguous"
    | "unavailable";
  /**
   * Phase 4A: "notRequired" for provider-reported cost (Quotalis pricing
   * verification does not apply to a number it didn't compute) --
   * "unverified" only once a locally-estimated figure with the Phase 4
   * pricing catalog behind it exists (not produced anywhere today).
   * Never implies a provider-reported number came from Quotalis pricing.
   */
  pricingState: "notRequired" | "unverified";
}

/**
 * Honest data-status classification (owner section 26, revised Phase
 * 4A section 16). Reads the snapshot's proven `costContract` instead of
 * inferring cost semantics from `hasCostData` alone -- a legacy
 * (pre-Phase-4A) row and a real provider-reported figure both set
 * `hasCostData: true`, but only one of them is safe to call "Cost data:
 * Provider reported".
 */
export function resolveDataStatus(snapshot: DashboardSnapshot | null): DataStatus {
  const availability = snapshot?.availability;
  const contract = snapshot?.costContract;
  const costState: DataStatus["costState"] =
    contract?.availability === "available" && contract.origin === "providerReported"
      ? contract.quantityKind === "spend"
        ? "providerReportedSpend"
        : contract.quantityKind === "balance"
          ? "providerReportedBalance"
          : contract.quantityKind === "credits"
            ? "providerReportedCredits"
            : "monetarySemanticsUnknown"
      : contract?.availability === "legacyAmbiguous"
        ? "legacyAmbiguous"
        : "unavailable";
  return {
    historyState: (availability?.sampleCount ?? 0) > 0 ? "active" : "collecting",
    quotaState: "live",
    costState,
    pricingState: contract?.pricingStatus === "unverified" ? "unverified" : "notRequired",
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
  /**
   * Phase 4A: renamed from `estimatedSpendTotal` -- this is always a
   * provider-reported figure, never a Quotalis-computed estimate (see
   * `docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md`). `null` whenever a
   * trustworthy combined total cannot be proven (no cost data, mixed
   * measurement kinds/currencies, or a provider with ambiguous
   * semantics) -- never a fabricated 0. Pair with `reportedSpendCurrency`
   * before rendering; a KPI showing a bare number with no currency is a
   * bug.
   */
  reportedSpendTotal: number | null;
  /** ISO 4217 currency code for `reportedSpendTotal`, or `null` exactly
   *  when `reportedSpendTotal` is `null`. */
  reportedSpendCurrency: string | null;
}

/**
 * Compute every KPI value from real live-provider/snapshot data. Each
 * field is independently nullable -- a widget renders "unavailable" for
 * whichever fields come back null/empty rather than a fabricated zero.
 */
export function computeKpis({ liveProviders, snapshot, settings }: KpiInputs): KpiValues {
  const connected = liveProviders.filter((p) => p.errorState === "ready" && !p.error);

  let highest: KpiValues["highestUsageProvider"] = null;
  for (const p of connected) {
    const metric = highestPhysicalWindow(p);
    const used = metric ? normalizePercentage(metric.usedPercent) : null;
    if (used !== null && (highest === null || used > highest.usedPercent)) {
      highest = { providerId: p.providerId, providerName: p.displayName, usedPercent: used };
    }
  }

  let nextReset: KpiValues["nextReset"] = null;
  const now = Date.now();
  for (const p of connected) {
    const metric = earliestPhysicalReset(p, now);
    if (!metric?.resetsAt) continue;
    const resetMs = Date.parse(metric.resetsAt);
    if (Number.isNaN(resetMs) || resetMs <= now) continue;
    if (nextReset === null || resetMs < Date.parse(nextReset.resetsAt)) {
      nextReset = { providerId: p.providerId, providerName: p.displayName, resetsAt: metric.resetsAt };
    }
  }

  const spend = totalReportedSpend(snapshot);

  return {
    activeProviderCount: connected.length,
    highestUsageProvider: highest,
    nextReset,
    alertCount: buildAlerts(liveProviders, settings).length,
    reportedSpendTotal: spend?.total ?? null,
    reportedSpendCurrency: spend?.currencyCode ?? null,
  };
}

/**
 * Phase 4A.1 hard rule (docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md
 * "Phase 4A.1" section, owner section 4): the Dashboard Spend KPI may
 * consume ONLY observations whose `quantityKind` is `"spend"` --
 * NEVER `"balance"`, `"credits"`, or `"unknown"`, even if their temporal
 * shape (`measurementKind`) happens to look identical to a genuine spend
 * series. `CostMeasurementKind` alone was proven insufficient by a real
 * provider-adapter audit: several providers write a prepaid balance into
 * the exact same field a spend total uses elsewhere. `snapshot.costContract`
 * is the proven, structured answer for the whole snapshot (Rust already
 * collapses it to `"unknown"` on either dimension the moment more than
 * one kind/currency is mixed in) -- this function trusts that contract
 * instead of re-deriving semantics from the raw trend data itself.
 *
 * A combined total is produced ONLY when the contract says every
 * relevant sample is Spend, Cumulative, in one unambiguous currency: for
 * each independent (provider, accountId) series, take only its MOST
 * RECENT bucket (that series' current cumulative reading), then sum
 * those latest-per-series values across providers/accounts. Summing
 * across independent Cumulative Spend series is legitimate (each is its
 * own real period total, and totals from genuinely different sources
 * are additive); summing across time within one series never is (that
 * was the original bug -- the same running total counted repeatedly).
 * Any other quantity kind (balance, credits, unknown) or measurement
 * kind (point-in-time, unknown, or a mix) returns `null` -- if only
 * balance data exists, Spend is unavailable; the balance is NOT shown
 * under the Spend label (owner Phase 4A.1 section 3/4). Accuracy wins
 * over feature completeness (owner Phase 4A section 15).
 */
function totalReportedSpend(
  snapshot: DashboardSnapshot | null,
): { total: number; currencyCode: string } | null {
  const spendPoints = snapshot?.spendTrend ?? [];
  const contract = snapshot?.costContract;
  if (!contract || spendPoints.length === 0) return null;
  if (contract.availability !== "available" || contract.origin !== "providerReported") return null;
  if (contract.quantityKind !== "spend") return null;
  if (contract.measurementKind !== "cumulative") return null;
  if (!contract.currencyCode || !contract.period || contract.period.toLowerCase() === "unknown") return null;

  const latestBySeries = new Map<string, (typeof spendPoints)[number]>();
  for (const point of spendPoints) {
    // Belt-and-suspenders: even though the contract already proved a
    // uniform kind/currency for the snapshot as a whole, never let an
    // individual point that disagrees (a bug elsewhere, or a future
    // provider not yet classified) silently join the total. This is the
    // literal enforcement of the hard rule: a Balance/Credits/Unknown
    // point can NEVER reach the Spend KPI even if it slipped through
    // some future refactor of the contract-level gate above.
    if (point.quantityKind !== "spend") return null;
    if (point.measurementKind !== "cumulative") return null;
    if (point.currencyCode !== contract.currencyCode || !Number.isFinite(point.costUsed)) return null;
    const key = JSON.stringify([point.provider, point.accountId]);
    const existing = latestBySeries.get(key);
    if (!existing || point.bucketStart > existing.bucketStart) {
      latestBySeries.set(key, point);
    }
  }
  if (latestBySeries.size === 0) return null;
  const total = Array.from(latestBySeries.values()).reduce((sum, p) => sum + p.costUsed, 0);
  return Number.isFinite(total) ? { total, currencyCode: contract.currencyCode } : null;
}
