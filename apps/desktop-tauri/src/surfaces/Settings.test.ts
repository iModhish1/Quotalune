import { describe, expect, it } from "vitest";
import { resetSettingsPanelScroll } from "./Settings";
import { TAB_META } from "./settings/settingsTabs";

describe("Settings navigation", () => {
  it("keeps Analytics immediately beside its Dashboard parent before other primary surfaces", () => {
    expect(TAB_META.slice(0, 7)).toEqual([
      { id: "dashboard", labelKey: "TabDashboard" },
      { id: "analytics", labelKey: "V3Analytics" },
      { id: "usageSpend", labelKey: "TabUsageSpend" },
      { id: "analyticsSources", labelKey: "TabAnalyticsSources" },
      { id: "providers", labelKey: "TabProviders" },
      { id: "collections", labelKey: "TabCollections" },
      { id: "profiles", labelKey: "TabProfiles" },
    ]);
  });

  it("resets both axes when a settings page changes", () => {
    const panel = document.createElement("div");
    panel.scrollLeft = 640;
    panel.scrollTop = 320;

    resetSettingsPanelScroll(panel);

    expect(panel.scrollLeft).toBe(0);
    expect(panel.scrollTop).toBe(0);
  });
});
