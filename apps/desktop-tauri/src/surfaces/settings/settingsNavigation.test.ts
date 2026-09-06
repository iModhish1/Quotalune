import {describe,it,expect} from "vitest";
import {horizontalNavigationScrollDelta,normalizeSettingsNavigation,shouldTransitionIntoSettings} from "./settingsNavigation";
describe("settings navigation",()=>{
  it("accepts side top and bottom and rejects corrupt preferences",()=>{
    for(const value of ["side","top","bottom"] as const)expect(normalizeSettingsNavigation(value)).toBe(value);
    for(const value of [null,undefined,"", "left",{},1])expect(normalizeSettingsNavigation(value)).toBe("side");
  });
});
describe("horizontal settings navigation wheel",()=>{
  it("uses the dominant axis and preserves its direction",()=>{
    expect(horizontalNavigationScrollDelta(2,48)).toBe(48);
    expect(horizontalNavigationScrollDelta(-64,8)).toBe(-64);
    expect(horizontalNavigationScrollDelta(0,-36)).toBe(-36);
  });
});
describe("settings tab navigation window ownership",()=>{
  it("never reapplies native window geometry while an existing settings surface changes tabs",()=>{
    expect(shouldTransitionIntoSettings("settings",false)).toBe(false);
    expect(shouldTransitionIntoSettings("main",true)).toBe(false);
    expect(shouldTransitionIntoSettings("main",false)).toBe(true);
  });
});
