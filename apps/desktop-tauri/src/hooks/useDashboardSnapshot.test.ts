import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DashboardRangeKind, DashboardSnapshot } from "../types/bridge";

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

  it("rejects late results from a superseded range or provider request", async () => {
    const pending: ((value: DashboardSnapshot) => void)[] = [];
    tauriMocks.getDashboardSnapshot.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
    const {result, rerender} = renderHook(({provider}) => useDashboardSnapshot("last7Days", undefined, [provider]), {initialProps: {provider: "codex"}});
    rerender({provider: "claude"});
    await act(async () => pending[1](snapshot({timezone: "new-result"})));
    expect(result.current.snapshot?.timezone).toBe("new-result");
    await act(async () => pending[0](snapshot({timezone: "old-result"})));
    expect(result.current.snapshot?.timezone).toBe("new-result");
  });

  /**
   * Same-source range race (owner Phase 3N section 24, "Claude 30d ->
   * Claude 7d"): the existing test above only varies the provider
   * filter between the two competing requests. This proves the exact
   * complementary case -- provider held constant, only `range`
   * changes -- since `requestKey` folds range/timezone/providers into
   * one key and `revision` gates every in-flight promise, but neither
   * had a dedicated deterministic test for a pure range change before.
   * Deferred promises, no sleeps, no wall-clock race.
   */
  it("rejects a late result from a superseded range on the same provider", async () => {
    const pending: ((value: DashboardSnapshot) => void)[] = [];
    tauriMocks.getDashboardSnapshot.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const { result, rerender } = renderHook(({ range }: { range: DashboardRangeKind }) => useDashboardSnapshot(range, undefined, ["claude"]), {
      initialProps: { range: "last30Days" },
    });
    rerender({ range: "last7Days" });
    // The narrower (7d) request resolves first, exactly as a real fast
    // local query would versus a slower 30-day scan.
    await act(async () => pending[1](snapshot({ timezone: "7d-result" })));
    expect(result.current.snapshot?.timezone).toBe("7d-result");
    // The late 30d completion must never overwrite the 7d result the
    // user is now looking at.
    await act(async () => pending[0](snapshot({ timezone: "30d-result" })));
    expect(result.current.snapshot?.timezone).toBe("7d-result");
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
