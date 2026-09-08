/**
 * Deterministic seeded PRNG for Demo Mode (owner Phase 5.2 section 29:
 * "One seed: one repeatable dataset" -- never `Math.random()` anywhere in
 * this module tree). mulberry32: small, fast, good-enough statistical
 * quality for cosmetic demo data, and trivially auditable.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0 || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A derived, stable sub-seed for a given (seed, key) pair -- lets each
 *  provider/field draw from its own independent-looking stream while the
 *  whole dataset still stems from one root seed, so reordering the
 *  provider list never changes an individual provider's own values. */
export function deriveSeed(rootSeed: number, key: string): number {
  let h = rootSeed >>> 0 || 1;
  for (let i = 0; i < key.length; i += 1) {
    h = Math.imul(h ^ key.charCodeAt(i), 2654435761);
    h ^= h >>> 15;
  }
  return h >>> 0 || 1;
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, 0, items.length - 1)];
}
