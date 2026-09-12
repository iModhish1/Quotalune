import { useLocale } from "../../hooks/useLocale";
import { Select } from "../../components/FormControls";
import type { SettingsSnapshot, SettingsUpdate, WorkspacePreferences } from "../../types/bridge";

export function WorkspacePreferencesControl({settings, navigation, update, disabled}: {
  settings: SettingsSnapshot; navigation: WorkspacePreferences["navigation"];
  update: (patch: SettingsUpdate) => void; disabled: boolean;
}) {
  const { t } = useLocale();
  return <section className="settings-section">
    <h3>{t("WorkspaceDensity")}</h3><p className="settings-section__description">{t("WorkspaceDensityHelp")}</p>
    <Select ariaLabel={t("WorkspaceDensity")} disabled={disabled} value={settings.workspacePreferences?.density ?? "comfortable"}
      onChange={value => update({workspacePreferences:{...settings.workspacePreferences,navigation,density:value as "comfortable" | "compact" | "dense"}})}
      options={[
        {value:"comfortable",label:t("WorkspaceComfortable")},
        {value:"compact",label:t("WorkspaceCompact")},
        {value:"dense",label:t("V2Dense")},
      ]}/>
  </section>;
}
