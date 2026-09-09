export type FreshnessState = "fresh" | "aging" | "stale" | "unavailable";
export interface Freshness {state: FreshnessState; ageSeconds: number | null; cadenceSeconds: number | null;}
/** Classification follows the native scheduled cadence, not a fixed global
 * five-minute cutoff. Manual/unknown cadence displays age without a stale claim. */
export function observationFreshness(updatedAt: string | null | undefined, cadence: number | null | undefined, now: number): Freshness {
  const updated = updatedAt ? Date.parse(updatedAt) : NaN;
  const age = (now - updated) / 1000;
  const seconds = cadence != null && Number.isFinite(cadence) && cadence > 0 ? cadence : null;
  if (!Number.isFinite(updated) || age < -60) return {state: "unavailable", ageSeconds: null, cadenceSeconds: seconds};
  const ageSeconds = Math.max(age, 0);
  if (seconds === null) return {state: "unavailable", ageSeconds, cadenceSeconds: null};
  const grace = Math.min(60, seconds * 0.2);
  return {state: ageSeconds <= seconds + grace ? "fresh" : ageSeconds <= seconds * 3 + grace ? "aging" : "stale", ageSeconds, cadenceSeconds: seconds};
}
