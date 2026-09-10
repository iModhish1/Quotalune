import {useEffect, useMemo, useRef, useState} from "react";
import {buildDashboardAnalyticsModel, type DashboardAnalyticsModel} from "../lib/analytics/dashboardModel";
import type {DashboardSnapshot, ProviderUsageSnapshot, SettingsSnapshot} from "../types/bridge";

export const DASHBOARD_ANALYTICS_WORKER_THRESHOLD = 25_000;

type WorkerResponse =
  | {requestId: number; model: DashboardAnalyticsModel}
  | {requestId: number; error: true};

interface WorkerState {
  key: string;
  model: DashboardAnalyticsModel | null;
  error: boolean;
}

const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;
function objectId(value: object | null): number {
  if (value === null) return 0;
  const cached = objectIds.get(value);
  if (cached !== undefined) return cached;
  const id = nextObjectId;
  nextObjectId += 1;
  objectIds.set(value, id);
  return id;
}

function inputKey(
  providers: ProviderUsageSnapshot[],
  snapshot: DashboardSnapshot | null,
  settings: SettingsSnapshot,
  filter: string | null,
  now: number,
): string {
  return `${objectId(providers)}:${objectId(snapshot)}:${objectId(settings)}:${filter ?? ""}:${now}`;
}

/**
 * Keeps quota aggregation off the renderer thread once a history payload is
 * large enough to exceed an interaction frame. While a Worker is pending or
 * unavailable, callers receive current provider state with no fabricated
 * historical metrics.
 */
export function useDashboardAnalyticsModel(
  providers: ProviderUsageSnapshot[],
  snapshot: DashboardSnapshot | null,
  settings: SettingsSnapshot,
  filter: string | null,
  now: number,
): {model: DashboardAnalyticsModel; processing: boolean; error: boolean} {
  const quotaHistoryLength = snapshot?.quotaHistory?.length ?? 0;
  const shouldUseWorker = quotaHistoryLength > DASHBOARD_ANALYTICS_WORKER_THRESHOLD;
  const key = inputKey(providers, snapshot, settings, filter, now);
  const revision = useRef(0);
  const [workerState, setWorkerState] = useState<WorkerState>({key: "", model: null, error: false});

  const fallbackModel = useMemo(
    () => buildDashboardAnalyticsModel(
      providers,
      shouldUseWorker && snapshot ? {...snapshot, quotaHistory: []} : snapshot,
      settings,
      filter,
      now,
    ),
    [providers, snapshot, settings, filter, now, shouldUseWorker],
  );

  useEffect(() => {
    if (!shouldUseWorker) return;

    const requestId = ++revision.current;
    let disposed = false;
    let worker: Worker | null = null;
    setWorkerState({key, model: null, error: false});

    const fail = () => {
      if (!disposed && revision.current === requestId) setWorkerState({key, model: null, error: true});
    };

    try {
      worker = new Worker(new URL("../lib/analytics/dashboardModel.worker.ts", import.meta.url), {type: "module"});
      worker.onmessage = ({data}: MessageEvent<WorkerResponse>) => {
        if (disposed || revision.current !== requestId || data.requestId !== requestId) return;
        if ("error" in data) {
          fail();
        } else {
          setWorkerState({key, model: data.model, error: false});
        }
      };
      worker.onerror = fail;
      worker.onmessageerror = fail;
      worker.postMessage({requestId, providers, snapshot, settings, filter, now});
    } catch {
      fail();
    }

    return () => {
      disposed = true;
      revision.current += 1;
      worker?.terminate();
    };
  }, [key, now, providers, settings, shouldUseWorker, snapshot, filter]);

  if (!shouldUseWorker) return {model: fallbackModel, processing: false, error: false};

  const activeState = workerState.key === key ? workerState : null;
  return {
    model: activeState?.model ?? fallbackModel,
    processing: !activeState || (activeState.model === null && !activeState.error),
    error: activeState?.error ?? false,
  };
}
