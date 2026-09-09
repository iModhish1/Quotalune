import { describe, expect, it } from "vitest";
import { isResetSoon, RESET_SOON_MS } from "./resetProximity";

describe("isResetSoon", () => {
  const now = 1_700_000_000_000;

  it("is false for null (no reset data)", () => {
    expect(isResetSoon(null, now)).toBe(false);
  });

  it("is false for an unparsable string", () => {
    expect(isResetSoon("not-a-date", now)).toBe(false);
  });

  it("is false for a reset time already in the past", () => {
    expect(isResetSoon(new Date(now - 1000).toISOString(), now)).toBe(false);
  });

  it("is false for a reset time further away than RESET_SOON_MS", () => {
    expect(isResetSoon(new Date(now + RESET_SOON_MS + 1).toISOString(), now)).toBe(false);
  });

  it("is true right at the RESET_SOON_MS boundary", () => {
    expect(isResetSoon(new Date(now + RESET_SOON_MS).toISOString(), now)).toBe(true);
  });

  it("is true for a reset time due soon", () => {
    expect(isResetSoon(new Date(now + 5 * 60 * 1000).toISOString(), now)).toBe(true);
  });
});
