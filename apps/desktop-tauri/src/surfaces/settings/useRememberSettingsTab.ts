import { useEffect, useRef } from "react";
import type { SettingsTabId, SettingsUpdate } from "../../types/bridge";

/** A shared preference is a record of navigation, not a command to other windows. */
export function useRememberSettingsTab(active: SettingsTabId, persisted: string | undefined, update: (patch: SettingsUpdate) => Promise<void>) {
  const observed = useRef<SettingsTabId | null>(null);
  useEffect(() => {
    if (observed.current === active) return;
    observed.current = active;
    if (persisted !== active) void update({ lastSettingsTab: active });
  }, [active, persisted, update]);
}
