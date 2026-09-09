import {describe, expect, it} from "vitest";
import {analyticsPreferences, DEFAULT_ANALYTICS_PREFERENCES} from "./preferences";
describe("analytics presentation preferences", () => {
  it("preserves defaults without mutating the default object", () => {
    const value = analyticsPreferences();
    expect(value).toEqual(DEFAULT_ANALYTICS_PREFERENCES);
    value.sectionOrder.reverse();
    expect(DEFAULT_ANALYTICS_PREFERENCES.sectionOrder[0]).toBe("limits");
  });
  it("retains valid order, appends missing sections and drops unknown IDs", () => {
    const value = analyticsPreferences({sectionOrder:["history","history","invented"],hiddenSections:["limits","unknown","limits"]});
    expect(value.sectionOrder[0]).toBe("history");
    expect(new Set(value.sectionOrder).size).toBe(7);
    expect(value.hiddenSections).toEqual(["limits"]);
  });
});
