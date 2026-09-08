/**
 * Phase 5: resolves ONE provider's identity color for the 3D scene,
 * respecting the existing "Follow Structure" vs "Independent" Provider
 * Presentation distinction (owner section 17) -- never a second, 3D-only
 * color system.
 *
 * - "Follow Structure" (`resolveVisualComposition(...).presentationSource
 *   === "followStructure"`): the provider takes the resolved Structure
 *   Theme's own `providerColors[providerId]`, falling back to the
 *   theme's `accent` when that theme has no explicit entry for this
 *   provider -- exactly the same source `CatalogTheme.providerColors`
 *   Phase 3.6 already established as authoritative.
 * - "Independent": the provider keeps its own authoritative color,
 *   resolved from the existing `--chart-<provider>` CSS custom
 *   properties (`chartPalette.ts`'s `PROVIDER_TOKEN` table, already used
 *   by every 2D chart) via `getComputedStyle` against the real DOM --
 *   not a new hardcoded hex table.
 */
import type { CatalogTheme } from "../../../design-system/themeCatalog";
import type { ResolvedVisualComposition } from "../../../design-system/visualComposition";
import { providerCreditsColor } from "../../../components/charts/chartPalette";

/** Extracts the `--chart-*` custom property name from a
 *  `providerCreditsColor(...)` CSS `var(...)` expression, e.g.
 *  `"var(--chart-claude, var(--provider-accent, var(--chart-credits)))"` ->
 *  `"--chart-claude"`. Returns `null` for a provider with no dedicated
 *  token (the plain `"var(--provider-accent, var(--chart-credits))"` form). */
function extractCssVarName(cssExpr: string): string | null {
  const match = /^var\((--[a-z0-9-]+)/i.exec(cssExpr);
  return match ? match[1] : null;
}

/** Reads a CSS custom property's real computed value from the DOM (the
 *  same cascade every 2D chart already resolves through) -- `null` when
 *  unavailable (no DOM, property unset, or a non-hex value this parser
 *  doesn't recognize). Kept intentionally simple: this project's
 *  `--chart-*` tokens are always plain hex/rgb strings, never nested
 *  `var()` chains this needs to walk further. */
function readComputedCssColor(varName: string, root: Element | null): string | null {
  if (!root || typeof getComputedStyle !== "function") return null;
  try {
    const value = getComputedStyle(root).getPropertyValue(varName).trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export interface IdentityColorContext {
  theme: CatalogTheme;
  composition: ResolvedVisualComposition;
  /** The real DOM root to resolve `--chart-*` custom properties against
   *  (normally `document.documentElement`) -- injected rather than read
   *  globally so this stays testable without a real DOM. */
  domRoot: Element | null;
}

/** Resolve one provider's identity color, hex/CSS-color-string. Always
 *  returns something renderable (falls back to the theme's own `accent`
 *  when neither source can provide a real value) -- never throws, never
 *  silently returns transparent/undefined. */
export function resolveProviderIdentityColor(
  providerId: string,
  context: IdentityColorContext,
): string {
  const { theme, composition, domRoot } = context;

  if (composition.presentationSource === "followStructure") {
    return theme.providerColors[providerId] ?? theme.accent;
  }

  const cssExpr = providerCreditsColor(providerId);
  const varName = extractCssVarName(cssExpr);
  const resolved = varName ? readComputedCssColor(varName, domRoot) : null;
  return resolved ?? theme.accent;
}
