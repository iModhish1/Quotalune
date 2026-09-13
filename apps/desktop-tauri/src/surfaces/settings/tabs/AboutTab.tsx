import { useEffect, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { useUpdateState } from "../../../hooks/useUpdateState";
import { getAppInfo, openExternalUrl } from "../../../lib/tauri";
import { Field, Select, Toggle } from "../../../components/FormControls";
import type { AppInfoBridge, UpdateChannel } from "../../../types/bridge";
import type { TabProps } from "../settingsTabs";
import QuotaArcMark from "../../../components/QuotaArcMark";

import "./AboutTab.css";
import WorkflowGuide from "../WorkflowGuide";

const CONTACT_URL = "https://wa.me/966570966094";
const UPSTREAM_PROJECTS = [
  { name: "Win-CodexBar", url: "https://github.com/nesszer/Win-CodexBar", key: "AboutWindowsFoundation" },
  { name: "CodexBar", url: "https://github.com/steipete/CodexBar", key: "AboutOriginalFoundation" },
  { name: "codexcontrol", url: "https://github.com/ademisler/codexcontrol", key: "AboutAccountsFoundation" },
] as const;
// Verified from Cargo.toml and package.json; this is not an exhaustive license inventory.
const RUNTIME_TOOLS = ["Rust", "Tauri 2", "WebView2", "React", "TypeScript", "Apache ECharts", "Motion"];

export default function AboutTab({ settings, set, saving }: TabProps) {
  const { t } = useLocale();
  const [appInfo, setAppInfo] = useState<AppInfoBridge | null>(null);
  const { updateState, checkNow, download, apply, openRelease } =
    useUpdateState();
  const [hasChecked, setHasChecked] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [infoError, setInfoError] = useState(false);

  useEffect(() => {
    let active = true;
    void getAppInfo().then(info => {if(active)setAppInfo(info);}).catch(()=>{if(active)setInfoError(true);});
    return ()=>{active=false;};
  }, []);

  const handleCheck = () => {
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
      <div className="about-header">
        <QuotaArcMark className="about-icon" size={92} label={t("AppName")} />
        <div className="about-title-block">
          <h2 className="about-title">{appInfo.name}</h2>
          <p className="about-version">
            {t("Version")} {appInfo.version}
            {appInfo.buildNumber !== "dev" && ` (${appInfo.buildNumber})`}
          </p>
          <p className="about-tagline">{appInfo.tagline}</p>
        </div>
      </div>

      <div className="about-product__overview">
        <section className="about-product__card" aria-labelledby="about-owner">
          <p className="about-product__eyebrow">{t("AboutProductDevelopment")}</p>
          <h3 id="about-owner"><bdi>Mohammed Modhish</bdi></h3>
          <p>{t("AboutOwnerContribution")}</p>
          <button type="button" className="about-link about-product__contact" onClick={() => openAboutLink(CONTACT_URL)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M21 11.5a9 9 0 0 1-13.5 7.8L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z" />
              <path d="M8 7.5c-.8 1.2.4 3.8 2 5.3s4 2.7 5.3 1.8l.7-1.7-2.2-1-1 1c-1.5-.6-2.6-1.7-3.2-3.1l.9-1-1-2.1Z" />
            </svg>
            {t("AboutContactWhatsApp")}
          </button>
        </section>
        <section className="about-product__card" aria-labelledby="about-tools">
          <h3 id="about-tools">{t("AboutBuiltWith")}</h3>
          <p>{t("AboutBuiltWithBody")}</p>
          <ul className="about-product__tools">{RUNTIME_TOOLS.map(tool => <li key={tool}>{tool}</li>)}</ul>
        </section>
      </div>
      {linkError && <p className="about-update-msg" role="alert">{t("ErrorPrefix")} {linkError}</p>}

      <section className="about-product__credits" aria-labelledby="about-credits">
        <h3 id="about-credits">{t("AboutOpenSourceCredits")}</h3>
        <p>{t("AboutLicenseBody")}</p>
        <div className="about-product__credit-grid">
          {UPSTREAM_PROJECTS.map(project => <article className="about-product__card" key={project.name}>
            <button type="button" className="about-link" onClick={() => openAboutLink(project.url)}>{project.name}</button>
            <p>{t(project.key)}</p>
          </article>)}
        </div>
      </section>
      <WorkflowGuide />
      <h3 className="about-product__updates-title">{t("AboutUpdatesHeading")}</h3>
      <div className="about-divider" />

      <div className="about-update-controls">
        <Field
          label={t("AutoDownloadUpdates")}
          description={t("AutoDownloadUpdatesHelper")}
          leading
        >
          <Toggle
            checked={settings.autoDownloadUpdates}
            disabled={saving}
            onChange={(v) => set({ autoDownloadUpdates: v })}
          />
        </Field>

        <div className="about-channel-row">
          <Field label={t("UpdateChannelChoice")}>
            <Select
              value={settings.updateChannel}
              disabled={saving}
              options={[
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
          disabled={isBusy}
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

        {updateState.status === "idle" && hasChecked && (
          <span className="about-update-msg">{t("AboutUpToDate")}</span>
        )}
      </div>

    </section>
  );
}
