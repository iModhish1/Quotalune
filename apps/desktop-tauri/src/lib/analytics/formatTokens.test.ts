import { describe, expect, it } from "vitest";
import { formatCompactTokens, formatExactTokens } from "./formatTokens";

describe("formatCompactTokens", () => {
  it("shows exact small counts below 1000", () => {
    expect(formatCompactTokens(0)).toBe("0");
    expect(formatCompactTokens(1)).toBe("1");
    expect(formatCompactTokens(999)).toBe("999");
  });

  it("compacts thousands/millions/billions/trillions with one decimal", () => {
    expect(formatCompactTokens(1240)).toBe("1.2k");
    expect(formatCompactTokens(12_400)).toBe("12.4k");
    expect(formatCompactTokens(1_150_000)).toBe("1.2M"); // rounds to one decimal
    expect(formatCompactTokens(11_000_000)).toBe("11M");
    expect(formatCompactTokens(63_747_046_211)).toBe("63.7B");
    expect(formatCompactTokens(1_500_000_000_000)).toBe("1.5T");
  });

  it("drops a trailing .0", () => {
    expect(formatCompactTokens(11_000_000)).toBe("11M");
    expect(formatCompactTokens(2_000_000_000)).toBe("2B");
  });

  it("never crashes on non-finite input", () => {
    expect(formatCompactTokens(Number.NaN)).toBe("0");
    expect(formatCompactTokens(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("formatExactTokens", () => {
  it("renders the full grouped integer", () => {
    expect(formatExactTokens(63_747_046_211)).toBe("63,747,046,211");
  });

  it("never crashes on non-finite input", () => {
    expect(formatExactTokens(Number.NaN)).toBe("0");
  });
});
