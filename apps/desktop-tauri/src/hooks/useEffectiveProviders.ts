/**
 * The one "effective data source" switch for provider snapshots (owner
 * Phase 5.2 section 18): every visualization surface (2D Dashboard, 3D
 * scene) calls this instead of `useProviders()` directly, and never
 * needs to know whether Demo Mode is on. Demo ON returns a fully
 * synthetic, deterministic array built by `demoMode/providerSnapshots.ts`
 * -- replacement semantics, never merged with live data (owner section
 * 52). Demo OFF is a pure passthrough to the real `useProviders()`, so
 * disabled behavior is byte-for-byte what it always was.
 *
 * `useProviders()` is still called unconditionally (Rules of Hooks) even
 * while Demo Mode is on -- this does NOT start any new network activity
 * of its own; it is the same background refresh this surface would have
 * triggered anyway once mounted, and demo providers never pass through
 * it (owner section 36: no network/auth calls for synthetic providers).
 */
import { useMemo } from "react";
import { useProviders, type UseProvidersOptions, type UseProvidersResult } from "./useProviders";
import type { ProviderCatalogEntry, ProviderUsageSnapshot, SettingsSnapshot } from "../types/bridge";
import { resolveDemoConfig, type DemoModeConfig } from "../demoMode/types";
import { buildDemoProviderSnapshots } from "../demoMode/providerSnapshots";

export type DataProvenance = "live" | "demo";

export interface UseEffectiveProvidersResult extends UseProvidersResult {
  provenance: DataProvenance;
  demoConfig: DemoModeConfig;
}

const EMPTY_REFRESHING = new Set<string>();

export function useEffectiveProviders(
  settings: Pick<
    SettingsSnapshot,
    | "demoModeEnabled"
    | "demoProviderMode"
    | "demoProviderCount"
    | "demoProviderIds"
    | "demoScenario"
    | "demoSeed"
    | "demoHistoryDays"
  >,
  catalog: readonly ProviderCatalogEntry[],
  options?: UseProvidersOptions,
): UseEffectiveProvidersResult {
  const live = useProviders(options);

  const demoProviderIdsKey = settings.demoProviderIds?.join(",") ?? "";
  const demoConfig = useMemo(
    () => resolveDemoConfig(settings),
    [
      settings.demoModeEnabled,
      settings.demoProviderMode,
      settings.demoProviderCount,
      demoProviderIdsKey,
      settings.demoScenario,
      settings.demoSeed,
      settings.demoHistoryDays,
    ],
  );

  // Regenerated only when the resolved config or the (rarely-changing)
  // provider catalog changes -- never on an unrelated re-render, and
  // never via `Date.now()` read directly in the render body (owner
  // section 49: memoized, not regenerated every render).
  const catalogKey = catalog.map((p) => p.id).join(",");
  const demoNow = useMemo(() => Date.now(), [demoConfig, catalogKey]);
  const demoProviders = useMemo<ProviderUsageSnapshot[]>(
    () => buildDemoProviderSnapshots(demoConfig, catalog, demoNow),
    [demoConfig, catalogKey, demoNow],
  );

  if (!demoConfig.enabled) {
    return { ...live, provenance: "live", demoConfig };
  }

  return {
    providers: demoProviders,
    isRefreshing: false,
    refreshingProviderIds: EMPTY_REFRESHING,
    // Demo data has nothing to "refresh" from a network -- regeneration
    // happens by changing `demoSeed` ("Regenerate Demo Data", owner
    // section 29), not by re-fetching.
    refresh: () => {},
    lastRefresh: null,
    hasCachedData: demoProviders.length > 0,
    hasLoadedCache: true,
    provenance: "demo",
    demoConfig,
  };
}
