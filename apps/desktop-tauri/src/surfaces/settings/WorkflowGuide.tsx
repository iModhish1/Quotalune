import { useLocale } from "../../hooks/useLocale";
import type { LocaleKey } from "../../i18n/keys";
import { PRIMARY_DESTINATIONS, type PrimaryDestination } from "./settingsCenterRegistry";

// Exhaustive against the actual navigation registry; no second destination list.
const WORKFLOWS: Record<PrimaryDestination, LocaleKey> = {
  dashboard: "WorkflowDashboard",
  analytics: "WorkflowAnalytics",
  notifications: "HistoryWorkflow",
  usageSpend: "WorkflowUsageSpend",
  providers: "WorkflowProviders",
  profiles: "WorkflowProfiles",
  collections: "WorkflowCollections",
  appearance: "WorkflowAppearance",
  surfaceStudio: "WorkflowSurfaces",
  trayStudio: "WorkflowTray",
  settings: "WorkflowSettings",
  about: "WorkflowAbout",
};

export default function WorkflowGuide() {
  const { t } = useLocale();
  return <details className="about-product__guide">
    <summary>{t("WorkflowGuideTitle")}</summary>
    <div className="about-product__overview">
      {PRIMARY_DESTINATIONS.map(destination => <article className="about-product__card" key={destination.id}>
        <h3>{t(destination.labelKey)}</h3>
        <p>{t(WORKFLOWS[destination.id])}</p>
      </article>)}
    </div>
  </details>;
}
