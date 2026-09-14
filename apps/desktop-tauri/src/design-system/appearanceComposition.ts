import type { CatalogTheme } from "./themeCatalog";

/**
 * Wave 1B theme composition — frontend mirror of
 * `rust/src/settings/appearance_composition.rs` (read that file's doc
 * comment first; this module intentionally does not re-explain the
 * architecture reasoning, only the resolution/display logic that lives on
 * the frontend).
 *
 * `floatingStructures` is deliberately NOT one of these scopes: it already
 * has real Global-vs-Override semantics today via `surface_catalog_themes`/
 * `resolveCatalogTheme()` in `themeResolution.ts` (empty override for a
 * surface = follows `catalogTheme`; present = explicit). Duplicating that
 * here would be exactly the "parallel theme system" this wave was told not
 * to build.
 */
export type AppearanceScopeId =
  | "quotalisLogo"
  | "providerIdentity"
  | "tray"
  | "workspaceBackground";

export const APPEARANCE_SCOPE_IDS: readonly AppearanceScopeId[] = [
  "quotalisLogo",
  "providerIdentity",
  "tray",
  "workspaceBackground",
];

export type AppearanceSource = "global" | "override";

/** Matches the Rust struct's camelCase field names exactly (serde
 * `rename_all = "camelCase"` on `AppearanceComposition`). */
export interface AppearanceComposition {
  quotalisLogo: AppearanceSource;
  providerIdentity: AppearanceSource;
  tray: AppearanceSource;
  workspaceBackground: AppearanceSource;
}

/** Same default every user who has never touched this field gets from the
 * Rust side (`impl Default for AppearanceSource`): every scope keeps its
 * own current explicit value, so nothing visibly changes until the user
 * opts a scope into Global. */
export const DEFAULT_APPEARANCE_COMPOSITION: AppearanceComposition = {
  quotalisLogo: "override",
  providerIdentity: "override",
  tray: "override",
  workspaceBackground: "override",
};

/** Human-readable label for a scope, used by the "what owns each
 * appearance" summary (Wave 1B §6/§16 — SOURCE vs RESOLVED). */
export const APPEARANCE_SCOPE_LABELS: Record<AppearanceScopeId, string> = {
  quotalisLogo: "Quotalis Logo",
  providerIdentity: "Provider Identity",
  tray: "Tray",
  workspaceBackground: "Background",
};

/**
 * Resolves what a scope's Global source maps to, given the currently
 * applied Main Application theme. Returns `undefined` when the theme has no
 * recommendation for this scope — callers fall back to the scope's current
 * explicit value rather than treating an absent recommendation as an error
 * or blanking the appearance.
 */
export function globalRecommendationFor(
  scope: AppearanceScopeId,
  mainTheme: CatalogTheme,
): string | undefined {
  const recommended = mainTheme.recommendedAppearance;
  if (!recommended) return undefined;
  switch (scope) {
    case "quotalisLogo":
      return recommended.quotalisLogo;
    case "providerIdentity":
      return recommended.providerIdentity;
    case "tray":
      return recommended.trayStyle;
    case "workspaceBackground":
      return recommended.workspaceBackground;
    default:
      return undefined;
  }
}

/**
 * Resolves the value a scope actually renders with (RESOLVED, distinct from
 * SOURCE — Wave 1B §16). `explicitValue` is the scope's own current flat
 * setting (e.g. `settings.logoVariant`) — used directly when the scope is
 * Override, and used as the fallback when the scope is Global but the
 * applied theme has no recommendation for it (see `globalRecommendationFor`).
 */
export function resolveAppearanceScope(
  scope: AppearanceScopeId,
  composition: AppearanceComposition,
  mainTheme: CatalogTheme,
  explicitValue: string,
): string {
  if (composition[scope] === "override") return explicitValue;
  return globalRecommendationFor(scope, mainTheme) ?? explicitValue;
}

/**
 * The compact "what owns each appearance" summary line for one scope
 * (Wave 1B §6): "Following Main Application" when Global, or the resolved
 * display value when Override — matching the owner's exact example format.
 */
export function appearanceScopeSummaryLabel(
  scope: AppearanceScopeId,
  composition: AppearanceComposition,
  explicitDisplayValue: string,
): string {
  if (composition[scope] === "global") return "Following Main Application";
  return explicitDisplayValue;
}
