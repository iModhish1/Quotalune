import { describe, expect, it } from "vitest";
import { hashUnitInterval } from "./deterministicHash";

describe("hashUnitInterval", () => {
  it("is deterministic for the same seed", () => {
    expect(hashUnitInterval("codex")).toBe(hashUnitInterval("codex"));
  });

  it("differs for different seeds (no trivial collisions among common seeds)", () => {
    const seeds = ["codex", "claude", "gemini", "perplexity", "grok", "deepseek"];
    const values = new Set(seeds.map(hashUnitInterval));
    expect(values.size).toBe(seeds.length);
  });

  it("always returns a value in [0, 1)", () => {
    for (const seed of ["", "a", "star-a-0", "depth:codex", "x".repeat(50)]) {
      const v = hashUnitInterval(seed);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
