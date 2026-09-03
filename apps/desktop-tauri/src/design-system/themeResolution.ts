import { catalogBySlug } from "./themeCatalog";

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

function knownSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  return catalogBySlug(value)?.slug ?? null;
}

/** One deterministic precedence chain shared by every production surface. */
export function resolveCatalogTheme(
  settings: CatalogThemeSettings,
  surface: CatalogSurfaceId,
): { slug: string; source: CatalogThemeSource } {
  const surfaceTheme = knownSlug(settings.surfaceCatalogThemes?.[surface]);
  if (surfaceTheme) return { slug: surfaceTheme, source: "surface" };

  const profileTheme = knownSlug(settings.activeProfileCatalogTheme);
  if (profileTheme) return { slug: profileTheme, source: "profile" };

  const globalTheme = knownSlug(settings.catalogTheme);
  if (globalTheme) return { slug: globalTheme, source: "global" };

  return { slug: DEFAULT_CATALOG_THEME, source: "default" };
}
