import type { CSSProperties } from "react";
import { CANONICAL_THEME, catalogBySlug } from "./themeCatalog";
import { resolveCatalogTheme, type CatalogThemeSettings } from "./themeResolution";

/** Settings and provider management inherit profile/global Structure Theme.
 * Dashboard retains its explicit surface override inside this shared shell. */
export function workspaceThemeStyle(settings: CatalogThemeSettings & {logoVariant?: string}): CSSProperties {
  const theme = catalogBySlug(resolveCatalogTheme(settings).slug) ?? CANONICAL_THEME;
  return {
    "--workspace-control-accent": ({silver:"#386f5e",arctic:"#326c86",aurora:"#367c62",ember:"#92583c",violet:"#695490"} as Record<string,string>)[settings.logoVariant ?? "silver"] ?? "#386f5e",
    "--qa-analytics-surface-opaque": theme.core, "--qa-analytics-text-primary": theme.material?.text ?? "#f0f4f8", "--qa-analytics-accent":theme.accent,
    "--workspace-bg": theme.bg[0], "--workspace-surface": theme.core,
    "--workspace-edge": theme.coreEdge, "--workspace-accent": theme.accent,
    "--workspace-accent-secondary": theme.accent2,
    "--text-primary": theme.material?.text ?? "#f0f4f8",
    "--text-secondary": theme.material?.muted ?? "#aeb9c5",
    "--text-muted": theme.material?.muted ?? "#aeb9c5",
    "--border-color": theme.coreEdge,
    "--provider-detail-sticky-bg": theme.core,
    "--provider-row-bg": theme.core,
    "--provider-row-text-primary": theme.material?.text ?? "#f0f4f8",
    "--provider-row-text-secondary": theme.material?.muted ?? "#aeb9c5",
    "--provider-detail-sticky-shadow": "transparent",
    "--provider-row-bg-hover": `color-mix(in srgb, ${theme.accent} 10%, ${theme.core})`,
    "--provider-row-bg-selected": `color-mix(in srgb, ${theme.accent} 18%, ${theme.core})`,
    colorScheme: theme.material?.light ? "light" : "dark",
  } as CSSProperties;
}
