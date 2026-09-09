import { describe, expect, it } from "vitest";
import { computeSpatialLayout } from "./spatialLayout";

const idsOfCount = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `provider-${String(i).padStart(2, "0")}`);

describe("computeSpatialLayout", () => {
  it("returns an empty map for no providers", () => {
    expect(computeSpatialLayout([]).size).toBe(0);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const ids = ["codex", "claude", "gemini", "perplexity", "grok", "deepseek"];
    const a = computeSpatialLayout(ids);
    const b = computeSpatialLayout(ids);
    for (const id of ids) {
      expect(b.get(id)).toEqual(a.get(id));
    }
  });

  it("is order-independent (sorts ids itself, like providers3d/layout.ts)", () => {
    const a = computeSpatialLayout(["codex", "claude", "gemini"]);
    const b = computeSpatialLayout(["gemini", "codex", "claude"]);
    for (const id of ["codex", "claude", "gemini"]) {
      expect(b.get(id)).toEqual(a.get(id));
    }
  });

  it("places a single provider as a centered hero, not a tiny dot in empty space", () => {
    const layout = computeSpatialLayout(["codex"]);
    const node = layout.get("codex")!;
    expect(node.tier).toBe("hero");
    expect(node.depth).toBe(0);
    expect(node.scale).toBeGreaterThan(1); // owner section 19: large enough to feel intentional
    expect(node.x).toBeCloseTo(50, 0);
  });

  it("splits exactly six providers into a 3-back / 3-front composition (owner section 17)", () => {
    const ids = idsOfCount(6);
    const layout = computeSpatialLayout(ids);
    const tiers = ids.map((id) => layout.get(id)!.tier);
    const backCount = tiers.filter((t) => t === "back").length;
    const frontCount = tiers.filter((t) => t === "front").length;
    expect(backCount).toBe(3);
    expect(frontCount).toBe(3);
  });

  it("never arranges providers in a perfect uniform circle (no shared fixed radius)", () => {
    // A ring layout would put every node at equal distance from a center
    // point; Spatial's tiers deliberately don't -- front-tier nodes sit
    // measurably closer to the viewer (lower depth) than back-tier ones.
    const layout = computeSpatialLayout(idsOfCount(6));
    const depths = new Set(Array.from(layout.values()).map((n) => n.depth));
    expect(depths.size).toBeGreaterThan(1);
  });

  for (const count of [1, 2, 3, 6, 12, 24]) {
    it(`produces valid, in-bounds, non-NaN positions for ${count} providers`, () => {
      const ids = idsOfCount(count);
      const layout = computeSpatialLayout(ids);
      expect(layout.size).toBe(count);
      for (const id of ids) {
        const node = layout.get(id)!;
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
        expect(Number.isFinite(node.depth)).toBe(true);
        expect(Number.isFinite(node.scale)).toBe(true);
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThanOrEqual(100);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThanOrEqual(100);
        expect(node.depth).toBeGreaterThanOrEqual(0);
        expect(node.depth).toBeLessThanOrEqual(1);
        expect(node.scale).toBeGreaterThan(0);
      }
    });
  }

  it("uses more depth tiers as the provider count grows (owner sections 21/22)", () => {
    const tierCountFor = (n: number) => {
      const layout = computeSpatialLayout(idsOfCount(n));
      return new Set(Array.from(layout.values()).map((v) => v.tier)).size;
    };
    expect(tierCountFor(1)).toBe(1);
    expect(tierCountFor(6)).toBe(2);
    expect(tierCountFor(12)).toBe(3);
    expect(tierCountFor(24)).toBe(4);
  });

  it("nudges a selected node's depth toward the foreground without changing its x/y slot", () => {
    const ids = idsOfCount(6);
    const unselected = computeSpatialLayout(ids);
    const selectedId = ids.find((id) => unselected.get(id)!.tier === "back")!;
    const selected = computeSpatialLayout(ids, { selectedId });

    const before = unselected.get(selectedId)!;
    const after = selected.get(selectedId)!;
    expect(after.depth).toBeLessThan(before.depth);
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
  });

  it("a selected far-tier node still reads as further back than an unselected front-tier node", () => {
    const ids = idsOfCount(24);
    const layout = computeSpatialLayout(ids);
    const farId = ids.find((id) => layout.get(id)!.tier === "far")!;
    const frontId = ids.find((id) => layout.get(id)!.tier === "front")!;

    const withFarSelected = computeSpatialLayout(ids, { selectedId: farId });
    expect(withFarSelected.get(farId)!.depth).toBeGreaterThan(withFarSelected.get(frontId)!.depth);
  });

  it("gives every node a connection anchor on its own tier's axis (never another provider's position)", () => {
    const layout = computeSpatialLayout(idsOfCount(6));
    for (const node of layout.values()) {
      expect(node.connectionAnchor.x).toBe(node.x);
      expect(Number.isFinite(node.connectionAnchor.y)).toBe(true);
    }
  });
});
