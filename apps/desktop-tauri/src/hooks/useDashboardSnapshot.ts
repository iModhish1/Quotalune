import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getDashboardSnapshot } from "../lib/tauri";
import type { DashboardRangeKind, DashboardSnapshot } from "../types/bridge";

/**
 * The one Dashboard-data hook every widget/mode should consume -- never a
 * per-widget re-fetch. Refreshes when: a provider refresh completes
 * ("refresh-complete"), the requested `range`/`timezone` changes, or a
 * relevant setting changes ("quotalis:settings-updated"). No polling loop.
 */
export function useDashboardSnapshot(
  range: DashboardRangeKind = "last30Days",
  timezone?: string,
  providers?: string[],
): {
  snapshot: DashboardSnapshot | null;
  error: string | null;
  isLoading: boolean;
  reload: () => void;
} {
  const [loaded, setLoaded] = useState<{key: string; snapshot: DashboardSnapshot} | null>(null);
  const revision = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Stabilize the array identity so a new `[]`/`["codex"]` literal from the
  // caller's render doesn't re-trigger the fetch effect every render.
  const providersKey = providers && providers.length > 0 ? providers.join(",") : "";
  const requestKey = JSON.stringify([range, timezone, providersKey]);

  const load = useCallback(() => {
    const request = ++revision.current;
    setIsLoading(true);
    getDashboardSnapshot({
      range,
      timezone,
      providers: providersKey ? providersKey.split(",") : undefined,
    })
      .then((next) => {
        if (request !== revision.current) return;
        setLoaded({key: requestKey, snapshot: next});
        setError(null);
      })
      .catch((cause: unknown) => {
        if (request !== revision.current) return;
        setLoaded(null);
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {if (request === revision.current) setIsLoading(false);});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- providersKey
    // (the stabilized string) is the real dependency, not `providers`.
  }, [range, timezone, providersKey, requestKey]);

  useEffect(() => {
    load();
    const unlistenRefresh = listen("refresh-complete", load).catch(() => (() => {}) as () => void);
    const unlistenSettings = listen("quotalis:settings-updated", load).catch(
      () => (() => {}) as () => void,
    );
    return () => {
      ++revision.current;
      void unlistenRefresh.then((fn) => fn());
      void unlistenSettings.then((fn) => fn());
    };
  }, [load]);

  return { snapshot: loaded?.key === requestKey ? loaded.snapshot : null, error, isLoading, reload: load };
}
