import { describe, expect, it } from "vitest";

import {
  ARCHIVED_THEME_SLUGS,
  CANONICAL_THEME,
  THEME_CATALOG,
  catalogBySlug,
} from "./themeCatalog";
import { LIBRARY_THEME_SLUGS } from "./themeCatalogExpansion";

describe("theme catalog", () => {
  it("offers token-only materials while keeping earlier explorations archived", () => {
    expect(THEME_CATALOG.slice(0,9).map(t=>t.slug)).toEqual([CANONICAL_THEME.slug,"sapphire-observatory","eclipse-ember","aurora-bloom-material","solar-ember-material","ceramic-pearl-material","smoked-silver","tidal-glass","ember-alloy"]);
    expect(THEME_CATALOG.slice(9).map(t=>t.slug)).toEqual(LIBRARY_THEME_SLUGS);
    expect(THEME_CATALOG).toHaveLength(24);
    expect(THEME_CATALOG.slice(9).filter(t=>t.material?.light)).toHaveLength(7);
    expect(new Set(THEME_CATALOG.map(t=>t.identity?.signature)).size).toBe(THEME_CATALOG.length);
    expect(new Set(THEME_CATALOG.map(t=>t.slug)).size).toBe(THEME_CATALOG.length);
    expect(THEME_CATALOG.every(t=>t.geometry==="orbit")).toBe(true);
    expect(CANONICAL_THEME.slug).toBe("01-obsidian-orbit");
    expect(ARCHIVED_THEME_SLUGS).toHaveLength(14);
    expect(new Set(ARCHIVED_THEME_SLUGS)).toHaveLength(14);
    expect(catalogBySlug("12-crimson-nova")).toBeUndefined();
    expect(ARCHIVED_THEME_SLUGS).toContain("12-crimson-nova");
    expect(CANONICAL_THEME.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(CANONICAL_THEME.providerColors.openai).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
