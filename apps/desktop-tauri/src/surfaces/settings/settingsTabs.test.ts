import { describe, expect, it } from "vitest";

import type { SettingsTabId } from "../../types/bridge";

import { isSettingsTab, TAB_META } from "./settingsTabs";

describe("isSettingsTab", () => {
  it.each(["dashboard", "analytics", "general", "providers", "providerDisplay", "resetDisplay", "dashboardStudio", "notifications", "menuBar", "menu", "usageSpend", "advanced", "about"])(
    "returns true for a known tab id (%s)",
    (id) => {
      expect(isSettingsTab(id)).toBe(true);
    },
  );

  it.each(["", "General", "usage", "providers ", "unknown", "Dashboard"])(
    "returns false for an unknown value (%s)",
    (id) => {
      expect(isSettingsTab(id)).toBe(false);
    },
  );

  it("narrows to SettingsTabId on true", () => {
    const value: string = "general";
    if (isSettingsTab(value)) {
      // assigned to a SettingsTabId-typed const — would fail to compile if narrowing broke
      const _narrowed: SettingsTabId = value;
      expect(_narrowed).toBe("general");
    } else {
      expect.fail("expected narrowing to succeed");
    }
  });
});

describe("TAB_META", () => {
  it("has exactly one entry per SettingsTabId", () => {
    const declared = new Set(TAB_META.map((m) => m.id));
    // The union of all SettingsTabId literals must match the declared ids exactly.
    const expected: SettingsTabId[] = [
      "dashboard",
      "analytics",
      "general",
      "providers",
      "providerDisplay",
      "collections",
      "profiles",
      "resetDisplay",
      "dashboardStudio",
      "analyticsSources",
      "notifications",
      "menuBar",
      "menu",
      "usageSpend",
      "surfaces",
      "themes",
      "advanced",
      "about",
    ];
    expect(declared).toEqual(new Set(expected));
    expect(TAB_META).toHaveLength(expected.length);
  });

  it("has unique ids", () => {
    expect(new Set(TAB_META.map((m) => m.id)).size).toBe(TAB_META.length);
  });
});
