import { describe, expect, it } from "vitest";
import type { ProviderCatalogEntry } from "../types/bridge";
import type { DemoModeConfig } from "./types";
import { buildDemoDashboardSnapshot } from "./dashboardSnapshot";
import { buildDemoProviderSnapshots } from "./providerSnapshots";

const NOW = Date.parse("2026-09-09T12:00:00Z");

function catalogEntry(id: string): ProviderCatalogEntry {
  return { id, displayName: id, cookieDomain: null };
}

const CATALOG: ProviderCatalogEntry[] = [
  "codex",
  "claude",
  "gemini",
  "perplexity",
  "grok",
  "deepseek",
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

describe("buildDemoDashboardSnapshot", () => {
  it("is deterministic: same config + now produces identical output", () => {
    const a = buildDemoDashboardSnapshot(config(), CATALOG, "last7Days", NOW);
    const b = buildDemoDashboardSnapshot(config(), CATALOG, "last7Days", NOW);
    expect(a).toEqual(b);
  });

  it("generates exactly historyDays worth of usage-trend buckets per provider", () => {
    const snapshot7 = buildDemoDashboardSnapshot(config({ historyDays: 7 }), CATALOG, "last7Days", NOW);
    const snapshot30 = buildDemoDashboardSnapshot(config({ historyDays: 30 }), CATALOG, "last30Days", NOW);
    const perProvider7 = snapshot7.usageTrend.filter((p) => p.provider === "codex").length;
    const perProvider30 = snapshot30.usageTrend.filter((p) => p.provider === "codex").length;
    expect(perProvider7).toBe(7);
    expect(perProvider30).toBe(30);
  });

  it("2D and 3D share the exact same current-provider truth (owner section 43)", () => {
    const providerSnapshots = buildDemoProviderSnapshots(config(), CATALOG, NOW);
    const dashboardSnapshot = buildDemoDashboardSnapshot(config(), CATALOG, "last7Days", NOW);
    for (const p of providerSnapshots) {
      const summary = dashboardSnapshot.providers.find((s) => s.provider === p.providerId);
      expect(summary?.usedPercent).toBe(p.primary.usedPercent);
    }
  });

  it("costContract only claims spend when a real spend-classified demo provider exists", () => {
    const snapshot = buildDemoDashboardSnapshot(config(), CATALOG, "last7Days", NOW);
    // claude and deepseek are both real spend-classified providers in
    // this six-provider curated set.
    expect(snapshot.costContract.availability).toBe("available");
    expect(snapshot.costContract.quantityKind).toBe("spend");
    expect(snapshot.costContract.origin).toBe("providerReported");
    expect(snapshot.costContract.pricingStatus).toBe("notRequired");
  });

  it("every spendTrend point is a real spend-classified provider -- never a Balance/Credits/Unknown provider's figure", () => {
    const snapshot = buildDemoDashboardSnapshot(
      config({ scenario: "monetarySemantics" }),
      CATALOG,
      "last7Days",
      NOW,
    );
    // Monetary Semantics uses claude (spend), codex (credits), sub2api
    // (balance, not in this catalog so filtered out), gemini (unknown).
    const spendProviderIds = new Set(snapshot.spendTrend.map((p) => p.provider));
    expect(spendProviderIds.has("claude")).toBe(true);
    expect(spendProviderIds.has("codex")).toBe(false);
    expect(spendProviderIds.has("gemini")).toBe(false);
    expect(snapshot.spendTrend.every((p) => p.quantityKind === "spend")).toBe(true);
  });

  it("costContract reports unavailable when the dataset has no spend-classified provider", () => {
    const catalogWithoutSpend: ProviderCatalogEntry[] = ["gemini", "perplexity", "grok"].map(catalogEntry);
    const snapshot = buildDemoDashboardSnapshot(
      config({ providerMode: "custom", providerIds: ["gemini", "perplexity", "grok"], providerCount: 3 }),
      catalogWithoutSpend,
      "last7Days",
      NOW,
    );
    expect(snapshot.costContract.availability).toBe("unavailable");
    expect(snapshot.spendTrend).toHaveLength(0);
  });

  it("spend trend values are cumulative (never decreasing within a provider's series)", () => {
    const snapshot = buildDemoDashboardSnapshot(config(), CATALOG, "last7Days", NOW);
    const claudePoints = snapshot.spendTrend
      .filter((p) => p.provider === "claude")
      .sort((a, b) => a.bucketStart - b.bucketStart);
    for (let i = 1; i < claudePoints.length; i += 1) {
      expect(claudePoints[i].costUsed).toBeGreaterThanOrEqual(claudePoints[i - 1].costUsed);
    }
  });
});
