import { describe, expect, it } from "vitest";
import {
  availableHistoryDays,
  buildAlerts,
  compareTrendHalves,
  computeKpis,
  rankProvidersByResetTime,
  rankProvidersByShare,
  resolveDataStatus,
} from "./dashboardSelectors";
import type {
  DashboardProviderSummary,
  DashboardSnapshot,
  ProviderUsageSnapshot,
  UsageTrendPoint,
} from "../../../types/bridge";

function rateWindow(overrides: Partial<ProviderUsageSnapshot["primary"]> = {}) {
  return {
    usedPercent: 20,
    remainingPercent: 80,
    windowMinutes: null,
    resetsAt: null,
    resetDescription: null,
    isExhausted: false,
    reservePercent: null,
    reserveDescription: null,
    ...overrides,
  };
}

function provider(overrides: Partial<ProviderUsageSnapshot> = {}): ProviderUsageSnapshot {
  return {
    providerId: "claude",
    displayName: "Claude",
    primary: rateWindow(),
    selectedMetric: rateWindow(),
    primaryLabel: "Monthly",
    secondary: null,
    modelSpecific: null,
    tertiary: null,
    extraRateWindows: [],
    cost: null,
    planName: null,
    accountEmail: null,
    sourceLabel: "auto",
    updatedAt: "2026-09-07T00:00:00Z",
    error: null,
    errorState: "ready",
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
    fetchDurationMs: null,
    ...overrides,
  };
}

function providerSummary(
  overrides: Partial<DashboardProviderSummary> = {},
): DashboardProviderSummary {
  return {
    provider: "claude",
    accountId: "acct-1",
    usedPercent: 20,
    remainingPercent: 80,
    resetsAt: null,
    lastSampleAt: 1000,
    ...overrides,
  };
}

function trendPoint(overrides: Partial<UsageTrendPoint> = {}): UsageTrendPoint {
  return {
    provider: "claude",
    accountId: "acct-1",
    bucketStart: 0,
    usedPercent: 10,
    remainingPercent: 90,
    sampleCount: 1,
    ...overrides,
  };
}

function snapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    generatedAt: 1000,
    rangeSince: 0,
    rangeUntil: 1000,
    grain: "daily",
    timezone: "UTC",
    availability: {
      firstSampleAt: null,
      lastSampleAt: null,
      sampleCount: 0,
      hasCostData: false,
      hasTokenData: false,
      hasRequestData: false,
      hasModelData: false,
    },
    providers: [],
    usageTrend: [],
    spendTrend: [],
    ...overrides,
  };
}

describe("rankProvidersByShare", () => {
  it("returns [] when no provider has usage", () => {
    expect(rankProvidersByShare([])).toEqual([]);
    expect(rankProvidersByShare([providerSummary({ usedPercent: 0 })])).toEqual([]);
  });

  it("ranks by descending share, summing to 1", () => {
    const ranked = rankProvidersByShare([
      providerSummary({ provider: "claude", usedPercent: 30 }),
      providerSummary({ provider: "codex", usedPercent: 70 }),
    ]);
    expect(ranked.map((r) => r.provider)).toEqual(["codex", "claude"]);
    expect(ranked[0].share).toBeCloseTo(0.7);
    expect(ranked[1].share).toBeCloseTo(0.3);
  });

  it("never fabricates a 100% single-provider slice from a lone real data point", () => {
    const ranked = rankProvidersByShare([providerSummary({ usedPercent: 42 })]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].share).toBe(1);
    expect(ranked[0].usedPercent).toBe(42); // real value, not invented
  });
});

describe("rankProvidersByResetTime", () => {
  it("returns [] when no provider has a real future reset", () => {
    expect(rankProvidersByResetTime([])).toEqual([]);
    expect(rankProvidersByResetTime([provider({ primary: rateWindow({ resetsAt: null }) })])).toEqual(
      [],
    );
  });

  it("excludes a provider whose reset has already passed", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const ranked = rankProvidersByResetTime([
      provider({ primary: rateWindow({ resetsAt: past }), selectedMetric: rateWindow({ resetsAt: past }) }),
    ]);
    expect(ranked).toEqual([]);
  });

  it("orders real future resets soonest-first", () => {
    const soon = new Date(Date.now() + 30 * 60_000).toISOString();
    const later = new Date(Date.now() + 5 * 60 * 60_000).toISOString();
    const ranked = rankProvidersByResetTime([
      provider({
        providerId: "codex",
        displayName: "Codex",
        primary: rateWindow({ resetsAt: later }),
        selectedMetric: rateWindow({ resetsAt: later }),
      }),
      provider({
        providerId: "claude",
        displayName: "Claude",
        primary: rateWindow({ resetsAt: soon }),
        selectedMetric: rateWindow({ resetsAt: soon }),
      }),
    ]);
    expect(ranked.map((r) => r.providerId)).toEqual(["claude", "codex"]);
  });

  it("excludes a provider that needs authentication rather than showing a stale reset", () => {
    const soon = new Date(Date.now() + 30 * 60_000).toISOString();
    const ranked = rankProvidersByResetTime([
      provider({
        errorState: "needsAuthentication",
        primary: rateWindow({ resetsAt: soon }),
        selectedMetric: rateWindow({ resetsAt: soon }),
      }),
    ]);
    expect(ranked).toEqual([]);
  });
});

describe("compareTrendHalves", () => {
  it("refuses to compute a comparison from fewer than 4 buckets", () => {
    expect(compareTrendHalves([trendPoint(), trendPoint({ bucketStart: 1 })])).toEqual({
      available: false,
    });
  });

  it("computes a real delta from real halves once there is enough data", () => {
    const trend = [
      trendPoint({ bucketStart: 0, usedPercent: 10 }),
      trendPoint({ bucketStart: 1, usedPercent: 10 }),
      trendPoint({ bucketStart: 2, usedPercent: 30 }),
      trendPoint({ bucketStart: 3, usedPercent: 30 }),
    ];
    const result = compareTrendHalves(trend);
    expect(result).toEqual({ available: true, deltaPercentPoints: 20 });
  });
});

describe("buildAlerts", () => {
  const settings = { highUsageThreshold: 70, criticalUsageThreshold: 90 };

  it("returns [] for a healthy, low-usage provider set", () => {
    expect(buildAlerts([provider({ primary: rateWindow({ usedPercent: 10 }) })], settings)).toEqual(
      [],
    );
  });

  it("flags auth-required as critical", () => {
    const alerts = buildAlerts([provider({ errorState: "needsAuthentication" })], settings);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: "authRequired", severity: "critical" });
  });

  it("flags quota warning vs critical using the user's own thresholds, not a hardcoded number", () => {
    const warning = buildAlerts(
      [provider({ primary: rateWindow({ usedPercent: 75 }) })],
      settings,
    );
    expect(warning[0]).toMatchObject({ kind: "quotaWarning" });

    const critical = buildAlerts(
      [provider({ primary: rateWindow({ usedPercent: 95 }) })],
      settings,
    );
    expect(critical[0]).toMatchObject({ kind: "quotaCritical" });
  });

  it("flags a reset happening within the next hour", () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const alerts = buildAlerts(
      [provider({ primary: rateWindow({ usedPercent: 10, resetsAt: soon }) })],
      settings,
    );
    expect(alerts.some((a) => a.kind === "resetSoon")).toBe(true);
  });

  it("sorts critical alerts before warnings", () => {
    const alerts = buildAlerts(
      [
        provider({ providerId: "a", primary: rateWindow({ usedPercent: 75 }) }),
        provider({ providerId: "b", errorState: "expiredSession" }),
      ],
      settings,
    );
    expect(alerts[0].severity).toBe("critical");
  });
});

describe("resolveDataStatus", () => {
  it("reports collecting/unavailable/not-verified when there is no real data yet", () => {
    const status = resolveDataStatus(snapshot().availability);
    expect(status).toEqual({
      historyState: "collecting",
      quotaState: "live",
      costState: "unavailable",
      pricingState: "notVerified",
    });
  });

  it("never reports pricing as verified -- that is Phase 4's job", () => {
    const status = resolveDataStatus(
      snapshot({
        availability: {
          firstSampleAt: 0,
          lastSampleAt: 1000,
          sampleCount: 500,
          hasCostData: true,
          hasTokenData: false,
          hasRequestData: false,
          hasModelData: false,
        },
      }).availability,
    );
    expect(status.pricingState).toBe("notVerified");
    expect(status.costState).toBe("estimated");
  });
});

describe("availableHistoryDays", () => {
  it("returns 0 when there is no real span", () => {
    expect(availableHistoryDays(snapshot().availability)).toBe(0);
  });

  it("computes the real elapsed span in whole days", () => {
    const days = availableHistoryDays(
      snapshot({
        availability: {
          firstSampleAt: 0,
          lastSampleAt: 4 * 86_400 + 3600,
          sampleCount: 10,
          hasCostData: false,
          hasTokenData: false,
          hasRequestData: false,
          hasModelData: false,
        },
      }).availability,
    );
    expect(days).toBe(4);
  });
});

describe("computeKpis", () => {
  const settings = { highUsageThreshold: 70, criticalUsageThreshold: 90 };

  it("reports null highest-usage/next-reset when nothing is connected", () => {
    const kpis = computeKpis({
      liveProviders: [provider({ errorState: "needsAuthentication" })],
      snapshot: null,
      settings,
    });
    expect(kpis.activeProviderCount).toBe(0);
    expect(kpis.highestUsageProvider).toBeNull();
    expect(kpis.nextReset).toBeNull();
    expect(kpis.estimatedSpendTotal).toBeNull();
  });

  it("computes real highest-usage and next-reset from connected providers", () => {
    const soon = new Date(Date.now() + 3600_000).toISOString();
    const kpis = computeKpis({
      liveProviders: [
        provider({ providerId: "a", primary: rateWindow({ usedPercent: 20 }) }),
        provider({
          providerId: "b",
          primary: rateWindow({ usedPercent: 80, resetsAt: soon }),
        }),
      ],
      snapshot: null,
      settings,
    });
    expect(kpis.highestUsageProvider?.providerId).toBe("b");
    expect(kpis.nextReset?.providerId).toBe("b");
  });

  it("only totals estimated spend when the snapshot actually has cost data", () => {
    const withoutCost = computeKpis({
      liveProviders: [],
      snapshot: snapshot({ spendTrend: [] }),
      settings,
    });
    expect(withoutCost.estimatedSpendTotal).toBeNull();
  });

  it("PHASE 4 regression: never sums a cumulative-period reading across time buckets of the same series (would double/triple count the same running total)", () => {
    const availability = {
      firstSampleAt: 0,
      lastSampleAt: 100,
      sampleCount: 5,
      hasCostData: true,
      hasTokenData: false,
      hasRequestData: false,
      hasModelData: false,
    };
    // Same provider+account, three buckets -- each is the provider's own
    // running month-to-date total at that point in time, NOT a delta.
    // The pre-Phase-4 bug summed all three (1.5 + 2.25 + 3.0 = 6.75),
    // inflating the KPI 3x. The correct total is just the latest
    // reading for that series: 3.0.
    const kpis = computeKpis({
      liveProviders: [],
      snapshot: snapshot({
        availability,
        spendTrend: [
          { provider: "claude", accountId: "a1", bucketStart: 0, costUsed: 1.5 },
          { provider: "claude", accountId: "a1", bucketStart: 86400, costUsed: 2.25 },
          { provider: "claude", accountId: "a1", bucketStart: 172800, costUsed: 3.0 },
        ],
      }),
      settings,
    });
    expect(kpis.estimatedSpendTotal).toBeCloseTo(3.0);
  });

  it("sums the latest reading across genuinely independent provider/account series (legitimate -- these are different real totals, not the same one counted twice)", () => {
    const availability = {
      firstSampleAt: 0,
      lastSampleAt: 100,
      sampleCount: 5,
      hasCostData: true,
      hasTokenData: false,
      hasRequestData: false,
      hasModelData: false,
    };
    const kpis = computeKpis({
      liveProviders: [],
      snapshot: snapshot({
        availability,
        spendTrend: [
          // Claude a1: two buckets, only the latest (2.25) should count.
          { provider: "claude", accountId: "a1", bucketStart: 0, costUsed: 1.5 },
          { provider: "claude", accountId: "a1", bucketStart: 86400, costUsed: 2.25 },
          // Codex a1: one bucket, counts in full.
          { provider: "codex", accountId: "a1", bucketStart: 86400, costUsed: 4.0 },
        ],
      }),
      settings,
    });
    expect(kpis.estimatedSpendTotal).toBeCloseTo(6.25);
  });
});
