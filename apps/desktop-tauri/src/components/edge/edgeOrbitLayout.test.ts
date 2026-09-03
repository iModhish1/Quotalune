import { describe, expect, it } from "vitest";

import { edgeOrbitLayout } from "./edgeOrbitLayout";

describe("edgeOrbitLayout", () => {
  for (const state of ["compact", "expanded"] as const) {
    it(`keeps seven ${state} providers inside the right-edge stage`, () => {
      const layout = edgeOrbitLayout(state, 7);
      expect(layout.nodes).toHaveLength(7);
      for (const node of layout.nodes) {
        expect(node.x - layout.nodeSize / 2).toBeGreaterThanOrEqual(0);
        expect(node.x + layout.nodeSize / 2).toBeLessThanOrEqual(layout.width);
        expect(node.y - layout.nodeSize / 2).toBeGreaterThanOrEqual(0);
        expect(node.y + layout.nodeSize / 2 + layout.labelDepth).toBeLessThanOrEqual(layout.height);
        if (state === "expanded") {
          expect(node.x + layout.nodeSize / 2 + layout.detailWidth).toBeLessThanOrEqual(layout.width);
        }
      }
    });
  }

  it("uses stable native dimensions and anchors its core to the right edge", () => {
    expect(edgeOrbitLayout("compact", 7)).toMatchObject({ width: 180, height: 560 });
    const expanded = edgeOrbitLayout("expanded", 7);
    expect(expanded).toMatchObject({ width: 420, height: 600 });
    expect(expanded.core.x + expanded.core.radius).toBeGreaterThan(expanded.width);
  });
});
