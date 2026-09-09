import { useLocale } from "../../hooks/useLocale";
import type { SettingsSnapshot, SettingsUpdate, WorkspacePreferences } from "../../types/bridge";

export function WorkspacePreferencesControl({settings, navigation, update, disabled}: {
  settings: SettingsSnapshot; navigation: WorkspacePreferences["navigation"];
  update: (patch: SettingsUpdate) => void; disabled: boolean;
}) {
  const { t } = useLocale();
  return <section className="settings-section">
    <h3>{t("WorkspaceDensity")}</h3><p className="settings-section__description">{t("WorkspaceDensityHelp")}</p>
    <select aria-label={t("WorkspaceDensity")} disabled={disabled} value={settings.workspacePreferences?.density ?? "comfortable"}
      onChange={e => update({workspacePreferences:{navigation,density:e.target.value === "compact" ? "compact" : "comfortable"}})}>
      <option value="comfortable">{t("WorkspaceComfortable")}</option><option value="compact">{t("WorkspaceCompact")}</option>
    </select>
  </section>;
}
