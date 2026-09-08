/**
 * Phase 5: pure, deterministic provider layout.
 *
 * Same input (provider ids, in the same order) always produces the same
 * output positions -- no `Math.random()`, no per-launch variation (owner
 * Phase 5 section 38). Ordering is the caller's responsibility; this
 * module sorts ids itself so layout is stable even if callers pass
 * providers in a different order between renders (e.g. after a snapshot
 * refresh reorders the live-provider array).
 *
 * Scaling strategy (owner section 14): up to `PRIMARY_RING_CAPACITY`
 * providers sit on one primary ring around the core. Beyond that, the
 * remainder sit on a second, smaller, less prominent ring -- never one
 * ring stretched to fit 70 bodies, and never heavy per-body geometry
 * instantiated for providers that aren't part of either ring (there is
 * no "dormant catalog" tier in this prototype; see
 * PHASE5_3D_PROTOTYPE.md's known limitations for why a third rail tier
 * was deferred).
 */

export interface ScenePosition {
  x: number;
  y: number;
  z: number;
}

export const PRIMARY_RING_CAPACITY = 12;
const PRIMARY_RING_RADIUS_MAX = 6;
/** Floor for the primary ring's radius at low provider counts (Phase 5.1
 *  owner sections 9/26 fix): a fixed radius-6 ring with only 2 bodies on
 *  it left them looking like debris lost in a huge empty void in the
 *  first native capture. The ring now grows with occupancy instead of
 *  starting at full size immediately. */
const PRIMARY_RING_RADIUS_MIN = 3;
export const SECONDARY_RING_RADIUS = 10;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Primary ring radius as a function of how many providers actually sit
 *  on it -- 2 providers get a small, tight ring; the ring reaches its
 *  full radius once the ring is at capacity. Exported so the engine's
 *  camera framing can match the same real geometry instead of guessing
 *  at fixed distance buckets. */
export function primaryRingRadiusFor(primaryCount: number): number {
  if (primaryCount <= 2) return PRIMARY_RING_RADIUS_MIN;
  const t = clamp01((primaryCount - 2) / (PRIMARY_RING_CAPACITY - 2));
  return PRIMARY_RING_RADIUS_MIN + (PRIMARY_RING_RADIUS_MAX - PRIMARY_RING_RADIUS_MIN) * t;
}

/** Single-provider composition: centered, not orbiting a huge empty ring
 *  (owner section 59) -- placed a short, fixed distance from the core so
 *  the camera can frame both in one composition. */
const SINGLE_PROVIDER_POSITION: ScenePosition = { x: 0, y: 0, z: PRIMARY_RING_RADIUS_MIN * 0.6 };

function ringPosition(index: number, count: number, radius: number): ScenePosition {
  const angle = (index / count) * Math.PI * 2;
  return {
    x: Math.cos(angle) * radius,
    y: 0,
    z: Math.sin(angle) * radius,
  };
}

/**
 * Compute deterministic scene positions for a set of provider ids.
 * Returns a `Map` keyed by id so callers never need to zip arrays back
 * together by index (a real source of bugs if a provider drops out
 * between renders).
 */
export function computeProviderLayout(
  providerIds: readonly string[],
): Map<string, ScenePosition> {
  const positions = new Map<string, ScenePosition>();
  const sorted = [...providerIds].sort();

  if (sorted.length === 0) return positions;

  if (sorted.length === 1) {
    positions.set(sorted[0], SINGLE_PROVIDER_POSITION);
    return positions;
  }

  const primary = sorted.slice(0, PRIMARY_RING_CAPACITY);
  const secondary = sorted.slice(PRIMARY_RING_CAPACITY);
  const primaryRadius = primaryRingRadiusFor(primary.length);

  primary.forEach((id, index) => {
    positions.set(id, ringPosition(index, primary.length, primaryRadius));
  });
  secondary.forEach((id, index) => {
    positions.set(id, ringPosition(index, secondary.length, SECONDARY_RING_RADIUS));
  });

  return positions;
}

/** Which ring a provider id was assigned to, for material/scale decisions
 *  (e.g. the secondary ring may render at a slightly smaller uniform
 *  scale -- never a per-provider "importance" scale, which owner section
 *  13 explicitly forbids). */
export function ringForProvider(
  providerId: string,
  providerIds: readonly string[],
): "single" | "primary" | "secondary" {
  const sorted = [...providerIds].sort();
  if (sorted.length <= 1) return "single";
  const index = sorted.indexOf(providerId);
  if (index < 0) return "secondary";
  return index < PRIMARY_RING_CAPACITY ? "primary" : "secondary";
}
