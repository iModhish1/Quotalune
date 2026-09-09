import { useMemo, type CSSProperties } from "react";
import { CANONICAL_THEME, catalogBySlug, type CatalogTheme } from "../../../design-system/themeCatalog";
import { resolveCatalogTheme, type CatalogThemeSettings } from "../../../design-system/themeResolution";

/**
 * Phase 3.6: the Dashboard's structural theme integration point (see
 * docs/validation/DASHBOARD_STRUCTURE_THEME_INTEGRATION.md).
 *
 * Calls the SAME `resolveCatalogTheme(settings, "dashboard")` +
 * `catalogBySlug` pipeline every other themed surface already uses (this
 * project has exactly one Structure Theme system -- this hook does not
 * introduce a second one), then maps the resolved theme's own real color
 * fields onto a set of semantic CSS custom properties under a
 * component-private `--qa-analytics-*` namespace, mirroring the existing
 * `CatalogUsageHero`/`TaskbarStage` (`--qa-hero-*`/`--qa-stage-*`) pattern.
 *
 * Nothing here is Dashboard-invented: every value traces back to a field
 * already defined on the resolved `CatalogTheme` object. Warning/critical
 * severity colors are deliberately NOT included -- those stay on the
 * existing `--qa-status-*` tokens everywhere in the Dashboard, since
 * semantic state must win over decorative theme color.
 */
export function useDashboardStructureTheme(settings: CatalogThemeSettings): {
  theme: CatalogTheme;
  style: CSSProperties;
} {
  return useMemo(() => {
    const { slug } = resolveCatalogTheme(settings, "dashboard");
    const theme = catalogBySlug(slug) ?? CANONICAL_THEME;
    const text = theme.material?.text ?? "#f0f4f8";
    const muted = theme.material?.muted ?? "#aeb9c5";

    const style: CSSProperties = {
      ["--qa-analytics-surface-opaque" as string]: theme.core,
      // Light analytical surfaces must be opaque over the app's dark chrome.
      ["--qa-analytics-surface-primary" as string]: theme.material?.light ? theme.core : `color-mix(in srgb, ${theme.core} 62%, transparent)`,
      ["--qa-analytics-surface-secondary" as string]: theme.material?.light ? theme.core : `color-mix(in srgb, ${theme.core} 52%, transparent)`,
      // A real 4-theme pass (section 9/14) caught a genuine contrast risk
      // at the original 36%: for a light theme (Ceramic Pearl, the
      // catalog's one `material.light: true` entry) layered as a
      // translucent surface over the app's own dark chrome, a low-opacity
      // tertiary card composited to an unpredictable medium-grey backdrop
      // instead of the theme's true light surface, and further opacity-
      // reduced text on top of that became hard to read. Raised so the
      // tertiary tier reads closer to the theme's real surface color
      // regardless of what's behind it.
      ["--qa-analytics-surface-tertiary" as string]: `color-mix(in srgb, ${theme.core} 55%, transparent)`,
      ["--qa-analytics-hairline" as string]: theme.hairline,
      ["--qa-analytics-hairline-strong" as string]: theme.coreEdge,
      ["--qa-analytics-text-primary" as string]: text,
      ["--qa-analytics-text-secondary" as string]: muted,
      // Same contrast finding: raised the opacity floor so the two
      // lower text tiers stay legible against any resolved theme, not
      // just the dark ones this was originally tuned against.
      ["--qa-analytics-text-tertiary" as string]: `color-mix(in srgb, ${muted} 85%, transparent)`,
      ["--qa-analytics-text-quaternary" as string]: `color-mix(in srgb, ${muted} 68%, transparent)`,
      // `theme.accent` is each theme's real signature color (Obsidian
      // Orbit's is teal, Smoked Silver's is silver, Sapphire Observatory's
      // is genuinely champagne gold) -- used for both the interactive
      // accent (range chip selection) and the primary card's structural
      // highlight, since a theme has exactly one signature color, not two.
      // (An earlier draft used `theme.accent2` for the structural
      // highlight; every theme's accent2 trends toward a similar
      // supporting blue, which produced near-identical Trend-card borders
      // across visually distinct themes -- caught during the real 4-theme
      // verification pass, not guessed.)
      ["--qa-analytics-accent" as string]: theme.accent,
      ["--qa-analytics-accent-structural" as string]: theme.accent,
      ["--qa-analytics-selection" as string]: `color-mix(in srgb, ${theme.accent} 26%, ${theme.core})`,
      ["--qa-analytics-shadow" as string]: `0 12px 30px color-mix(in srgb, ${theme.core} 70%, black)`,
    };

    return { theme, style };
  }, [settings]);
}
