import { describe, expect, it } from "vitest";
import { labelDensityPolicyFor, shouldShowLabel, LABEL_ALL_THRESHOLD, LABEL_PRIMARY_ONLY_THRESHOLD } from "./labelPolicy";

describe("labelDensityPolicyFor", () => {
  it("shows all labels at 1-8 providers", () => {
    for (const count of [1, 2, 6, 8]) {
      expect(labelDensityPolicyFor(count)).toBe("all");
    }
  });

  it("shows only primary-ring labels at 9-16 providers", () => {
    for (const count of [9, 12, 16]) {
      expect(labelDensityPolicyFor(count)).toBe("primaryOnly");
    }
  });

  it("shows only selected/hover labels at 17+ providers", () => {
    for (const count of [17, 24, 70]) {
      expect(labelDensityPolicyFor(count)).toBe("selectedHoverOnly");
    }
  });

  it("thresholds are exactly 8 and 16", () => {
    expect(LABEL_ALL_THRESHOLD).toBe(8);
    expect(LABEL_PRIMARY_ONLY_THRESHOLD).toBe(16);
  });
});

describe("shouldShowLabel", () => {
  it("selection always wins regardless of count or ring", () => {
    expect(shouldShowLabel(24, "secondary", true, false)).toBe(true);
    expect(shouldShowLabel(70, "secondary", true, false)).toBe(true);
  });

  it("hover always wins regardless of count or ring", () => {
    expect(shouldShowLabel(24, "secondary", false, true)).toBe(true);
  });

  it("at <=8 providers every body shows a label even without selection/hover", () => {
    expect(shouldShowLabel(6, "primary", false, false)).toBe(true);
    expect(shouldShowLabel(1, "single", false, false)).toBe(true);
  });

  it("at 9-16 providers, primary ring shows labels but secondary does not (unless selected/hovered)", () => {
    expect(shouldShowLabel(12, "primary", false, false)).toBe(true);
    expect(shouldShowLabel(13, "secondary", false, false)).toBe(false);
    expect(shouldShowLabel(13, "secondary", true, false)).toBe(true);
  });

  it("at 17+ providers, no unselected/unhovered body shows a label, regardless of ring", () => {
    expect(shouldShowLabel(24, "primary", false, false)).toBe(false);
    expect(shouldShowLabel(24, "secondary", false, false)).toBe(false);
  });
});
