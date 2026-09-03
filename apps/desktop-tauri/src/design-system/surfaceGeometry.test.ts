import { describe, expect, it } from "vitest";

import { THEME_CATALOG } from "./themeCatalog";
import { characterizeSurfaceNodes } from "./surfaceGeometry";

const BASE = Array.from({ length: 7 }, (_, index) => {
  const angle = (-90 + (360 * index) / 7) * (Math.PI / 180);
  return { x: 230 + 178 * Math.cos(angle), y: 241 + 178 * Math.sin(angle) };
});

describe("characterizeSurfaceNodes", () => {
  it("gives every registered geometry a distinct deterministic signature", () => {
    const signatures = THEME_CATALOG.map((theme) => {
      const first = characterizeSurfaceNodes(BASE, { x: 230, y: 241 }, theme.geometry);
      const second = characterizeSurfaceNodes(BASE, { x: 230, y: 241 }, theme.geometry);
      expect(second).toEqual(first);
      return JSON.stringify(first.map((node) => [Math.round(node.x), Math.round(node.y), node.scale]));
    });

    // Porcelain Halo intentionally shares the precision-orbit geometry with
    // Obsidian Orbit; every other registered geometry remains structurally unique.
    expect(new Set(signatures)).toHaveLength(14);
  });

  it("clamps every geometry to the supplied safe area", () => {
    for (const theme of THEME_CATALOG) {
      const nodes = characterizeSurfaceNodes(
        BASE,
        { x: 230, y: 241 },
        theme.geometry,
        { left: 44, right: 416, top: 44, bottom: 438 },
      );

      expect(nodes).toHaveLength(7);
      for (const node of nodes) {
        expect(node.x).toBeGreaterThanOrEqual(44);
        expect(node.x).toBeLessThanOrEqual(416);
        expect(node.y).toBeGreaterThanOrEqual(44);
        expect(node.y).toBeLessThanOrEqual(438);
        expect(node.scale).toBeGreaterThanOrEqual(0.92);
        expect(node.scale).toBeLessThanOrEqual(1.08);
      }
    }
  });
});
