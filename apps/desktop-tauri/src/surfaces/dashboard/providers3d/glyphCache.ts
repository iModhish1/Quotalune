/**
 * Phase 6 owner section 6: real provider glyph presence in the 3D scene,
 * reusing the exact same brand SVG assets `ProviderIcon.tsx` uses
 * elsewhere in the app (`components/providers/providerIcons.ts`) --
 * never a second icon registry.
 *
 * Rasterizing an SVG to a canvas/texture is inherently async (the
 * browser decodes the image off-thread), so this module caches one
 * `HTMLImageElement` per `(providerId, tint color)` pair for the whole
 * process lifetime -- a given provider/theme combination is decoded
 * exactly once, never per frame and never per mount (owner section 6:
 * "no per-frame rasterization"). The tint color is the provider's real
 * resolved identity color (Follow Structure or Independent, whichever
 * `sceneModel.ts` already resolved) substituted for the SVG's
 * `currentColor` placeholder -- an `<img>` rendered from a data URI has
 * no CSS context to inherit `currentColor` from, so the substitution has
 * to happen before rasterization.
 */
import { getProviderIcon } from "../../../components/providers/providerIcons";

interface CachedGlyph {
  image: HTMLImageElement;
  ready: boolean;
}

const cache = new Map<string, CachedGlyph>();

/** Returns the cached glyph image for this exact (provider, color) pair
 *  if it has already finished decoding, or `null` if it's still loading
 *  (or the provider has no brand SVG at all, in which case callers fall
 *  back to the existing fallback-letter/name-only label). `onReady`
 *  fires exactly once, the first time this pair finishes decoding --
 *  callers use it to trigger a one-time redraw + dirty-render request,
 *  never a polling loop. */
export function getCachedGlyphImage(
  providerId: string,
  colorHex: string,
  onReady: () => void,
): HTMLImageElement | null {
  const icon = getProviderIcon(providerId);
  if (!icon.svgPath) return null;

  const key = `${providerId}:${colorHex}`;
  const existing = cache.get(key);
  if (existing) return existing.ready ? existing.image : null;

  const tinted = icon.svgPath.replace(/currentColor/gi, colorHex);
  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tinted)}`;
  const image = new Image();
  const entry: CachedGlyph = { image, ready: false };
  cache.set(key, entry);
  image.addEventListener(
    "load",
    () => {
      entry.ready = true;
      onReady();
    },
    { once: true },
  );
  // A malformed/unsupported SVG should never leave the sprite stuck
  // blank forever -- just never mark it ready, so callers keep using
  // the name-only fallback they already draw before this resolves.
  image.addEventListener("error", () => cache.delete(key), { once: true });
  image.src = dataUri;
  return null;
}

/** Test-only escape hatch -- production code never needs to clear this. */
export function __clearGlyphCacheForTests(): void {
  cache.clear();
}
