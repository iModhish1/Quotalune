import { useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import type { ProviderCatalogEntry, SettingsSnapshot, SettingsUpdate } from "../../../types/bridge";
import ProviderIdentityGallery from "./ProviderIdentityGallery";
import UsageDisplaySection from "./UsageDisplaySection";
import ResetDisplaySection from "./ResetDisplaySection";
import "./ProviderDisplayTab.css";

type ProviderDisplayView = "identities" | "rules" | "resetDisplay";

interface ProviderDisplayTabProps {
  settings: SettingsSnapshot;
  providerCatalog: ProviderCatalogEntry[];
  set: (patch: SettingsUpdate) => void;
  saving: boolean;
}

export default function ProviderDisplayTab({
  settings,
  providerCatalog,
  set,
  saving,
}: ProviderDisplayTabProps) {
  const { t } = useLocale();
  const [view, setView] = useState<ProviderDisplayView>("identities");

  return (
    <div className="provider-display-page">
      <header className="provider-display-page__hero">
        <div>
          <span>{t("ProviderIdentityGalleryEyebrow")}</span>
          <h2>{t("TabProviderDisplay")}</h2>
          <p>{t("ProviderPresentationIdentityHelper")}</p>
        </div>
        <div className="provider-display-page__layers" aria-label={t("TabProviderDisplay")}>
          <span>{t("TabThemes")}</span>
          <i aria-hidden="true">≠</i>
          <strong>{t("TabProviderDisplay")}</strong>
          <i aria-hidden="true">≠</i>
          <span>{t("TabSurfaces")}</span>
        </div>
      </header>

      <nav className="provider-display-page__switcher" aria-label={t("TabProviderDisplay")}>
        <button type="button" aria-pressed={view === "identities"} onClick={() => setView("identities")}>
          <span aria-hidden="true">◉</span>
          <strong>{t("ProviderIdentityGalleryTitle")}</strong>
          <small>{t("ProviderIdentityCountLabel")}</small>
        </button>
        <button type="button" aria-pressed={view === "rules"} onClick={() => setView("rules")}>
          <span aria-hidden="true">☷</span>
          <strong>{t("UsageDisplay")}</strong>
          <small>{t("ProviderPresentationGlobalTitle")}</small>
        </button>
        <button type="button" aria-pressed={view === "resetDisplay"} onClick={() => setView("resetDisplay")}>
          <span aria-hidden="true">⏱</span>
          <strong>Reset Display</strong>
          <small>Countdown, date &amp; time</small>
        </button>
      </nav>

      {view === "identities" && <ProviderIdentityGallery />}
      {view === "rules" && (
        <UsageDisplaySection
          providerCatalog={providerCatalog}
          providerAccentColors={settings.providerAccentColors}
          onSettingsChange={set}
          externalSaving={saving}
        />
      )}
      {view === "resetDisplay" && <ResetDisplaySection />}
    </div>
  );
}
