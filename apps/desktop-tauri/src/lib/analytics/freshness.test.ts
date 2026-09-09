import {describe, expect, it} from "vitest";
import {observationFreshness} from "./freshness";
describe("cadence-derived freshness", () => {
  const now = Date.UTC(2026,8,9,12);
  const updated = new Date(now - 10 * 60_000).toISOString();
  it("does not treat manual/unknown cadence as a scheduled failure", () => {
    expect(observationFreshness(updated, null, now)).toEqual({state:"unavailable",ageSeconds:600,cadenceSeconds:null});
  });
  it("distinguishes fast and slow scheduled providers using the real policy interval", () => {
    expect(observationFreshness(updated,60,now).state).toBe("stale");
    expect(observationFreshness(updated,300,now).state).toBe("aging");
    expect(observationFreshness(updated,900,now).state).toBe("fresh");
  });
  it("rejects invalid and future timestamps", () => {
    expect(observationFreshness("bad",60,now).ageSeconds).toBeNull();
    expect(observationFreshness(new Date(now + 120_000).toISOString(),60,now).state).toBe("unavailable");
  });
});
