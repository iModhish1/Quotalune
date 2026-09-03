import { describe, expect, it } from "vitest";

import { topOrbitLayout } from "./topOrbitLayout";

describe("topOrbitLayout", () => {
  for (const state of ["compact", "expanded"] as const) {
    it(`keeps seven ${state} providers inside the top-edge stage`, () => {
      const layout = topOrbitLayout(state, 7);
      expect(layout.nodes).toHaveLength(7);
      for (const node of layout.nodes) {
        expect(node.x - layout.nodeFootprint / 2).toBeGreaterThanOrEqual(0);
        expect(node.x + layout.nodeFootprint / 2).toBeLessThanOrEqual(layout.width);
        expect(node.y - layout.nodeSize / 2).toBeGreaterThanOrEqual(0);
        expect(node.y + layout.nodeSize / 2 + layout.labelDepth).toBeLessThanOrEqual(layout.height);
      }
    });
  }

  it("uses stable logical-pixel dimensions for native resize", () => {
    expect(topOrbitLayout("compact", 7)).toMatchObject({ width: 680, height: 180 });
    expect(topOrbitLayout("expanded", 7)).toMatchObject({ width: 760, height: 430 });
  });

  it("places the expanded summary below the provider notch", () => {
    const layout = topOrbitLayout("expanded", 7);
    expect(layout.summary.y).toBeGreaterThan(Math.max(...layout.nodes.map((node) => node.y)));
  });
});
