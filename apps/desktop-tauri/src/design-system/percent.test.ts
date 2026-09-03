import { describe, expect, it } from "vitest";
import {
  arcFraction,
  formatPercentage,
  formatTokenCount,
  normalizePercentage,
} from "./percent";

describe("normalizePercentage", () => {
  it("eliminates IEEE-754 drift artifacts", () => {
    expect(normalizePercentage(20.999999999999996)).toBe(21);
    expect(normalizePercentage(58.00000000000001)).toBe(58);
    expect(normalizePercentage(99.99999999999999)).toBe(100);
    expect(normalizePercentage(73)).toBe(73);
  });

  it("snaps near-boundary drift to exact bounds", () => {
    expect(normalizePercentage(100 - 1e-12)).toBe(100);
    expect(normalizePercentage(0 + 1e-12)).toBe(0);
    expect(normalizePercentage(-1e-12)).toBe(0);
  });

  it("clamps out-of-range input", () => {
    expect(normalizePercentage(120)).toBe(100);
    expect(normalizePercentage(-30)).toBe(0);
  });

  it("treats non-finite and null as unavailable", () => {
    expect(normalizePercentage(null)).toBeNull();
    expect(normalizePercentage(undefined)).toBeNull();
    expect(normalizePercentage(Number.NaN)).toBeNull();
    expect(normalizePercentage(Number.POSITIVE_INFINITY)).toBeNull();
    expect(normalizePercentage(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it("never returns negative zero", () => {
    const r = normalizePercentage(-0);
    expect(Object.is(r, -0)).toBe(false);
    expect(r).toBe(0);
  });
});

describe("formatPercentage", () => {
  it("formats the documented boundary set", () => {
    expect(formatPercentage(0)).toBe("0%");
    expect(formatPercentage(20.999999999999996)).toBe("21%");
    expect(formatPercentage(27)).toBe("27%");
    expect(formatPercentage(58.00000000000001)).toBe("58%");
    expect(formatPercentage(73)).toBe("73%");
    expect(formatPercentage(99.999999999)).toBe("100%");
    expect(formatPercentage(100)).toBe("100%");
    expect(formatPercentage(120)).toBe("100%");
    expect(formatPercentage(-5)).toBe("0%");
  });

  it("returns the unavailable dash consistently", () => {
    expect(formatPercentage(null)).toBe("–");
    expect(formatPercentage(undefined)).toBe("–");
    expect(formatPercentage(Number.NaN)).toBe("–");
    expect(formatPercentage(Number.POSITIVE_INFINITY)).toBe("–");
  });

  it("supports bounded one-decimal mode without trailing .0", () => {
    expect(formatPercentage(73.0, { decimals: 1 })).toBe("73%");
    expect(formatPercentage(73.46, { decimals: 1 })).toBe("73.5%");
    expect(formatPercentage(73.999, { decimals: 1 })).toBe("74%");
  });

  it("supports suppressing the percent sign", () => {
    expect(formatPercentage(73, { withSign: false })).toBe("73");
  });
});

describe("arcFraction", () => {
  it("agrees with the formatted text (no endpoint disagreement)", () => {
    // 20.999999999999996% text = "21%" → arc must be exactly 0.21.
    expect(arcFraction(20.999999999999996)).toBe(0.21);
    expect(arcFraction(73)).toBe(0.73);
    expect(arcFraction(100)).toBe(1);
    expect(arcFraction(null)).toBeNull();
  });
});

describe("formatTokenCount", () => {
  it("uses compact K/M notation without stray decimals", () => {
    expect(formatTokenCount(73000)).toBe("73K");
    expect(formatTokenCount(100000)).toBe("100K");
    expect(formatTokenCount(7300)).toBe("7.3K");
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(null)).toBe("–");
  });
});
