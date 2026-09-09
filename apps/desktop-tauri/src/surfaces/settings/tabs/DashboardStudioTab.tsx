import { useOptionalLocale } from "../../../hooks/useLocale";
import type { LocaleKey } from "../../../i18n/keys";
import { useSettings } from "../../../hooks/useSettings";
import type { BootstrapState, DashboardPerformancePreset } from "../../../types/bridge";
import { DASHBOARD_PERFORMANCE_PRESETS } from "../../../lib/dashboardPreferences";
import { catalogBySlug } from "../../../design-system/themeCatalog";
import AnalyticsPreferencesControl from "../AnalyticsPreferencesControl";
import DemoSettingsSection from "../../../demoMode/DemoSettingsSection";
import "./DashboardStudioTab.css";

export default function DashboardStudioTab({
  state,
  onOpenThemes,
  onOpenProviderDisplay,
}: {
  state: BootstrapState;
  onOpenThemes: () => void;
  onOpenProviderDisplay: () => void;
}) {
  const locale = useOptionalLocale();
  const t = (key: LocaleKey, fallback: string) => locale?.t(key) ?? fallback;
  const { settings, update, saving, error } = useSettings(state.settings);

  const setPreset = (preset: DashboardPerformancePreset) => {
    void update({ dashboardPerformancePreset: preset });
  };

  const activeThemeSlug = settings.activeProfileCatalogTheme ?? settings.catalogTheme ?? "01-obsidian-orbit";
  const activeThemeName = catalogBySlug(activeThemeSlug)?.name ?? activeThemeSlug;
  const providerPresentationFollowsStructure =
    (settings.globalLimitPresentation?.identity ?? "adaptive") === "adaptive";

  return (
    <div className="dashboard-studio">
      <header className="dashboard-studio__header">
        <span className="dashboard-studio__eyebrow">{t("V2Settings", "Settings")}</span>
        <h2>{t("DashboardPreferences", "Dashboard Preferences")}</h2>
        {saving && <span className="dashboard-studio__saving">{t("DashboardStudioSaving", "Saving…")}</span>}
      </header>


      {error && <p role="alert">{error}</p>}
      <AnalyticsPreferencesControl settings={settings} update={update} disabled={saving} />
      <section aria-label={t("DashboardPerformance", "Performance")}>
        <h3>{t("DashboardPerformance", "Performance")}</h3>
        <div className="dashboard-studio__preset-grid" role="radiogroup" aria-label={t("DashboardPerformance", "Performance")}>
          {DASHBOARD_PERFORMANCE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={settings.dashboardPerformancePreset === preset.id}
              className={`dashboard-studio__preset-card${settings.dashboardPerformancePreset === preset.id ? " dashboard-studio__preset-card--selected" : ""}`}
              onClick={() => setPreset(preset.id)}
            >
              <strong>{t(preset.id === "lowCpu" ? "DashboardLowCpu" : preset.id === "balanced" ? "DashboardBalanced" : "DashboardHighFidelity", preset.name)}</strong>
              <p>{t(preset.id === "lowCpu" ? "DashboardLowCpuHelp" : preset.id === "balanced" ? "DashboardBalancedHelp" : "DashboardHighFidelityHelp", preset.description)}</p>
            </button>
          ))}
        </div>
      </section>

      <section aria-label={t("DashboardVisualIdentity", "Current Visual Identity")} className="dashboard-studio__identity">
        <h3>{t("DashboardVisualIdentity", "Current Visual Identity")}</h3>
        <div className="dashboard-studio__identity-row">
          <span>{t("DashboardStructureTheme", "Structure Theme")}</span>
          <strong>{activeThemeName}</strong>
          <button type="button" onClick={onOpenThemes}>
            {t("V2Appearance", "Appearance")}
          </button>
        </div>
        <div className="dashboard-studio__identity-row">
          <span>{t("DashboardProviderPresentation", "Provider Presentation")}</span>
          <strong>{providerPresentationFollowsStructure ? t("DashboardFollowStructure", "Follow Structure") : t("DashboardIndependent", "Independent")}</strong>
          <button type="button" onClick={onOpenProviderDisplay}>
            {t("V2Appearance", "Appearance")}
          </button>
        </div>
      </section>

      <DemoSettingsSection settings={settings} catalog={state.providers} update={update} />
    </div>
  );
}
