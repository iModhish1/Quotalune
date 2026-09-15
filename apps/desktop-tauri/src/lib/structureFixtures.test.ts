import { describe, expect, it } from "vitest";
import {
  buildStructureQaProviders,
  syntheticLongProviderName,
  syntheticLongReset,
  syntheticProviderCount,
  syntheticTwoUsageWindows,
  syntheticUnavailableProvider,
} from "./structureFixtures";

describe("syntheticProviderCount", () => {
  it.each([1, 3, 6, 12, 24, 70])("produces exactly %i providers, all clearly labeled synthetic", (count) => {
    const providers = syntheticProviderCount(count);
    expect(providers).toHaveLength(count);
    for (const provider of providers) {
      expect(provider.id.startsWith("synthetic-")).toBe(true);
      expect(provider.name.startsWith("Synthetic ")).toBe(true);
      expect(provider.accountLabel).toBe("Demo · synthetic data");
    }
  });

  it("produces unique ids even at the largest count", () => {
    const providers = syntheticProviderCount(70);
    expect(new Set(providers.map((p) => p.id)).size).toBe(70);
  });

  it("returns an empty array for a zero or negative count rather than throwing", () => {
    expect(syntheticProviderCount(0)).toEqual([]);
    expect(syntheticProviderCount(-5)).toEqual([]);
  });
});

describe("edge-case single-provider fixtures", () => {
  it("syntheticLongProviderName produces a real long name, clearly synthetic", () => {
    const provider = syntheticLongProviderName();
    expect(provider.name.startsWith("Synthetic")).toBe(true);
    expect(provider.name.length).toBeGreaterThan(40);
  });

  it("syntheticLongReset produces a long reset string", () => {
    const provider = syntheticLongReset();
    expect(provider.reset.length).toBeGreaterThan(30);
  });

  it("syntheticTwoUsageWindows produces exactly two named windows", () => {
    const provider = syntheticTwoUsageWindows();
    expect(provider.windows).toHaveLength(2);
    expect(provider.windows?.map((w) => w.id)).toEqual(["session", "weekly"]);
  });

  it("syntheticUnavailableProvider has null values and offline status, distinct from a real zero", () => {
    const provider = syntheticUnavailableProvider();
    expect(provider.status).toBe("offline");
    expect(provider.primaryValue).toBeNull();
    expect(provider.arcFraction).toBeNull();
  });
});

describe("buildStructureQaProviders (Wave 1F §22-30: shared by both Dev QA panels)", () => {
  const base = { providerCount: 6, nameLength: "normal", resetLength: "normal", windows: 1 } as const;

  it("dataState unavailable/error/timeout each produce exactly one provider with the matching status", () => {
    expect(buildStructureQaProviders({ ...base, dataState: "unavailable" })[0].status).toBe("offline");
    expect(buildStructureQaProviders({ ...base, dataState: "error" })[0].status).toBe("error");
    expect(buildStructureQaProviders({ ...base, dataState: "timeout" })[0].status).toBe("timeout");
  });

  it("respects providerCount for available/loading/refreshing data states", () => {
    for (const dataState of ["available", "loading", "refreshing"] as const) {
      expect(buildStructureQaProviders({ ...base, providerCount: 24, dataState })).toHaveLength(24);
    }
  });

  it("applies name/reset/windows overrides only to the first provider, matching ReelPreview.tsx's prior behavior", () => {
    const providers = buildStructureQaProviders({
      providerCount: 3, nameLength: "long", resetLength: "long", windows: 2, dataState: "available",
    });
    expect(providers).toHaveLength(3);
    expect(providers[0].name.length).toBeGreaterThan(40);
    expect(providers[0].windows).toHaveLength(2);
    expect(providers[1].name.length).toBeLessThan(40);
  });
});
