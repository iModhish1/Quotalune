import type { CSSProperties } from "react";
import { CANONICAL_THEME, catalogBySlug } from "./themeCatalog";
import { resolveCatalogTheme, type CatalogThemeSettings } from "./themeResolution";

/** Settings and provider management inherit profile/global Structure Theme.
 * Dashboard retains its explicit surface override inside this shared shell. */
export function workspaceThemeStyle(settings: CatalogThemeSettings & {logoVariant?: string}): CSSProperties {
  const theme = catalogBySlug(resolveCatalogTheme(settings).slug) ?? CANONICAL_THEME;
  // App appearance can change independently of the selected structure material.
  // CSS resolves these fallbacks live when the system/profile appearance changes.
  const bg = `var(--workspace-light-bg, ${theme.bg[0]})`;
  const surface = `var(--workspace-light-surface, ${theme.core})`;
  const edge = `var(--workspace-light-edge, ${theme.coreEdge})`;
  const accent = `var(--workspace-light-accent, ${theme.accent})`;
  const text = `var(--workspace-light-text, ${theme.material?.text ?? "#f0f4f8"})`;
  const muted = `var(--workspace-light-muted, ${theme.material?.muted ?? "#aeb9c5"})`;
  return {
    "--workspace-control-accent": ({silver:"#386f5e",arctic:"#326c86",aurora:"#367c62",ember:"#92583c",violet:"#695490"} as Record<string,string>)[settings.logoVariant ?? "silver"] ?? "#386f5e",
    "--qa-analytics-surface-opaque": surface, "--qa-analytics-text-primary": text, "--qa-analytics-accent":accent,
    "--workspace-bg": bg, "--workspace-surface": surface,
    "--workspace-edge": edge, "--workspace-accent": accent,
    "--workspace-accent-secondary": theme.accent2,
    "--text-primary": text,
    "--text-secondary": muted,
    "--text-muted": muted,
    "--border-color": edge,
    "--provider-detail-sticky-bg": surface,
    "--provider-row-bg": surface,
    "--provider-row-text-primary": text,
    "--provider-row-text-secondary": muted,
    "--provider-detail-sticky-shadow": "transparent",
    "--provider-row-bg-hover": `color-mix(in srgb, ${accent} 10%, ${surface})`,
    "--provider-row-bg-selected": `color-mix(in srgb, ${accent} 18%, ${surface})`,
    colorScheme: theme.material?.light ? "light" : "dark",
  } as CSSProperties;
}
