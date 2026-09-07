/**
 * Profile switcher — a compact, keyboard-friendly control for the dashboard
 * title area. Lists profiles with the active one checked; creating and
 * switching happen inline. Falls back to a plain select until opened.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  createProfile,
  getProfileStore,
  switchProfile,
  type ProfileStoreDto,
} from "../lib/profileBridge";
import { getSettingsSnapshot } from "../lib/tauri";

export function useProfileStore(): ProfileStoreDto | null {
  const [store, setStore] = useState<ProfileStoreDto | null>(null);

  const reload = useCallback(() => {
    // Demo stage (headless screenshot gate): no Tauri, deterministic store.
    const demoCount = (window as unknown as { __qaDemoProfiles?: number }).__qaDemoProfiles;
    if (typeof demoCount === "number") {
      const profiles = Array.from({ length: Math.max(1, demoCount) }, (_, i) => ({
        id: `demo-${i}`,
        name: i === 0 ? "Default" : `Profile ${i + 1}`,
        description: null,
        enabled: true,
        theme: null,
        accent: null,
        surfaces: { edgeArc: false, topArc: false, taskbarArc: false, floatBar: false },
        accountIds: [],
        highUsageThreshold: 80,
        criticalUsageThreshold: 95,
        createdAt: 0,
        updatedAt: 0,
      }));
      setStore({
        schemaVersion: 1,
        profiles,
        accounts: [],
        activeProfileId: profiles[0]?.id ?? "",
      });
      return;
    }
    getProfileStore()
      .then(setStore)
      .catch(() => setStore(null));
  }, []);

  useEffect(() => {
    reload();
    const unlisten = listen("profiles-changed", reload);
    return () => {
      void unlisten.then((fn) => fn()).catch(() => {});
    };
  }, [reload]);

  return store;
}

/** Privacy Mode hides profile/account names across surfaces. */
export function usePrivacyMode(): boolean {
  const [privacy, setPrivacy] = useState(false);
  useEffect(() => {
    const load = () =>
      getSettingsSnapshot()
        .then((s: { privacyMode?: boolean }) => setPrivacy(Boolean(s.privacyMode)))
        .catch(() => {});
    load();
    const unlisten = listen("quotalis:settings-updated", load);
    return () => {
      void unlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);
  return privacy;
}

export default function ProfileSwitcher() {
  const store = useProfileStore();
  const privacy = usePrivacyMode();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => store?.profiles.find((p) => p.id === store.activeProfileId),
    [store],
  );

  const doSwitch = useCallback(async (id: string) => {
    setOpen(false);
    try {
      await switchProfile(id);
    } catch {
      /* surfaced by profiles-changed state */
    }
  }, []);

  const doCreate = useCallback(async () => {
    setError(null);
    try {
      const profile = await createProfile(draftName);
      setDraftName("");
      setCreating(false);
      await switchProfile(profile.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [draftName]);

  if (!store) return null;

  return (
    <div className="qa-profile-switcher" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="qa-profile-switcher__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="qa-profile-switcher__mark" aria-hidden="true">
          {privacy ? "•" : (active?.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="qa-profile-switcher__name">
          {privacy ? "Profile" : active?.name ?? "Profile"}
        </span>
      </button>
      {open && (
        <div className="qa-profile-switcher__menu" role="menu">
          {store.profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              className="qa-profile-switcher__item"
              data-active={p.id === store.activeProfileId ? "true" : "false"}
              onClick={() => doSwitch(p.id)}
            >
              <span className="qa-profile-switcher__item-mark" aria-hidden="true">
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              {p.name}
            </button>
          ))}
          {creating ? (
            <form
              className="qa-profile-switcher__create"
              onSubmit={(e) => {
                e.preventDefault();
                void doCreate();
              }}
            >
              <input
                autoFocus
                value={draftName}
                placeholder="Profile name"
                onChange={(e) => setDraftName(e.target.value)}
                aria-label="New profile name"
              />
              <button type="submit" disabled={!draftName.trim()}>
                Add
              </button>
              {error && <span className="qa-profile-switcher__error">{error}</span>}
            </form>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="qa-profile-switcher__item qa-profile-switcher__item--new"
              onClick={() => setCreating(true)}
            >
              + New profile
            </button>
          )}
        </div>
      )}
    </div>
  );
}
