import { describe, expect, it } from "vitest";

import { CANONICAL_THEME, THEME_CATALOG } from "./themeCatalog";
import { characterizeSurfaceNodes } from "./surfaceGeometry";

const BASE = Array.from({ length: 7 }, (_, index) => {
  const angle = (-90 + (360 * index) / 7) * (Math.PI / 180);
  return { x: 230 + 178 * Math.cos(angle), y: 241 + 178 * Math.sin(angle) };
});

describe("characterizeSurfaceNodes", () => {
  it("keeps the canonical geometry deterministic", () => {
    const signatures = THEME_CATALOG.map((theme) => {
      const first = characterizeSurfaceNodes(BASE, { x: 230, y: 241 }, theme.geometry);
      const second = characterizeSurfaceNodes(BASE, { x: 230, y: 241 }, theme.geometry);
      expect(second).toEqual(first);
      return JSON.stringify(first.map((node) => [Math.round(node.x), Math.round(node.y), node.scale]));
    });

    expect(signatures).toHaveLength(THEME_CATALOG.length);
    expect(new Set(signatures).size).toBe(1);
    expect(THEME_CATALOG[0]).toBe(CANONICAL_THEME);
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
