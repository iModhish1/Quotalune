import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import type { UsageDisplayConfig } from "../design-system/themes";
import { useProviders } from "./useProviders";
import { getSettingsSnapshot, refreshProvidersIfStale } from "../lib/tauri";
import {
  toStageProviders,
  usageConfigFromSnapshot,
} from "../components/orbit/stageProviders";

const DEFAULT_THEME = "01-obsidian-orbit";

/** Shared live theme + usage runtime for detached orbital surfaces. */
export function useStageRuntime({ enabled = true }: { enabled?: boolean } = {}) {
  const live = useProviders({ refreshOnMount: enabled });
  const [catalog, setCatalog] = useState(DEFAULT_THEME);
  const [usageConfig, setUsageConfig] = useState<UsageDisplayConfig | undefined>();
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const reloadSettings = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return getSettingsSnapshot()
      .then((snapshot) => {
        setCatalog(snapshot.catalogTheme ?? DEFAULT_THEME);
        setUsageConfig(usageConfigFromSnapshot(snapshot));
        setSettingsError(null);
      })
      .catch((cause: unknown) => {
        setSettingsError(cause instanceof Error ? cause.message : String(cause));
      });
  }, [enabled]);

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
    providers,
    settingsError,
    refresh: live.refresh,
    isRefreshing: live.isRefreshing,
  };
}
