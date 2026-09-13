import { describe, expect, it } from "vitest";
import type { ProviderCatalogEntry } from "../types/bridge";
import type { DemoModeConfig } from "./types";
import {
  buildDemoProviderSnapshots,
  resolveDemoProviderIds,
} from "./providerSnapshots";
import { DEFAULT_CURATED_PROVIDER_IDS } from "./constants";

const NOW = Date.parse("2026-09-09T12:00:00Z");

function catalogEntry(id: string): ProviderCatalogEntry {
  return { id, displayName: id[0].toUpperCase() + id.slice(1), cookieDomain: null };
}

const FULL_CATALOG: ProviderCatalogEntry[] = [
  "codex",
  "claude",
  "gemini",
  "perplexity",
  "grok",
  "deepseek",
  "cursor",
  "mistral",
  "openrouter",
  "bedrock",
  "fireworks",
  "deepinfra",
  "litellm",
  "minimax",
  "openaiapi",
  "sub2api",
  "crossmodel",
  "devin",
  "neuralwatt",
  "opencodego",
  "zenmux",
  "commandcode",
  "aiand",
  "llmproxy",
].map(catalogEntry);

function config(overrides: Partial<DemoModeConfig> = {}): DemoModeConfig {
  return {
    enabled: true,
    providerMode: "curated",
    providerCount: 6,
    providerIds: [],
    scenario: "connectedShowcase",
    seed: 1,
    historyDays: 7,
    ...overrides,
  };
}

describe("resolveDemoProviderIds", () => {
  it("curated mode picks exactly the requested count", () => {
    expect(resolveDemoProviderIds(config({ providerCount: 6 }), FULL_CATALOG)).toHaveLength(6);
    expect(resolveDemoProviderIds(config({ providerCount: 12 }), FULL_CATALOG)).toHaveLength(12);
    expect(resolveDemoProviderIds(config({ providerCount: 1 }), FULL_CATALOG)).toHaveLength(1);
    expect(resolveDemoProviderIds(config({ providerCount: 24 }), FULL_CATALOG)).toHaveLength(
      Math.min(24, FULL_CATALOG.length),
    );
  });

  it("curated default six matches the real registered preferred providers, in order", () => {
    const ids = resolveDemoProviderIds(config({ providerCount: 6 }), FULL_CATALOG);
    expect(ids).toEqual(DEFAULT_CURATED_PROVIDER_IDS);
  });

  it("curated never duplicates a provider id", () => {
    const ids = resolveDemoProviderIds(config({ providerCount: 24 }), FULL_CATALOG);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("custom mode uses exactly the selected providers, filtered to ones that still exist", () => {
    const ids = resolveDemoProviderIds(
      config({ providerMode: "custom", providerIds: ["mistral", "removed-provider", "bedrock"] }),
      FULL_CATALOG,
    );
    expect(ids).toEqual(["mistral", "bedrock"]);
  });

  it("custom mode with an empty/fully-removed list falls back to curated (never zero providers while enabled)", () => {
    const ids = resolveDemoProviderIds(
      config({ providerMode: "custom", providerIds: ["nonexistent-1", "nonexistent-2"], providerCount: 6 }),
      FULL_CATALOG,
    );
    expect(ids).toHaveLength(6);
  });

  it("Monetary Semantics scenario always overrides to its fixed four real providers, regardless of mode/count", () => {
    const ids = resolveDemoProviderIds(
      config({ scenario: "monetarySemantics", providerMode: "curated", providerCount: 12 }),
      FULL_CATALOG,
    );
    expect(ids).toEqual(["claude", "codex", "sub2api", "gemini"]);
  });
});

describe("buildDemoProviderSnapshots -- determinism", () => {
  it("same seed + config + now produces byte-identical output", () => {
    const a = buildDemoProviderSnapshots(config(), FULL_CATALOG, NOW);
    const b = buildDemoProviderSnapshots(config(), FULL_CATALOG, NOW);
    expect(a).toEqual(b);
  });

  it("a different seed produces a different dataset", () => {
    // "connectedShowcase" deliberately uses a fixed example pattern for
    // the default six providers (owner section 9) rather than deriving
    // from the seed -- "balancedActivity" is a scenario that genuinely
    // draws its usage values from the seeded RNG, so it's the right one
    // to prove seed-sensitivity with.
    const scenario = "balancedActivity" as const;
    const a = buildDemoProviderSnapshots(config({ seed: 1, scenario }), FULL_CATALOG, NOW);
    const b = buildDemoProviderSnapshots(config({ seed: 2, scenario }), FULL_CATALOG, NOW);
    const changed = a.some((p, i) => p.primary.usedPercent !== b[i]?.primary.usedPercent);
    expect(changed).toBe(true);
  });

  it("disabled config returns an empty array", () => {
    expect(buildDemoProviderSnapshots(config({ enabled: false }), FULL_CATALOG, NOW)).toEqual([]);
  });

  it("provider count 6 returns exactly 6, count 12 returns exactly 12", () => {
    expect(buildDemoProviderSnapshots(config({ providerCount: 6 }), FULL_CATALOG, NOW)).toHaveLength(6);
    expect(buildDemoProviderSnapshots(config({ providerCount: 12 }), FULL_CATALOG, NOW)).toHaveLength(12);
  });

  it("every generated snapshot's sourceLabel is 'demo' -- never mistaken for real data downstream", () => {
    const snapshots = buildDemoProviderSnapshots(config(), FULL_CATALOG, NOW);
    expect(snapshots.every((p) => p.sourceLabel === "demo")).toBe(true);
  });
});

describe("buildDemoProviderSnapshots -- Phase 4 monetary semantics", () => {
  it("a Spend-classified provider (claude) never becomes Balance or Credits", () => {
    const snapshots = buildDemoProviderSnapshots(
      config({ scenario: "monetarySemantics" }),
      FULL_CATALOG,
      NOW,
    );
    const claude = snapshots.find((p) => p.providerId === "claude");
    expect(claude?.cost).not.toBeNull();
    // Spend has no `balance` field populated -- distinguishing it from a
    // Balance-classified provider's cost shape.
    expect(claude?.cost?.balance ?? null).toBeNull();
  });

  it("a Balance-classified provider (sub2api) carries a `balance` figure, never formatted as generic currency-less credits", () => {
    const snapshots = buildDemoProviderSnapshots(
      config({ scenario: "monetarySemantics" }),
      FULL_CATALOG,
      NOW,
    );
    const balanceProvider = snapshots.find((p) => p.providerId === "sub2api");
    expect(balanceProvider?.cost?.balance).not.toBeNull();
    expect(balanceProvider?.cost?.formattedBalance).toMatch(/^\$/);
  });

  it("a Credits-classified provider (codex) never gets currency formatting applied to its figure", () => {
    const snapshots = buildDemoProviderSnapshots(
      config({ scenario: "monetarySemantics" }),
      FULL_CATALOG,
      NOW,
    );
    const codex = snapshots.find((p) => p.providerId === "codex");
    expect(codex?.cost).not.toBeNull();
    expect(codex?.cost?.formattedUsed).not.toMatch(/\$/);
  });

  it("an unclassified provider (gemini) never gets a fabricated cost -- stays null (Unavailable)", () => {
    const snapshots = buildDemoProviderSnapshots(
      config({ scenario: "monetarySemantics" }),
      FULL_CATALOG,
      NOW,
    );
    const gemini = snapshots.find((p) => p.providerId === "gemini");
    expect(gemini?.cost).toBeNull();
  });

  it("no provider's raw usage percentage is ever reinterpreted as a monetary figure", () => {
    const snapshots = buildDemoProviderSnapshots(config(), FULL_CATALOG, NOW);
    for (const p of snapshots) {
      if (p.cost) {
        expect(p.cost.used).not.toBe(p.primary.usedPercent);
      }
    }
  });
});

describe("buildDemoProviderSnapshots -- Connected Showcase scenario", () => {
  it("every default provider is genuinely connected (ready), never auth-required", () => {
    const snapshots = buildDemoProviderSnapshots(config(), FULL_CATALOG, NOW);
    expect(snapshots.every((p) => p.errorState === "ready")).toBe(true);
  });

  it("has a real, believable, non-zero usage spread (not flat/identical values)", () => {
    const snapshots = buildDemoProviderSnapshots(config(), FULL_CATALOG, NOW);
    const values = new Set(snapshots.map((p) => p.primary.usedPercent));
    expect(values.size).toBeGreaterThan(1);
  });

  it("every provider has a real ISO reset timestamp derived from `now`, not a hardcoded date", () => {
    const snapshots = buildDemoProviderSnapshots(config(), FULL_CATALOG, NOW);
    for (const p of snapshots) {
      expect(p.primary.resetsAt).not.toBeNull();
      const resetMs = Date.parse(p.primary.resetsAt!);
      expect(resetMs).toBeGreaterThan(NOW);
    }
  });
});

describe("buildDemoProviderSnapshots -- Mixed Status scenario", () => {
  it("includes at least one non-ready (simulated auth-required/expired) provider", () => {
    const snapshots = buildDemoProviderSnapshots(
      config({ scenario: "mixedStatus", providerCount: 6 }),
      FULL_CATALOG,
      NOW,
    );
    expect(snapshots.some((p) => p.errorState !== "ready")).toBe(true);
  });

  it("a non-ready simulated provider's error text says 'Demo state', never a real-looking failure", () => {
    const snapshots = buildDemoProviderSnapshots(
      config({ scenario: "mixedStatus", providerCount: 6 }),
      FULL_CATALOG,
      NOW,
    );
    const notReady = snapshots.filter((p) => p.errorState !== "ready");
    expect(notReady.length).toBeGreaterThan(0);
    expect(notReady.every((p) => p.error === "Demo state")).toBe(true);
  });
});
it('keeps illustrative reset inventory inside Demo inputs with individual expiries',()=>{
 const rows=buildDemoProviderSnapshots(config({providerCount:6}),FULL_CATALOG,NOW);
 expect(rows.map(row=>row.sourceLabel)).toEqual(Array(6).fill('demo'));
 expect(rows[0].resetFacts?.bankedResetCards).toMatchObject({state:'known',value:{reportedAvailableCount:0}});
 expect(rows[3].resetFacts?.bankedResetCards).toMatchObject({state:'known',value:{reportedAvailableCount:3,cards:expect.any(Array)}});
 expect(rows[4].resetFacts?.bankedResetCards.state).toBe('unavailable');
 expect(buildDemoProviderSnapshots(config({enabled:false}),FULL_CATALOG,NOW)).toEqual([]);
});
