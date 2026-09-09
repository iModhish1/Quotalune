import { workspaceThemeStyle } from "../design-system/workspaceTheme";
import { useRememberSettingsTab } from "./settings/useRememberSettingsTab";
import { WorkspacePreferencesControl } from "./settings/WorkspacePreferencesControl";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
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
import { isSettingsTab } from "./settings/settingsTabs";
import GeneralTab from "./settings/tabs/GeneralTab";
import DisplayTab from "./settings/tabs/DisplayTab";
import AdvancedTab from "./settings/tabs/AdvancedTab";
import AboutTab from "./settings/tabs/AboutTab";
import ProvidersTab from "./settings/tabs/ProvidersTab";
import UsageSpendTab from "./settings/tabs/UsageSpendTab";
import SurfacesTab from "./settings/tabs/SurfacesTab";
import ThemeGallery from "./settings/tabs/ThemeGallery";
import ProviderDisplayTab from "./settings/tabs/ProviderDisplayTab";
import DashboardTab from "./settings/tabs/DashboardTab";
import ResetDisplaySection from "./settings/tabs/ResetDisplaySection";
import DashboardStudioTab from "./settings/tabs/DashboardStudioTab";
import CollectionsTab from "./settings/tabs/CollectionsTab";
import ProfilesTab from "./settings/tabs/ProfilesTab";
import {horizontalNavigationScrollDelta,normalizeSettingsNavigation,SETTINGS_NAVIGATION_KEY,shouldTransitionIntoSettings} from "./settings/settingsNavigation";
import NavigationPreference from "./settings/NavigationPreference";
import "./settings/SettingsStudio.css";
import SettingsWindowActions from "./settings/SettingsWindowActions";
import SettingsShellHeader from "./settings/SettingsShellHeader";
import SettingsShell, {WorkspaceShell} from "./settings/SettingsShell";
import {PRIMARY_GROUPS, PRIMARY_DESTINATIONS, primaryDestination} from "./settings/settingsCenterRegistry";

function ContentShell({tab, navigate, children}: {tab: SettingsTabId; navigate: (tab: SettingsTabId) => void; children: ReactNode}) {
  const destination = primaryDestination(tab);
  return destination === "settings" ? <SettingsShell activeTab={tab} onNavigate={navigate}>{children}</SettingsShell>
    : destination === "workspace" ? <WorkspaceShell activeTab={tab} onNavigate={navigate}>{children}</WorkspaceShell> : <>{children}</>;
}

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
  dashboard: (
    <Svg>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="8" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
    </Svg>
  ),
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
  providerDisplay: (
    <Svg>
      <circle cx="5" cy="8" r="2.5" />
      <path d="M7.5 8h6M10 5.5 13.5 8 10 10.5" />
      <path d="M3.5 8a1.5 1.5 0 0 0 3 0" />
    </Svg>
  ),
  collections: (
    <Svg>
      <rect x="2" y="2" width="6" height="4.5" rx="1" />
      <rect x="9.5" y="2" width="4.5" height="7" rx="1" />
      <rect x="2" y="8" width="6" height="6" rx="1" />
      <rect x="9.5" y="10.5" width="4.5" height="3.5" rx="1" />
    </Svg>
  ),
  profiles: (
    <Svg>
      <circle cx="6" cy="5.5" r="2.2" />
      <path d="M2.2 13.2c.4-2.4 2-3.6 3.8-3.6s3.4 1.2 3.8 3.6" />
      <circle cx="11.5" cy="4.5" r="1.6" opacity=".55" />
      <path d="M14 9.8c-.3-1.5-1.2-2.4-2.3-2.6" opacity=".55" />
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
  resetDisplay: (
    <Svg>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.6 1.6" />
    </Svg>
  ),
  dashboardStudio: (
    <Svg>
      <rect x="2" y="3" width="12" height="8" rx="1.4" />
      <path d="M6 13.5h4M8 11v2.5" />
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

export function resetSettingsPanelScroll(panel: HTMLElement | null): void {
  if (!panel) return;
  panel.scrollTop = 0;
  panel.scrollLeft = 0;
}

export default function Settings({ state, initialTab: propTab }: { state: BootstrapState; initialTab?: string }) {
  const [legacyNavigation]=useState(()=>{try{return normalizeSettingsNavigation(localStorage.getItem(SETTINGS_NAVIGATION_KEY));}catch{return normalizeSettingsNavigation(null);}});

  const { settings, saving, error, update } = useSettings(state.settings);
  const navigation = settings.workspacePreferences?.navigation ?? legacyNavigation;
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
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Every settings page owns its own reading origin. A horizontally scrollable
  // collection/editor must not leave the next page shifted into empty space.
  useLayoutEffect(() => {
    resetSettingsPanelScroll(panelRef.current);
  }, [activeTab, navigation]);

  // Remember the active tab for "Last opened" startup destination. Only
  // persists once settings have actually loaded, so a fresh/loading render
  // never overwrites a real remembered tab with the transient "general"
  // default state starts in.
  useRememberSettingsTab(activeTab, settings.lastSettingsTab, update);

  const set = (patch: SettingsUpdate) => void update(patch);
  const handleTabClick = useCallback((tab: SettingsTabId) => {
    setActiveTab(tab);
    // Tab changes are local while Settings already owns the surface. Re-running
    // a native transition here can disturb Windows maximize/Snap geometry.
    if (shouldTransitionIntoSettings(getCurrentWebviewWindow().label,shellTarget!==null)) {
      void setSurfaceMode("settings", { kind: "settings", tab });
    }
  }, [shellTarget]);

  const primary = primaryDestination(activeTab);
  return (
    <div
      className={`settings settings-studio${activeTab === "providers" ? " settings--providers-active" : ""}`}
      style={workspaceThemeStyle(settings)}
      data-navigation={navigation}
    >
      <SettingsShellHeader section={t(PRIMARY_DESTINATIONS.find(tab=>tab.id===primary)!.labelKey)}>
        <SettingsWindowActions />
      </SettingsShellHeader>
      {/* tab bar */}
      <nav className="settings-tabs" role="tablist" aria-label={t("V2PrimaryNavigation")} aria-orientation={navigation==="side"?"vertical":"horizontal"} onWheel={event=>{
        if(navigation==="side")return;
        const delta=horizontalNavigationScrollDelta(event.deltaX,event.deltaY);
        if(delta===0)return;
        event.currentTarget.scrollLeft+=delta;
        event.preventDefault();
      }}>
        {PRIMARY_GROUPS.map(group => <div className="settings-nav-group" role="group" aria-label={t(group.labelKey)} key={group.labelKey}>
          <span className="settings-nav-group__label" aria-hidden="true">{t(group.labelKey)}</span>
          {group.tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            id={`settings-tab-${tab.id}`}
            aria-controls="settings-active-panel"
            tabIndex={primary === tab.id ? 0 : -1}
            aria-selected={primary === tab.id}
            className={`settings-tab ${primary === tab.id ? "settings-tab--active" : ""}`}
            onClick={() => handleTabClick(tab.target)}
            onKeyDown={(event) => {
              const rtl = document.documentElement.dir === "rtl";
              const previous = navigation === "side" ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
              const next = navigation === "side" ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
              const index = PRIMARY_DESTINATIONS.findIndex(item => item.id === tab.id);
              const target = event.key === "Home" ? 0 : event.key === "End" ? PRIMARY_DESTINATIONS.length - 1
                : event.key === next ? (index + 1) % PRIMARY_DESTINATIONS.length
                : event.key === previous ? (index - 1 + PRIMARY_DESTINATIONS.length) % PRIMARY_DESTINATIONS.length : -1;
              if (target < 0) return;
              event.preventDefault();
              handleTabClick(PRIMARY_DESTINATIONS[target].target);
              document.getElementById(`settings-tab-${PRIMARY_DESTINATIONS[target].id}`)?.focus();
            }}
          >
            <span className="settings-tab__icon">{TabIcons[tab.target]}</span>
            <span className="settings-tab__label">{t(tab.labelKey)}</span>
          </button>
        ))}
        </div>)}
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
      <div ref={panelRef} id="settings-active-panel" role="tabpanel" aria-labelledby={`settings-tab-${primary}`} tabIndex={0} data-tab={activeTab} className={`settings-body${activeTab === "providers" ? " settings-body--providers" : ""}`}>
        <ContentShell tab={activeTab} navigate={handleTabClick}>
        {activeTab === "dashboard" && (
          <DashboardTab state={state} onOpenProviders={() => handleTabClick("providers")} />
        )}
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
        {activeTab === "providerDisplay" && (
          <ProviderDisplayTab
            settings={settings}
            providerCatalog={state.providers}
            set={set}
            saving={saving}
          />
        )}
        {activeTab === "collections" && <CollectionsTab />}
        {activeTab === "profiles" && <ProfilesTab />}
        {activeTab === "resetDisplay" && <ResetDisplaySection />}
        {activeTab === "dashboardStudio" && (
          <DashboardStudioTab
            state={state}
            onOpenThemes={() => handleTabClick("themes")}
            onOpenProviderDisplay={() => handleTabClick("providerDisplay")}
          />
        )}
        {activeTab === "notifications" && (
          <GeneralTab
            mode="notifications"
            settings={settings}
            set={set}
            saving={saving}
            providerCatalog={state.providers}
          />
        )}
        {activeTab === "menuBar" && (
          <><NavigationPreference value={navigation} error={!!error} onChange={next=>{
            void update({workspacePreferences: {density: settings.workspacePreferences?.density ?? "comfortable", navigation: next}});
          }}/><DisplayTab mode="menuBar" settings={settings} set={set} saving={saving} /></>
        )}
        {activeTab === "menu" && (
          <DisplayTab mode="menu" settings={settings} set={set} saving={saving} />
        )}
        {activeTab === "usageSpend" && (
          <UsageSpendTab settings={settings} set={set} saving={saving} />
        )}
        {activeTab === "surfaces" && <SurfacesTab />}
        {activeTab === "themes" && (
          <><WorkspacePreferencesControl settings={settings} navigation={navigation} update={update} disabled={saving}/><ThemeGallery /></>
        )}
        {activeTab === "advanced" && (
          <AdvancedTab settings={settings} set={set} saving={saving} />
        )}
        {activeTab === "about" && (
          <AboutTab settings={settings} set={set} saving={saving} />
        )}
        </ContentShell>
      </div>
    </div>
  );
}
