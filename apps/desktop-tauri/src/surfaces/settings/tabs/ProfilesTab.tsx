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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { useProfileStore } from "../../../components/ProfileSwitcher";
import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  renameProfile,
  reorderProfiles,
  setAccountProfileMembership,
  switchProfile,
  updateProfile,
  type ProfileDto,
} from "../../../lib/profileBridge";
import { getProviderCatalog } from "../../../lib/tauri";
import {profileCopyName, reorderedProfileIds} from '../../../lib/profilePresentation';
import {ProviderIcon} from '../../../components/providers/ProviderIcon';
import type { ProviderCatalogEntry } from "../../../types/bridge";
import { THEME_CATALOG } from "../../../design-system/themeCatalog";
import { Select, Toggle } from "../../../components/FormControls";
import "./ProfilesTab.css";

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
  const [busy,setBusy] = useState(false), lock = useRef(false);
  const [deleteId,setDeleteId] = useState<string|null>(null);
  const [accountQuery,setAccountQuery] = useState('');

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
    if(lock.current)return;
    lock.current=true;setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      lock.current=false;setBusy(false);
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
        const copy = await duplicateProfile(profile.id, profileCopyName(store?.profiles??[], profile.name, t('ProfilesCopySuffix')));
        setSelectedId(copy.id);
      });
    },
    [run,store,t],
  );

  const doDelete = useCallback(
    (profile: ProfileDto) => {
      void run(async () => {
        await deleteProfile(profile.id);
        setDeleteId(null);
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
  const accounts=store.accounts.filter(a=>`${a.displayName} ${a.provider}`.toLocaleLowerCase().includes(accountQuery.trim().toLocaleLowerCase()));
  const pendingDelete=store.profiles.find(p=>p.id===deleteId);

  return (
    <div className="profiles-page" aria-busy={busy}>
      <header className="profiles-page__header">
        <h2>{t("TabProfiles")}</h2>
        <p>{t("ProfilesPageHelper")}</p>
      </header>
      {error && <p className="profiles-page__error" role="alert">{error}</p>}
      <fieldset className="profiles-page__workspace" disabled={busy}>
      <div className="profiles-page__layout">
        <div className="profiles-page__list" role="list">
          {store.profiles.map((profile,index) => (
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
                aria-pressed={profile.id===selectedId}
                onClick={() => setSelectedId(profile.id)}
              >
                <span className="profiles-page__row-mark" aria-hidden="true">
                  {profile.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="profiles-page__row-name">{profile.name}</span>
                {profile.id === store.activeProfileId && (
                  <span className="profiles-page__badge">{t('ProfilesActive')}</span>
                )}
              </button>
              {renamingId === profile.id && (
                <form className="profiles-page__rename" onSubmit={e=>{e.preventDefault();doRename(profile.id);}}>
                  <input
                    autoFocus
                    value={renameDraft}
                    aria-label={t('ProfilesEditName').replace('{}',profile.name)}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {e.preventDefault();setRenamingId(null);}
                    }}
                  />
                  <button type="submit" disabled={!renameDraft.trim()}>{t('ProfilesSave')}</button>
                  <button type="button" onClick={()=>setRenamingId(null)}>{t('ProfilesCancel')}</button>
                </form>
              )}
              <div className="profiles-page__row-actions">
                {profile.id !== store.activeProfileId && (
                  <button type="button" aria-label={`${t('ProfilesSwitch')} ${profile.name}`} onClick={() => run(() => switchProfile(profile.id))}>
                    {t("ProfilesSwitch")}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`${t("ProfilesRename")} ${profile.name}`}
                  onClick={() => {
                    setRenamingId(profile.id);
                    setRenameDraft(profile.name);
                  }}
                >
                  {t("ProfilesRename")}
                </button>
                <button type="button" aria-label={`${t('ProfilesDuplicate')} ${profile.name}`} onClick={() => doDuplicate(profile)}>
                  {t("ProfilesDuplicate")}
                </button>
                <button
                  type="button"
                  disabled={!canDelete}
                  aria-label={`${t('ProfilesDelete')} ${profile.name}`}
                  title={canDelete ? undefined : t("ProfilesLastProtected")}
                  onClick={() => setDeleteId(profile.id)}
                >
                  {t("ProfilesDelete")}
                </button>
              </div>
              <div className="profiles-page__order" role="group" aria-label={`${t('ProfilesOrder')} ${profile.name}`}>
                <button type="button" disabled={index===0} aria-label={`${t('ProfilesMoveEarlier')} ${profile.name}`} onClick={()=>void run(()=>reorderProfiles(reorderedProfileIds(store.profiles,profile.id,-1)))}>↑ {t('ProfilesMoveEarlier')}</button>
                <button type="button" disabled={index===store.profiles.length-1} aria-label={`${t('ProfilesMoveLater')} ${profile.name}`} onClick={()=>void run(()=>reorderProfiles(reorderedProfileIds(store.profiles,profile.id,1)))}>↓ {t('ProfilesMoveLater')}</button>
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
                placeholder={t("ProfilesName")}
                aria-label={t("ProfilesNewName")}
                onChange={(e) => setDraftName(e.target.value)}
              />
              <button type="submit" disabled={!draftName.trim()}>
                {t("ProfilesAdd")}
              </button>
              <button type="button" onClick={() => setCreating(false)}>
                {t("ProfilesCancel")}
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="profiles-page__row profiles-page__row--new"
              onClick={() => setCreating(true)}
            >
              + {t("ProfilesNew")}
            </button>
          )}
          {pendingDelete&&<section className="profiles-page__delete" aria-label={t('ProfilesDeleteConfirm')}>
            <strong>{t('ProfilesDelete')} <bdi>{pendingDelete.name}</bdi>?</strong><p>{t('ProfilesDeleteHelp')}</p>
            <button type="button" onClick={()=>doDelete(pendingDelete)}>{t('ProfilesDeleteConfirm')}</button>
            <button type="button" onClick={()=>setDeleteId(null)}>{t('ProfilesCancel')}</button>
          </section>}
        </div>

        {selected && (
          <div className="profiles-page__detail">
            <header className="profiles-page__detail-heading"><h3><bdi>{selected.name}</bdi></h3><p>{t('ProfilesEditingHelp')}</p></header>
            {selected.description && (
              <p className="profiles-page__description">{selected.description}</p>
            )}

            <section className="profiles-page__field">
              <label>{t("ThemeLabel")}</label>
              <div className="profiles-page__theme-choices" role="group" aria-label={t("ThemeLabel")}>
                {([
                  {value:null,label:t("ProfilesInheritTheme")},
                  {value:"auto",label:t("ThemeAutoOption")},
                  {value:"light",label:t("ThemeLightOption")},
                  {value:"dark",label:t("ThemeDarkOption")},
                ] as const).map(option => <button
                  key={option.value ?? "inherit"}
                  type="button"
                  aria-pressed={(selected.theme ?? null) === option.value}
                  disabled={busy}
                  onClick={() => run(() => updateProfile({profileId:selected.id,theme:option.value}))}
                >{option.label}</button>)}
              </div>
            </section>

            <section className="profiles-page__field">
              <label>{t("ProfilesStructureTheme")}</label>
              <Select
                ariaLabel={t("ProfilesStructureTheme")}
                value={selected.catalogTheme ?? ""}
                options={[
                  { value: "", label: t("ProfilesInheritTheme") },
                  ...THEME_CATALOG.map((theme) => ({ value: theme.slug, label: theme.name })),
                ]}
                onChange={(value) =>
                  run(() =>
                    updateProfile({
                      profileId: selected.id,
                      catalogTheme: value === "" ? null : value,
                    }),
                  )
                }
              />
            </section>

            <section className="profiles-page__field profiles-page__field--surfaces">
              <span className="profiles-page__field-label">{t("ProfilesSurfaces")}</span>
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
                <p className="profiles-page__empty-hint">{t("ProfilesNoAccounts")}</p>
              ) : (
                <div className="profiles-page__accounts">
                  <input type="search" className="profiles-page__search" aria-label={t('ProfilesSearchAccounts')} placeholder={t('ProfilesSearchAccounts')} value={accountQuery} onChange={e=>setAccountQuery(e.target.value)}/>
                  {!accounts.length&&<p role="status">{t('ProfilesNoMatches')}</p>}
                  {accounts.map((account) => {
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
                        <ProviderIcon providerId={account.provider} size={20}/>
                        <span className="profiles-page__account-identity"><span className="profiles-page__account-name">{account.displayName}</span>
                        <span className="profiles-page__account-provider">
                          {provider?.displayName ?? account.provider}
                        </span>
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
      </fieldset>
    </div>
  );
}
