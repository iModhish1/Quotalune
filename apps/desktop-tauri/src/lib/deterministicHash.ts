/**
 * A tiny deterministic string hash used anywhere this project needs
 * "the same input always produces the same small amount of visual
 * variation" without `Math.random()` -- static starfield/background
 * point placement, per-provider depth/position jitter, and similar
 * cosmetic-only variation where a stable, reproducible result matters
 * more than true randomness (no per-launch flicker, identical native
 * screenshots across runs, no seed to persist).
 *
 * Originally written inline in the 3D engine (`providers3d/engine.ts`);
 * pulled out here so the Spatial (DOM/SVG/CSS) surface can use the exact
 * same hash instead of a second copy-pasted implementation.
 */

/** FNV-1a-style hash, folded into `[0, 1)`. */
export function hashUnitInterval(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
