import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type {
  BootstrapState,
  SettingsTabId,
  SettingsUpdate,
} from "../types/bridge";
import { useSettings } from "../hooks/useSettings";
import { useSurfaceTarget } from "../hooks/useSurfaceMode";
import { useLocale } from "../hooks/useLocale";
import { setSurfaceMode } from "../lib/tauri";
import { TAB_META, isSettingsTab } from "./settings/settingsTabs";
import GeneralTab from "./settings/tabs/GeneralTab";
import DisplayTab from "./settings/tabs/DisplayTab";
import AdvancedTab from "./settings/tabs/AdvancedTab";
import AboutTab from "./settings/tabs/AboutTab";
import ProvidersTab from "./settings/tabs/ProvidersTab";
import UsageSpendTab from "./settings/tabs/UsageSpendTab";
import SurfacesTab from "./settings/tabs/SurfacesTab";
import ThemeGallery from "./settings/tabs/ThemeGallery";
import UsageDisplaySection from "./settings/tabs/UsageDisplaySection";
import {normalizeSettingsNavigation,SETTINGS_NAVIGATION_KEY} from "./settings/settingsNavigation";
import "./settings/SettingsStudio.css";
import SettingsWindowActions from "./settings/SettingsWindowActions";

// Inline monochrome SVG icons stand in for the upstream macOS SF Symbols
// (gearshape / square.grid.2x2 / eye / slider.horizontal.3 / info.circle).
// They render in `currentColor` so they pick up the same secondary/accent
// text color as the tab label.
const ICON_SIZE = 16;

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const TabIcons: Record<SettingsTabId, ReactElement> = {
  general: (
    <Svg>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </Svg>
  ),
  providers: (
    <Svg>
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="8" cy="12" r="1.5" />
      <path d="M5.3 4.8 7.2 10M10.7 4.8 8.8 10M5.5 4h5" />
    </Svg>
  ),
  notifications: (
    <Svg>
      <path d="M3.5 11.5h9l-1.2-1.8V7a3.3 3.3 0 0 0-6.6 0v2.7Z" />
      <path d="M6.5 13a1.7 1.7 0 0 0 3 0" />
    </Svg>
  ),
  menuBar: (
    <Svg>
      <path d="M1.5 8c1.6-3 4-4.5 6.5-4.5S13 5 14.5 8c-1.5 3-4 4.5-6.5 4.5S3.1 11 1.5 8Z" />
      <circle cx="8" cy="8" r="2" />
    </Svg>
  ),
  menu: (
    <Svg>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </Svg>
  ),
  usageSpend: (
    <Svg>
      <path d="M2 12.5V4.5h12v8" />
      <path d="M4.5 10V8M7.5 10V6.5M10.5 10V7.2M13 10V5.5" />
    </Svg>
  ),
  surfaces: (
    <Svg>
      <path d="M8 2.5 14 5.5 8 8.5 2 5.5Z" />
      <path d="M2 9.5 8 12.5 14 9.5" />
    </Svg>
  ),
  themes: (
    <Svg>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.4" />
    </Svg>
  ),
  advanced: (
    <Svg>
      <path d="M2 4h8M2 8h5M2 12h10" />
      <circle cx="11.5" cy="4" r="1.4" />
      <circle cx="8.5" cy="8" r="1.4" />
      <circle cx="13" cy="12" r="1.4" />
    </Svg>
  ),
  about: (
    <Svg>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7v4" />
      <circle cx="8" cy="5" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  ),
};


export default function Settings({ state, initialTab: propTab }: { state: BootstrapState; initialTab?: string }) {
  const [navigation,setNavigation]=useState(()=>{try{return normalizeSettingsNavigation(localStorage.getItem(SETTINGS_NAVIGATION_KEY));}catch{return normalizeSettingsNavigation(null);}});
  const [navigationError,setNavigationError]=useState(false);
  const { settings, saving, error, update } = useSettings(state.settings);
  const { t } = useLocale();
  const shellTarget = useSurfaceTarget("settings");
  const initialTab: SettingsTabId =
    propTab && isSettingsTab(propTab)
      ? propTab
      : shellTarget?.kind === "settings" && isSettingsTab(shellTarget.tab)
        ? shellTarget.tab
        : "general";
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const shellTab: SettingsTabId | null =
    shellTarget?.kind === "settings" && isSettingsTab(shellTarget.tab)
      ? shellTarget.tab
      : null;
  const [prevPropTab, setPrevPropTab] = useState(propTab);
  const [prevShellTab, setPrevShellTab] = useState(shellTab);

  // Adjust local tab during render when external drivers change (no effect sync).
  if (propTab !== prevPropTab) {
    setPrevPropTab(propTab);
    if (propTab && isSettingsTab(propTab)) {
      setActiveTab(propTab);
    }
  }
  if (shellTab !== prevShellTab) {
    setPrevShellTab(shellTab);
    if (shellTab) {
      setActiveTab(shellTab);
    }
  }

  useEffect(() => {
    const active = document.querySelector<HTMLElement>(
      '.settings-tab[aria-selected="true"]',
    );
    const nav = active?.parentElement;
    if (!active || !nav) return;
    const item = active.getBoundingClientRect(), box = nav.getBoundingClientRect();
    // Scroll only the tab strip, never the root viewport or the content panel.
    if (navigation === "side") {
      if (item.top < box.top) nav.scrollTop += item.top - box.top;
      else if (item.bottom > box.bottom) nav.scrollTop += item.bottom - box.bottom;
    } else {
      if (item.left < box.left) nav.scrollLeft += item.left - box.left;
      else if (item.right > box.right) nav.scrollLeft += item.right - box.right;
    }
  }, [activeTab, navigation]);

  const set = (patch: SettingsUpdate) => void update(patch);
  const handleTabClick = useCallback((tab: SettingsTabId) => {
    setActiveTab(tab);
    // Only transition the main window if we're NOT in the detached settings window
    if (getCurrentWebviewWindow().label !== "settings") {
      void setSurfaceMode("settings", { kind: "settings", tab });
    }
  }, []);

  return (
    <div
      className={`settings settings-studio${activeTab === "providers" ? " settings--providers-active" : ""}`}
      data-navigation={navigation}
    >
      <div className="settings-studio-toolbar">
        <div><strong>QuotaArc</strong><span>WORKSPACE / {t(TAB_META.find(tab=>tab.id===activeTab)!.labelKey)}</span></div>
        <label>Navigation <select aria-label="Settings navigation placement" value={navigation} onChange={event=>{
          const next=normalizeSettingsNavigation(event.target.value);setNavigation(next);
          try{localStorage.setItem(SETTINGS_NAVIGATION_KEY,next);setNavigationError(false);}catch{setNavigationError(true);}
        }}><option value="side">Sidebar</option><option value="top">Top</option><option value="bottom">Bottom</option></select></label>
        {navigationError && <span role="alert">Layout changed for this session; preference could not be saved.</span>}
        <SettingsWindowActions />
      </div>
      {/* tab bar */}
      <nav className="settings-tabs" role="tablist" aria-label="Settings sections" aria-orientation={navigation==="side"?"vertical":"horizontal"}>
        {TAB_META.map((tab) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            id={`settings-tab-${tab.id}`}
            aria-controls="settings-active-panel"
            tabIndex={activeTab === tab.id ? 0 : -1}
            aria-selected={activeTab === tab.id}
            className={`settings-tab ${activeTab === tab.id ? "settings-tab--active" : ""}`}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(event) => {
              const previous = navigation === "side" ? "ArrowUp" : "ArrowLeft";
              const next = navigation === "side" ? "ArrowDown" : "ArrowRight";
              const index = TAB_META.findIndex(item => item.id === tab.id);
              const target = event.key === "Home" ? 0 : event.key === "End" ? TAB_META.length - 1
                : event.key === next ? (index + 1) % TAB_META.length
                : event.key === previous ? (index - 1 + TAB_META.length) % TAB_META.length : -1;
              if (target < 0) return;
              event.preventDefault();
              handleTabClick(TAB_META[target].id);
              document.getElementById(`settings-tab-${TAB_META[target].id}`)?.focus();
            }}
          >
            <span className="settings-tab__icon">{TabIcons[tab.id]}</span>
            <span className="settings-tab__label">{t(tab.labelKey)}</span>
          </button>
        ))}
      </nav>

      {/* status bar */}
      {(saving || error) && (
        <div
          className={`settings-status ${error ? "settings-status--error" : ""}`}
        >
          {saving ? t("SettingsStatusSaving") : error}
        </div>
      )}

      {/* tab panels */}
      <div id="settings-active-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} tabIndex={0} className={`settings-body${activeTab === "providers" ? " settings-body--providers" : ""}`}>
        {activeTab === "general" && (
          <GeneralTab mode="general" settings={settings} set={set} saving={saving} />
        )}
        {activeTab === "providers" && (
          <ProvidersTab
            settings={settings}
            providers={state.providers}
            set={set}
            saving={saving}
          />
        )}
        {activeTab === "notifications" && (
          <GeneralTab mode="notifications" settings={settings} set={set} saving={saving} />
        )}
        {activeTab === "menuBar" && (
          <DisplayTab mode="menuBar" settings={settings} set={set} saving={saving} />
        )}
        {activeTab === "menu" && (
          <DisplayTab mode="menu" settings={settings} set={set} saving={saving} />
        )}
        {activeTab === "usageSpend" && (
          <UsageSpendTab settings={settings} set={set} saving={saving} />
        )}
        {activeTab === "surfaces" && <SurfacesTab />}
        {activeTab === "themes" && (
          <>
            <ThemeGallery />
            <UsageDisplaySection providerCatalog={state.providers} />
          </>
        )}
        {activeTab === "advanced" && (
          <AdvancedTab settings={settings} set={set} saving={saving} />
        )}
        {activeTab === "about" && (
          <AboutTab settings={settings} set={set} saving={saving} />
        )}
      </div>
    </div>
  );
}
