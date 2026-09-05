import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getSurfaceDemoMode, setSurfaceDemoMode } from "../lib/surfaceDemo";

export function useSurfaceDemo() {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    const reload = () => getSurfaceDemoMode().then(value => { if (mounted) setEnabled(value === true); }).catch(() => {});
    // Subscribe before reading so an in-flight toggle cannot be lost.
    const subscription = listen("quotaarc:surface-demo", reload);
    void subscription.then(reload).catch(() => {});
    return () => { mounted = false; void subscription.then(dispose => dispose()).catch(() => {}); };
  }, []);
  const toggle = async (value: boolean) => {
    try { await setSurfaceDemoMode(value); setEnabled(value); setError(null); }
    catch (cause) { setError(String(cause)); }
  };
  return { enabled, toggle, error };
}
