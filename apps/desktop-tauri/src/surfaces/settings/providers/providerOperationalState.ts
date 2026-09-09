import {observationFreshness} from "../../../lib/analytics/freshness";
import type { ProviderUsageSnapshot } from "../../../types/bridge";

export type ProviderOperationalState = "ok" | "stale" | "error" | "disabled" | "loading" | "authRequired" | "offline" | "unavailable";

/** Enabled is a monitoring preference, not evidence of authentication. */
export function providerOperationalState(enabled: boolean, snapshot: ProviderUsageSnapshot | null, now = Date.now(), cadenceSecs?: number | null): ProviderOperationalState {
  if (!enabled) return "disabled";
  if (!snapshot) return "unavailable";
  if (snapshot.errorState === "needsAuthentication" || snapshot.errorState === "expiredSession") return "authRequired";
  if (snapshot.errorState === "localRuntimeOffline") return "offline";
  if (snapshot.errorState !== "ready" || snapshot.error) return "error";
  const freshness = observationFreshness(snapshot.updatedAt, cadenceSecs, now);
  if (freshness.state === "stale") return "stale";
  if (freshness.ageSeconds === null) return "unavailable";
  return "ok";
}
