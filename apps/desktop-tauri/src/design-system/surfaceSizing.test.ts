import { describe, expect, it } from "vitest";

import {
  computeSurfaceLayout,
  type SurfaceLayoutInput,
} from "./surfaceSizing";

const REFERENCE_WORK_AREA = { width: 1280, height: 752 };

function input(overrides: Partial<SurfaceLayoutInput> = {}): SurfaceLayoutInput {
  return {
    surface: "taskbar",
    state: "compact",
    workArea: REFERENCE_WORK_AREA,
    dpiScale: 1,
    userScale: 1,
    providerCount: 3,
    placement: "bottom",
    ...overrides,
  };
}

describe("computeSurfaceLayout — V9 responsive sizing engine", () => {
  it("compact taskbar fits the V9 envelope at the reference work area", () => {
    const layout = computeSurfaceLayout(input());
    expect(layout.windowBounds.width).toBeLessThanOrEqual(440);
    expect(layout.windowBounds.height).toBeLessThanOrEqual(140);
    expect(layout.isExpanded).toBe(false);
  });

  it("enforces the compact horizontal proportional cap (≤35% work-area width)", () => {
    const layout = computeSurfaceLayout(input());
    expect(layout.windowBounds.width).toBeLessThanOrEqual(
      Math.floor(REFERENCE_WORK_AREA.width * 0.35),
    );
    expect(layout.windowBounds.height).toBeLessThanOrEqual(
      Math.floor(REFERENCE_WORK_AREA.height * 0.2),
    );
  });

  it("clamps to work-area width when the envelope exceeds the cap and reports provenance", () => {
    const tiny = { width: 800, height: 600 };
    const layout = computeSurfaceLayout(
      input({ workArea: tiny, surface: "taskbar", state: "expanded" }),
    );
    expect(layout.windowBounds.width).toBeLessThanOrEqual(
      Math.floor(tiny.width * 0.35),
    );
    expect(layout.clampedBy).toBe("work-area-width");
  });

  it("edge rail obeys the narrow-rail cap (≤12% work-area width) and is vertical", () => {
    const layout = computeSurfaceLayout(input({ surface: "edge", placement: "left" }));
    expect(layout.windowBounds.width).toBeLessThanOrEqual(
      Math.floor(REFERENCE_WORK_AREA.width * 0.12),
    );
    expect(layout.windowBounds.height).toBeGreaterThan(layout.windowBounds.width);
  });

  it("expanded taskbar is strictly larger than compact but never exceeds its cap", () => {
    const compact = computeSurfaceLayout(input({ state: "compact" }));
    const expanded = computeSurfaceLayout(input({ state: "expanded" }));
    expect(expanded.windowBounds.width).toBeGreaterThan(compact.windowBounds.width);
    expect(expanded.windowBounds.height).toBeGreaterThan(compact.windowBounds.height);
    expect(expanded.windowBounds.width).toBeLessThanOrEqual(640);
    expect(expanded.isExpanded).toBe(true);
  });

  it("is DPI-invariant: layout is computed in logical pixels", () => {
    const at100 = computeSurfaceLayout(input({ dpiScale: 1 }));
    const at150 = computeSurfaceLayout(input({ dpiScale: 1.5 }));
    const at200 = computeSurfaceLayout(input({ dpiScale: 2 }));
    expect(at150.windowBounds).toEqual(at100.windowBounds);
    expect(at200.windowBounds).toEqual(at100.windowBounds);
  });

  it("is deterministic: identical input yields identical output (no module state)", () => {
    const a = computeSurfaceLayout(input({ providerCount: 5 }));
    const b = computeSurfaceLayout(input({ providerCount: 5 }));
    expect(a).toEqual(b);
  });

  it("provider-count density growth is bounded", () => {
    const three = computeSurfaceLayout(input({ providerCount: 3 }));
    const many = computeSurfaceLayout(input({ providerCount: 12 }));
    expect(many.windowBounds.width).toBeGreaterThan(three.windowBounds.width);
    expect(many.windowBounds.width - three.windowBounds.width).toBeLessThanOrEqual(72);
    // Density growth must never break the proportional cap.
    expect(many.windowBounds.width).toBeLessThanOrEqual(
      Math.floor(REFERENCE_WORK_AREA.width * 0.35),
    );
  });

  it("user scale widens the surface but the proportional cap still wins", () => {
    const scaled = computeSurfaceLayout(input({ userScale: 2 }));
    expect(scaled.windowBounds.width).toBeLessThanOrEqual(
      Math.floor(REFERENCE_WORK_AREA.width * 0.35),
    );
    expect(scaled.windowBounds.width).toBeGreaterThan(
      computeSurfaceLayout(input()).windowBounds.width,
    );
  });

  it("user scale is clamped to [0.5, 2.0] and cannot produce absurd sizes", () => {
    const tiny = computeSurfaceLayout(input({ userScale: 0.1 }));
    const huge = computeSurfaceLayout(input({ userScale: 99 }));
    expect(tiny.windowBounds.width).toBeGreaterThan(0);
    expect(huge.windowBounds.width).toBeLessThanOrEqual(
      Math.floor(REFERENCE_WORK_AREA.width * 0.35),
    );
  });

  it("unknown surface kinds fall back to the taskbar envelope instead of throwing", () => {
    const layout = computeSurfaceLayout(
      input({ surface: "mystery" as SurfaceLayoutInput["surface"] }),
    );
    expect(layout.windowBounds.width).toBeLessThanOrEqual(440);
  });

  it("exposes orbit radius and instrument size derived from the stage, not magic numbers", () => {
    const compact = computeSurfaceLayout(input());
    const expanded = computeSurfaceLayout(input({ state: "expanded" }));
    expect(compact.orbitRadius).toBeGreaterThan(0);
    expect(expanded.instrumentSize).toBeGreaterThanOrEqual(compact.instrumentSize);
    // Orbit radius must fit inside the window.
    expect(compact.orbitRadius * 2).toBeLessThan(compact.windowBounds.height);
    expect(expanded.orbitRadius * 2).toBeLessThan(expanded.windowBounds.height);
  });

  it("every surface kind returns a positive, finite, integer-bounded layout", () => {
    const kinds = [
      "taskbar",
      "top",
      "edge",
      "hud",
      "quick-panel",
      "dashboard",
      "settings",
    ] as const;
    for (const kind of kinds) {
      for (const state of ["compact", "hover", "expanded"] as const) {
        const layout = computeSurfaceLayout(input({ surface: kind, state }));
        expect(Number.isFinite(layout.windowBounds.width)).toBe(true);
        expect(Number.isFinite(layout.windowBounds.height)).toBe(true);
        expect(layout.windowBounds.width).toBeGreaterThan(0);
        expect(layout.windowBounds.height).toBeGreaterThan(0);
        expect(Number.isInteger(layout.windowBounds.width)).toBe(true);
        expect(Number.isInteger(layout.windowBounds.height)).toBe(true);
      }
    }
  });
});
