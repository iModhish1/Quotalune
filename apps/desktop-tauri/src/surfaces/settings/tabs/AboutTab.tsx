import { useEffect, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { useUpdateState } from "../../../hooks/useUpdateState";
import { getAppInfo, openExternalUrl } from "../../../lib/tauri";
import { Field, Select, Toggle } from "../../../components/FormControls";
import type { AppInfoBridge, UpdateChannel } from "../../../types/bridge";
import type { TabProps } from "../settingsTabs";
import AboutProductIdentity, { AboutEngineering } from "./AboutProductIdentity";
import AboutCreatorFooter from "./AboutCreatorFooter";

import "./AboutTab.css";
import WorkflowGuide from "../WorkflowGuide";

export default function AboutTab({ settings, set, saving }: TabProps) {
  const { t } = useLocale();
  const [appInfo, setAppInfo] = useState<AppInfoBridge | null>(null);
  const { updateState, checkNow, download, apply, openRelease } =
    useUpdateState();
  const [hasChecked, setHasChecked] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [infoError, setInfoError] = useState(false);
  const localUpdates = settings.updateChannel === "local";

  useEffect(() => {
    let active = true;
    void getAppInfo().then(info => {if(active)setAppInfo(info);}).catch(()=>{if(active)setInfoError(true);});
    return ()=>{active=false;};
  }, []);

  const handleCheck = () => {
    if (localUpdates) return;
    setHasChecked(true);
    checkNow();
  };

  const openAboutLink = (url: string) => {
    setLinkError(null);
    openExternalUrl(url).catch((error) => {
      setLinkError(String(error));
    });
  };

  if (!appInfo) {
    return (
      <section className="settings-section">
        <p className="settings-section__hint" role={infoError ? "alert" : "status"}>{t(infoError ? "WorkspaceAboutUnavailable" : "AboutLoading")}</p>
      </section>
    );
  }

  const isBusy =
    updateState.status === "checking" ||
    updateState.status === "downloading";

  return (
    <section className="settings-section about-section about-product">
      <AboutProductIdentity appInfo={appInfo} />
      {linkError && <p className="about-update-msg" role="alert">{t("ErrorPrefix")} {linkError}</p>}
      <h3 className="about-product__updates-title">{t("AboutUpdatesHeading")}</h3>
      {localUpdates && <p className="about-channel-description" role="status">{t("AboutLocalUpdatesBody")}</p>}

      <div className="about-update-controls">
        <Field
          label={t("AutoDownloadUpdates")}
          description={t("AutoDownloadUpdatesHelper")}
          leading
        >
          <Toggle
            checked={settings.autoDownloadUpdates}
            disabled={saving || localUpdates}
            onChange={(v) => set({ autoDownloadUpdates: v })}
          />
        </Field>

        <div className="about-channel-row">
          <Field label={t("UpdateChannelChoice")}>
            <Select
              value={settings.updateChannel}
              disabled={saving}
              options={[
                { value: "local", label: t("UpdateChannelLocalOption") },
                { value: "stable", label: t("UpdateChannelStableOption") },
                { value: "beta", label: t("UpdateChannelBetaOption") },
              ]}
              onChange={(v) => set({ updateChannel: v as UpdateChannel })}
            />
          </Field>
          <p className="about-channel-description">
            {t("UpdateChannelChoiceHelper")}
          </p>
        </div>
      </div>

      <div className="about-actions">
        <button
          type="button"
          className="credential-btn credential-btn--primary"
          disabled={isBusy || localUpdates}
          onClick={handleCheck}
        >
          {updateState.status === "checking"
            ? t("AboutChecking")
            : t("AboutCheckForUpdates")}
        </button>

        {updateState.status === "available" && (
          <div className="about-update-row">
            <span className="about-update-msg">
              {t("UpdateAvailableMessage").replace(
                "{}",
                updateState.version ?? "",
              )}
            </span>
            {updateState.canDownload ? (
              <button
                type="button"
                className="credential-btn credential-btn--primary"
                onClick={download}
              >
                {t("BannerDownloadButton")}
              </button>
            ) : (
              <button type="button" className="credential-btn" onClick={openRelease}>
                {t("BannerViewRelease")}
              </button>
            )}
          </div>
        )}

        {updateState.status === "downloading" && (
          <span className="about-update-msg">
            {t("UpdateDownloading")}
            {updateState.progress != null &&
              ` ${Math.round(updateState.progress * 100)}%`}
          </span>
        )}

        {updateState.status === "ready" && (
          <div className="about-update-row">
            <span className="about-update-msg">{t("UpdateReady")}</span>
            {updateState.canApply ? (
              <button
                type="button"
                className="credential-btn credential-btn--primary"
                onClick={apply}
              >
                {t("BannerInstallRestart")}
              </button>
            ) : (
              <button type="button" className="credential-btn" onClick={openRelease}>
                {t("BannerViewRelease")}
              </button>
            )}
          </div>
        )}

        {updateState.status === "error" && (
          <span className="about-update-msg">
            {t("ErrorPrefix")} {updateState.error}
          </span>
        )}

        {updateState.status === "idle" && hasChecked && !localUpdates && (
          <span className="about-update-msg">{t("AboutUpToDate")}</span>
        )}
      </div>

      <AboutEngineering openLink={openAboutLink} />
      <WorkflowGuide />
      <AboutCreatorFooter openLink={openAboutLink} enableAnimations={settings.enableAnimations} />
    </section>
  );
}
