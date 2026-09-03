import { describe, expect, it } from "vitest";

import { THEME_CATALOG } from "./themeCatalog";

describe("theme catalog", () => {
  it("keeps fifteen complete, uniquely identified production themes", () => {
    expect(THEME_CATALOG).toHaveLength(15);
    expect(new Set(THEME_CATALOG.map((theme) => theme.slug))).toHaveLength(15);

    for (const theme of THEME_CATALOG) {
      expect(theme.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.accent2).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.accent3).toMatch(/^#[0-9a-f]{6}$/i);
      expect(new Set([theme.accent, theme.accent2, theme.accent3]).size).toBe(3);
    }
  });
});
