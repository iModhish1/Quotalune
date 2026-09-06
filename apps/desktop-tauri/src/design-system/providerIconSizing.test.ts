import { describe, expect, it } from "vitest";

import { providerGlyphSize } from "./providerIconSizing";

describe("providerGlyphSize", () => {
  it.each([
    [25, 15],
    [31, 18],
    [36, 20],
    [44, 25],
    [46, 26],
    [52, 28],
  ])("fills a %ipx ring prominently while preserving stroke clearance", (ring, expected) => {
    expect(providerGlyphSize(ring)).toBe(expected);
    expect(providerGlyphSize(ring)).toBeLessThanOrEqual(ring - 10);
  });

  it("handles invalid and tiny inputs defensively", () => {
    expect(providerGlyphSize(Number.NaN)).toBe(10);
    expect(providerGlyphSize(12)).toBe(10);
  });
});
