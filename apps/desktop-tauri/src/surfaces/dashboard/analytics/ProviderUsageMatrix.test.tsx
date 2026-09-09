import {render,screen,fireEvent} from "@testing-library/react";
import {describe,it,expect,vi} from "vitest";
import {buildQuotaAnalytics} from "../../../lib/analytics/quotaAnalytics";
import type {DashboardAnalyticsModel} from "../../../lib/analytics/dashboardModel";
import type {ProviderUsageSnapshot,QuotaHistoryPoint,SettingsSnapshot} from "../../../types/bridge";
import ProviderUsageMatrix from "./ProviderUsageMatrix";
vi.mock("../../../hooks/useLocale",()=>({useLocale:()=>({t:(key:string)=>key,language:"english"}),useOptionalLocale:()=>null}));
const range={since:0,until:3*86400,grainSeconds:86400};
const provider={providerId:"codex",displayName:"Codex"} as ProviderUsageSnapshot;
const settings={highUsageThreshold:70,criticalUsageThreshold:90} as SettingsSnapshot;
const point:QuotaHistoryPoint={provider:"codex",accountId:"a",accountScope:"observed",windowKey:"primary",windowLabel:"Monthly",windowMinutes:43200,bucketStart:0,observedAt:60,usedPercent:75,remainingPercent:25,sampleCount:1,resetsAt:400000};
function model(points:QuotaHistoryPoint[]):DashboardAnalyticsModel{return {range,trends:buildQuotaAnalytics(points,range)} as DashboardAnalyticsModel;}
describe("provider usage matrix",()=>{
 it("renders one real latest observation per bucket and leaves absent days missing",()=>{
  const data=[point,{...point,observedAt:120,usedPercent:95,remainingPercent:5}];
  const before=JSON.stringify(data);const {container}=render(<ProviderUsageMatrix model={model(data)} providers={[provider]} settings={settings}/>);
  expect(container.querySelectorAll(".cosmic-matrix-dot")).toHaveLength(1);
  expect(container.querySelector(".cosmic-matrix-dot")).toHaveAttribute("data-level","critical");
  expect(container.querySelector(".cosmic-matrix-dot")).toHaveAttribute("title",expect.stringContaining("95%"));
  expect(container.querySelectorAll("tbody td")).toHaveLength(3);expect(JSON.stringify(data)).toBe(before);
 });
 it("keeps physical windows separate and expands them without averaging",()=>{
  const data=[point,{...point,windowKey:"secondary",windowLabel:"Weekly",windowMinutes:10080,usedPercent:20,remainingPercent:80}];
  const {container}=render(<ProviderUsageMatrix model={model(data)} providers={[provider]} settings={settings}/>);
  expect(container.querySelectorAll(".cosmic-matrix-dot")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button",{name:"Codex"}));expect(container.querySelectorAll(".cosmic-matrix-dot")).toHaveLength(2);
 });
 it("fails closed for conflicting or unidentified histories",()=>{
  const {container}=render(<ProviderUsageMatrix model={model([{...point,accountScope:"unknown" as QuotaHistoryPoint["accountScope"],accountId:""}])} providers={[provider]} settings={settings}/>);
  expect(container.querySelector(".cosmic-matrix-dot")).toBeNull();expect(screen.getByText("V2NoPhysicalHistory")).toBeInTheDocument();
 });
});
