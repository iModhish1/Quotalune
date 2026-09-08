/**
 * Per-scenario deterministic profile generation (owner Phase 5.2 section
 * 8). Each scenario is a fixed recipe over `(index, count, rng)` -- never
 * "completely random meaningless values" (the phase's own words): a
 * given seed always reproduces the same numbers, and the shape of each
 * scenario is intentional (a showcase spread, a reset-soon cluster, a
 * mixed-status set, etc.), not uniform noise.
 *
 * These profiles feed real thresholds (`AlertsPanel`'s `buildAlerts`,
 * the 3D scene's `alertLevelFor`) rather than fabricating alert objects
 * directly -- a provider placed above the user's own configured
 * `highUsageThreshold`/near its `resetsAt` produces a real alert through
 * the SAME selector production data does (owner section 13).
 */
import type { DemoScenario } from "../types/bridge";
import type { ProviderStateKind } from "../types/bridge";
import { type Rng, randRange } from "./rng";

export interface DemoProviderProfile {
  usedPercent: number;
  errorState: ProviderStateKind;
  /** `null` means "no meaningful reset countdown" (e.g. a provider that
   *  needs sign-in first) -- never a fabricated date. */
  resetOffsetMs: number | null;
}

/** Owner section 10's suggested distribution: ~45m, ~2h, ~5h, ~12h, ~1d,
 *  ~2d -- real Date-based offsets from "now", not hardcoded stale dates. */
const RESET_OFFSETS_MS = [
  45 * 60_000,
  2 * 3_600_000,
  5 * 3_600_000,
  12 * 3_600_000,
  24 * 3_600_000,
  48 * 3_600_000,
];

/** Owner section 21's suggested clusters: within 30m / 2h / 6h. */
const RESET_SOON_OFFSETS_MS = [30 * 60_000, 2 * 3_600_000, 6 * 3_600_000];

/** Owner section 9's example pattern for the default six-provider
 *  showcase -- exact values, applied in curated-list order. Additional
 *  providers past the first six (a larger custom/curated count) get a
 *  deterministic in-range value instead of repeating this fixed list. */
const CONNECTED_SHOWCASE_VALUES = [68, 42, 81, 34, 57, 73];

/** Owner section 40: at least one high, one moderate, one low, one
 *  rising-looking, one stable-looking, one recently-reset-looking
 *  provider in the default showcase -- `providerSnapshots.ts`'s history
 *  generator reads this same index to pick a trend shape per provider,
 *  so the "current" number and the "7-day trend" stay consistent with
 *  each other for the same provider. */
export type DemoTrendShape = "gradualRise" | "stable" | "lateSpike" | "resetCycle" | "moderateOscillation";
const TREND_SHAPES: readonly DemoTrendShape[] = [
  "gradualRise",
  "stable",
  "lateSpike",
  "resetCycle",
  "moderateOscillation",
];

export function trendShapeFor(index: number): DemoTrendShape {
  return TREND_SHAPES[index % TREND_SHAPES.length];
}

export function buildScenarioProfile(
  scenario: DemoScenario,
  index: number,
  rng: Rng,
): DemoProviderProfile {
  switch (scenario) {
    case "connectedShowcase": {
      const usedPercent =
        index < CONNECTED_SHOWCASE_VALUES.length
          ? CONNECTED_SHOWCASE_VALUES[index]
          : Math.round(randRange(rng, 25, 88));
      return {
        usedPercent,
        errorState: "ready",
        resetOffsetMs: RESET_OFFSETS_MS[index % RESET_OFFSETS_MS.length],
      };
    }
    case "balancedActivity": {
      const buckets = [15, 35, 55, 75];
      const base = buckets[index % buckets.length];
      const usedPercent = Math.min(92, Math.max(5, Math.round(base + randRange(rng, -8, 8))));
      return {
        usedPercent,
        errorState: "ready",
        resetOffsetMs: RESET_OFFSETS_MS[index % RESET_OFFSETS_MS.length],
      };
    }
    case "highUsage": {
      const usedPercent = Math.round(randRange(rng, 75, 95));
      return {
        usedPercent,
        errorState: "ready",
        resetOffsetMs: RESET_OFFSETS_MS[index % RESET_OFFSETS_MS.length],
      };
    }
    case "resetSoon": {
      const usedPercent = Math.round(randRange(rng, 40, 80));
      return {
        usedPercent,
        errorState: "ready",
        resetOffsetMs: RESET_SOON_OFFSETS_MS[index % RESET_SOON_OFFSETS_MS.length],
      };
    }
    case "mixedStatus": {
      const states: ProviderStateKind[] = [
        "ready",
        "ready",
        "needsAuthentication",
        "ready",
        "expiredSession",
        "ready",
      ];
      const errorState = states[index % states.length];
      const usedPercent = errorState === "ready" ? Math.round(randRange(rng, 20, 90)) : 0;
      return {
        usedPercent,
        errorState,
        resetOffsetMs: errorState === "ready" ? RESET_OFFSETS_MS[index % RESET_OFFSETS_MS.length] : null,
      };
    }
    case "monetarySemantics": {
      // Provider selection for this scenario is overridden by the caller
      // (providerSnapshots.ts) to the four fixed real providers that
      // demonstrate Spend/Balance/Credits/Unavailable -- usage values
      // here just need to look plausible, not carry scenario-specific
      // meaning themselves.
      return {
        usedPercent: Math.round(randRange(rng, 20, 70)),
        errorState: "ready",
        resetOffsetMs: RESET_OFFSETS_MS[index % RESET_OFFSETS_MS.length],
      };
    }
    default: {
      const exhaustiveCheck: never = scenario;
      throw new Error(`Unhandled demo scenario: ${String(exhaustiveCheck)}`);
    }
  }
}
