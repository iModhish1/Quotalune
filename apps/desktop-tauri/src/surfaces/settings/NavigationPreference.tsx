import type {SettingsNavigation} from "./settingsNavigation";
import type {LocaleKey} from "../../i18n/keys";
import {useLocale} from "../../hooks/useLocale";
import "./NavigationPreference.css";

const choices:{id:SettingsNavigation;name:LocaleKey;description:LocaleKey}[]=[
  {id:"side",name:"NavigationSidebar",description:"NavigationSidebarHelper"},
  {id:"top",name:"NavigationTop",description:"NavigationTopHelper"},
  {id:"bottom",name:"NavigationBottom",description:"NavigationBottomHelper"},
];

export default function NavigationPreference({value,onChange,error}:{value:SettingsNavigation;onChange:(value:SettingsNavigation)=>void;error?:boolean}){
  const {t}=useLocale();
  return <section className="settings-section navigation-preference" aria-label={t("NavigationLayout")}>
    <h3 className="settings-section__title">{t("NavigationLayout")}</h3>
    <p className="settings-section__description">{t("NavigationLayoutHelper")}</p>
    <div className="navigation-preference__choices">
      {choices.map(choice=><button key={choice.id} type="button" aria-pressed={value===choice.id} onClick={()=>onChange(choice.id)}>
        <span className="navigation-preference__diagram" data-placement={choice.id} aria-hidden="true"><i/><b/><em/></span>
        <strong>{t(choice.name)}</strong><small>{t(choice.description)}</small>
      </button>)}
    </div>
    {error&&<p role="alert">{t("NavigationSaveError")}</p>}
  </section>;
}
