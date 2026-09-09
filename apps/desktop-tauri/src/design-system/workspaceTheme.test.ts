import { expect, it } from "vitest";
import { workspaceThemeStyle } from "./workspaceTheme";
import { THEME_CATALOG } from "./themeCatalog";
it("inherits profile/global theme while leaving Dashboard-specific overrides local", () => {
  const [global, profile] = THEME_CATALOG;
  const expected = workspaceThemeStyle({catalogTheme:profile.slug});
  expect(workspaceThemeStyle({catalogTheme:global.slug,activeProfileCatalogTheme:profile.slug})).toEqual(expected);
  expect(workspaceThemeStyle({catalogTheme:global.slug,surfaceCatalogThemes:{dashboard:profile.slug}})).toEqual(workspaceThemeStyle({catalogTheme:global.slug}));
});
it("does not overwrite provider identity palette tokens", () => {
  expect(Object.keys(workspaceThemeStyle({})).some(key=>key.startsWith("--chart-"))).toBe(false);
});
