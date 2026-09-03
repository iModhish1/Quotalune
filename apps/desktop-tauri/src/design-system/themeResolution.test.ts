import { describe, expect, it } from "vitest";

import { resolveCatalogTheme } from "./themeResolution";

describe("resolveCatalogTheme", () => {
  it("resolves surface over profile over global over default", () => {
    const settings = {
      catalogTheme: "03-solar-ember",
      activeProfileCatalogTheme: "02-aurora-bloom",
      surfaceCatalogThemes: { taskbar: "12-crimson-nova" },
    };

    expect(resolveCatalogTheme(settings, "taskbar")).toEqual({
      slug: "12-crimson-nova",
      source: "surface",
    });
    expect(resolveCatalogTheme(settings, "top")).toEqual({
      slug: "02-aurora-bloom",
      source: "profile",
    });
    expect(
      resolveCatalogTheme({ ...settings, activeProfileCatalogTheme: null }, "top"),
    ).toEqual({ slug: "03-solar-ember", source: "global" });
    expect(resolveCatalogTheme({}, "hud")).toEqual({
      slug: "01-obsidian-orbit",
      source: "default",
    });
  });

  it("ignores corrupt values at every inherited level", () => {
    expect(
      resolveCatalogTheme(
        {
          catalogTheme: "missing-global",
          activeProfileCatalogTheme: "missing-profile",
          surfaceCatalogThemes: { edge: "missing-surface" },
        },
        "edge",
      ),
    ).toEqual({ slug: "01-obsidian-orbit", source: "default" });
  });
});
