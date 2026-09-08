import { describe, expect, it } from "vitest";
import { buildDevProviderFixtures, DEV_FIXTURE_PRESET_COUNTS } from "./devFixtures";

describe("buildDevProviderFixtures", () => {
  it("builds exactly `count` snapshots for every preset count", () => {
    for (const count of DEV_FIXTURE_PRESET_COUNTS) {
      expect(buildDevProviderFixtures({ count })).toHaveLength(count);
    }
  });

  it("produces unique providerIds even past the base fixture id list (70 providers)", () => {
    const nodes = buildDevProviderFixtures({ count: 70 });
    const ids = new Set(nodes.map((n) => n.providerId));
    expect(ids.size).toBe(70);
  });

  it("is deterministic: two calls with the same count/mix produce the same layout-relevant shape (ids, usage, status)", () => {
    // `updatedAt`/`resetsAt` are wall-clock-derived and may drift by a
    // millisecond across the two calls -- excluded from this comparison,
    // which targets the fields that actually drive layout/rendering.
    const strip = (nodes: ReturnType<typeof buildDevProviderFixtures>) =>
      nodes.map(({ providerId, errorState, primary: { usedPercent } }) => ({ providerId, errorState, usedPercent }));
    const a = buildDevProviderFixtures({ count: 24, statusMix: "mixedAlert" });
    const b = buildDevProviderFixtures({ count: 24, statusMix: "mixedAlert" });
    expect(strip(a)).toEqual(strip(b));
  });

  it("allReady mix never emits a non-ready errorState", () => {
    const nodes = buildDevProviderFixtures({ count: 12, statusMix: "allReady" });
    expect(nodes.every((n) => n.errorState === "ready")).toBe(true);
  });

  it("mixedAuth mix includes at least one needsAuthentication and one localRuntimeOffline provider at count 12", () => {
    const nodes = buildDevProviderFixtures({ count: 12, statusMix: "mixedAuth" });
    expect(nodes.some((n) => n.errorState === "needsAuthentication")).toBe(true);
    expect(nodes.some((n) => n.errorState === "localRuntimeOffline")).toBe(true);
  });

  it("mixedAlert mix includes both a critical-range and a warning-range usedPercent at count 12", () => {
    const nodes = buildDevProviderFixtures({ count: 12, statusMix: "mixedAlert" });
    expect(nodes.some((n) => n.primary.usedPercent >= 90)).toBe(true);
    expect(nodes.some((n) => n.primary.usedPercent >= 70 && n.primary.usedPercent < 90)).toBe(true);
  });

  it("every produced snapshot carries sourceLabel 'devFixture' -- never mistakable for real data", () => {
    const nodes = buildDevProviderFixtures({ count: 6 });
    expect(nodes.every((n) => n.sourceLabel === "devFixture")).toBe(true);
    expect(nodes.every((n) => n.displayName.includes("Dev Fixture"))).toBe(true);
  });

  it("count 0 returns an empty array", () => {
    expect(buildDevProviderFixtures({ count: 0 })).toEqual([]);
  });
});
