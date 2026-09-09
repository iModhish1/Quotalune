import { CANONICAL_THEME, catalogBySlug } from "./themeCatalog";

export const DEFAULT_CATALOG_THEME = "01-obsidian-orbit";

export type CatalogSurfaceId =
  | "taskbar"
  | "top"
  | "edge"
  | "hud"
  | "quick"
  | "dashboard";

export type CatalogThemeSource = "surface" | "profile" | "global" | "default";

export interface CatalogThemeSettings {
  catalogTheme?: string | null;
  activeProfileCatalogTheme?: string | null;
  surfaceCatalogThemes?: Partial<Record<CatalogSurfaceId, string>>;
}

/**
 * Material precedence is independent of structure. Unknown/archived values
 * fall through to the next valid scope, never to an unrelated experimental theme.
 */
export function resolveCatalogTheme(
  settings: CatalogThemeSettings,
  surface?: CatalogSurfaceId,
): { slug: string; source: CatalogThemeSource } {
  const candidates = [[surface ? settings.surfaceCatalogThemes?.[surface] : undefined,"surface"],
    [settings.activeProfileCatalogTheme,"profile"],[settings.catalogTheme,"global"]] as const;
  for(const [value,source] of candidates){
    const theme=value ? catalogBySlug(value) : undefined;
    if(theme)return {slug:theme.slug,source};
  }
  return { slug: CANONICAL_THEME.slug, source: "default" };
}
