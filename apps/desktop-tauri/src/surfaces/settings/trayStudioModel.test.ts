import {describe,it,expect} from "vitest";
import {DEFAULT_PROVIDER_TRAY,trayLimits,trayPercent} from "./trayStudioModel";
import type {ProviderUsageSnapshot} from "../../types/bridge";
const sample={providerId:"codex",errorState:"ready",sourceLabel:"oauth",primaryLabel:"Session",primary:{usedPercent:21.25,remainingPercent:78.75,windowMinutes:300},secondary:{usedPercent:50,remainingPercent:50,windowMinutes:10080},secondaryLabel:"Weekly",extraRateWindows:[{id:"spark",title:"Spark",window:{usedPercent:0,remainingPercent:100,windowMinutes:300}}]} as ProviderUsageSnapshot;
describe("tray selection truth",()=>{
 it("uses exact reported windows, including extras",()=>{expect(trayLimits(sample).map(w=>w.id)).toEqual(["primary:Session:300","secondary:Weekly:10080","extra:spark:300"]);});
 it("preserves exact percent and never substitutes another limit",()=>{const c={...DEFAULT_PROVIDER_TRAY,limitId:"primary:Session:300"};expect(trayPercent(sample,c)).toBe(78.75);expect(trayPercent(sample,{...c,showAsUsed:true})).toBe(21.25);expect(trayPercent(sample,{...c,limitId:"retired"})).toBeNull();});
 it("fails closed for auth, absent snapshots and invalid numbers",()=>{const c={...DEFAULT_PROVIDER_TRAY,limitId:"primary:Session:300"};expect(trayPercent({...sample,errorState:"needsAuthentication"},c)).toBeNull();expect(trayPercent(undefined,c)).toBeNull();expect(trayPercent({...sample,primary:{...sample.primary,remainingPercent:NaN}},c)).toBeNull();});
 it("does not turn informational windows into quota meters",()=>{expect(trayLimits({...sample,primary:{...sample.primary,isInformational:true}}).some(w=>w.id.startsWith("primary:"))).toBe(false);});
});
