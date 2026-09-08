import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  getCachedProviders: vi.fn(),
  refreshProviders: vi.fn(),
  refreshProvidersIfStale: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

import { useEffectiveProviders } from "./useEffectiveProviders";
import type { ProviderCatalogEntry, SettingsSnapshot } from "../types/bridge";

const CATALOG: ProviderCatalogEntry[] = [
  "codex",
  "claude",
  "gemini",
  "perplexity",
  "grok",
  "deepseek",
].map((id) => ({ id, displayName: id, cookieDomain: null }));

function liveProvider(id: string) {
  return {
    providerId: id,
    displayName: id,
    primary: {
      usedPercent: 99,
      remainingPercent: 1,
      windowMinutes: null,
      resetsAt: null,
      resetDescription: null,
      isExhausted: false,
      reservePercent: null,
      reserveDescription: null,
    },
    selectedMetric: {
      usedPercent: 99,
      remainingPercent: 1,
      windowMinutes: null,
      resetsAt: null,
      resetDescription: null,
      isExhausted: false,
      reservePercent: null,
      reserveDescription: null,
    },
    primaryLabel: "Session",
    secondary: null,
    modelSpecific: null,
    tertiary: null,
    extraRateWindows: [],
    cost: null,
    planName: null,
    accountEmail: null,
    sourceLabel: "cli-session",
    updatedAt: new Date().toISOString(),
    error: null,
    errorState: "ready" as const,
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
    fetchDurationMs: null,
  };
}

function settings(overrides: Partial<SettingsSnapshot> = {}): SettingsSnapshot {
  return {
    demoModeEnabled: false,
    demoProviderMode: "curated",
    demoProviderCount: 6,
    demoProviderIds: [],
    demoScenario: "connectedShowcase",
    demoSeed: 1,
    demoHistoryDays: 7,
    ...overrides,
  } as unknown as SettingsSnapshot;
}

describe("useEffectiveProviders -- data-source switch (owner section 52)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tauriMocks.getCachedProviders.mockResolvedValue([liveProvider("codex")]);
    tauriMocks.refreshProviders.mockResolvedValue(undefined);
    tauriMocks.refreshProvidersIfStale.mockResolvedValue(undefined);
  });

  it("Demo OFF returns live data with provenance 'live'", async () => {
    const { result } = renderHook(() =>
      useEffectiveProviders(settings({ demoModeEnabled: false }), CATALOG, { refreshOnMount: false }),
    );
    await waitFor(() => expect(result.current.providers.map((p) => p.providerId)).toEqual(["codex"]));
    expect(result.current.provenance).toBe("live");
  });

  it("Demo ON returns synthetic data with provenance 'demo' -- never merged with live data", async () => {
    const { result } = renderHook(() =>
      useEffectiveProviders(
        settings({ demoModeEnabled: true, demoProviderCount: 6 }),
        CATALOG,
        { refreshOnMount: false },
      ),
    );
    expect(result.current.provenance).toBe("demo");
    expect(result.current.providers).toHaveLength(6);
    // The real live provider ("codex" with usedPercent 99 from the mock)
    // must never leak into the demo array via a merge.
    const codex = result.current.providers.find((p) => p.providerId === "codex");
    expect(codex?.primary.usedPercent).not.toBe(99);
    expect(codex?.sourceLabel).toBe("demo");
  });

  it("Demo ON -> OFF restores live data with no stale demo entries (replacement semantics)", async () => {
    const { result, rerender } = renderHook(
      ({ demoOn }) =>
        useEffectiveProviders(settings({ demoModeEnabled: demoOn }), CATALOG, { refreshOnMount: false }),
      { initialProps: { demoOn: true } },
    );
    expect(result.current.provenance).toBe("demo");
    expect(result.current.providers).toHaveLength(6);

    rerender({ demoOn: false });
    await waitFor(() => expect(result.current.provenance).toBe("live"));
    await waitFor(() => expect(result.current.providers.map((p) => p.providerId)).toEqual(["codex"]));
    expect(result.current.providers.every((p) => p.sourceLabel !== "demo")).toBe(true);
  });
});
