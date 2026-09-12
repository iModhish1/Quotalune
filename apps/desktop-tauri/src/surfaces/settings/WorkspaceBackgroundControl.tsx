import {useLocale} from "../../hooks/useLocale";
import {useReducedMotion} from "../../design-system/motion";
import {backgroundInteractionAllowed} from "../../design-system/WorkspaceBackdrop";
import type {SettingsSnapshot, SettingsUpdate, WorkspacePreferences} from "../../types/bridge";
import "./WorkspaceBackgroundControl.css";

const backgrounds = [
  {id:"cosmic", title:"WorkspaceBackgroundCosmic", help:"WorkspaceBackgroundCosmicHelp"},
  {id:"aurora", title:"WorkspaceBackgroundAurora", help:"WorkspaceBackgroundAuroraHelp"},
  {id:"starfield", title:"WorkspaceBackgroundStars", help:"WorkspaceBackgroundStarsHelp"},
  {id:"none", title:"WorkspaceBackgroundPlain", help:"WorkspaceBackgroundPlainHelp"},
] as const;

export default function WorkspaceBackgroundControl({settings, navigation, update, disabled}: {
  settings: SettingsSnapshot; navigation: WorkspacePreferences["navigation"];
  update: (patch: SettingsUpdate) => void; disabled: boolean;
}) {
  const {t} = useLocale();
  const reducedMotion = useReducedMotion();
  const prefs = settings.workspacePreferences;
  const motion = prefs?.backgroundMotion ?? "static";
  const set = (patch: Partial<WorkspacePreferences>) => update({workspacePreferences:{density:"comfortable",...prefs,navigation,...patch}});
  return <section className="settings-section workspace-background-control" aria-labelledby="workspace-background-title">
    <header><h3 id="workspace-background-title">{t("WorkspaceBackgroundTitle")}</h3><p>{t("WorkspaceBackgroundHelp")}</p></header>
    <div className="workspace-background-choices" role="group" aria-label={t("WorkspaceBackgroundTitle")}>
      {backgrounds.map(item => <button type="button" key={item.id} disabled={disabled}
        aria-pressed={(prefs?.background ?? "cosmic") === item.id} onClick={() => set({background:item.id})}>
        <span className="workspace-background-preview" data-background={item.id} aria-hidden="true"/>
        <strong>{t(item.title)}</strong><small>{t(item.help)}</small>
      </button>)}
    </div>
    <div className="workspace-background-options">
      <fieldset disabled={disabled}><legend>{t("WorkspaceBackgroundMotion")}</legend>
        <div className="workspace-background-segments">
          <button type="button" aria-pressed={motion === "static"} onClick={() => set({backgroundMotion:"static"})}>{t("WorkspaceBackgroundStatic")}</button>
          <button type="button" aria-pressed={motion === "interactive"} onClick={() => set({backgroundMotion:"interactive"})}>{t("WorkspaceBackgroundInteractive")}</button>
        </div>
      </fieldset>
      <fieldset disabled={disabled}><legend>{t("WorkspaceBackgroundIntensity")}</legend>
        <div className="workspace-background-segments">
          {([['subtle','WorkspaceBackgroundSubtle'],['balanced','WorkspaceBackgroundBalanced'],['vivid','WorkspaceBackgroundVivid']] as const).map(([id,key]) =>
            <button type="button" key={id} aria-pressed={(prefs?.backgroundIntensity ?? "balanced") === id} onClick={() => set({backgroundIntensity:id})}>{t(key)}</button>)}
        </div>
      </fieldset>
    </div>
    <p className="workspace-background-hint">{t(motion === "interactive" && !backgroundInteractionAllowed(settings,reducedMotion) ? "WorkspaceBackgroundPaused" : "WorkspaceBackgroundMotionHelp")}</p>
  </section>;
}
