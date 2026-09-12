import {useEffect, useState, type ReactNode} from "react";
import {useLocale} from "../../hooks/useLocale";
import type {SettingsTabId} from "../../types/bridge";
import {PRIMARY_GROUPS, SETTINGS_CATEGORIES, primaryDestination} from "./settingsCenterRegistry";
import {TAB_META} from "./settingsTabs";

const labels = new Map(TAB_META.map(tab => [tab.id, tab.labelKey]));
type Branch = "settings" | "workspace" | "dashboard";
const BRANCHES: readonly Branch[] = ["settings", "workspace", "dashboard"];
const isBranch = (value: string): value is Branch => (BRANCHES as readonly string[]).includes(value);
const onlyExpand = (active: string) => ({settings: active === "settings", workspace: active === "workspace", dashboard: active === "dashboard"});

/**
 * One navigation hierarchy; settings editors never create a second sidebar.
 *
 * Only the branch containing the active tab stays expanded -- all three
 * used to default open and never collapsed on their own, so in the "top"/
 * "bottom" navigation layouts every branch's full children list rendered
 * inline at once (Settings alone has 7 categories), pushing the nav to
 * ~38vh regardless of which page was actually open. Auto-collapsing
 * siblings when the active branch changes reclaims that space in every
 * navigation layout without hiding anything the user hasn't already
 * chosen to look at.
 */
export default function ProductNavigation({activeTab, onNavigate, icons, hidden = false}: {
  activeTab: SettingsTabId;
  onNavigate: (tab: SettingsTabId) => void;
  icons: Partial<Record<SettingsTabId, ReactNode>>;
  hidden?: boolean;
}) {
  const {t} = useLocale();
  const primary = primaryDestination(activeTab);
  const [expanded, setExpanded] = useState(() => onlyExpand(primary));
  // Keep the expanded branch in sync when the active tab changes through a
  // path other than this component's own click handler (e.g. Settings'
  // search results navigating directly to a tab in a different branch).
  useEffect(() => {
    setExpanded(current => (isBranch(primary) && current[primary] ? current : onlyExpand(primary)));
  }, [primary]);
  const leaf = (tab: SettingsTabId) => <button type="button" key={tab}
    className="product-nav__leaf" aria-current={activeTab === tab ? "page" : undefined}
    onClick={() => onNavigate(tab)}>
    <span className="product-nav__leaf-icon" aria-hidden="true">{icons[tab]}</span>
    <span>{t(tab === "dashboard" ? "V3Overview" : labels.get(tab)!)}</span>
  </button>;
  return <nav id="product-navigation" hidden={hidden} className="settings-tabs product-nav" aria-label={t("V2PrimaryNavigation")}
    onKeyDown={event => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")].filter(button => !button.closest("[hidden]"));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }}>
    {PRIMARY_GROUPS.map(group => <div className="settings-nav-group" key={group.labelKey}>
      <span className="settings-nav-group__label">{t(group.labelKey)}</span>
      {group.tabs.map(tab => {
        const branch = tab.id === "settings" || tab.id === "workspace" || tab.id === "dashboard" ? tab.id : null;
        return <div className="product-nav__branch" key={tab.id}>
          <button type="button" id={`settings-tab-${tab.id}`} aria-controls={branch ? `product-nav-${branch}` : "settings-active-panel"}
            aria-expanded={branch ? expanded[branch] : undefined}
            aria-current={primary === tab.id ? "page" : undefined}
            className={`settings-tab ${primary === tab.id ? "settings-tab--active" : ""}`}
            onClick={() => {
              if (branch) {
                // Switching to a different branch collapses the other
                // branches too -- otherwise every branch a user has ever
                // visited stays expanded forever, which is what pushed the
                // top/bottom navigation layouts to ~38vh of the window.
                setExpanded(value => primary === tab.id ? {...value, [branch]: !value[branch]} : onlyExpand(branch));
                if (primary !== tab.id) onNavigate(tab.target);
              } else onNavigate(tab.target);
            }}>
            <span className="settings-tab__icon" aria-hidden="true">{icons[tab.target]}</span>
            <span className="settings-tab__label">{t(tab.labelKey)}</span>
            {branch && <span className="product-nav__chevron" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7"/></svg></span>}
          </button>
          {branch === "dashboard" && <div id="product-nav-dashboard" className="product-nav__children" hidden={!expanded.dashboard}>{leaf("dashboard")}{leaf("analytics")}</div>}
          {branch === "workspace" && <div id="product-nav-workspace" className="product-nav__children" hidden={!expanded.workspace}>
            {leaf("profiles")}{leaf("collections")}
          </div>}
          {branch === "settings" && <div id="product-nav-settings" className="product-nav__children" hidden={!expanded.settings}>
            {SETTINGS_CATEGORIES.map(category => <div key={category.id} className="product-nav__category">
              {category.tabs.length > 1 && <span className="product-nav__caption">{t(category.labelKey)}</span>}
              {category.tabs.map(leaf)}
            </div>)}
          </div>}
        </div>;
      })}
    </div>)}
  </nav>;
}
