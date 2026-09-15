import { describe, expect, it } from "vitest";
import { resolveStructurePlacement, type StructureRect } from "./structurePlacement";

const workArea: StructureRect = { x: 0, y: 0, width: 1920, height: 1080 };
const detailSize = { width: 240, height: 160 };

describe("resolveStructurePlacement", () => {
  it("keeps the preferred side when it fits (§15: preferred side if it fits)", () => {
    const anchor: StructureRect = { x: 900, y: 500, width: 40, height: 40 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea, preferred: "right" });
    expect(result.side).toBe("right");
    expect(result.flipped).toBe(false);
    expect(result.x).toBeGreaterThan(anchor.x + anchor.width);
  });

  it("right edge: flips to left when the preferred right side would overflow the work area", () => {
    const anchor: StructureRect = { x: 1850, y: 500, width: 40, height: 40 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea, preferred: "right" });
    expect(result.side).toBe("left");
    expect(result.flipped).toBe(true);
    expect(result.x + detailSize.width).toBeLessThanOrEqual(anchor.x);
    expect(result.x).toBeGreaterThanOrEqual(workArea.x + 8);
  });

  it("left edge: flips to right when the preferred left side would overflow the work area", () => {
    const anchor: StructureRect = { x: 10, y: 500, width: 40, height: 40 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea, preferred: "left" });
    expect(result.side).toBe("right");
    expect(result.flipped).toBe(true);
    expect(result.x).toBeGreaterThanOrEqual(anchor.x + anchor.width);
  });

  it("top: flips to bottom when the preferred top side would overflow the work area", () => {
    const anchor: StructureRect = { x: 900, y: 10, width: 40, height: 40 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea, preferred: "top" });
    expect(result.side).toBe("bottom");
    expect(result.flipped).toBe(true);
    expect(result.y).toBeGreaterThanOrEqual(anchor.y + anchor.height);
  });

  it("bottom: flips to top when the preferred bottom side would overflow the work area", () => {
    const anchor: StructureRect = { x: 900, y: 1030, width: 40, height: 40 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea, preferred: "bottom" });
    expect(result.side).toBe("top");
    expect(result.flipped).toBe(true);
    expect(result.y + detailSize.height).toBeLessThanOrEqual(anchor.y);
  });

  it("top-left corner: preferred left+top-biased anchor stays within the work area after flip/shift", () => {
    const anchor: StructureRect = { x: 5, y: 5, width: 40, height: 40 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea, preferred: "left" });
    expect(result.x).toBeGreaterThanOrEqual(workArea.x + 8);
    expect(result.y).toBeGreaterThanOrEqual(workArea.y + 8);
    expect(result.x + detailSize.width).toBeLessThanOrEqual(workArea.x + workArea.width - 8);
    expect(result.y + detailSize.height).toBeLessThanOrEqual(workArea.y + workArea.height - 8);
  });

  it("top-right corner: stays within the work area after flip/shift", () => {
    const anchor: StructureRect = { x: 1875, y: 5, width: 40, height: 40 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea, preferred: "right" });
    expect(result.x).toBeGreaterThanOrEqual(workArea.x + 8);
    expect(result.y).toBeGreaterThanOrEqual(workArea.y + 8);
    expect(result.x + detailSize.width).toBeLessThanOrEqual(workArea.x + workArea.width - 8);
  });

  it("bottom-left corner: stays within the work area after flip/shift", () => {
    const anchor: StructureRect = { x: 5, y: 1035, width: 40, height: 40 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea, preferred: "left" });
    expect(result.y + detailSize.height).toBeLessThanOrEqual(workArea.y + workArea.height - 8);
    expect(result.x).toBeGreaterThanOrEqual(workArea.x + 8);
  });

  it("bottom-right corner: stays within the work area after flip/shift", () => {
    const anchor: StructureRect = { x: 1875, y: 1035, width: 40, height: 40 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea, preferred: "right" });
    expect(result.x + detailSize.width).toBeLessThanOrEqual(workArea.x + workArea.width - 8);
    expect(result.y + detailSize.height).toBeLessThanOrEqual(workArea.y + workArea.height - 8);
  });

  it("small work area: never produces a negative or out-of-range position, even when the detail panel doesn't fully fit", () => {
    const tinyWorkArea: StructureRect = { x: 0, y: 0, width: 200, height: 150 };
    const anchor: StructureRect = { x: 80, y: 60, width: 20, height: 20 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea: tinyWorkArea, preferred: "right" });
    expect(result.x).toBeGreaterThanOrEqual(tinyWorkArea.x + 8);
    expect(result.y).toBeGreaterThanOrEqual(tinyWorkArea.y + 8);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });

  it("RTL: when neither preferred nor opposite side fits, breaks the tie toward the left rather than the right", () => {
    // A work area narrow enough that neither "right" nor "left" placement
    // fully fits horizontally (detail wider than the remaining room on
    // both sides of a centered anchor).
    const narrowWorkArea: StructureRect = { x: 0, y: 0, width: 260, height: 1080 };
    const anchor: StructureRect = { x: 110, y: 500, width: 40, height: 40 };
    const ltr = resolveStructurePlacement({ anchor, detailSize, workArea: narrowWorkArea, preferred: "right", rtl: false });
    const rtl = resolveStructurePlacement({ anchor, detailSize, workArea: narrowWorkArea, preferred: "right", rtl: true });
    expect(rtl.side).toBe("left");
    // The RTL tie-break must still land inside the safe inset regardless
    // of what the LTR path chose.
    expect(rtl.x).toBeGreaterThanOrEqual(narrowWorkArea.x + 8);
    expect(ltr.x).toBeGreaterThanOrEqual(narrowWorkArea.x + 8);
  });

  it("always preserves the safe monitor inset, even for a perfectly-fitting preferred placement", () => {
    const anchor: StructureRect = { x: 20, y: 20, width: 40, height: 40 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea, preferred: "right", safeInset: 20 });
    expect(result.x).toBeGreaterThanOrEqual(workArea.x + 20);
    expect(result.y).toBeGreaterThanOrEqual(workArea.y + 20);
  });

  it("preserves the anchor relationship (gap) on the facing edge for the common, uncontested case", () => {
    const anchor: StructureRect = { x: 900, y: 500, width: 40, height: 40 };
    const result = resolveStructurePlacement({ anchor, detailSize, workArea, preferred: "bottom", gap: 10 });
    expect(result.y).toBe(anchor.y + anchor.height + 10);
  });
});
