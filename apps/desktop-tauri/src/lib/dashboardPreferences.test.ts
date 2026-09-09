import { describe, it, expect } from "vitest";
import { DASHBOARD_PERFORMANCE_PRESETS, DEFAULT_DASHBOARD_PERFORMANCE_PRESET, resolveDashboardPerformancePreset, isDashboardPerformancePreset } from "./dashboardPreferences";
describe("DASHBOARD_PERFORMANCE_PRESETS", () => {
  it("has exactly 3 presets with unique ids", () => {
    expect(DASHBOARD_PERFORMANCE_PRESETS).toHaveLength(3);
    const ids = DASHBOARD_PERFORMANCE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("defaults to balanced", () => {
    expect(DEFAULT_DASHBOARD_PERFORMANCE_PRESET).toBe("balanced");
  });

  it("resolveDashboardPerformancePreset falls back safely", () => {
    expect(resolveDashboardPerformancePreset("lowCpu")).toBe("lowCpu");
    expect(resolveDashboardPerformancePreset("ultra")).toBe("balanced");
    expect(resolveDashboardPerformancePreset(undefined)).toBe("balanced");
  });

  it("isDashboardPerformancePreset rejects unknown strings", () => {
    expect(isDashboardPerformancePreset("balanced")).toBe(true);
    expect(isDashboardPerformancePreset("ultra")).toBe(false);
  });
});
