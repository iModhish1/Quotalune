import {describe,it,expect} from "vitest";
import {normalizeSettingsNavigation} from "./settingsNavigation";
describe("settings navigation",()=>{
  it("accepts side top and bottom and rejects corrupt preferences",()=>{
    for(const value of ["side","top","bottom"] as const)expect(normalizeSettingsNavigation(value)).toBe(value);
    for(const value of [null,undefined,"", "left",{},1])expect(normalizeSettingsNavigation(value)).toBe("side");
  });
});
