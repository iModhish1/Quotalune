import type {LocaleKey} from "../../i18n/keys";
import type {SettingsTabId} from "../../types/bridge";
import {CUSTOMIZATION_REGISTRY} from "../../lib/customizationRegistry";

export type PrimaryDestination = "dashboard" | "providers" | "workspace" | "settings";
export const PRIMARY_GROUPS: {labelKey: LocaleKey; tabs: {id: PrimaryDestination; target: SettingsTabId; labelKey: LocaleKey}[]}[] = [
  {labelKey: "NavMonitor", tabs: [{id: "dashboard", target: "dashboard", labelKey: "TabDashboard"}]},
  {labelKey: "NavManage", tabs: [{id: "providers", target: "providers", labelKey: "TabProviders"}, {id: "workspace", target: "profiles", labelKey: "V2Workspace"}]},
  {labelKey: "V2Settings", tabs: [{id: "settings", target: "general", labelKey: "V2Settings"}]},
];
export const PRIMARY_DESTINATIONS = PRIMARY_GROUPS.flatMap(group => group.tabs);
export function primaryDestination(tab: SettingsTabId): PrimaryDestination {
  if (tab === "analytics" || tab === "usageSpend") return "dashboard";
  if (tab === "dashboard" || tab === "providers") return tab;
  return tab === "profiles" || tab === "collections" ? "workspace" : "settings";
}
export interface SettingsCategory {
  id: string; labelKey: LocaleKey; descriptionKey: LocaleKey;
  tabs: SettingsTabId[]; keywords: string[];
}
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {id: "general", labelKey: "WorkspaceGeneralAlerts", descriptionKey: "WorkspaceGeneralAlertsHelp", tabs: ["general", "notifications"], keywords: ["startup", "language", "updates", "refresh", "alerts", "threshold", "sound", "تنبيهات", "صوت", "لغة", "تشغيل"]},
  {id: "appearance", labelKey: "V2Appearance", descriptionKey: "WorkspaceAppearanceHelp", tabs: ["themes", "providerDisplay", "resetDisplay"], keywords: ["theme", "background", "identity", "density", "effects", "ثيم", "خلفية", "كثافة", "هوية", "reset", "time", "region", "remaining", "إعادة", "متبقي", "وقت"]},
  {id: "dashboard", labelKey: "WorkspaceAnalyticsData", descriptionKey: "WorkspaceAnalyticsDataHelp", tabs: ["dashboardStudio", "analyticsSources"], keywords: ["layout", "charts", "demo", "preview", "range", "تجريبي", "مخططات", "tokens", "sessions", "codex", "claude", "privacy", "local activity", "بيانات", "خصوصية"]},
  {id: "surfaces", labelKey: "V2NavigationSurfaces", descriptionKey: "V2SurfacesHelp", tabs: ["menuBar", "menu", "surfaces"], keywords: ["menu bar", "navigation", "window", "floating", "قائمة", "نافذة", "تنقل"]},
  {id: "advanced", labelKey: "TabAdvanced", descriptionKey: "V2AdvancedHelp", tabs: ["advanced", "about"], keywords: ["diagnostics", "data", "version", "تشخيص", "بيانات", "إصدار"]},
];
export function categoryForTab(tab: SettingsTabId): SettingsCategory | undefined {
  return SETTINGS_CATEGORIES.find(category => category.tabs.includes(tab));
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
  return SETTINGS_CATEGORIES.filter(category => {
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
