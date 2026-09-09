/**
 * Profiles — a first-class Settings destination (Wave 6 UX pass).
 *
 * Previously "Profiles" existed only as a runtime concept and a tray
 * switch-list (see docs/validation/PROFILES_0_11_0.md); there was no page
 * inside the main app to create, rename, duplicate, delete, or configure
 * one. This reuses the existing Rust profile store/commands unchanged
 * (`get_profile_store`, `switch_profile`, `create_profile`,
 * `rename_profile`, `duplicate_profile`, `delete_profile`,
 * `update_profile`, `set_account_profile_membership`) — no second
 * profile model.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { useProfileStore } from "../../../components/ProfileSwitcher";
import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  renameProfile,
  setAccountProfileMembership,
  switchProfile,
  updateProfile,
  type ProfileDto,
} from "../../../lib/profileBridge";
import { getProviderCatalog } from "../../../lib/tauri";
import type { ProviderCatalogEntry } from "../../../types/bridge";
import { THEME_CATALOG } from "../../../design-system/themeCatalog";
import { Toggle } from "../../../components/FormControls";
import "./ProfilesTab.css";

const THEME_OPTIONS: { value: "" | "auto" | "light" | "dark"; label: string }[] = [
  { value: "", label: "Inherit global theme" },
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const SURFACE_TOGGLES: { key: "edgeArc" | "topArc" | "taskbarArc" | "floatBar"; label: string }[] = [
  { key: "edgeArc", label: "Edge Arc" },
  { key: "topArc", label: "Quota Island" },
  { key: "taskbarArc", label: "Taskbar Arc" },
  { key: "floatBar", label: "Float Bar" },
];

export default function ProfilesTab() {
  const { t } = useLocale();
  const store = useProfileStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderCatalogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    getProviderCatalog().then(setProviders).catch(() => {});
  }, []);

  // Default the detail pane to the active profile, but keep the user's
  // explicit selection across background store refreshes.
  useEffect(() => {
    if (!store) return;
    setSelectedId((current) =>
      current && store.profiles.some((p) => p.id === current) ? current : store.activeProfileId,
    );
  }, [store]);

  const selected: ProfileDto | undefined = useMemo(
    () => store?.profiles.find((p) => p.id === selectedId),
    [store, selectedId],
  );

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const doCreate = useCallback(() => {
    const name = draftName.trim();
    if (!name) return;
    void run(async () => {
      const profile = await createProfile(name);
      setDraftName("");
      setCreating(false);
      setSelectedId(profile.id);
    });
  }, [draftName, run]);

  const doRename = useCallback(
    (id: string) => {
      const name = renameDraft.trim();
      if (!name) return;
      void run(async () => {
        await renameProfile(id, name);
        setRenamingId(null);
      });
    },
    [renameDraft, run],
  );

  const doDuplicate = useCallback(
    (profile: ProfileDto) => {
      void run(async () => {
        const copy = await duplicateProfile(profile.id, `${profile.name} copy`);
        setSelectedId(copy.id);
      });
    },
    [run],
  );

  const doDelete = useCallback(
    (profile: ProfileDto) => {
      void run(async () => {
        await deleteProfile(profile.id);
        setSelectedId(null);
      });
    },
    [run],
  );

  if (!store) {
    return (
      <section className="settings-section">
        <h3 className="settings-section__title">{t("TabProfiles")}</h3>
      </section>
    );
  }

  const canDelete = store.profiles.length > 1;

  return (
    <div className="profiles-page">
      <header className="profiles-page__header">
        <h2>{t("TabProfiles")}</h2>
        <p>{t("ProfilesPageHelper")}</p>
      </header>
      {error && <p className="profiles-page__error" role="alert">{error}</p>}
      <div className="profiles-page__layout">
        <div className="profiles-page__list" role="list">
          {store.profiles.map((profile) => (
            <div
              key={profile.id}
              role="listitem"
              className="profiles-page__row"
              data-selected={profile.id === selectedId}
              data-active={profile.id === store.activeProfileId}
            >
              <button
                type="button"
                className="profiles-page__row-select"
                onClick={() => setSelectedId(profile.id)}
              >
                <span className="profiles-page__row-mark" aria-hidden="true">
                  {profile.name.slice(0, 1).toUpperCase()}
                </span>
                {renamingId === profile.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    aria-label={`New name for ${profile.name}`}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") doRename(profile.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => doRename(profile.id)}
                  />
                ) : (
                  <span className="profiles-page__row-name">{profile.name}</span>
                )}
                {profile.id === store.activeProfileId && (
                  <span className="profiles-page__badge">Active</span>
                )}
              </button>
              <div className="profiles-page__row-actions">
                {profile.id !== store.activeProfileId && (
                  <button type="button" onClick={() => run(() => switchProfile(profile.id))}>
                    Switch
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Rename ${profile.name}`}
                  onClick={() => {
                    setRenamingId(profile.id);
                    setRenameDraft(profile.name);
                  }}
                >
                  Rename
                </button>
                <button type="button" onClick={() => doDuplicate(profile)}>
                  Duplicate
                </button>
                <button
                  type="button"
                  disabled={!canDelete}
                  title={canDelete ? undefined : "The last profile cannot be deleted"}
                  onClick={() => doDelete(profile)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {creating ? (
            <form
              className="profiles-page__create"
              onSubmit={(e) => {
                e.preventDefault();
                doCreate();
              }}
            >
              <input
                autoFocus
                value={draftName}
                placeholder="Profile name"
                aria-label="New profile name"
                onChange={(e) => setDraftName(e.target.value)}
              />
              <button type="submit" disabled={!draftName.trim()}>
                Add
              </button>
              <button type="button" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="profiles-page__row profiles-page__row--new"
              onClick={() => setCreating(true)}
            >
              + New profile
            </button>
          )}
        </div>

        {selected && (
          <div className="profiles-page__detail">
            {selected.description && (
              <p className="profiles-page__description">{selected.description}</p>
            )}

            <section className="profiles-page__field">
              <label htmlFor="profile-theme">Theme</label>
              <select
                id="profile-theme"
                value={selected.theme ?? ""}
                onChange={(e) =>
                  run(() =>
                    updateProfile({
                      profileId: selected.id,
                      theme: e.target.value === "" ? null : (e.target.value as "auto" | "light" | "dark"),
                    }),
                  )
                }
              >
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </section>

            <section className="profiles-page__field">
              <label htmlFor="profile-catalog-theme">Structure Theme</label>
              <select
                id="profile-catalog-theme"
                value={selected.catalogTheme ?? ""}
                onChange={(e) =>
                  run(() =>
                    updateProfile({
                      profileId: selected.id,
                      catalogTheme: e.target.value === "" ? null : e.target.value,
                    }),
                  )
                }
              >
                <option value="">Inherit global theme</option>
                {THEME_CATALOG.map((theme) => (
                  <option key={theme.slug} value={theme.slug}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </section>

            <section className="profiles-page__field profiles-page__field--surfaces">
              <span className="profiles-page__field-label">Surfaces active in this profile</span>
              <div className="profiles-page__surfaces">
                {SURFACE_TOGGLES.map(({ key, label }) => (
                  <label key={key} className="profiles-page__surface-toggle">
                    <span>{label}</span>
                    <Toggle
                      ariaLabel={label}
                      checked={selected.surfaces[key]}
                      disabled={false}
                      onChange={(value) =>
                        run(() => updateProfile({ profileId: selected.id, [key]: value }))
                      }
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="profiles-page__field">
              <span className="profiles-page__field-label">{t("ProfileProviderMembership")}</span>
              <p className="profiles-page__empty-hint">{t("ProfileMembershipHelp")}</p>
              {store.accounts.length === 0 ? (
                <p className="profiles-page__empty-hint">No provider accounts yet.</p>
              ) : (
                <div className="profiles-page__accounts">
                  {store.accounts.map((account) => {
                    const provider = providers.find((p) => p.id === account.provider);
                    const member = selected.accountIds.includes(account.id);
                    return (
                      <label key={account.id} className="profiles-page__account-row">
                        <input
                          type="checkbox"
                          checked={member}
                          onChange={(e) =>
                            run(() =>
                              setAccountProfileMembership(account.id, selected.id, e.target.checked),
                            )
                          }
                        />
                        <span className="profiles-page__account-name">{account.displayName}</span>
                        <span className="profiles-page__account-provider">
                          {provider?.displayName ?? account.provider}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
