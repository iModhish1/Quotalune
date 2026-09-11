import type {LocaleKey} from "../../i18n/keys";
import type {SettingsTabId} from "../../types/bridge";
import {CUSTOMIZATION_REGISTRY} from "../../lib/customizationRegistry";

export type PrimaryDestination = "dashboard" | "usageSpend" | "providers" | "workspace" | "settings";
export const PRIMARY_GROUPS: {labelKey: LocaleKey; tabs: {id: PrimaryDestination; target: SettingsTabId; labelKey: LocaleKey}[]}[] = [
  {labelKey: "NavMonitor", tabs: [{id: "dashboard", target: "dashboard", labelKey: "TabDashboard"}, {id: "usageSpend", target: "usageSpend", labelKey: "TabUsageSpend"}]},
  {labelKey: "NavManage", tabs: [{id: "providers", target: "providers", labelKey: "TabProviders"}, {id: "workspace", target: "profiles", labelKey: "V2Workspace"}]},
  {labelKey: "V2Settings", tabs: [{id: "settings", target: "general", labelKey: "V2Settings"}]},
];
export const PRIMARY_DESTINATIONS = PRIMARY_GROUPS.flatMap(group => group.tabs);
export function primaryDestination(tab: SettingsTabId): PrimaryDestination {
  if (tab === "analytics") return "dashboard";
  if (tab === "dashboard" || tab === "usageSpend" || tab === "providers") return tab;
  return tab === "profiles" || tab === "collections" ? "workspace" : "settings";
}
export interface SettingsCategory {
  id: string; labelKey: LocaleKey; descriptionKey: LocaleKey;
  tabs: SettingsTabId[]; keywords: string[];
}
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {id: "general", labelKey: "TabGeneral", descriptionKey: "V2GeneralHelp", tabs: ["general"], keywords: ["startup", "language", "updates", "refresh", "لغة", "تشغيل"]},
  {id: "appearance", labelKey: "V2Appearance", descriptionKey: "V2AppearanceHelp", tabs: ["themes", "providerDisplay"], keywords: ["theme", "identity", "density", "effects", "ثيم", "كثافة", "هوية"]},
  {id: "dashboard", labelKey: "TabDashboard", descriptionKey: "V2DashboardHelp", tabs: ["dashboardStudio"], keywords: ["layout", "charts", "demo", "preview", "range", "تجريبي", "مخططات"]},
  {id: "analyticsSources", labelKey: "TabAnalyticsSources", descriptionKey: "AnalyticsSourcesHelp", tabs: ["analyticsSources"], keywords: ["tokens", "sessions", "codex", "claude", "privacy", "local activity"]},
  {id: "reset", labelKey: "V2LimitsReset", descriptionKey: "V2ResetHelp", tabs: ["resetDisplay"], keywords: ["reset", "time", "region", "remaining", "إعادة", "متبقي", "وقت"]},
  {id: "notifications", labelKey: "TabNotifications", descriptionKey: "V2NotificationsHelp", tabs: ["notifications"], keywords: ["alerts", "threshold", "sound", "تنبيهات", "صوت"]},
  {id: "surfaces", labelKey: "V2NavigationSurfaces", descriptionKey: "V2SurfacesHelp", tabs: ["menuBar", "menu", "surfaces"], keywords: ["menu bar", "navigation", "window", "floating", "قائمة", "نافذة", "تنقل"]},
  {id: "advanced", labelKey: "TabAdvanced", descriptionKey: "V2AdvancedHelp", tabs: ["advanced", "about"], keywords: ["diagnostics", "data", "version", "تشخيص", "بيانات", "إصدار"]},
];
export function categoryForTab(tab: SettingsTabId): SettingsCategory | undefined {
  return SETTINGS_CATEGORIES.find(category => category.tabs.includes(tab));
}
export function searchSettings(query: string, translate: (key: LocaleKey) => string, labels: ReadonlyMap<SettingsTabId, LocaleKey>): SettingsCategory[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return SETTINGS_CATEGORIES.filter(category => {
    const haystack = [translate(category.labelKey), translate(category.descriptionKey), ...category.keywords,
      ...CUSTOMIZATION_REGISTRY.filter(entry => entry.category === category.id).flatMap(entry => [translate(entry.labelKey), ...entry.keywords]),
      ...category.tabs.map(tab => translate(labels.get(tab)!))].join(" ").toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  });
}
