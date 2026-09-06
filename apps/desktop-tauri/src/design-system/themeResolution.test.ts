import { describe, expect, it } from "vitest";

import { resolveCatalogTheme } from "./themeResolution";

describe("resolveCatalogTheme", () => {
  it("resolves selectable materials through surface, profile, global and default", () => {
    const config={catalogTheme:"smoked-silver",activeProfileCatalogTheme:"tidal-glass",surfaceCatalogThemes:{edge:"ember-alloy"}};
    expect(resolveCatalogTheme(config,"edge")).toEqual({slug:"ember-alloy",source:"surface"});
    expect(resolveCatalogTheme(config,"top")).toEqual({slug:"tidal-glass",source:"profile"});
    expect(resolveCatalogTheme({catalogTheme:"smoked-silver"},"top")).toEqual({slug:"smoked-silver",source:"global"});
  });
  it("locks every legacy scope to the canonical foundation theme", () => {
    const settings = {
      catalogTheme: "03-solar-ember",
      activeProfileCatalogTheme: "02-aurora-bloom",
      surfaceCatalogThemes: { taskbar: "12-crimson-nova" },
    };

    expect(resolveCatalogTheme(settings, "taskbar")).toEqual({
      slug: "01-obsidian-orbit",
      source: "default",
    });
    expect(resolveCatalogTheme(settings, "top")).toEqual({
      slug: "01-obsidian-orbit",
      source: "default",
    });
    expect(resolveCatalogTheme({}, "hud")).toEqual({
      slug: "01-obsidian-orbit",
      source: "default",
    });
  });

  it("does not allow corrupt or archived values to alter production surfaces", () => {
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
