import { describe, expect, it } from "vitest";
import { geometryLayout, normalizeVariant } from "./geometryVariants";

describe("geometryLayout", () => {
  it("places every node within the stage bounds for all variants", () => {
    const variants = [
      "orbit", "petals", "dial", "constellation", "spine", "eclipse",
      "facets", "orchid", "ice", "lens", "nova", "aperture", "astrolabe", "dunes",
    ] as const;
    for (const v of variants) {
      const layout = geometryLayout(v, 230, 150, 100, 7);
      expect(layout.nodes).toHaveLength(7);
      for (const n of layout.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(230 - 160);
        expect(n.x).toBeLessThanOrEqual(230 + 160);
        expect(n.y).toBeGreaterThanOrEqual(150 - 160);
        expect(n.y).toBeLessThanOrEqual(150 + 160);
      }
    }
  });

  it("is deterministic across calls", () => {
    const a = geometryLayout("constellation", 230, 150, 100, 5);
    const b = geometryLayout("constellation", 230, 150, 100, 5);
    expect(a.nodes).toEqual(b.nodes);
    expect(a.connectors).toEqual(b.connectors);
  });

  it("handles single and large provider counts", () => {
    expect(geometryLayout("orbit", 100, 100, 80, 1).nodes).toHaveLength(1);
    expect(geometryLayout("spine", 100, 100, 80, 12).nodes).toHaveLength(12);
    expect(geometryLayout("dunes", 100, 100, 80, 12).nodes).toHaveLength(12);
  });
});

describe("normalizeVariant", () => {
  it("falls back to orbit for unknown variants", () => {
    expect(normalizeVariant("petals")).toBe("petals");
    expect(normalizeVariant("nope")).toBe("orbit");
    expect(normalizeVariant(undefined)).toBe("orbit");
  });
});
