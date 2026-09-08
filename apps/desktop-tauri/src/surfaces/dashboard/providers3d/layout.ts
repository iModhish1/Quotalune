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
const PRIMARY_RING_RADIUS = 6;
const SECONDARY_RING_RADIUS = 10;

/** Single-provider composition: centered, not orbiting a huge empty ring
 *  (owner section 59) -- placed a short, fixed distance from the core so
 *  the camera can frame both in one composition. */
const SINGLE_PROVIDER_POSITION: ScenePosition = { x: 0, y: 0, z: PRIMARY_RING_RADIUS * 0.6 };

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

  primary.forEach((id, index) => {
    positions.set(id, ringPosition(index, primary.length, PRIMARY_RING_RADIUS));
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
