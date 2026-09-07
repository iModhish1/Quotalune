import { describe, expect, it } from "vitest";
import {
  DASHBOARD_DEFINITIONS,
  DASHBOARD_PERFORMANCE_PRESETS,
  DEFAULT_DASHBOARD_MODE,
  DEFAULT_DASHBOARD_PERFORMANCE_PRESET,
  isDashboardModeId,
  isDashboardPerformancePreset,
  resolveDashboardMode,
  resolveDashboardPerformancePreset,
} from "./dashboardRegistry";

describe("DASHBOARD_DEFINITIONS", () => {
  it("has exactly 3 production definitions", () => {
    expect(DASHBOARD_DEFINITIONS).toHaveLength(3);
  });

  it("has unique ids", () => {
    const ids = DASHBOARD_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a valid lazy loader for every definition", () => {
    for (const def of DASHBOARD_DEFINITIONS) {
      expect(def.loader).toBeTruthy();
      expect(typeof def.loader).toBe("object"); // React.lazy returns a component object, not a function
    }
  });

  it("marks only analytics2d as a real (non-placeholder) implementation", () => {
    const analytics = DASHBOARD_DEFINITIONS.find((d) => d.id === "analytics2d")!;
    const providers3d = DASHBOARD_DEFINITIONS.find((d) => d.id === "providers3d")!;
    const hybrid = DASHBOARD_DEFINITIONS.find((d) => d.id === "hybrid")!;
    expect(analytics.isPlaceholder).toBe(false);
    expect(providers3d.isPlaceholder).toBe(true);
    expect(hybrid.isPlaceholder).toBe(true);
  });

  it("gives every definition a name, short description, and performance class", () => {
    for (const def of DASHBOARD_DEFINITIONS) {
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.shortDescription.length).toBeGreaterThan(0);
      expect(["lowest", "medium", "high"]).toContain(def.performanceClass);
    }
  });
});

describe("resolveDashboardMode", () => {
  it("defaults to analytics2d", () => {
    expect(DEFAULT_DASHBOARD_MODE).toBe("analytics2d");
  });

  it("passes through every valid mode", () => {
    expect(resolveDashboardMode("analytics2d")).toBe("analytics2d");
    expect(resolveDashboardMode("providers3d")).toBe("providers3d");
    expect(resolveDashboardMode("hybrid")).toBe("hybrid");
  });

  it("falls back to analytics2d for an unknown or missing value", () => {
    expect(resolveDashboardMode("quantum3d")).toBe("analytics2d");
    expect(resolveDashboardMode(undefined)).toBe("analytics2d");
    expect(resolveDashboardMode(null)).toBe("analytics2d");
    expect(resolveDashboardMode("")).toBe("analytics2d");
  });

  it("isDashboardModeId rejects unknown strings", () => {
    expect(isDashboardModeId("analytics2d")).toBe(true);
    expect(isDashboardModeId("legacy3d")).toBe(false);
  });
});

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
