import { describe, expect, it } from "vitest";

import { resolveCatalogTheme } from "./themeResolution";

describe("resolveCatalogTheme", () => {
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
