import { describe, expect, it } from "vitest";

import { CANONICAL_THEME, THEME_CATALOG } from "./themeCatalog";
import { catalogMotion, catalogMotionStyle, motionDelay } from "./themeMotion";

describe("catalogMotion", () => {
  it("assigns a curated restrained motion profile to every live identity", () => {
    const characters = THEME_CATALOG.map((theme) => catalogMotion(theme).character);
    const durations = THEME_CATALOG.map((theme) => catalogMotion(theme).durationMs);

    expect(characters.slice(0, 9)).toEqual([
      "orbit",
      "reticle",
      "corona",
      "bloom",
      "detent",
      "float",
      "shutter",
      "frost",
      "facet",
    ]);
    expect(characters).toHaveLength(THEME_CATALOG.length);
    expect(new Set(characters).size).toBeGreaterThanOrEqual(10);
    expect(new Set(durations).size).toBeGreaterThanOrEqual(12);
    expect(durations.every(duration=>duration>=150&&duration<=230)).toBe(true);
  });

  it("keeps every profile bounded and tied to the catalog expansion duration", () => {
    for (const theme of THEME_CATALOG) {
      const profile = catalogMotion(theme);
      const style = catalogMotionStyle(theme);

      expect(profile.durationMs).toBe(theme.expansionMs);
      expect(profile.focusScale).toBeGreaterThanOrEqual(1.04);
      expect(profile.focusScale).toBeLessThanOrEqual(1.14);
      expect(profile.hoverLiftPx).toBeGreaterThanOrEqual(-5);
      expect(profile.hoverLiftPx).toBeLessThanOrEqual(0);
      expect(profile.enterScale).toBeGreaterThanOrEqual(0.55);
      expect(profile.enterScale).toBeLessThanOrEqual(1);
      expect(style["--qa-theme-motion-duration"]).toBe(`${theme.expansionMs}ms`);
    }
  });

  it("uses short deterministic stagger delays without exceeding the reveal budget", () => {
    const profile = catalogMotion(CANONICAL_THEME);

    expect(motionDelay(profile, 0)).toBe("0ms");
    expect(motionDelay(profile, 6)).toBe(`${profile.staggerMs * 6}ms`);
    expect(profile.staggerMs * 6).toBeLessThanOrEqual(180);
  });
});
