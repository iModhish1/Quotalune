import { describe, expect, it } from "vitest";
import { applyUsageSemantics, resolveUsageMode } from "./themes";

describe("resolveUsageMode", () => {
  const config = {
    global: "remaining" as const,
    providerOverrides: { claude: "used" as const, codex: "remaining" as const },
  };

  it("falls back to the global mode when no override exists", () => {
    expect(resolveUsageMode(config, "copilot")).toBe("remaining");
  });

  it("honors per-provider overrides", () => {
    expect(resolveUsageMode(config, "claude")).toBe("used");
    expect(resolveUsageMode(config, "codex")).toBe("remaining");
  });

  it("account overrides beat provider overrides (future-safe hook)", () => {
    expect(
      resolveUsageMode({ ...config, accountOverrides: { "acc-1": "hybrid" } }, "claude", "acc-1"),
    ).toBe("hybrid");
  });
});

describe("applyUsageSemantics", () => {
  it("used mode: arc follows the primary used value (V8.4 contract)", () => {
    const s = applyUsageSemantics("used", 0.73);
    // V8.4 rule: the arc ALWAYS displays the same fraction as the primary
    // value, so text, arc endpoint, and accessible name cannot disagree.
    expect(s.arc).toBeCloseTo(0.27);
    expect(s.value).toBeCloseTo(27);
    expect(s.label).toBe("used");
  });

  it("remaining mode: arc and value both read remaining", () => {
    const s = applyUsageSemantics("remaining", 0.73);
    expect(s.value).toBeCloseTo(73);
    expect(s.label).toBe("remaining");
  });

  it("hybrid mode: arc shows remaining, value leads with used", () => {
    const s = applyUsageSemantics("hybrid", 0.73);
    expect(s.arc).toBeCloseTo(0.73);
    expect(s.value).toBeCloseTo(27);
    expect(s.secondary).toBeCloseTo(73);
  });

  it("null stays null in every mode", () => {
    for (const m of ["used", "remaining", "hybrid"] as const) {
      expect(applyUsageSemantics(m, null).value).toBeNull();
    }
  });
});
