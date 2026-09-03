import { describe, expect, it } from "vitest";

import { taskbarLayout } from "./taskbarLayout";

describe("taskbarLayout", () => {
  for (const state of ["compact", "expanded"] as const) {
    it(`keeps seven ${state} instruments and their labels inside the native stage`, () => {
      const layout = taskbarLayout(state, 7);

      expect(layout.nodes).toHaveLength(7);
      for (const node of layout.nodes) {
        const xHalf = Math.max(layout.nodeSize, layout.labelWidth) / 2;
        const yHalf = layout.nodeSize / 2;
        expect(node.x - xHalf).toBeGreaterThanOrEqual(0);
        expect(node.x + xHalf).toBeLessThanOrEqual(layout.width);
        expect(node.y - yHalf).toBeGreaterThanOrEqual(0);
        expect(node.y + yHalf + layout.labelDepth).toBeLessThanOrEqual(layout.height);
      }
    });
  }

  it("uses one authoritative stage size for native and demo consumers", () => {
    expect(taskbarLayout("compact", 3)).toMatchObject({ width: 820, height: 360 });
    expect(taskbarLayout("expanded", 3)).toMatchObject({ width: 820, height: 540 });
  });

  it("places expanded providers around a full dial and compact providers in a fan", () => {
    const compact = taskbarLayout("compact", 7);
    const expanded = taskbarLayout("expanded", 7);

    expect(Math.max(...compact.nodes.map((node) => node.y))).toBeLessThan(compact.core.y);
    expect(Math.max(...expanded.nodes.map((node) => node.y))).toBeGreaterThan(expanded.core.y);
    expect(Math.min(...expanded.nodes.map((node) => node.y))).toBeLessThan(expanded.core.y);
  });
});
