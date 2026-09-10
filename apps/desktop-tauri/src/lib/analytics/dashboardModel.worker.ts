import {buildDashboardAnalyticsModel, type DashboardAnalyticsModel} from "./dashboardModel";
import type {DashboardSnapshot, ProviderUsageSnapshot, SettingsSnapshot} from "../../types/bridge";

interface DashboardModelRequest {
  requestId: number;
  providers: ProviderUsageSnapshot[];
  snapshot: DashboardSnapshot | null;
  settings: SettingsSnapshot;
  filter: string | null;
  now: number;
}

type DashboardModelResponse =
  | {requestId: number; model: DashboardAnalyticsModel}
  | {requestId: number; error: true};

type WorkerHost = {
  onmessage: ((event: MessageEvent<DashboardModelRequest>) => void) | null;
  postMessage: (response: DashboardModelResponse) => void;
};

const workerHost = globalThis as unknown as WorkerHost;

workerHost.onmessage = ({data}) => {
  try {
    workerHost.postMessage({
      requestId: data.requestId,
      model: buildDashboardAnalyticsModel(
        data.providers,
        data.snapshot,
        data.settings,
        data.filter,
        data.now,
      ),
    });
  } catch {
    // The UI deliberately uses its current-only model on worker failure.
    workerHost.postMessage({requestId: data.requestId, error: true});
  }
};
