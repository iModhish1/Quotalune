import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDashboardStructureTheme } from "./useDashboardStructureTheme";
import { CANONICAL_THEME, catalogBySlug } from "../../../design-system/themeCatalog";

describe("useDashboardStructureTheme", () => {
  it("resolves to the real default (CANONICAL_THEME) when no theme setting is present", () => {
    const { result } = renderHook(() => useDashboardStructureTheme({}));
    expect(result.current.theme.slug).toBe(CANONICAL_THEME.slug);
    expect(result.current.style["--qa-analytics-accent" as never]).toBe(CANONICAL_THEME.accent);
  });

  it("respects the precedence chain: surface override wins over profile, profile wins over global", () => {
    const smokedSilver = catalogBySlug("smoked-silver")!;
    const emberAlloy = catalogBySlug("ember-alloy")!;
    const sapphire = catalogBySlug("sapphire-observatory")!;

    // Global only.
    const global = renderHook(() =>
      useDashboardStructureTheme({ catalogTheme: emberAlloy.slug }),
    );
    expect(global.result.current.theme.slug).toBe(emberAlloy.slug);

    // Profile beats global.
    const profile = renderHook(() =>
      useDashboardStructureTheme({
        catalogTheme: emberAlloy.slug,
        activeProfileCatalogTheme: sapphire.slug,
      }),
    );
    expect(profile.result.current.theme.slug).toBe(sapphire.slug);

    // Surface override beats profile and global.
    const surface = renderHook(() =>
      useDashboardStructureTheme({
        catalogTheme: emberAlloy.slug,
        activeProfileCatalogTheme: sapphire.slug,
        surfaceCatalogThemes: { dashboard: smokedSilver.slug },
      }),
    );
    expect(surface.result.current.theme.slug).toBe(smokedSilver.slug);
  });

  it("falls back to the default theme for an unknown/corrupt slug rather than an unrelated theme", () => {
    const { result } = renderHook(() =>
      useDashboardStructureTheme({ catalogTheme: "not-a-real-slug" }),
    );
    expect(result.current.theme.slug).toBe(CANONICAL_THEME.slug);
  });

  it("derives every --qa-analytics-* value from the resolved theme's own real fields -- never a fixed/hardcoded value", () => {
    const smokedSilver = catalogBySlug("smoked-silver")!;
    const { result } = renderHook(() =>
      useDashboardStructureTheme({ catalogTheme: smokedSilver.slug }),
    );
    const style = result.current.style as Record<string, string>;
    expect(style["--qa-analytics-hairline"]).toBe(smokedSilver.hairline);
    expect(style["--qa-analytics-hairline-strong"]).toBe(smokedSilver.coreEdge);
    expect(style["--qa-analytics-accent"]).toBe(smokedSilver.accent);
    expect(style["--qa-analytics-accent-structural"]).toBe(smokedSilver.accent);
    expect(style["--qa-analytics-text-primary"]).toBe(smokedSilver.material!.text);
    expect(style["--qa-analytics-text-secondary"]).toBe(smokedSilver.material!.muted);
    // Two different real themes must produce two genuinely different
    // structural accents -- this is the whole point of Phase 3.6: the
    // Dashboard must visibly differ per theme, not render one hardcoded
    // palette regardless of selection.
    const emberAlloy = catalogBySlug("ember-alloy")!;
    const other = renderHook(() => useDashboardStructureTheme({ catalogTheme: emberAlloy.slug }));
    const otherStyle = other.result.current.style as Record<string, string>;
    expect(otherStyle["--qa-analytics-accent-structural"]).not.toBe(
      style["--qa-analytics-accent-structural"],
    );
  });
});
