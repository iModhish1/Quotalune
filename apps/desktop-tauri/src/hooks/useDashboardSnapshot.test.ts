import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DashboardSnapshot } from "../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getDashboardSnapshot: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

import { useDashboardSnapshot } from "./useDashboardSnapshot";

function snapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    generatedAt: 1000,
    rangeSince: 0,
    rangeUntil: 1000,
    grain: "daily",
    timezone: "UTC",
    availability: {
      firstSampleAt: null,
      lastSampleAt: null,
      sampleCount: 0,
      hasCostData: false,
      hasTokenData: false,
      hasRequestData: false,
      hasModelData: false,
    },
    providers: [],
    usageTrend: [],
    spendTrend: [],
    costContract: {
      origin: "unavailable",
      quantityKind: "unknown",
      measurementKind: "unknown",
      currencyCode: null,
      period: "unknown",
      availability: "unavailable",
      pricingStatus: "notRequired",
    },
    ...overrides,
  };
}

describe("useDashboardSnapshot", () => {
  beforeEach(() => {
    tauriMocks.getDashboardSnapshot.mockReset();
    eventMocks.listen.mockReset().mockResolvedValue(() => {});
  });

  it("loads a snapshot on mount for the requested range", async () => {
    tauriMocks.getDashboardSnapshot.mockResolvedValue(snapshot({ timezone: "Asia/Riyadh" }));
    const { result } = renderHook(() => useDashboardSnapshot("last7Days"));

    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    expect(result.current.snapshot?.timezone).toBe("Asia/Riyadh");
    expect(tauriMocks.getDashboardSnapshot).toHaveBeenCalledWith({
      range: "last7Days",
      timezone: undefined,
    });
  });

  it("surfaces an error without throwing", async () => {
    tauriMocks.getDashboardSnapshot.mockRejectedValue(new Error("no history"));
    const { result } = renderHook(() => useDashboardSnapshot());
    await waitFor(() => expect(result.current.error).toBe("no history"));
    expect(result.current.snapshot).toBeNull();
  });

  it("reloads when a provider refresh completes", async () => {
    tauriMocks.getDashboardSnapshot.mockResolvedValue(snapshot());
    let refreshHandler: (() => void) | undefined;
    eventMocks.listen.mockImplementation((event: string, handler: () => void) => {
      if (event === "refresh-complete") refreshHandler = handler;
      return Promise.resolve(() => {});
    });

    renderHook(() => useDashboardSnapshot());
    await waitFor(() => expect(tauriMocks.getDashboardSnapshot).toHaveBeenCalledTimes(1));

    refreshHandler?.();
    await waitFor(() => expect(tauriMocks.getDashboardSnapshot).toHaveBeenCalledTimes(2));
  });

  it("threads a provider filter through to the bridge call", async () => {
    tauriMocks.getDashboardSnapshot.mockResolvedValue(snapshot());
    const { result } = renderHook(() => useDashboardSnapshot("last7Days", undefined, ["codex"]));
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    expect(tauriMocks.getDashboardSnapshot).toHaveBeenCalledWith({
      range: "last7Days",
      timezone: undefined,
      providers: ["codex"],
    });
  });

  it("omits the provider filter when empty", async () => {
    tauriMocks.getDashboardSnapshot.mockResolvedValue(snapshot());
    const { result } = renderHook(() => useDashboardSnapshot("last7Days", undefined, []));
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    expect(tauriMocks.getDashboardSnapshot).toHaveBeenCalledWith({
      range: "last7Days",
      timezone: undefined,
      providers: undefined,
    });
  });
});
