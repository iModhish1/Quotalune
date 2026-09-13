import {useEffect, useState} from "react";
import {listen} from "@tauri-apps/api/event";
import {getProviderInstances} from "../lib/tauri";
import type {ProviderInstanceSnapshot} from "../types/bridge";

/** Passive account cache read. No auth or refresh is initiated by this hook. */
export function useProviderInstances(enabled: boolean) {
  const [instances, setInstances] = useState<ProviderInstanceSnapshot[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled) {setInstances([]); setError(false); return;}
    let active = true, revision = 0;
    const stops: (() => void)[] = [];
    const reload = async () => {
      const request = ++revision;
      try {
        const next = await getProviderInstances();
        if (active && request === revision) {setInstances(next); setError(false);}
      } catch {
        // A removed account or unreadable store must not retain another account's card.
        if (active && request === revision) {setInstances([]); setError(true);}
      }
    };
    // A settings event also fires for badge/order changes. Keep the current
    // identity set until its replacement arrives, or an open account dialog
    // would disappear while saving a presentation-only preference.
    const reset = () => {void reload();};
    const registrations = ["codex-accounts-updated", "refresh-complete", "settings-changed", "quotalis:settings-updated"]
      .map(name => Promise.resolve(listen(name, name === "settings-changed" || name === "quotalis:settings-updated" ? reset : reload))
        .then(stop => {if (active) {if (stop) stops.push(stop);} else stop?.();}).catch(() => {}));
    window.addEventListener("quotalis:settings-updated", reset);
    void Promise.all(registrations).then(() => {if (active) void reload();});
    return () => {active = false; revision++; stops.forEach(stop => stop()); window.removeEventListener("quotalis:settings-updated", reset);};
  }, [enabled]);
  return {instances: enabled ? instances : [], error: enabled && error};
}
