import { describe, expect, it } from "vitest";
import { resetSettingsPanelScroll } from "./Settings";
import { TAB_META } from "./settings/settingsTabs";

describe("Settings navigation", () => {
  it("puts Dashboard and the primary product surfaces first (in-shell navigation order)", () => {
    // Dashboard is now a real, first-class settings tab -- not a button
    // that opens a separate window -- so it leads this list.
    expect(TAB_META.slice(0, 5)).toEqual([
      { id: "dashboard", labelKey: "TabDashboard" },
      { id: "providerDisplay", labelKey: "TabProviderDisplay" },
      { id: "collections", labelKey: "TabCollections" },
      { id: "profiles", labelKey: "TabProfiles" },
      { id: "providers", labelKey: "TabProviders" },
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
