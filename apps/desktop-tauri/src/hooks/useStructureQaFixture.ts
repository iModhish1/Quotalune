import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  getStructureQaFixture,
  resetStructureQaFixture,
  setStructureQaFixture,
  type StructureQaFixture,
} from "../lib/structureQaFixture";

/**
 * Wave 1F §22-30: live-reads the Dev-only Structure QA fixture, the same
 * `listen`-before-`get` pattern `useSurfaceDemo.ts` already established
 * (subscribe first so a concurrent toggle from elsewhere can't be lost).
 * Safe to mount in every channel: in a Personal/stable build the backend
 * command itself refuses `set`/`reset`, so `fixture` simply always reads
 * back `null` there and this hook never exposes a working control.
 */
export function useStructureQaFixture() {
  const [fixture, setFixture] = useState<StructureQaFixture | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const reload = () =>
      getStructureQaFixture()
        .then((value) => { if (mounted) setFixture(value); })
        .catch(() => {});
    const subscription = listen<StructureQaFixture | null>("quotalis:structure-qa-fixture", (event) => {
      if (mounted) setFixture(event.payload);
    });
    void subscription.then(reload).catch(() => {});
    return () => { mounted = false; void subscription.then((dispose) => dispose()).catch(() => {}); };
  }, []);

  const set = async (next: StructureQaFixture) => {
    try { await setStructureQaFixture(next); setFixture(next); setError(null); }
    catch (cause) { setError(String(cause)); }
  };
  const reset = async () => {
    try { await resetStructureQaFixture(); setFixture(null); setError(null); }
    catch (cause) { setError(String(cause)); }
  };

  return { fixture, set, reset, error };
}
