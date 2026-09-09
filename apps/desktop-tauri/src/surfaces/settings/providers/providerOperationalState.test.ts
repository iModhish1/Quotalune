import { expect, it } from "vitest";
import type { ProviderUsageSnapshot } from "../../../types/bridge";
import { providerOperationalState } from "./providerOperationalState";
const now = Date.UTC(2026, 8, 9);
const snapshot = (patch: Partial<ProviderUsageSnapshot>) => ({errorState: "ready", error: null, updatedAt: new Date(now).toISOString(), ...patch}) as ProviderUsageSnapshot;
it("does not confuse enabled, observed and connected", () => {
  expect(providerOperationalState(false, snapshot({}), now)).toBe("disabled");
  expect(providerOperationalState(true, null, now)).toBe("unavailable");
  expect(providerOperationalState(true, snapshot({}), now)).toBe("ok");
});
it("uses backend auth state even without an error message", () => {
  expect(providerOperationalState(true, snapshot({errorState: "expiredSession"}), now)).toBe("authRequired");
  expect(providerOperationalState(true, snapshot({errorState: "needsAuthentication"}), now)).toBe("authRequired");
  expect(providerOperationalState(true, snapshot({errorState: "unknown"}), now)).toBe("error");
});
it("separates offline from expired credentials", () => {
  expect(providerOperationalState(true, snapshot({errorState: "localRuntimeOffline"}), now)).toBe("offline");
});
it("does not call unknown or old timestamps fresh", () => {
  expect(providerOperationalState(true, snapshot({updatedAt: "invalid"}), now)).toBe("stale");
  expect(providerOperationalState(true, snapshot({updatedAt: new Date(now-660_000).toISOString()}), now)).toBe("stale");
});
