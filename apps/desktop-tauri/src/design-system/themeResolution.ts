import { CANONICAL_THEME } from "./themeCatalog";

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
 * Production is intentionally locked to one composition and one visual token
 * set until the foundation is proven. Legacy per-profile and per-surface
 * selections are ignored rather than changing the active structure.
 */
export function resolveCatalogTheme(
  _settings: CatalogThemeSettings,
  _surface: CatalogSurfaceId,
): { slug: string; source: CatalogThemeSource } {
  return { slug: CANONICAL_THEME.slug, source: "default" };
}
