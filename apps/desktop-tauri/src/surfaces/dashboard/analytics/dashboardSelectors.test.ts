import { describe, expect, it } from "vitest";
import {
  availableHistoryDays,
  buildAlerts,
  compareTrendHalves,
  computeKpis,
  rankProvidersByResetTime,
  rankProviderQuotas,
  summarizeUsageTrend,
  resolveDataStatus,
} from "./dashboardSelectors";
import type {
  CostContract,
  DashboardProviderSummary,
  DashboardSnapshot,
  ProviderUsageSnapshot,
  SpendTrendPoint,
  UsageTrendPoint,
} from "../../../types/bridge";

function rateWindow(overrides: Partial<ProviderUsageSnapshot["primary"]> = {}) {
  return {
    usedPercent: 20,
    remainingPercent: 100 - (overrides.usedPercent ?? 20),
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

function costContract(overrides: Partial<CostContract> = {}): CostContract {
  return {
    origin: "unavailable",
    quantityKind: "unknown",
    measurementKind: "unknown",
    currencyCode: null,
    period: "unknown",
    availability: "unavailable",
    pricingStatus: "notRequired",
    ...overrides,
  };
}

function spendPoint(overrides: Partial<SpendTrendPoint> = {}): SpendTrendPoint {
  return {
    provider: "claude",
    accountId: "acct-1",
    bucketStart: 0,
    costUsed: 0,
    currencyCode: "USD",
    measurementKind: "cumulative",
    quantityKind: "spend",
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
    costContract: costContract(),
    ...overrides,
  };
}

describe("rankProviderQuotas", () => {
  it("preserves independent percentages, including real zero", () => {
    const result = rankProviderQuotas([providerSummary({provider: "a", usedPercent: 80}), providerSummary({provider: "b", usedPercent: 80}), providerSummary({provider: "c", usedPercent: 0})]);
    expect(result.map(p => p.usedPercent)).toEqual([80, 80, 0]);
    expect(result.every(p => !("share" in p))).toBe(true);
  });
  it("never turns a lone 42% quota into 100%", () => {
    expect(rankProviderQuotas([providerSummary({usedPercent: 42})])[0].usedPercent).toBe(42);
  });
  it("rejects unknown or invalid observations", () => {
    expect(rankProviderQuotas([providerSummary({usedPercent: NaN}), providerSummary({usedPercent: 101})])).toEqual([]);
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
  it("reports collecting/unavailable/not-required when there is no real data yet", () => {
    const status = resolveDataStatus(snapshot());
    expect(status).toEqual({
      historyState: "collecting",
      quotaState: "live",
      costState: "unavailable",
      pricingState: "notRequired",
    });
  });

  it("PHASE 4A: real provider-reported cost data is labeled providerReported, never estimated/verified", () => {
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
        costContract: costContract({
          origin: "providerReported",
          quantityKind: "spend",
          measurementKind: "cumulative",
          currencyCode: "USD",
          period: "Monthly",
          availability: "available",
        }),
      }),
    );
    expect(status.pricingState).toBe("notRequired");
    expect(status.costState).toBe("providerReportedSpend");
  });

  it("PHASE 4A.1: a provider-reported BALANCE is never labeled providerReportedSpend", () => {
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
        costContract: costContract({
          origin: "providerReported",
          quantityKind: "balance",
          measurementKind: "pointInTime",
          currencyCode: "USD",
          period: "balance",
          availability: "available",
        }),
      }),
    );
    expect(status.costState).toBe("providerReportedBalance");
  });

  it("PHASE 4A.1: a provider-reported CREDITS figure gets its own costState", () => {
    const status = resolveDataStatus(
      snapshot({
        availability: {
          firstSampleAt: 0,
          lastSampleAt: 1000,
          sampleCount: 10,
          hasCostData: true,
          hasTokenData: false,
          hasRequestData: false,
          hasModelData: false,
        },
        costContract: costContract({
          origin: "providerReported",
          quantityKind: "credits",
          measurementKind: "pointInTime",
          currencyCode: "USD",
          period: "Credits",
          availability: "available",
        }),
      }),
    );
    expect(status.costState).toBe("providerReportedCredits");
  });

  it("PHASE 4A: legacy-ambiguous cost rows never report as providerReported", () => {
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
        costContract: costContract({ availability: "legacyAmbiguous" }),
      }),
    );
    expect(status.costState).toBe("legacyAmbiguous");
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

  it("uses the highest and earliest physical windows regardless of display selection", () => {
    const soon = new Date(Date.now() + 1800_000).toISOString();
    const live = provider({primary: rateWindow({usedPercent: 10}),
      selectedMetric: rateWindow({usedPercent: 1}),
      secondary: rateWindow({usedPercent: 96, resetsAt: soon})});
    const kpis = computeKpis({liveProviders: [live], snapshot: null, settings});
    expect(kpis.highestUsageProvider?.usedPercent).toBe(96);
    expect(kpis.nextReset?.resetsAt).toBe(soon);
    expect(buildAlerts([live], settings).map(alert => alert.kind)).toEqual(["quotaCritical", "resetSoon"]);
  });

  it("reports null highest-usage/next-reset when nothing is connected", () => {
    const kpis = computeKpis({
      liveProviders: [provider({ errorState: "needsAuthentication" })],
      snapshot: null,
      settings,
    });
    expect(kpis.activeProviderCount).toBe(0);
    expect(kpis.highestUsageProvider).toBeNull();
    expect(kpis.nextReset).toBeNull();
    expect(kpis.reportedSpendTotal).toBeNull();
    expect(kpis.reportedSpendCurrency).toBeNull();
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

  it("only totals reported spend when the snapshot's cost contract says a total can be trusted", () => {
    const withoutCost = computeKpis({
      liveProviders: [],
      snapshot: snapshot({ spendTrend: [] }),
      settings,
    });
    expect(withoutCost.reportedSpendTotal).toBeNull();
    expect(withoutCost.reportedSpendCurrency).toBeNull();
  });

  const cumulativeAvailability = {
    firstSampleAt: 0,
    lastSampleAt: 100,
    sampleCount: 5,
    hasCostData: true,
    hasTokenData: false,
    hasRequestData: false,
    hasModelData: false,
  };
  const cumulativeContract = costContract({
    origin: "providerReported",
    quantityKind: "spend",
    measurementKind: "cumulative",
    currencyCode: "USD",
    period: "Monthly",
    availability: "available",
  });

  it("PHASE 4A regression: never sums a cumulative-period reading across time buckets of the same series (would double/triple count the same running total)", () => {
    // Same provider+account, three buckets -- each is the provider's own
    // running month-to-date total at that point in time, NOT a delta.
    // The pre-Phase-4 bug summed all three (1.5 + 2.25 + 3.0 = 6.75),
    // inflating the KPI 3x. The correct total is just the latest
    // reading for that series: 3.0.
    const kpis = computeKpis({
      liveProviders: [],
      snapshot: snapshot({
        availability: cumulativeAvailability,
        costContract: cumulativeContract,
        spendTrend: [
          spendPoint({ bucketStart: 0, costUsed: 1.5 }),
          spendPoint({ bucketStart: 86400, costUsed: 2.25 }),
          spendPoint({ bucketStart: 172800, costUsed: 3.0 }),
        ],
      }),
      settings,
    });
    expect(kpis.reportedSpendTotal).toBeCloseTo(3.0);
    expect(kpis.reportedSpendCurrency).toBe("USD");
  });

  it("sums the latest reading across genuinely independent provider/account series (legitimate -- these are different real totals, not the same one counted twice)", () => {
    const kpis = computeKpis({
      liveProviders: [],
      snapshot: snapshot({
        availability: cumulativeAvailability,
        costContract: cumulativeContract,
        spendTrend: [
          // Claude a1: two buckets, only the latest (2.25) should count.
          spendPoint({ provider: "claude", accountId: "a1", bucketStart: 0, costUsed: 1.5 }),
          spendPoint({ provider: "claude", accountId: "a1", bucketStart: 86400, costUsed: 2.25 }),
          // Codex a1: one bucket, counts in full.
          spendPoint({ provider: "codex", accountId: "a1", bucketStart: 86400, costUsed: 4.0 }),
        ],
      }),
      settings,
    });
    expect(kpis.reportedSpendTotal).toBeCloseTo(6.25);
    expect(kpis.reportedSpendCurrency).toBe("USD");
  });

  it("PHASE 4A.1 hard rule: a point-in-time BALANCE is never shown as Spend -- returns unavailable, not the balance number", () => {
    const kpis = computeKpis({
      liveProviders: [],
      snapshot: snapshot({
        availability: { ...cumulativeAvailability },
        costContract: costContract({
          origin: "providerReported",
          quantityKind: "balance",
          measurementKind: "pointInTime",
          currencyCode: "USD",
          period: "balance",
          availability: "available",
        }),
        spendTrend: [
          spendPoint({
            provider: "zenmux",
            bucketStart: 0,
            costUsed: 30,
            quantityKind: "balance",
            measurementKind: "pointInTime",
          }),
        ],
      }),
      settings,
    });
    expect(kpis.reportedSpendTotal).toBeNull();
    expect(kpis.reportedSpendCurrency).toBeNull();
  });

  it("PHASE 4A.1 hard rule: a CREDITS figure (e.g. Codex's live balance) is never shown as Spend", () => {
    const kpis = computeKpis({
      liveProviders: [],
      snapshot: snapshot({
        availability: { ...cumulativeAvailability },
        costContract: costContract({
          origin: "providerReported",
          quantityKind: "credits",
          measurementKind: "pointInTime",
          currencyCode: "USD",
          period: "Credits",
          availability: "available",
        }),
        spendTrend: [
          spendPoint({
            provider: "codex",
            bucketStart: 0,
            costUsed: 12,
            quantityKind: "credits",
            measurementKind: "pointInTime",
          }),
        ],
      }),
      settings,
    });
    expect(kpis.reportedSpendTotal).toBeNull();
  });

  it("PHASE 4A: mixed measurement kinds across providers (same quantity kind) collapse to unavailable, never a combined guess", () => {
    const kpis = computeKpis({
      liveProviders: [],
      snapshot: snapshot({
        availability: cumulativeAvailability,
        // The Rust side already collapses a mixed set to "unknown" --
        // this proves the TS selector respects that verdict rather than
        // re-deriving its own (wrong) answer from the raw points.
        costContract: costContract({
          origin: "providerReported",
          quantityKind: "spend",
          measurementKind: "unknown",
          currencyCode: null,
          period: "unknown",
          availability: "available",
        }),
        spendTrend: [
          spendPoint({ provider: "claude", bucketStart: 0, costUsed: 12, measurementKind: "cumulative" }),
          spendPoint({ provider: "zenmux", bucketStart: 0, costUsed: 30, measurementKind: "pointInTime" }),
        ],
      }),
      settings,
    });
    expect(kpis.reportedSpendTotal).toBeNull();
  });

  it("PHASE 4A.1: mixed quantity kinds (same temporal shape) collapse to unavailable -- proves the two dimensions are checked independently", () => {
    const kpis = computeKpis({
      liveProviders: [],
      snapshot: snapshot({
        availability: cumulativeAvailability,
        costContract: costContract({
          origin: "providerReported",
          quantityKind: "unknown", // Rust already proved quantity kinds differ
          measurementKind: "cumulative", // ...even though temporal shape matches
          currencyCode: "USD",
          period: "Monthly",
          availability: "available",
        }),
        spendTrend: [
          spendPoint({ provider: "claude", bucketStart: 0, costUsed: 12, quantityKind: "spend" }),
          spendPoint({ provider: "zenmux", bucketStart: 0, costUsed: 30, quantityKind: "balance" }),
        ],
      }),
      settings,
    });
    expect(kpis.reportedSpendTotal).toBeNull();
  });

  it("PHASE 4A: mixed currencies collapse to unavailable rather than summing USD + EUR", () => {
    const kpis = computeKpis({
      liveProviders: [],
      snapshot: snapshot({
        availability: cumulativeAvailability,
        costContract: costContract({
          origin: "providerReported",
          quantityKind: "spend",
          measurementKind: "cumulative",
          currencyCode: null, // Rust already proved currencies differ
          period: "Monthly",
          availability: "available",
        }),
        spendTrend: [
          spendPoint({ provider: "claude", bucketStart: 0, costUsed: 12, currencyCode: "USD" }),
          spendPoint({ provider: "mistral", bucketStart: 0, costUsed: 9, currencyCode: "EUR" }),
        ],
      }),
      settings,
    });
    expect(kpis.reportedSpendTotal).toBeNull();
    expect(kpis.reportedSpendCurrency).toBeNull();
  });

  it("PHASE 4A: legacy-ambiguous cost data (pre-Phase-4A rows) never contributes to the total", () => {
    const kpis = computeKpis({
      liveProviders: [],
      snapshot: snapshot({
        availability: cumulativeAvailability,
        costContract: costContract({
          origin: "unavailable",
          measurementKind: "unknown",
          currencyCode: null,
          period: "unknown",
          availability: "legacyAmbiguous",
        }),
        spendTrend: [spendPoint({ bucketStart: 0, costUsed: 5 })],
      }),
      settings,
    });
    expect(kpis.reportedSpendTotal).toBeNull();
  });

  // ── Phase 4A owner section 9: quota % must never feed a monetary
  // calculation. Hard regression: an extreme (98%) quota usage figure
  // must leave the reported-spend total completely unaffected -- it is
  // computed exclusively from `spendTrend`'s own dollar readings, never
  // from `usedPercent`/`remainingPercent`, a subscription price, or any
  // rate-limit/reset figure. If a future change wired usedPercent into
  // the spend calculation (e.g. `spend = usedPercent * planPrice`), this
  // test would catch it: the two providers below have identical spend
  // data and wildly different quota usage, so the totals MUST be equal.
  it("PHASE 4A hard regression: quota %/subscription usage/reset data never feeds the monetary total", () => {
    const lowQuotaProvider = provider({
      providerId: "claude",
      primary: rateWindow({ usedPercent: 2, resetsAt: null }),
    });
    const highQuotaProvider = provider({
      providerId: "claude",
      primary: rateWindow({ usedPercent: 98, resetsAt: null }),
    });
    const spendSnapshot = snapshot({
      availability: cumulativeAvailability,
      costContract: cumulativeContract,
      spendTrend: [spendPoint({ provider: "claude", accountId: "acct-1", bucketStart: 0, costUsed: 12.5 })],
    });

    const atLowQuota = computeKpis({ liveProviders: [lowQuotaProvider], snapshot: spendSnapshot, settings });
    const atHighQuota = computeKpis({ liveProviders: [highQuotaProvider], snapshot: spendSnapshot, settings });

    // Same underlying spend data, wildly different quota% -- the reported
    // spend total must be identical in both cases (12.5), never
    // 98% * anything or 2% * anything.
    expect(atLowQuota.reportedSpendTotal).toBe(12.5);
    expect(atHighQuota.reportedSpendTotal).toBe(12.5);
    expect(atLowQuota.reportedSpendTotal).toBe(atHighQuota.reportedSpendTotal);
  });
});


describe("scoped observations", () => {
 it("keeps accounts separate and uses the last bucket, never a percentage average", () => {
   const rows = summarizeUsageTrend([trendPoint({accountId:"a",bucketStart:1,usedPercent:80}),trendPoint({accountId:"a",bucketStart:2,usedPercent:10}),trendPoint({accountId:"b",bucketStart:1,usedPercent:90})]);
   expect(rows.map(p=>[p.accountId,p.usedPercent])).toEqual([["a",10],["b",90]]);
 });
 it("refuses trends assembled from different accounts", () => {
   expect(compareTrendHalves([0,1,2,3].map((n)=>trendPoint({accountId:String(n%2),bucketStart:n})))).toEqual({available:false});
 });
 it("refuses nonfinite monetary totals even with an available contract", () => {
   const kpis=computeKpis({liveProviders:[],settings:{highUsageThreshold:80,criticalUsageThreshold:95},snapshot:snapshot({costContract:costContract({origin:"providerReported",availability:"available",quantityKind:"spend",measurementKind:"cumulative",currencyCode:"USD"}),spendTrend:[spendPoint({costUsed:NaN})]})});
   expect(kpis.reportedSpendTotal).toBeNull();
 });
});

it("does not promote an errored Ready snapshot into healthy KPIs or quota alerts", () => {
  const p = provider({error: "refresh failed", primary: rateWindow({usedPercent: 98})});
  const settings = {highUsageThreshold: 80, criticalUsageThreshold: 95};
  const kpis = computeKpis({liveProviders: [p], snapshot: null, settings});
  expect(kpis.activeProviderCount).toBe(0);
  expect(kpis.highestUsageProvider).toBeNull();
  expect(buildAlerts([p], settings).map(a=>a.kind)).toEqual(["unavailable"]);
});
