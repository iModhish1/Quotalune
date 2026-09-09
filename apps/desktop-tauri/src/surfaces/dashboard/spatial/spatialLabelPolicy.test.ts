import { describe, expect, it } from "vitest";
import {
  spatialLabelDensityFor,
  shouldShowSpatialLabel,
  LABEL_ALL_THRESHOLD,
  LABEL_FRONT_ONLY_THRESHOLD,
} from "./spatialLabelPolicy";

describe("spatialLabelDensityFor", () => {
  it("shows all labels at 1-8 providers", () => {
    for (const count of [1, 2, 6, 8]) {
      expect(spatialLabelDensityFor(count)).toBe("all");
    }
  });

  it("shows only front-tier labels at 9-16 providers", () => {
    for (const count of [9, 12, 16]) {
      expect(spatialLabelDensityFor(count)).toBe("frontOnly");
    }
  });

  it("shows only selected/hover labels at 17+ providers", () => {
    for (const count of [17, 24, 70]) {
      expect(spatialLabelDensityFor(count)).toBe("selectedHoverOnly");
    }
  });

  it("thresholds are exactly 8 and 16", () => {
    expect(LABEL_ALL_THRESHOLD).toBe(8);
    expect(LABEL_FRONT_ONLY_THRESHOLD).toBe(16);
  });
});

describe("shouldShowSpatialLabel", () => {
  it("selection always wins regardless of count or tier", () => {
    expect(shouldShowSpatialLabel(24, "far", true, false)).toBe(true);
  });

  it("hover always wins regardless of count or tier", () => {
    expect(shouldShowSpatialLabel(24, "far", false, true)).toBe(true);
  });

  it("at <=8 providers every tier shows a label even without selection/hover", () => {
    expect(shouldShowSpatialLabel(6, "back", false, false)).toBe(true);
    expect(shouldShowSpatialLabel(1, "hero", false, false)).toBe(true);
  });

  it("at 9-16 providers, front/hero tiers show labels but others do not", () => {
    expect(shouldShowSpatialLabel(12, "front", false, false)).toBe(true);
    expect(shouldShowSpatialLabel(12, "hero", false, false)).toBe(true);
    expect(shouldShowSpatialLabel(12, "back", false, false)).toBe(false);
    expect(shouldShowSpatialLabel(12, "back", true, false)).toBe(true);
  });

  it("at 17+ providers, no unselected/unhovered node shows a label, regardless of tier", () => {
    expect(shouldShowSpatialLabel(24, "front", false, false)).toBe(false);
    expect(shouldShowSpatialLabel(24, "back", false, false)).toBe(false);
  });
});
