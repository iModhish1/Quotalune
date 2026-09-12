import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AnalyticsSourceDescriptor } from "../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getAnalyticsSourceRegistry: vi.fn(),
}));
vi.mock("../lib/tauri", () => tauriMocks);

import { useAnalyticsSources } from "./useAnalyticsSources";

function source(overrides: Partial<AnalyticsSourceDescriptor> = {}): AnalyticsSourceDescriptor {
  return {
    id: "codexLocalActivity",
    label: "Codex local activity",
    scope: "device",
    capabilities: {
      quota: false,
      resets: false,
      monetary: false,
      tokens: false,
      models: false,
      sessionCount: false,
      dailyActivity: false,
    },
    availability: "available",
    reads: [],
    doesNotRead: [],
    ...overrides,
  };
}

describe("useAnalyticsSources", () => {
  it("fetches the real registry once and exposes it", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([source()]);
    const { result } = renderHook(() => useAnalyticsSources());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sources).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("hasCapability is true only for an AVAILABLE source with that real capability", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([
      source({ id: "codexLocalActivity", availability: "available", capabilities: { ...source().capabilities, tokens: true } }),
      source({ id: "claudeLocalActivity", availability: "noDataYet", capabilities: { ...source().capabilities, tokens: true, sessionCount: false } }),
    ]);
    const { result } = renderHook(() => useAnalyticsSources());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Codex is available and has tokens=true.
    expect(result.current.hasCapability("tokens")).toBe(true);
    // Neither source has sessionCount=true, and the one that does have
    // tokens=true but is noDataYet must not count toward availability
    // for a capability neither source actually has.
    expect(result.current.hasCapability("sessionCount")).toBe(false);
  });

  it("a capability is not counted from a source that has no data yet, even if the flag is true", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([
      source({ availability: "noDataYet", capabilities: { ...source().capabilities, tokens: true } }),
    ]);
    const { result } = renderHook(() => useAnalyticsSources());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasCapability("tokens")).toBe(false);
  });

  it("surfaces a real fetch error rather than silently showing an empty registry", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockRejectedValue(new Error("ipc failed"));
    const { result } = renderHook(() => useAnalyticsSources());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("ipc failed");
    expect(result.current.sources).toEqual([]);
  });
});
