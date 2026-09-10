import {act, renderHook} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";
import type {DashboardAnalyticsModel} from "../lib/analytics/dashboardModel";
import type {DashboardSnapshot, QuotaHistoryPoint, SettingsSnapshot} from "../types/bridge";

const modelMocks = vi.hoisted(() => ({build: vi.fn()}));
vi.mock("../lib/analytics/dashboardModel", () => ({buildDashboardAnalyticsModel: modelMocks.build}));

import {DASHBOARD_ANALYTICS_WORKER_THRESHOLD, useDashboardAnalyticsModel} from "./useDashboardAnalyticsModel";

type WorkerPayload =
  | {requestId: number; model: DashboardAnalyticsModel}
  | {requestId: number; error: true};

class WorkerStub {
  static instances: WorkerStub[] = [];
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();
  onmessage: ((event: MessageEvent<WorkerPayload>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;

  constructor(_url: URL, _options: WorkerOptions) {
    WorkerStub.instances.push(this);
  }

  emit(data: WorkerPayload) {
    this.onmessage?.({data} as MessageEvent<WorkerPayload>);
  }

  fail() {
    this.onerror?.(new Event("error"));
  }
}

function snapshot(historyLength: number): DashboardSnapshot {
  // The model is mocked here; only the threshold and fail-closed replacement
  // need exercising, so avoid allocating a production-sized fixture per test.
  return {quotaHistory: {length: historyLength} as unknown as QuotaHistoryPoint[]} as DashboardSnapshot;
}

const providers = [] as never[];
const settings = {} as SettingsSnapshot;
const model = (marker: string): DashboardAnalyticsModel => ({marker} as unknown as DashboardAnalyticsModel);

describe("useDashboardAnalyticsModel", () => {
  beforeEach(() => {
    WorkerStub.instances = [];
    vi.stubGlobal("Worker", WorkerStub);
    modelMocks.build.mockReset().mockImplementation((_providers, source: DashboardSnapshot | null) =>
      model(`history:${source?.quotaHistory?.length ?? 0}`),
    );
  });

  it("keeps small histories synchronous and does not construct a Worker", () => {
    const source = snapshot(DASHBOARD_ANALYTICS_WORKER_THRESHOLD);
    const {result} = renderHook(() => useDashboardAnalyticsModel(
      providers,
      source,
      settings,
      null,
      1,
    ));

    expect(WorkerStub.instances).toHaveLength(0);
    expect(result.current).toMatchObject({processing: false, error: false, model: {marker: `history:${DASHBOARD_ANALYTICS_WORKER_THRESHOLD}`}});
  });

  it("uses a current-only fallback while large history is being processed", () => {
    const source = snapshot(DASHBOARD_ANALYTICS_WORKER_THRESHOLD + 1);
    const {result} = renderHook(() => useDashboardAnalyticsModel(
      providers,
      source,
      settings,
      "codex",
      1,
    ));

    expect(WorkerStub.instances).toHaveLength(1);
    expect(result.current).toMatchObject({processing: true, error: false, model: {marker: "history:0"}});
    expect(WorkerStub.instances[0].postMessage).toHaveBeenCalledWith(expect.objectContaining({filter: "codex"}));
  });

  it("ignores stale Worker responses after a filter change", () => {
    const source = snapshot(DASHBOARD_ANALYTICS_WORKER_THRESHOLD + 1);
    const {result, rerender} = renderHook(
      ({filter}) => useDashboardAnalyticsModel(providers, source, settings, filter, 1),
      {initialProps: {filter: "codex" as string | null}},
    );
    const first = WorkerStub.instances[0];
    const firstRequest = first.postMessage.mock.calls[0][0].requestId as number;

    rerender({filter: "claude"});
    const second = WorkerStub.instances[1];
    const secondRequest = second.postMessage.mock.calls[0][0].requestId as number;
    expect(first.terminate).toHaveBeenCalledOnce();

    act(() => first.emit({requestId: firstRequest, model: model("stale")}));
    expect(result.current).toMatchObject({processing: true, error: false, model: {marker: "history:0"}});

    act(() => second.emit({requestId: secondRequest, model: model("fresh")}));
    expect(result.current).toMatchObject({processing: false, error: false, model: {marker: "fresh"}});
  });

  it("keeps the fresher request's result even when the stale request's Worker response arrives afterward (out-of-order resolution)", () => {
    // Reproduces the exact race: request A (e.g. a wide-range/provider-X
    // selection) is slow; before it resolves the user picks provider Y,
    // firing request B. B's Worker finishes -- and is applied -- first.
    // A's Worker then finishes late. Without the revision-ref guard in
    // useDashboardAnalyticsModel's effect (`revision.current !== requestId`),
    // A's onmessage handler would call setWorkerState unconditionally and
    // clobber B's already-applied fresh state with A's stale one, because
    // nothing here orders completion by request recency -- only by whichever
    // Worker happens to post its message last. The guard makes onmessage a
    // no-op for any requestId that isn't the current revision, so late
    // arrivals from a superseded request are dropped regardless of when they
    // resolve.
    const source = snapshot(DASHBOARD_ANALYTICS_WORKER_THRESHOLD + 1);
    const {result, rerender} = renderHook(
      ({filter}) => useDashboardAnalyticsModel(providers, source, settings, filter, 1),
      {initialProps: {filter: "provider-x" as string | null}},
    );
    const requestA = WorkerStub.instances[0];
    const requestAId = requestA.postMessage.mock.calls[0][0].requestId as number;

    rerender({filter: "provider-y"});
    const requestB = WorkerStub.instances[1];
    const requestBId = requestB.postMessage.mock.calls[0][0].requestId as number;

    // B (the newer, fresh request) resolves FIRST.
    act(() => requestB.emit({requestId: requestBId, model: model("fresh-B")}));
    expect(result.current).toMatchObject({processing: false, error: false, model: {marker: "fresh-B"}});

    // A (the older, now-stale request) resolves AFTER B -- out of order.
    act(() => requestA.emit({requestId: requestAId, model: model("stale-A")}));
    expect(result.current).toMatchObject({processing: false, error: false, model: {marker: "fresh-B"}});
  });

  it("fails closed to current state when Worker processing fails", () => {
    const source = snapshot(DASHBOARD_ANALYTICS_WORKER_THRESHOLD + 1);
    const {result} = renderHook(() => useDashboardAnalyticsModel(
      providers,
      source,
      settings,
      null,
      1,
    ));

    act(() => WorkerStub.instances[0].fail());
    expect(result.current).toMatchObject({processing: false, error: true, model: {marker: "history:0"}});
    expect(modelMocks.build).toHaveBeenCalledTimes(1);
    expect(modelMocks.build.mock.calls[0][1].quotaHistory).toEqual([]);
  });

  it("terminates a pending Worker when unmounted", () => {
    const source = snapshot(DASHBOARD_ANALYTICS_WORKER_THRESHOLD + 1);
    const {unmount} = renderHook(() => useDashboardAnalyticsModel(
      providers,
      source,
      settings,
      null,
      1,
    ));

    const worker = WorkerStub.instances[0];
    unmount();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
