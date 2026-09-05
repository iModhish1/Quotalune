import { describe, expect, it } from "vitest";
import { reelOffset, reelPoint, reelBaseSize, wheelStep } from "./reelGeometry";

describe("Orbit Reel geometry", () => {
  it("cycles through all six providers without dropping the last three", () => {
    for (let focus = 0; focus < 6; focus++) {
      const offsets = Array.from({ length: 6 }, (_, i) => reelOffset(i, focus, 6));
      expect(offsets.filter((n) => Math.abs(n) <= 1)).toHaveLength(3);
      expect(offsets[focus]).toBe(0);
      expect(offsets[(focus + 1) % 6]).toBe(1);
    }
  });
  it("keeps horizontal and vertical instruments inside the compact envelope", () => {
    for (const horizontal of [false, true]) {
      const size = reelBaseSize("compact", horizontal);
      for (const offset of [-1, 0, 1]) {
        const p = reelPoint(offset, horizontal);
        expect(p.x - 26).toBeGreaterThanOrEqual(0);
        expect(p.x + 26).toBeLessThanOrEqual(size.width);
        expect(p.y - 26).toBeGreaterThanOrEqual(0);
        expect(p.y + 26).toBeLessThanOrEqual(size.height);
      }
    }
  });
  it("accumulates trackpad deltas and applies a bounded wheel detent", () => {
    expect(wheelStep({ sum: 0, lastAt: 0 }, 8, 1000).step).toBe(0);
    const next = wheelStep({ sum: 20, lastAt: 0 }, 8, 1000);
    expect(next.step).toBe(1);
    expect(wheelStep(next.state, 120, 1050).step).toBe(0);
    expect(wheelStep(next.state, -120, 1300).step).toBe(-1);
  });
  it("handles empty and single-provider data", () => {
    expect(reelOffset(0, 0, 0)).toBe(0);
    expect(reelOffset(0, 0, 1)).toBe(0);
  });
});
