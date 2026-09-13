import type {LocaleKey} from "../../i18n/keys";
import type {SettingsTabId} from "../../types/bridge";
import {CUSTOMIZATION_REGISTRY} from "../../lib/customizationRegistry";

export type PrimaryDestination = "dashboard" | "analytics" | "notifications" | "usageSpend" | "providers" | "profiles" | "collections" | "appearance" | "surfaceStudio" | "trayStudio" | "settings" | "about";
export const PRIMARY_GROUPS: {labelKey: LocaleKey; tabs: {id: PrimaryDestination; target: SettingsTabId; labelKey: LocaleKey}[]}[] = [
  {labelKey: "NavMonitor", tabs: [{id: "dashboard", target: "dashboard", labelKey: "TabDashboard"}, {id:"analytics",target:"analytics",labelKey:"V3Analytics"}, {id:"usageSpend",target:"usageSpend",labelKey:"TabUsageSpend"},{id:"notifications",target:"notifications",labelKey:"TabNotifications"}]},
  {labelKey: "NavManage", tabs: [{id: "providers", target: "providers", labelKey: "TabProviders"}, {id: "profiles", target: "profiles", labelKey: "TabProfiles"}, {id:"collections",target:"collections",labelKey:"TabCollections"}]},
  {labelKey: "V2Appearance", tabs: [{id:"appearance",target:"themes",labelKey:"V2Appearance"},{id:"surfaceStudio",target:"surfaces",labelKey:"TabSurfaces"},{id:"trayStudio",target:"menuBar",labelKey:"TrayStudioTitle"}]},
  {labelKey: "V2Settings", tabs: [{id: "settings", target: "general", labelKey: "V2Settings"}, {id:"about",target:"about",labelKey:"TabAbout"}]},
];
export const PRIMARY_DESTINATIONS = PRIMARY_GROUPS.flatMap(group => group.tabs);
export function primaryDestination(tab: SettingsTabId): PrimaryDestination {
  if (["themes","providerDisplay","resetDisplay"].includes(tab)) return "appearance";
  if (["surfaces","menu"].includes(tab)) return "surfaceStudio";
  return PRIMARY_DESTINATIONS.find(item=>item.target===tab)?.id ?? "settings";
}
export interface SettingsCategory {
  id: string; labelKey: LocaleKey; descriptionKey: LocaleKey;
  tabs: SettingsTabId[]; keywords: string[];
}
export const ALL_EDITOR_CATEGORIES: SettingsCategory[] = [
  {id: "general", labelKey: "WorkspaceGeneralAlerts", descriptionKey: "WorkspaceGeneralAlertsHelp", tabs: ["general", "notifications"], keywords: ["startup", "language", "updates", "refresh", "alerts", "threshold", "sound", "تنبيهات", "صوت", "لغة", "تشغيل"]},
  {id: "appearance", labelKey: "V2Appearance", descriptionKey: "WorkspaceAppearanceHelp", tabs: ["themes", "providerDisplay", "resetDisplay"], keywords: ["theme", "background", "identity", "density", "effects", "ثيم", "خلفية", "كثافة", "هوية", "reset", "time", "region", "remaining", "إعادة", "متبقي", "وقت"]},
  {id: "dashboard", labelKey: "WorkspaceAnalyticsData", descriptionKey: "WorkspaceAnalyticsDataHelp", tabs: ["dashboardStudio", "analyticsSources"], keywords: ["layout", "charts", "demo", "preview", "range", "تجريبي", "مخططات", "tokens", "sessions", "codex", "claude", "privacy", "local activity", "بيانات", "خصوصية"]},
  {id: "surfaces", labelKey: "V2NavigationSurfaces", descriptionKey: "V2SurfacesHelp", tabs: ["menuBar", "menu", "surfaces"], keywords: ["menu bar", "navigation", "window", "floating", "قائمة", "نافذة", "تنقل"]},
  {id: "advanced", labelKey: "TabAdvanced", descriptionKey: "V2AdvancedHelp", tabs: ["advanced"], keywords: ["diagnostics", "data", "تشخيص", "بيانات"]},
];
export const SETTINGS_CATEGORIES:SettingsCategory[] = ALL_EDITOR_CATEGORIES.filter(group=>!["appearance","surfaces"].includes(group.id)).map(group=>({...group,tabs:group.tabs.filter(tab=>tab!=="notifications")}));
export function categoryForTab(tab: SettingsTabId): SettingsCategory | undefined {
  return ALL_EDITOR_CATEGORIES.find(category => category.tabs.includes(tab));
}
// Search must land on the matching editor, not merely the first sibling in its group.
const EDITOR_SEARCH_TERMS: Partial<Record<SettingsTabId, readonly string[]>> = {
  general:["startup","language","refresh","لغة","تشغيل"],
  notifications:["alerts","threshold","sound","تنبيهات","صوت"],
  themes:["theme","background","density","aurora","stars","ثيم","خلفية","كثافة","شفق","نجوم"],
  providerDisplay:["identity","provider presentation","هوية","مزود"],
  resetDisplay:["reset","time","region","remaining","timezone","وقت","تجديد","إعادة","إقليمي"],
  dashboardStudio:["layout","charts","demo","preview","range","تجريبي","مخططات"],
  analyticsSources:["tokens","sessions","codex","claude","privacy","data","بيانات","خصوصية","جلسات"],
  about:["version","إصدار"], advanced:["diagnostics","تشخيص"],
};
export function searchSettings(query: string, translate: (key: LocaleKey) => string, labels: ReadonlyMap<SettingsTabId, LocaleKey>): SettingsCategory[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return ALL_EDITOR_CATEGORIES.filter(category => {
    const haystack = [translate(category.labelKey), translate(category.descriptionKey), ...category.keywords,
      ...CUSTOMIZATION_REGISTRY.filter(entry => entry.category === category.id).flatMap(entry => [translate(entry.labelKey), ...entry.keywords]),
      ...category.tabs.flatMap(tab => [translate(labels.get(tab)!), ...(EDITOR_SEARCH_TERMS[tab] ?? [])])].join(" ").toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  }).map(category => {
    const score = (tab: SettingsTabId) => {
      const text = [translate(labels.get(tab)!), ...(EDITOR_SEARCH_TERMS[tab] ?? [])].join(" ").toLocaleLowerCase();
      return words.filter(word => text.includes(word)).length;
    };
    return {...category,tabs:[...category.tabs].sort((a,b)=>score(b)-score(a))};
  });
}
