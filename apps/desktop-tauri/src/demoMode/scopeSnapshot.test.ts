import { describe, expect, it } from "vitest";
import { scopeDemoSnapshot } from "./scopeSnapshot";
import { buildDemoDashboardSnapshot } from "./dashboardSnapshot";
import { resolveDemoConfig } from "./types";
describe("Demo analytics controls", () => {
  const catalog = ["codex", "claude", "gemini", "perplexity", "grok", "deepseek"].map(id => ({id, displayName: id, cookieDomain: null}));
  const snapshot = buildDemoDashboardSnapshot(resolveDemoConfig({demoModeEnabled: true, demoProviderCount: 6, demoHistoryDays: 30}), catalog, "last30Days", Date.UTC(2026, 8, 9, 12));
  it("scopes history to seven days without regenerating points", () => {
    const result = scopeDemoSnapshot(snapshot, "last7Days");
    expect(result.usageTrend.length).toBeLessThan(snapshot.usageTrend.length);
    expect(result.usageTrend.every(p => p.bucketStart >= result.rangeSince)).toBe(true);
    expect(result.usageTrend.every(p => snapshot.usageTrend.includes(p))).toBe(true);
  });
  it("unknown selection is empty and never retains a reported spend total", () => {
    const result = scopeDemoSnapshot(snapshot, "last30Days", ["not-in-demo"]);
    expect(result.providers).toEqual([]);
    expect(result.spendTrend).toEqual([]);
    expect(result.costContract.availability).toBe("unavailable");
  });
});
