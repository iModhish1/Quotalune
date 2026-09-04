import { describe, expect, it } from "vitest";

import {
  ARCHIVED_THEME_SLUGS,
  CANONICAL_THEME,
  THEME_CATALOG,
  catalogBySlug,
} from "./themeCatalog";

describe("theme catalog", () => {
  it("exposes one canonical production theme and archives the earlier explorations", () => {
    expect(THEME_CATALOG).toEqual([CANONICAL_THEME]);
    expect(CANONICAL_THEME.slug).toBe("01-obsidian-orbit");
    expect(ARCHIVED_THEME_SLUGS).toHaveLength(14);
    expect(new Set(ARCHIVED_THEME_SLUGS)).toHaveLength(14);
    expect(catalogBySlug("12-crimson-nova")).toBeUndefined();
    expect(ARCHIVED_THEME_SLUGS).toContain("12-crimson-nova");
    expect(CANONICAL_THEME.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(CANONICAL_THEME.providerColors.openai).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
