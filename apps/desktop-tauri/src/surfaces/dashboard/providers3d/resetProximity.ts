/**
 * Owner section 8: the pure predicate behind the 3D scene's low-cost
 * reset-proximity marker. Pulled out of `engine.ts` (which cannot be
 * unit-tested directly in jsdom -- see `engine.test.ts`'s own note on
 * why) so this real logic gets real test coverage instead of only being
 * exercised by native proof.
 *
 * Mirrors `buildAlerts`'s `resetSoon` condition in
 * `../analytics/dashboardSelectors.ts` exactly, using the same
 * `RESET_SOON_MS` constant -- the 3D scene must never invent a second
 * "reset soon" definition that could silently drift from the 2D
 * dashboard's own alerts.
 */
import { RESET_SOON_MS } from "../analytics/dashboardSelectors";

export { RESET_SOON_MS };

/** `false` for `null`, an unparsable string, or a timestamp already in
 *  the past -- never fabricates urgency from bad/missing data. */
export function isResetSoon(resetsAt: string | null, now: number = Date.now()): boolean {
  if (!resetsAt) return false;
  const resetMs = Date.parse(resetsAt);
  if (Number.isNaN(resetMs)) return false;
  return resetMs > now && resetMs - now <= RESET_SOON_MS;
}
