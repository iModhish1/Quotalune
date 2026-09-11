import type { BootstrapState, SettingsTabId, SettingsUpdate } from "../../types/bridge";
import type { LocaleKey } from "../../i18n/keys";

/** Stable destinations grouped by user task; IDs preserve native links. */
export const SETTINGS_GROUPS: {labelKey: LocaleKey; tabs: {id: SettingsTabId; labelKey: LocaleKey}[]}[] = [
  {labelKey: "NavMonitor", tabs: [
    {id: "dashboard", labelKey: "TabDashboard"},
    {id: "analytics", labelKey: "V3Analytics"},
    {id: "usageSpend", labelKey: "TabUsageSpend"},
    {id: "analyticsSources", labelKey: "TabAnalyticsSources"},
  ]},
  {labelKey: "NavManage", tabs: [
    {id: "providers", labelKey: "TabProviders"},
    {id: "collections", labelKey: "TabCollections"},
    {id: "profiles", labelKey: "TabProfiles"},
  ]},
  {labelKey: "NavCustomize", tabs: [
    {id: "themes", labelKey: "TabThemes"},
    {id: "providerDisplay", labelKey: "TabProviderDisplay"},
    {id: "resetDisplay", labelKey: "TabResetDisplay"},
    {id: "dashboardStudio", labelKey: "TabDashboardStudio"},
  ]},
  {labelKey: "NavPreferences", tabs: [
    {id: "general", labelKey: "TabGeneral"},
    {id: "notifications", labelKey: "TabNotifications"},
    {id: "menuBar", labelKey: "TabMenuBar"},
    {id: "menu", labelKey: "TabMenu"},
    {id: "surfaces", labelKey: "TabSurfaces"},
  ]},
  {labelKey: "NavSystem", tabs: [
    {id: "advanced", labelKey: "TabAdvanced"},
    {id: "about", labelKey: "TabAbout"},
  ]},
];
export const TAB_META = SETTINGS_GROUPS.flatMap(group => group.tabs);

export interface TabProps {
  settings: BootstrapState["settings"];
  set: (p: SettingsUpdate) => void;
  saving: boolean;
}

export function isSettingsTab(value: string): value is SettingsTabId {
  return TAB_META.some((t) => t.id === value);
}
