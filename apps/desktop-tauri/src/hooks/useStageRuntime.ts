import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import type { UsageDisplayConfig } from "../design-system/themes";
import { useProviders } from "./useProviders";
import { getSettingsSnapshot, refreshProvidersIfStale } from "../lib/tauri";
import {
  toStageProviders,
  usageConfigFromSnapshot,
} from "../components/orbit/stageProviders";
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
  const [catalog, setCatalog] = useState(DEFAULT_CATALOG_THEME);
  const [catalogSource, setCatalogSource] = useState<CatalogThemeSource>("default");
  const [usageConfig, setUsageConfig] = useState<UsageDisplayConfig | undefined>();
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const reloadSettings = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return getSettingsSnapshot()
      .then((snapshot) => {
        const resolved = resolveCatalogTheme(snapshot, surface);
        setCatalog(resolved.slug);
        setCatalogSource(resolved.source);
        setUsageConfig(usageConfigFromSnapshot(snapshot));
        setSettingsError(null);
      })
      .catch((cause: unknown) => {
        setSettingsError(cause instanceof Error ? cause.message : String(cause));
      });
  }, [enabled, surface]);

  useEffect(() => {
    if (!enabled) return;
    void reloadSettings();
    const unlistenPromise = listen("codexbar:settings-updated", reloadSettings);
    return () => {
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [enabled, reloadSettings]);

  useEffect(() => {
    if (!enabled) return;
    void refreshProvidersIfStale().catch(() => {});
  }, [enabled]);

  const providers = useMemo(
    () => toStageProviders(live.providers ?? [], usageConfig),
    [live.providers, usageConfig],
  );

  return {
    catalog,
    catalogSource,
    providers,
    settingsError,
    refresh: live.refresh,
    isRefreshing: live.isRefreshing,
  };
}
