/**
 * The `DashboardSnapshot` counterpart to `useEffectiveProviders` (owner
 * Phase 5.2 section 18) -- `DashboardAnalyticsPanel` calls this instead
 * of `useDashboardSnapshot` directly, so its Usage Trend / Historical
 * Usage Share / Reported Spend widgets render demo data through the
 * exact same selectors and components production data uses.
 */
import { useMemo } from "react";
import { useDashboardSnapshot } from "./useDashboardSnapshot";
import type { DashboardRangeKind, DashboardSnapshot, ProviderCatalogEntry, SettingsSnapshot } from "../types/bridge";
import { resolveDemoConfig } from "../demoMode/types";
import { buildDemoDashboardSnapshot } from "../demoMode/dashboardSnapshot";
import { scopeDemoSnapshot } from "../demoMode/scopeSnapshot";

export function useEffectiveDashboardSnapshot(
  range: DashboardRangeKind,
  timezone: string | undefined,
  providers: string[] | undefined,
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
): { snapshot: DashboardSnapshot | null; error: string | null; isLoading: boolean; reload: () => void } {
  // Still called unconditionally (Rules of Hooks); its own network
  // request is unaffected by Demo Mode either way, and simply isn't used
  // for rendering while Demo Mode is on.
  const live = useDashboardSnapshot(range, timezone, providers);

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
  const catalogKey = catalog.map((p) => p.id).join(",");
  const demoNow = useMemo(() => Date.now(), [demoConfig, catalogKey]);
  const demoSnapshot = useMemo(
    () => (demoConfig.enabled ? buildDemoDashboardSnapshot(demoConfig, catalog, "last30Days", demoNow) : null),
    [demoConfig, catalogKey, demoNow],
  );

  if (!demoConfig.enabled) return live;
  return { snapshot: demoSnapshot ? scopeDemoSnapshot(demoSnapshot, range, providers) : null, error: null, isLoading: false, reload: () => {} };
}
