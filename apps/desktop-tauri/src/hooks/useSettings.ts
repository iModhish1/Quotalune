import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { SettingsSnapshot, SettingsUpdate } from "../types/bridge";
import { getSettingsSnapshot, updateSettings } from "../lib/tauri";

interface UseSettingsReturn {
  settings: SettingsSnapshot;
  saving: boolean;
  error: string | null;
  update: (patch: SettingsUpdate) => Promise<void>;
}

/**
 * Manages the current settings state and exposes a mutation helper that
 * persists changes through the Tauri bridge and refreshes the local copy.
 */
export function useSettings(initial: SettingsSnapshot): UseSettingsReturn {
  const [settings, setSettings] = useState<SettingsSnapshot>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);

  useEffect(() => {
    let cancelled = false;

    setSettings(initial);

    const request = ++revision.current;
    getSettingsSnapshot()
      .then((fresh) => {
        if (!cancelled && request === revision.current) {
          setSettings(fresh);
        }
      })
      .catch(() => {
        // Keep the bootstrap snapshot if the background sync fails.
      });

    return () => {
      cancelled = true;
    };
  }, [initial]);

  // Share successful patches between multiple consumers in this webview as well.
  useEffect(() => {
    const receive = (event: Event) => {
      const next = (event as CustomEvent<SettingsSnapshot>).detail;
      if (next) { revision.current++; setSettings(next); }
    };
    window.addEventListener("quotalis:settings-updated", receive);
    return () => window.removeEventListener("quotalis:settings-updated", receive);
  }, []);

  // Live-sync when settings change in ANOTHER window. The detached Settings
  // window and the main/PopOut window are separate webviews with separate
  // React state, so the in-window CustomEvent below never reaches them. Rust
  // broadcasts "settings-changed" after every persisted update; re-fetch the
  // snapshot so this surface (e.g. the PopOut window scale) re-renders live.
  useEffect(() => {
    let active = true;
    const unlisteners: (() => void)[] = [];
    // `Promise.resolve` tolerates test mocks that return a bare unlisten fn (or
    // undefined) instead of a promise; the `active` flag handles unmounting
    // before the listener finishes registering.
    for (const eventName of ["settings-changed", "quotalis:settings-updated"]) {
    Promise.resolve(
      listen(eventName, () => {
        const request = ++revision.current;
        getSettingsSnapshot()
          .then((fresh) => { if(active && request === revision.current)setSettings(fresh); })
          .catch(() => {
            // Keep the current copy if the refresh fails.
          });
      }),
    )
      .then((fn) => {
        if (active) {
          if(fn)unlisteners.push(fn);
        } else {
          fn?.();
        }
      })
      .catch(() => {});
    }
    return () => {
      active = false;
      unlisteners.forEach(stop=>stop());
    };
  }, []);

  const update = useCallback(async (patch: SettingsUpdate) => {
    setSaving(true);
    setError(null);
    try {
      const next = await updateSettings(patch);
      revision.current++;
      setSettings(next);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent<SettingsSnapshot>("quotalis:settings-updated", {
            detail: next,
          }),
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      // Re-fetch to stay in sync with disk state on failure
      try {
        const fresh = await getSettingsSnapshot();
        setSettings(fresh);
      } catch {
        // ignore secondary failure
      }
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, saving, error, update };
}
