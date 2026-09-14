import { describe, expect, it } from "vitest";
import {
  DEFAULT_APPEARANCE_COMPOSITION,
  appearanceScopeSummaryLabel,
  globalRecommendationFor,
  resolveAppearanceScope,
  type AppearanceComposition,
} from "./appearanceComposition";
import { CANONICAL_THEME } from "./themeCatalog";

describe("DEFAULT_APPEARANCE_COMPOSITION", () => {
  it("keeps every scope on override, matching the Rust default's zero-visible-change migration guarantee", () => {
    expect(DEFAULT_APPEARANCE_COMPOSITION).toEqual({
      quotalisLogo: "override",
      providerIdentity: "override",
      tray: "override",
      workspaceBackground: "override",
    });
  });
});

describe("globalRecommendationFor", () => {
  it("reads the canonical theme's populated recommendation for scopes it defines", () => {
    expect(globalRecommendationFor("quotalisLogo", CANONICAL_THEME)).toBe("silver");
    expect(globalRecommendationFor("tray", CANONICAL_THEME)).toBe("ring");
    expect(globalRecommendationFor("workspaceBackground", CANONICAL_THEME)).toBe("cosmic");
  });

  it("returns undefined for a scope the theme has no opinion on, rather than throwing or fabricating one", () => {
    // CANONICAL_THEME's recommendedAppearance omits providerIdentity.
    expect(globalRecommendationFor("providerIdentity", CANONICAL_THEME)).toBeUndefined();
  });

  it("returns undefined entirely when a theme has no recommendedAppearance block at all", () => {
    const themeWithNoOpinion = { ...CANONICAL_THEME, recommendedAppearance: undefined };
    expect(globalRecommendationFor("quotalisLogo", themeWithNoOpinion)).toBeUndefined();
  });
});

describe("resolveAppearanceScope", () => {
  it("uses the explicit value directly when the scope is Override, ignoring any theme recommendation", () => {
    const composition: AppearanceComposition = { ...DEFAULT_APPEARANCE_COMPOSITION, quotalisLogo: "override" };
    expect(resolveAppearanceScope("quotalisLogo", composition, CANONICAL_THEME, "arctic")).toBe("arctic");
  });

  it("uses the theme's recommendation when the scope is Global and the theme has one", () => {
    const composition: AppearanceComposition = { ...DEFAULT_APPEARANCE_COMPOSITION, quotalisLogo: "global" };
    expect(resolveAppearanceScope("quotalisLogo", composition, CANONICAL_THEME, "arctic")).toBe("silver");
  });

  it("falls back to the explicit value when Global but the theme has no recommendation for this scope (never blanks it)", () => {
    const composition: AppearanceComposition = { ...DEFAULT_APPEARANCE_COMPOSITION, providerIdentity: "global" };
    expect(resolveAppearanceScope("providerIdentity", composition, CANONICAL_THEME, "adaptive")).toBe("adaptive");
  });
});

describe("appearanceScopeSummaryLabel", () => {
  it("shows 'Following Main Application' for a Global scope, not the resolved value", () => {
    const composition: AppearanceComposition = { ...DEFAULT_APPEARANCE_COMPOSITION, tray: "global" };
    expect(appearanceScopeSummaryLabel("tray", composition, "Provider Accent")).toBe(
      "Following Main Application",
    );
  });

  it("shows the scope's own explicit display value for an Override scope", () => {
    const composition: AppearanceComposition = { ...DEFAULT_APPEARANCE_COMPOSITION, tray: "override" };
    expect(appearanceScopeSummaryLabel("tray", composition, "Provider Accent")).toBe("Provider Accent");
  });
});
