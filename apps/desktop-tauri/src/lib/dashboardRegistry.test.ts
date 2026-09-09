import { describe, expect, it } from "vitest";
import {
  DASHBOARD_DEFINITIONS,
  DASHBOARD_PERFORMANCE_PRESETS,
  DASHBOARD_REGISTRY,
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
    for (const def of DASHBOARD_DEFINITIONS) {
      expect(def.isPlaceholder).toBe(def.id !== "analytics2d");
    }
  });

  it("Phase S1: the visible picker is exactly Analytics / Spatial / Experimental 3D, in that order", () => {
    expect(DASHBOARD_DEFINITIONS.map((d) => d.id)).toEqual(["analytics2d", "spatial", "providers3d"]);
  });

  it("relabels providers3d as Experimental 3D without changing its wire value (owner section 36)", () => {
    expect(DASHBOARD_REGISTRY.providers3d.id).toBe("providers3d");
    expect(DASHBOARD_REGISTRY.providers3d.name).toMatch(/experimental/i);
  });

  it("preserves the hybrid registry entry even though it's excluded from the visible picker (owner section 0/55)", () => {
    expect(DASHBOARD_REGISTRY.hybrid.id).toBe("hybrid");
    expect(DASHBOARD_DEFINITIONS.some((d) => d.id === "hybrid")).toBe(false);
  });

  it("spatial creates zero WebGL dependency at the registry level (own loader, own performance class)", () => {
    expect(DASHBOARD_REGISTRY.spatial.id).toBe("spatial");
    expect(DASHBOARD_REGISTRY.spatial.supports3d).toBe(false);
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
    expect(resolveDashboardMode("spatial")).toBe("spatial");
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
