/**
 * Dashboard Studio — configures which Dashboard experience is active and
 * how it renders, without duplicating the theme/provider-presentation
 * controls that already exist on their own Settings pages (Themes,
 * Provider Display). Persists through the same `updateSettings` bridge
 * every other Settings tab uses -- no separate configuration file, no
 * account, no cloud.
 */
import { useSettings } from "../../../hooks/useSettings";
import type { BootstrapState, DashboardModeId, DashboardPerformancePreset } from "../../../types/bridge";
import { DASHBOARD_DEFINITIONS, DASHBOARD_PERFORMANCE_PRESETS } from "../../../lib/dashboardRegistry";
import { catalogBySlug } from "../../../design-system/themeCatalog";
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
  const { settings, update, saving } = useSettings(state.settings);

  const setMode = (mode: DashboardModeId) => {
    void update({ dashboardMode: mode });
  };
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
        <span className="dashboard-studio__eyebrow">Dashboard Studio</span>
        <h2>Choose how Quotalis presents your data</h2>
        {saving && <span className="dashboard-studio__saving">Saving…</span>}
      </header>

      <section aria-label="Dashboard Experience">
        <h3>Dashboard Experience</h3>
        <div className="dashboard-studio__mode-grid" role="radiogroup" aria-label="Dashboard Experience">
          {DASHBOARD_DEFINITIONS.map((def) => (
            <button
              key={def.id}
              type="button"
              role="radio"
              aria-checked={settings.dashboardMode === def.id}
              className={`dashboard-studio__mode-card${settings.dashboardMode === def.id ? " dashboard-studio__mode-card--selected" : ""}`}
              onClick={() => setMode(def.id)}
            >
              <div className="dashboard-studio__mode-preview" aria-hidden="true" data-mode={def.id} />
              <strong>{def.name}</strong>
              <p>{def.shortDescription}</p>
              {def.isPlaceholder && <small className="dashboard-studio__badge">Dev preview</small>}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Performance">
        <h3>Performance</h3>
        <div className="dashboard-studio__preset-grid" role="radiogroup" aria-label="Performance">
          {DASHBOARD_PERFORMANCE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={settings.dashboardPerformancePreset === preset.id}
              className={`dashboard-studio__preset-card${settings.dashboardPerformancePreset === preset.id ? " dashboard-studio__preset-card--selected" : ""}`}
              onClick={() => setPreset(preset.id)}
            >
              <strong>{preset.name}</strong>
              <p>{preset.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Current Visual Identity" className="dashboard-studio__identity">
        <h3>Current Visual Identity</h3>
        <div className="dashboard-studio__identity-row">
          <span>Structure Theme</span>
          <strong>{activeThemeName}</strong>
          <button type="button" onClick={onOpenThemes}>
            Change
          </button>
        </div>
        <div className="dashboard-studio__identity-row">
          <span>Provider Presentation</span>
          <strong>{providerPresentationFollowsStructure ? "Follow Structure" : "Independent"}</strong>
          <button type="button" onClick={onOpenProviderDisplay}>
            Change
          </button>
        </div>
      </section>
    </div>
  );
}
