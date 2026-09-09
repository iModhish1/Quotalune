import type { ProviderUsageSnapshot } from "../../../types/bridge";

export type ProviderOperationalState = "ok" | "stale" | "error" | "disabled" | "loading" | "authRequired" | "offline" | "unavailable";

/** Enabled is a monitoring preference, not evidence of authentication. */
export function providerOperationalState(enabled: boolean, snapshot: ProviderUsageSnapshot | null, now = Date.now()): ProviderOperationalState {
  if (!enabled) return "disabled";
  if (!snapshot) return "unavailable";
  if (snapshot.errorState === "needsAuthentication" || snapshot.errorState === "expiredSession") return "authRequired";
  if (snapshot.errorState === "localRuntimeOffline") return "offline";
  if (snapshot.errorState !== "ready" || snapshot.error) return "error";
  const updated = Date.parse(snapshot.updatedAt);
  if (!Number.isFinite(updated) || updated > now + 60_000 || now - updated > 10 * 60_000) return "stale";
  return "ok";
}
