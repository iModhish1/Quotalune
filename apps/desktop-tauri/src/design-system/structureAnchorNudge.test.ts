import { describe, expect, it } from "vitest";
import { nudgeStructureAnchor } from "./structureAnchorNudge";
import type { FlowSurfaceAnchor } from "./flowSurface";

describe("nudgeStructureAnchor", () => {
  it("moves one grid step in each direction from a corner", () => {
    expect(nudgeStructureAnchor("top-left", "right")).toBe("top");
    expect(nudgeStructureAnchor("top-left", "down")).toBe("left");
  });

  it("skips the unused center cell rather than getting stuck on it", () => {
    expect(nudgeStructureAnchor("left", "right")).toBe("right");
    expect(nudgeStructureAnchor("right", "left")).toBe("left");
    expect(nudgeStructureAnchor("top", "down")).toBe("bottom");
    expect(nudgeStructureAnchor("bottom", "up")).toBe("top");
  });

  it("clamps at the grid edge instead of wrapping around", () => {
    expect(nudgeStructureAnchor("left", "left")).toBe("left");
    expect(nudgeStructureAnchor("right", "right")).toBe("right");
    expect(nudgeStructureAnchor("top", "up")).toBe("top");
    expect(nudgeStructureAnchor("bottom", "down")).toBe("bottom");
    expect(nudgeStructureAnchor("top-left", "left")).toBe("top-left");
    expect(nudgeStructureAnchor("top-left", "up")).toBe("top-left");
    expect(nudgeStructureAnchor("bottom-right", "right")).toBe("bottom-right");
    expect(nudgeStructureAnchor("bottom-right", "down")).toBe("bottom-right");
  });

  it("moves between adjacent corners along an edge", () => {
    expect(nudgeStructureAnchor("top-left", "right")).toBe("top");
    expect(nudgeStructureAnchor("top", "right")).toBe("top-right");
    expect(nudgeStructureAnchor("bottom-left", "right")).toBe("bottom");
    expect(nudgeStructureAnchor("bottom", "right")).toBe("bottom-right");
  });

  it("starts from 'top' when nudging away from the pointer-drag-only 'free' anchor", () => {
    expect(nudgeStructureAnchor("free", "right")).toBe("top-right");
    expect(nudgeStructureAnchor("free", "left")).toBe("top-left");
    expect(nudgeStructureAnchor("free", "down")).toBe("bottom");
  });

  it("every fixed anchor has a reachable, defined result for all four directions (no crash, no undefined)", () => {
    const anchors: FlowSurfaceAnchor[] = [
      "left", "right", "top", "bottom",
      "top-left", "top-right", "bottom-left", "bottom-right",
    ];
    for (const anchor of anchors) {
      for (const direction of ["left", "right", "up", "down"] as const) {
        const result = nudgeStructureAnchor(anchor, direction);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    }
  });
});
