import type { CSSProperties } from "react";
import { CANONICAL_THEME, catalogBySlug } from "./themeCatalog";
import { resolveCatalogTheme, type CatalogThemeSettings } from "./themeResolution";

/** Settings and provider management inherit profile/global Structure Theme.
 * Dashboard retains its explicit surface override inside this shared shell. */
export function workspaceThemeStyle(settings: CatalogThemeSettings): CSSProperties {
  const theme = catalogBySlug(resolveCatalogTheme(settings).slug) ?? CANONICAL_THEME;
  return {
    "--workspace-bg": theme.bg[0], "--workspace-surface": theme.core,
    "--workspace-edge": theme.coreEdge, "--workspace-accent": theme.accent,
    "--text-primary": theme.material?.text ?? "#f0f4f8",
    "--text-secondary": theme.material?.muted ?? "#aeb9c5",
    "--text-muted": theme.material?.muted ?? "#aeb9c5",
    "--border-color": theme.coreEdge,
    "--provider-detail-sticky-bg": theme.core,
    "--provider-row-bg": theme.core,
    "--provider-row-bg-hover": `color-mix(in srgb, ${theme.accent} 10%, ${theme.core})`,
    "--provider-row-bg-selected": `color-mix(in srgb, ${theme.accent} 18%, ${theme.core})`,
    colorScheme: theme.material?.light ? "light" : "dark",
  } as CSSProperties;
}
