import {describe, expect, it} from "vitest";
import type {ProviderUsageSnapshot, RateWindowSnapshot, SettingsSnapshot} from "../../types/bridge";
import {currentProviderModel, physicalQuotaWindows} from "./currentProviders";
const window = (usedPercent:number): RateWindowSnapshot => ({usedPercent,remainingPercent:100-usedPercent,windowMinutes:300,resetsAt:"2026-09-09T15:00:00Z",resetDescription:null,isExhausted:false,reservePercent:null,reserveDescription:null});
const provider = {providerId:"test",displayName:"Test",primary:window(0),selectedMetric:window(99),secondary:window(40),modelSpecific:window(70),tertiary:window(100),extraRateWindows:[{id:"specific",title:"Extra",window:window(10)}],errorState:"ready",error:null,updatedAt:"2026-09-09T12:00:00Z"} as ProviderUsageSnapshot;
describe("live physical quota model", () => {
  it("preserves all physical windows and never uses the presentation-selected synthetic metric", () => {
    const windows = physicalQuotaWindows(provider);
    expect(windows.map(item => item.window.usedPercent)).toEqual([0,40,70,100,10]);
    expect(new Set(windows.map(item => item.key)).size).toBe(5);
  });
  it("excludes informational/invalid windows and error caches", () => {
    expect(physicalQuotaWindows({...provider,primary:{...window(0),isInformational:true},secondary:window(101)})).toHaveLength(3);
    expect(currentProviderModel([{...provider,errorState:"expiredSession"}],{} as SettingsSnapshot,Date.parse("2026-09-09T12:00:00Z"))[0].windows).toEqual([]);
  });
  it("keeps all genuine upcoming resets rather than one marker per provider", () => {
    expect(currentProviderModel([provider],{} as SettingsSnapshot,Date.parse("2026-09-09T12:00:00Z"))[0].resets).toHaveLength(5);
  });
});
