/**
 * Builds a synthetic `DashboardSnapshot` (the same type
 * `get_dashboard_snapshot` returns) so `DashboardAnalyticsPanel` and its
 * children (`UsageTrendSection`, `ProviderDistribution`, the KPI row's
 * "Reported Spend" figure) render through the SAME real selectors
 * production data uses (owner Phase 5.2 section 13/17) -- this module
 * only ever produces INPUT data, never a second analytics
 * implementation.
 *
 * Phase 4 monetary truth model is preserved exactly: `costContract` only
 * ever claims `quantityKind: "spend"` when a real spend-classified demo
 * provider exists in this dataset, and only that provider's points carry
 * `quantityKind: "spend"` -- a Balance/Credits/Unavailable provider never
 * contributes a `SpendTrendPoint` at all (owner section 15/51), exactly
 * mirroring how `totalReportedSpend()` (`dashboardSelectors.ts`) already
 * defensively filters real data.
 */
import type {
  DashboardProviderSummary,
  DashboardRangeKind,
  DashboardSnapshot,
  ProviderCatalogEntry,
  SpendTrendPoint,
  UsageTrendPoint,
  QuotaHistoryPoint,
} from "../types/bridge";
import {physicalQuotaWindows} from "../lib/analytics/currentProviders";
import { providerMonetaryQuantityKind } from "../lib/providerMonetaryKind";
import type { DemoModeConfig } from "./types";
import { buildDemoProviderSnapshotsWithTrend } from "./providerSnapshots";
import { createRng, deriveSeed, randRange } from "./rng";
import type { DemoTrendShape } from "./scenarios";

const DAY_SECONDS = 86_400;

/** One provider's usedPercent for a given day index (0 = oldest),
 *  shaped by its deterministic trend (owner section 11/40) -- never pure
 *  noise. `currentPercent` anchors the series so "today" in the
 *  generated history matches the provider's own real "current" snapshot
 *  value exactly (owner section 43: 2D and 3D must agree). */
function trendValueForDay(
  shape: DemoTrendShape,
  dayIndex: number,
  totalDays: number,
  currentPercent: number,
  rng: () => number,
): number {
  const t = totalDays <= 1 ? 1 : dayIndex / (totalDays - 1);
  let value: number;
  switch (shape) {
    case "gradualRise":
      value = currentPercent * (0.35 + 0.65 * t);
      break;
    case "stable":
      value = currentPercent * (0.92 + 0.08 * Math.sin(dayIndex * 1.3));
      break;
    case "lateSpike":
      value = t < 0.75 ? currentPercent * 0.3 : currentPercent * (0.3 + 0.7 * ((t - 0.75) / 0.25));
      break;
    case "resetCycle": {
      const cyclePos = (dayIndex % Math.max(2, Math.floor(totalDays / 2))) / Math.max(2, Math.floor(totalDays / 2));
      value = currentPercent * cyclePos + (t >= 0.95 ? 0 : 0);
      break;
    }
    case "moderateOscillation":
      value = currentPercent * (0.55 + 0.35 * Math.sin(dayIndex * 0.9));
      break;
  }
  const jitter = randRange(rng, -3, 3);
  return Math.max(0, Math.min(100, Math.round(value + jitter)));
}

export function buildDemoDashboardSnapshot(
  config: DemoModeConfig,
  catalog: readonly ProviderCatalogEntry[],
  // Accepted for API parity with the real `useDashboardSnapshot(range, ...)`
  // call site, but intentionally unused: Demo Mode always generates the
  // full configured `historyDays` window regardless of the requested
  // range (owner section 39's documented simplification -- the real
  // history chip still honestly reports the generated span rather than
  // claiming a longer one).
  _range: DashboardRangeKind,
  now: number,
): DashboardSnapshot {
  const nowSec = Math.floor(now / 1000);
  const totalDays = config.historyDays;
  const rangeSince = nowSec - totalDays * DAY_SECONDS;

  const resolved = buildDemoProviderSnapshotsWithTrend(config, catalog, now);

  const providers: DashboardProviderSummary[] = resolved.map(({ snapshot }) => ({
    provider: snapshot.providerId,
    accountId: `demo-${snapshot.providerId}`,
    usedPercent: snapshot.primary.usedPercent,
    remainingPercent: snapshot.primary.remainingPercent,
    resetsAt: snapshot.primary.resetsAt,
    lastSampleAt: nowSec,
  }));

  const usageTrend: UsageTrendPoint[] = [];
  const spendTrend: SpendTrendPoint[] = [];
  const quotaHistory: QuotaHistoryPoint[] = [];
  let hasSpendProvider = false;

  for (const { snapshot, trendShape } of resolved) {
    const historyRng = createRng(deriveSeed(config.seed, `history:${snapshot.providerId}`));
    // Explicit Demo fixture identity only. This generator is never persisted.
    if (snapshot.errorState === "ready" && !snapshot.error) {
      for (const item of physicalQuotaWindows(snapshot)) {
        const duration = item.window.windowMinutes;
        if (!duration || duration <= 0) continue;
        const cycleSeconds = duration * 60;
        const currentReset = item.window.resetsAt ? Date.parse(item.window.resetsAt) / 1000 : NaN;
        for (let day = 0; day < totalDays; day++) {
          const bucketStart = rangeSince + day * DAY_SECONDS;
          const observedAt = bucketStart + DAY_SECONDS - 1;
          const resetsAt = Number.isFinite(currentReset) ? currentReset - Math.floor((currentReset - observedAt - 1) / cycleSeconds) * cycleSeconds : null;
          const progress = resetsAt === null ? item.window.usedPercent : Math.max(0, Math.min(100, (1 - (resetsAt - observedAt) / cycleSeconds) * item.window.usedPercent));
          quotaHistory.push({provider: snapshot.providerId, accountId: `demo-${snapshot.providerId}`, accountScope: "observed",
            windowKey: `${item.key}:${duration}`, windowLabel: item.label, windowMinutes: duration,
            bucketStart, observedAt, usedPercent: progress, remainingPercent: 100 - progress, resetsAt, sampleCount: 1});
        }
      }
    }
    const kind = providerMonetaryQuantityKind(snapshot.providerId);
    let cumulativeSpend = 0;
    for (let day = 0; day < totalDays; day += 1) {
      const bucketStart = rangeSince + day * DAY_SECONDS;
      const usedPercent = trendValueForDay(
        trendShape,
        day,
        totalDays,
        snapshot.primary.usedPercent,
        historyRng,
      );
      usageTrend.push({
        provider: snapshot.providerId,
        accountId: `demo-${snapshot.providerId}`,
        bucketStart,
        usedPercent,
        remainingPercent: Math.max(0, 100 - usedPercent),
        sampleCount: 1,
      });

      if (kind === "spend" && snapshot.cost) {
        hasSpendProvider = true;
        cumulativeSpend += randRange(historyRng, 0.1, snapshot.cost.used / totalDays + 0.5);
        spendTrend.push({
          provider: snapshot.providerId,
          accountId: `demo-${snapshot.providerId}`,
          bucketStart,
          costUsed: Math.round(cumulativeSpend * 100) / 100,
          currencyCode: snapshot.cost.currencyCode,
          measurementKind: "cumulative",
          quantityKind: "spend",
        });
      }
    }
  }

  return {
    generatedAt: nowSec,
    rangeSince,
    rangeUntil: nowSec,
    grain: "daily",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    availability: {
      firstSampleAt: totalDays > 0 ? rangeSince : null,
      lastSampleAt: totalDays > 0 ? nowSec : null,
      sampleCount: usageTrend.length,
      hasCostData: hasSpendProvider,
      hasTokenData: false,
      hasRequestData: false,
      hasModelData: false,
    },
    providers,
    usageTrend,
    quotaHistory,
    spendTrend,
    costContract: {
      origin: hasSpendProvider ? "providerReported" : "unavailable",
      quantityKind: "spend",
      measurementKind: "cumulative",
      currencyCode: hasSpendProvider ? "USD" : null,
      period: "monthly",
      availability: hasSpendProvider ? "available" : "unavailable",
      // Never our own pricing engine (owner section 15) -- a
      // provider-reported figure has no pricing to verify.
      pricingStatus: "notRequired",
    },
  };
}
