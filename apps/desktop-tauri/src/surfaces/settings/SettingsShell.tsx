import {useId, useState, type ReactNode} from "react";
import {useLocale} from "../../hooks/useLocale";
import type {SettingsTabId} from "../../types/bridge";
import {TAB_META} from "./settingsTabs";
import {categoryForTab, searchSettings} from "./settingsCenterRegistry";
import "./SettingsShell.css";

const labels = new Map(TAB_META.map(tab => [tab.id, tab.labelKey]));
export default function SettingsShell({activeTab, onNavigate, children}: {
  activeTab: SettingsTabId; onNavigate: (tab: SettingsTabId) => void; children: ReactNode;
}) {
  const {t} = useLocale();
  const [query, setQuery] = useState("");
  const id = useId();
  const category = categoryForTab(activeTab)!;
  const results = searchSettings(query, t, labels);
  return <div className="settings-center">
    <header className="settings-center__header">
      <div><h2 id={id}>{t(category.labelKey)}</h2><p>{t(category.descriptionKey)}</p></div>
      <label className="settings-center__search"><span>{t("V2SearchSettings")}</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("V2SearchPlaceholder")} />
      </label>
    </header>
    <div className="settings-center__layout">
      {query.trim() && <nav className="settings-center__search-results" aria-label={t("V2SearchSettings")}>
        {results.map(item => <button key={item.id} type="button" onClick={() => {onNavigate(item.tabs[0]); setQuery("");}}>{t(item.labelKey)}<strong>{t(labels.get(item.tabs[0])!)}</strong><span>{t(item.descriptionKey)}</span></button>)}
        {results.length === 0 && <p role="status">{t("V2SearchEmpty")}</p>}
      </nav>}
      <section className="settings-center__content" aria-labelledby={id}>
        <div className="settings-center__editor">{children}</div>
      </section>
    </div>
  </div>;
}

export function WorkspaceShell({activeTab, onNavigate, children}: {activeTab: SettingsTabId; onNavigate: (tab: SettingsTabId) => void; children: ReactNode}) {
  const {t} = useLocale();
  return <div className="workspace-center"><header className="settings-center__header"><div><h2>{t("V2Workspace")}</h2><p>{t("V2WorkspaceHelp")}</p></div></header>
    <nav className="settings-center__subsections" aria-label={t("V2Workspace")}>
      {(["profiles", "collections"] as const).map(tab => <button key={tab} type="button" aria-current={tab === activeTab ? "page" : undefined} onClick={() => onNavigate(tab)}>{t(labels.get(tab)!)}</button>)}
    </nav>{children}</div>;
}
