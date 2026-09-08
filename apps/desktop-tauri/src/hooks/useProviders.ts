import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type {
  ProviderUsageSnapshot,
  RefreshCompletePayload,
  RefreshStartedPayload,
} from "../types/bridge";
import {
  getCachedProviders,
  refreshProviders,
  refreshProvidersIfStale,
} from "../lib/tauri";

export interface UseProvidersOptions {
  /**
   * Delay the automatic stale-aware refresh on mount. Tray/menu surfaces use
   * this so opening the UI can paint and accept input before provider work
   * starts.
   */
  initialRefreshDelayMs?: number;
  /**
   * Whether mounting this hook should ask the backend for a stale-aware refresh.
   * Passive surfaces can turn this off when another timer already drives
   * freshness, while still receiving cached data and live provider events.
   */
  refreshOnMount?: boolean;
  /**
   * When true, the mount refresh bypasses stale-cache checks and refreshes all
   * enabled providers. Used by the tray/menu "refresh on open" setting.
   */
  forceRefreshOnMount?: boolean;
}

export interface UseProvidersResult {
  /** Current provider snapshots (updated live as each provider completes). */
  providers: ProviderUsageSnapshot[];
  /** True while a refresh cycle is in progress. */
  isRefreshing: boolean;
  refreshingProviderIds: ReadonlySet<string>;
  /** Trigger a manual refresh. No-op if already refreshing. */
  refresh: () => void;
  /** Summary from the last completed refresh cycle, if any. */
  lastRefresh: RefreshCompletePayload | null;
  /** True when the hook has provider data that can stay visible during refresh. */
  hasCachedData: boolean;
  /** True after the initial cached-provider read has completed. */
  hasLoadedCache: boolean;
}

/**
 * Subscribe to live provider usage data.
 *
 * On mount the hook:
 *  1. Loads any cached providers already in AppState.
 *  2. Fires `refresh_providers` to kick off a fresh fetch cycle.
 *  3. Listens for `provider-updated` events and merges each snapshot
 *     into the local array (upsert by providerId).
 *  4. Listens for `refresh-started` / `refresh-complete` to track loading.
 */
export function useProviders(options: UseProvidersOptions = {}): UseProvidersResult {
  const [providers, setProviders] = useState<ProviderUsageSnapshot[]>([]);
  const [refreshingProviderIds, setRefreshingProviderIds] = useState<Set<string>>(
    new Set(),
  );
  const [lastRefresh, setLastRefresh] = useState<RefreshCompletePayload | null>(
    null,
  );
  const [hasLoadedCache, setHasLoadedCache] = useState(false);
  const refreshingRef = useRef(false);
  const pendingSnapshotsRef = useRef<Map<string, ProviderUsageSnapshot>>(new Map());
  const flushTimerRef = useRef<number | undefined>(undefined);
  const resetRefreshTimerRef = useRef<number | undefined>(undefined);
  const settingsReloadEpochRef = useRef(0);
  const settingsReloadingRef = useRef(false);

  const mergeSnapshots = useCallback((snapshots: ProviderUsageSnapshot[]) => {
    if (snapshots.length === 0) return;
    setProviders((prev) => {
      const next = [...prev];
      const byId = new Map(next.map((provider, index) => [provider.providerId, index]));
      for (const snapshot of snapshots) {
        const idx = byId.get(snapshot.providerId);
        if (idx !== undefined) {
          next[idx] = snapshot;
        } else {
          byId.set(snapshot.providerId, next.length);
          next.push(snapshot);
        }
      }
      return next;
    });
  }, []);

  /** Unlike `mergeSnapshots` (an upsert -- used for individual
   *  `provider-updated` deltas, where an absent id must NOT be treated as
   *  "removed"), `getCachedProviders()` returns the complete, authoritative
   *  set of providers visible in the current context. A backend-driven
   *  reload (settings change, profile switch) must REPLACE state with it,
   *  including down to an empty array -- a profile with zero accounts is
   *  a real, valid state, not "nothing changed." Using `mergeSnapshots`
   *  here (fixed alongside the missing "quotalis:settings-updated"
   *  listener, Phase 5.1) would have kept the previous profile's
   *  providers on screen forever once merged in, since an upsert has no
   *  way to express "this id is no longer present." */
  const replaceSnapshots = useCallback((snapshots: ProviderUsageSnapshot[]) => {
    setProviders(snapshots);
  }, []);

  const flushPendingSnapshots = useCallback(() => {
    if (flushTimerRef.current !== undefined) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = undefined;
    }
    const snapshots = Array.from(pendingSnapshotsRef.current.values());
    pendingSnapshotsRef.current.clear();
    mergeSnapshots(snapshots);
  }, [mergeSnapshots]);

  const queueSnapshot = useCallback((snapshot: ProviderUsageSnapshot) => {
    pendingSnapshotsRef.current.set(snapshot.providerId, snapshot);
    if (settingsReloadingRef.current || flushTimerRef.current !== undefined) return;
    flushTimerRef.current = window.setTimeout(flushPendingSnapshots, 80);
  }, [flushPendingSnapshots]);

  const refresh = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    refreshProviders().catch(() => {
      refreshingRef.current = false;
      setRefreshingProviderIds(new Set());
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Load existing cache first.
    const initialEpoch = settingsReloadEpochRef.current;
    getCachedProviders()
      .then((cached) => {
        if (
          !cancelled &&
          initialEpoch === settingsReloadEpochRef.current &&
          cached.length > 0
        ) {
          mergeSnapshots(cached);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHasLoadedCache(true);
        }
      });

    // Event listeners.
    const unlistenUpdated = listen<ProviderUsageSnapshot>(
      "provider-updated",
      (event) => {
        if (!cancelled) {
          queueSnapshot(event.payload);
          setRefreshingProviderIds(
            (current) =>
              new Set(
                [...current].filter((id) => id !== event.payload.providerId),
              ),
          );
        }
      },
    );

    // Re-fetch cached providers whenever the backend broadcasts a change
    // that can alter which providers are visible: a plain settings save
    // ("settings-changed") or a profile switch/create/update/delete
    // ("quotalis:settings-updated" -- emitted by both `update_settings`
    // and every `command_profiles.rs` mutation via its shared
    // `emit_changed`, mirroring the two-event pattern `useSettings.ts`
    // already listens for). Without the second event, switching to a
    // profile with different (or zero) accounts left this hook's provider
    // list showing the previous profile's providers until some unrelated
    // event happened to trigger a refetch -- confirmed via real native CDP
    // proof in docs/validation/PHASE5_3D_PROTOTYPE.md (Phase 5.1).
    const reloadFromBackendEvent = () => {
      const epoch = ++settingsReloadEpochRef.current;
      settingsReloadingRef.current = true;
      if (flushTimerRef.current !== undefined) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = undefined;
      }
      pendingSnapshotsRef.current.clear();
      getCachedProviders()
        .then((cached) => {
          if (!cancelled && epoch === settingsReloadEpochRef.current) {
            replaceSnapshots(cached);
          }
        })
        .finally(() => {
          if (!cancelled && epoch === settingsReloadEpochRef.current) {
            settingsReloadingRef.current = false;
            flushPendingSnapshots();
          }
        });
    };

    const unlistenSettings = listen("settings-changed", reloadFromBackendEvent);
    const unlistenProfile = listen("quotalis:settings-updated", reloadFromBackendEvent);

    const unlistenStarted = listen<RefreshStartedPayload>("refresh-started", (event) => {
      if (!cancelled) {
        refreshingRef.current = true;
        setRefreshingProviderIds(new Set(event.payload.providerIds));
      }
    });

    const unlistenComplete = listen<RefreshCompletePayload>(
      "refresh-complete",
      (event) => {
        if (!cancelled) {
          if (!settingsReloadingRef.current) flushPendingSnapshots();
          refreshingRef.current = false;
          setRefreshingProviderIds(new Set());
          setLastRefresh(event.payload);
        }
      },
    );

    let initialRefreshTimer: number | undefined;

    const runInitialRefresh = () => {
      const refreshPromise = options.forceRefreshOnMount
        ? refreshProviders()
        : refreshProvidersIfStale();
      refreshPromise.catch(() => {
        if (!cancelled) {
          refreshingRef.current = false;
          setRefreshingProviderIds(new Set());
        }
      });
    };

    // Kick off the initial refresh, but let the backend reuse fresh cache.
    if (options.refreshOnMount !== false) {
      const delay = Math.max(0, options.initialRefreshDelayMs ?? 0);
      if (delay > 0) {
        initialRefreshTimer = window.setTimeout(runInitialRefresh, delay);
      } else {
        runInitialRefresh();
      }
    }

    return () => {
      cancelled = true;
      settingsReloadEpochRef.current += 1;
      settingsReloadingRef.current = false;
      if (initialRefreshTimer !== undefined) {
        window.clearTimeout(initialRefreshTimer);
      }
      if (flushTimerRef.current !== undefined) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = undefined;
      }
      if (resetRefreshTimerRef.current !== undefined) {
        window.clearTimeout(resetRefreshTimerRef.current);
        resetRefreshTimerRef.current = undefined;
      }
      pendingSnapshotsRef.current.clear();
      unlistenUpdated.then((fn) => fn());
      unlistenSettings.then((fn) => fn());
      unlistenProfile.then((fn) => fn());
      unlistenStarted.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
    };
  }, [
    options.forceRefreshOnMount,
    options.initialRefreshDelayMs,
    options.refreshOnMount,
    flushPendingSnapshots,
    mergeSnapshots,
    replaceSnapshots,
    queueSnapshot,
  ]);

  useEffect(() => {
    if (resetRefreshTimerRef.current !== undefined) {
      window.clearTimeout(resetRefreshTimerRef.current);
      resetRefreshTimerRef.current = undefined;
    }

    const now = Date.now();
    let nextReset: number | undefined;
    for (const provider of providers) {
      const candidates = [
        provider.primary.resetsAt,
        provider.secondary?.resetsAt,
        provider.modelSpecific?.resetsAt,
        provider.tertiary?.resetsAt,
        ...(provider.extraRateWindows ?? []).map((extra) => extra.window.resetsAt),
        provider.cost?.resetsAt,
      ];
      for (const value of candidates) {
        if (!value) continue;
        const time = Date.parse(value);
        if (Number.isFinite(time) && time > now && (nextReset === undefined || time < nextReset)) {
          nextReset = time;
        }
      }
    }

    if (nextReset === undefined) return;

    const delay = Math.max(5_000, nextReset - now + 1_000);
    resetRefreshTimerRef.current = window.setTimeout(() => {
      resetRefreshTimerRef.current = undefined;
      refresh();
    }, delay);

    return () => {
      if (resetRefreshTimerRef.current !== undefined) {
        window.clearTimeout(resetRefreshTimerRef.current);
        resetRefreshTimerRef.current = undefined;
      }
    };
  }, [providers, refresh]);

  return {
    providers,
    isRefreshing: refreshingProviderIds.size > 0,
    refreshingProviderIds,
    refresh,
    lastRefresh,
    hasCachedData: providers.length > 0,
    hasLoadedCache,
  };
}
