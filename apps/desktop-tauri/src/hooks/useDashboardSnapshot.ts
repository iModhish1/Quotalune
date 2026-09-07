import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getDashboardSnapshot } from "../lib/tauri";
import type { DashboardRangeKind, DashboardSnapshot } from "../types/bridge";

/**
 * The one Dashboard-data hook every widget/mode should consume -- never a
 * per-widget re-fetch. Refreshes when: a provider refresh completes
 * ("refresh-complete"), the requested `range`/`timezone` changes, or a
 * relevant setting changes ("codexbar:settings-updated"). No polling loop.
 */
export function useDashboardSnapshot(
  range: DashboardRangeKind = "last30Days",
  timezone?: string,
): {
  snapshot: DashboardSnapshot | null;
  error: string | null;
  isLoading: boolean;
  reload: () => void;
} {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    getDashboardSnapshot({ range, timezone })
      .then((next) => {
        setSnapshot(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => setIsLoading(false));
  }, [range, timezone]);

  useEffect(() => {
    load();
    const unlistenRefresh = listen("refresh-complete", load).catch(() => (() => {}) as () => void);
    const unlistenSettings = listen("codexbar:settings-updated", load).catch(
      () => (() => {}) as () => void,
    );
    return () => {
      void unlistenRefresh.then((fn) => fn());
      void unlistenSettings.then((fn) => fn());
    };
  }, [load]);

  return { snapshot, error, isLoading, reload: load };
}
