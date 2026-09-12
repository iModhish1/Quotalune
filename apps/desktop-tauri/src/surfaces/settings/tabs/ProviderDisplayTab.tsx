import { useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import type { ProviderCatalogEntry, SettingsSnapshot, SettingsUpdate } from "../../../types/bridge";
import ProviderIdentityGallery from "./ProviderIdentityGallery";
import UsageDisplaySection from "./UsageDisplaySection";
import "./ProviderDisplayTab.css";

type ProviderDisplayView = "identities" | "rules";

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
          <h2>{t("TabProviderDisplay")}</h2>
          <p>{t("ProviderPresentationIdentityHelper")}</p>
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
    </div>
  );
}
