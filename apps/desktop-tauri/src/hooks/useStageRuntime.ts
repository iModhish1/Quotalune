import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import type { UsageDisplayConfig } from "../design-system/themes";
import { useProviders } from "./useProviders";
import { useProviderInstances } from "./useProviderInstances";
import { composeProviderInstances, DEFAULT_INSTANCE_PRESENTATION } from "../lib/providerInstances";
import type { ProviderInstancePresentation } from "../types/bridge";
import { getSettingsSnapshot } from "../lib/tauri";
import {
  toStageProviderInstances,
  usageConfigFromSnapshot,
} from "../components/orbit/stageProviders";
import { useResetStageOptions, type ResetStageSettingsSource } from "./useResetStageOptions";
import {
  DEFAULT_CATALOG_THEME,
  resolveCatalogTheme,
  type CatalogSurfaceId,
  type CatalogThemeSource,
} from "../design-system/themeResolution";

/** Shared live theme + usage runtime for detached orbital surfaces. */
export function useStageRuntime({
  enabled = true,
  surface,
}: {
  enabled?: boolean;
  surface: CatalogSurfaceId;
}) {
  const live = useProviders({ refreshOnMount: enabled });
  const accounts = useProviderInstances(enabled);
  const [catalog, setCatalog] = useState(DEFAULT_CATALOG_THEME);
  const [catalogSource, setCatalogSource] = useState<CatalogThemeSource>("default");
  const [usageConfig, setUsageConfig] = useState<UsageDisplayConfig | undefined>();
  const [resetSettings, setResetSettings] = useState<ResetStageSettingsSource>({});
  const [enabledProviders, setEnabledProviders] = useState<string[] | null>(null);
  const [instancePresentation, setInstancePresentation] = useState<ProviderInstancePresentation>(DEFAULT_INSTANCE_PRESENTATION);
  // Fail closed while settings load: account labels must never flash before
  // the persisted privacy preference is known.
  const [hidePersonalInfo, setHidePersonalInfo] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const reloadSettings = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return getSettingsSnapshot()
      .then((snapshot) => {
        const resolved = resolveCatalogTheme(snapshot, surface);
        setCatalog(resolved.slug);
        setCatalogSource(resolved.source);
        setUsageConfig(usageConfigFromSnapshot(snapshot));
        setEnabledProviders(snapshot.enabledProviders);
        setInstancePresentation(snapshot.providerInstancePresentation ?? DEFAULT_INSTANCE_PRESENTATION);
        setHidePersonalInfo(snapshot.hidePersonalInfo);
        setResetSettings({
          resetPresentation: snapshot.resetPresentation,
          resetPresentationOverrides: snapshot.resetPresentationOverrides,
        });
        setSettingsError(null);
      })
      .catch((cause: unknown) => {
        setSettingsError(cause instanceof Error ? cause.message : String(cause));
      });
  }, [enabled, surface]);

  useEffect(() => {
    if (!enabled) return;
    void reloadSettings();
    const unlistenPromise = listen("quotalis:settings-updated", reloadSettings);
    return () => {
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [enabled, reloadSettings]);

  const resetOptions = useResetStageOptions(resetSettings, surface);
  const instances = useMemo(
    () => composeProviderInstances(live.providers ?? [], accounts.instances,
      enabledProviders ?? (live.providers ?? []).map(provider => provider.providerId),
      instancePresentation),
    [live.providers, accounts.instances, enabledProviders, instancePresentation],
  );
  const providers = useMemo(
    () => toStageProviderInstances(instances, usageConfig, resetOptions, hidePersonalInfo),
    [instances, usageConfig, resetOptions, hidePersonalInfo],
  );

  return {
    catalog,
    catalogSource,
    providers,
    settingsError,
    refresh: live.refresh,
    isRefreshing: live.isRefreshing,
    /** Wave 1D §10: true until the very first cached-provider read (or
     * fetch) has completed — the "first load" signal FlowSurface/
     * ReelSurface/NotchSurface use to show a Loading message instead of a
     * "no data" message before real data has ever arrived. */
    initialLoading: !live.hasLoadedCache,
  };
}
