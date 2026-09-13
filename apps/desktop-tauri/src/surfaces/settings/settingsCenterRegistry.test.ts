import {describe, expect, it} from "vitest";
import {PRIMARY_DESTINATIONS, SETTINGS_CATEGORIES, categoryForTab, primaryDestination, searchSettings} from "./settingsCenterRegistry";
import {TAB_META} from "./settingsTabs";

describe("Settings Center route contract", () => {
  it("groups related monitoring under Dashboard and maps every legacy route exactly once", () => {
    expect(PRIMARY_DESTINATIONS.map(item => item.id)).toEqual(["dashboard", "analytics", "usageSpend", "notifications", "providers", "profiles", "collections", "appearance", "surfaceStudio", "trayStudio", "settings", "about"]);
    expect(primaryDestination("usageSpend")).toBe("usageSpend");
    expect(categoryForTab("resetDisplay")?.id).toBe("appearance");
    expect(categoryForTab("analyticsSources")?.id).toBe("dashboard");
    expect(categoryForTab("notifications")?.id).toBe("general");
    for (const tab of TAB_META) {
      const parent = primaryDestination(tab.id);
      expect(PRIMARY_DESTINATIONS.some(item => item.id === parent)).toBe(true);
      expect(SETTINGS_CATEGORIES.filter(category => category.tabs.includes(tab.id))).toHaveLength(parent === "settings" ? 1 : 0);
    }
  });
  it("preserves direct links to the right editor category", () => {
    expect(categoryForTab("providerDisplay")?.id).toBe("appearance");
    expect(categoryForTab("dashboardStudio")?.id).toBe("dashboard");
    expect(categoryForTab("menu")?.id).toBe("surfaces");
    expect(primaryDestination("collections")).toBe("collections");
  });
  it("searches declared keywords and translated labels without any remote request", () => {
    const labels = new Map(TAB_META.map(tab => [tab.id, tab.labelKey]));
    const t = (key: string) => key === "V2Appearance" ? "المظهر" : key;
    expect(searchSettings("density", t, labels).map(c => c.id)).toEqual(["appearance"]);
    expect(searchSettings("المظهر", t, labels).map(c => c.id)).toEqual(["appearance"]);
    expect(searchSettings("menu bar", t, labels).map(c => c.id)).toEqual(["surfaces"]);
    expect(searchSettings("not-a-setting", t, labels)).toEqual([]);
  });
  it("opens matching siblings instead of the first page in a merged category",()=>{
    const labels=new Map(TAB_META.map(tab=>[tab.id,tab.labelKey]));
    for(const [query,tab] of [["sound","notifications"],["sessions","analyticsSources"],["وقت","resetDisplay"],["background","themes"]]) {
      expect(searchSettings(query,key=>key,labels)[0].tabs[0]).toBe(tab);
    }
    expect(categoryForTab("notifications")?.tabs[0]).toBe("general");
  });
});
