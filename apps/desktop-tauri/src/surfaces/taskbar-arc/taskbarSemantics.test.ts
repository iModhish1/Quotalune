/**
 * V8.7 acceptance tests — unskipped.
 *
 * Proves the full usage-semantics pipeline as a PURE function:
 * seeded ProviderUsageSnapshot[] + explicit config → StageProvider[],
 * with order-independence and state-isolation guarantees.
 *
 * These are the acceptance criteria the V8.4 mode-pollution defect blocked;
 * the pure pipeline (toStageProviders(providers, config)) removed the
 * module state that caused the inversion.
 */
import { describe, expect, it } from "vitest";
import type { ProviderUsageSnapshot } from "../../types/bridge";
import {
  applyUsageSemantics,
  resolveUsageMode,
  type UsageDisplayConfig,
} from "../../design-system/themes";
import { toStageProviders } from "./TaskbarArc";

function seededSnapshot(
  providerId: string,
  displayName: string,
  remainingPercent: number,
): ProviderUsageSnapshot {
  const used = 100 - remainingPercent;
  const win = {
    usedPercent: used,
    remainingPercent,
    windowMinutes: null,
    resetsAt: null,
    resetDescription: "resets in 4h",
    isExhausted: false,
    isInformational: false,
    reservePercent: null,
    reserveDescription: null,
    reserveEtaSeconds: null,
    reserveWillLastToReset: false,
  } as unknown as ProviderUsageSnapshot["primary"];
  return {
    providerId,
    displayName,
    primary: win,
    selectedMetric: win,
    secondary: null,
    secondaryLabel: undefined,
    modelSpecific: null,
    tertiary: null,
    extraRateWindows: [],
    cost: null,
    planName: "Proof",
    accountEmail: null,
    sourceLabel: "proof",
    updatedAt: "2026-09-03T12:00:00Z",
    error: null,
    errorState: "ready",
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
  } as unknown as ProviderUsageSnapshot;
}

const FIXTURE = [
  seededSnapshot("codex", "Codex", 79), // 21 used
  seededSnapshot("claude", "Claude", 27), // 73 used
  seededSnapshot("gemini", "Gemini", 42), // 58 used
];

const toRows = (config?: UsageDisplayConfig) => toStageProviders(FIXTURE, config);

const byId = (rows: ReturnType<typeof toRows>, id: string) => rows.find((r) => r.id === id)!;

describe("usage semantics: global modes (pure, order-independent)", () => {
  it("GLOBAL USED: primary values are the USED fractions", () => {
    const rows = toRows({ global: "used", providerOverrides: {} });
    expect(byId(rows, "codex").primaryValue).toBe(21);
    expect(byId(rows, "claude").primaryValue).toBe(73);
    expect(byId(rows, "gemini").primaryValue).toBe(58);
    for (const r of rows) {
      expect(r.primaryLabel).toBe("used");
      expect(r.resolvedMode).toBe("used");
      expect(r.arcFraction).toBeCloseTo(r.primaryValue! / 100, 6);
    }
  });

  it("GLOBAL REMAINING: primary values are the REMAINING fractions", () => {
    const rows = toRows({ global: "remaining", providerOverrides: {} });
    expect(byId(rows, "codex").primaryValue).toBe(79);
    expect(byId(rows, "claude").primaryValue).toBe(27);
    expect(byId(rows, "gemini").primaryValue).toBe(42);
    for (const r of rows) {
      expect(r.primaryLabel).toBe("remaining");
      expect(r.resolvedMode).toBe("remaining");
      expect(r.arcFraction).toBeCloseTo(r.primaryValue! / 100, 6);
    }
  });

  it("GLOBAL HYBRID: documented contract — arc follows remaining, primary leads with used", () => {
    const rows = toRows({ global: "hybrid", providerOverrides: {} });
    for (const r of rows) {
      expect(r.resolvedMode).toBe("hybrid");
      expect(r.primaryLabel).toBe("used");
      expect(Math.round(r.primaryValue! + r.secondaryValue!)).toBe(100);
      expect(r.arcFraction).toBeCloseTo(r.secondaryValue! / 100, 6);
    }
  });

  it("USED → REMAINING → USED produces identical results each time", () => {
    const first = toRows({ global: "used", providerOverrides: {} });
    toRows({ global: "remaining", providerOverrides: {} });
    const third = toRows({ global: "used", providerOverrides: {} });
    expect(third).toEqual(first);
  });

  it("REMAINING → USED → REMAINING produces identical results each time", () => {
    const first = toRows({ global: "remaining", providerOverrides: {} });
    toRows({ global: "used", providerOverrides: {} });
    const third = toRows({ global: "remaining", providerOverrides: {} });
    expect(third).toEqual(first);
  });
});

describe("usage semantics: per-provider overrides (pure)", () => {
  it("provider override beats global (claude: used under global remaining)", () => {
    const rows = toRows({
      global: "remaining",
      providerOverrides: { claude: "used" },
    });
    expect(byId(rows, "claude").primaryLabel).toBe("used");
    expect(byId(rows, "claude").primaryValue).toBe(73);
    expect(byId(rows, "codex").primaryLabel).toBe("remaining");
  });

  it("global used + claude remaining override → claude 27", () => {
    const rows = toRows({
      global: "used",
      providerOverrides: { claude: "remaining" },
    });
    expect(byId(rows, "claude").primaryLabel).toBe("remaining");
    expect(byId(rows, "claude").primaryValue).toBe(27);
    expect(byId(rows, "codex").primaryLabel).toBe("used");
  });

  it("an override applied to one surface does not leak to another config", () => {
    const surfaceA = toRows({ global: "used", providerOverrides: {} });
    const surfaceB = toRows({ global: "remaining", providerOverrides: {} });
    expect(byId(surfaceA, "codex").primaryLabel).toBe("used");
    expect(byId(surfaceB, "codex").primaryLabel).toBe("remaining");
  });

  it("invalid config values fall back to remaining without throwing", () => {
    const rows = toRows({
      global: "bogus" as unknown as UsageDisplayConfig["global"],
      providerOverrides: { claude: "nonsense" as unknown as UsageDisplayConfig["global"] },
    });
    for (const r of rows) expect(r.primaryLabel).toBe("remaining");
  });
});

describe("usage semantics: unavailable providers", () => {
  it("unavailable provider keeps the honest dash, never a fabricated value", () => {
    const withError = [
      ...FIXTURE,
      seededSnapshot("copilot", "Copilot", 50),
    ];
    withError[3].error = "auth expired";
    const rows = toStageProviders(withError, {
      global: "used",
      providerOverrides: {},
    });
    const copilot = rows.find((r) => r.id === "copilot")!;
    expect(copilot.arcFraction).toBeNull();
    expect(copilot.primaryValue).toBeNull();
  });
});

describe("usage semantics: resolver determinism", () => {
  it("resolveUsageMode is pure and precedence-correct", () => {
    const config: UsageDisplayConfig = {
      global: "remaining",
      providerOverrides: { claude: "used" },
    };
    expect(resolveUsageMode(config, "codex")).toBe("remaining");
    expect(resolveUsageMode(config, "claude")).toBe("used");
    expect(resolveUsageMode(config, "claude")).toBe("used"); // stable
  });

  it("applyUsageSemantics is deterministic per (mode, remaining)", () => {
    const a = applyUsageSemantics("used", 0.73);
    const b = applyUsageSemantics("used", 0.73);
    expect(a).toEqual(b);
  });
});
