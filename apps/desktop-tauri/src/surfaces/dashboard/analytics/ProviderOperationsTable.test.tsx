import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {currentProviderModel} from "../../../lib/analytics/currentProviders";
import type {ProviderUsageSnapshot, SettingsSnapshot} from "../../../types/bridge";
import ProviderOperationsTable from "./ProviderOperationsTable";

vi.mock("../../../hooks/useLocale", () => ({useOptionalLocale: () => null, useLocale: () => ({t: (key: string) => ({
  TabProviders:"Provider", V2CurrentState:"Status", Plan:"Plan", DashboardKpiHighestUsage:"Current usage",
  FloatBarRemainingSuffix:"Remaining", V2NextReset:"Next reset", V2ObservationAge:"Freshness",
  DashboardValueUnavailable:"Unavailable", DashboardNeedsAttention:"Needs attention", V2ProviderReady:"Reporting",
  V24Fresh:"Fresh", V24Aging:"Aging", V24Stale:"Stale", V2MinutesShort:"min", V2PhysicalWindow:"Physical window",
  V45TableColumns:"Columns", V45TableFreshness:"Freshness", V45TablePreviousPage:"Previous page", V45TableNextPage:"Next page", V45TablePage:"Page",
} as Record<string,string>)[key] ?? key})}));
vi.mock("../../../hooks/useResetStageOptions", () => ({useResetStageOptions: () => ({locale:"en-US",translate: () => "",config:{}})}));

const NOW = Date.parse("2026-09-09T12:00:00Z");
const settings = {effectiveRefreshIntervalSecs:60} as SettingsSnapshot;
function provider(index: number, overrides: Partial<ProviderUsageSnapshot> = {}): ProviderUsageSnapshot {
  const usedPercent = index % 101;
  return {
    providerId:`provider-${index}`, displayName:`Provider ${index}`, primary:{usedPercent,remainingPercent:100-usedPercent,windowMinutes:300,resetsAt:"2026-09-09T15:00:00Z",resetDescription:null,isExhausted:false,reservePercent:null,reserveDescription:null},
    selectedMetric:{usedPercent,remainingPercent:100-usedPercent,windowMinutes:300,resetsAt:"2026-09-09T15:00:00Z",resetDescription:null,isExhausted:false,reservePercent:null,reserveDescription:null}, primaryLabel:"Monthly", secondary:null, modelSpecific:null, tertiary:null, extraRateWindows:[], cost:null, planName:"Pro", accountEmail:null, sourceLabel:"test", updatedAt:"2026-09-09T11:59:30Z", error:null, errorState:"ready", pace:null, accountOrganization:null, trayStatusLabel:null, ...overrides,
  };
}

describe("ProviderOperationsTable", () => {
  it("keeps the operational matrix complete, typed, and unpaginated at the 70-provider comparison threshold", () => {
    const models = currentProviderModel(Array.from({length:70},(_, index)=>provider(index)),settings,NOW);
    render(<ProviderOperationsTable models={models} settings={settings} now={NOW}/>);
    expect(screen.getAllByRole("row")).toHaveLength(71);
    expect(screen.getByRole("columnheader",{name:"Freshness"})).toBeInTheDocument();
    expect(screen.getByText("Provider 69")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Next page"})).toBeNull();
  });
  it("uses validated readiness and cadence freshness rather than inferring a provider status", () => {
    const models = currentProviderModel([
      provider(1, {errorState:"needsAuthentication", updatedAt:"2026-09-09T11:40:00Z"}),
      provider(2, {updatedAt:"2026-09-09T11:57:00Z"}),
    ],settings,NOW);
    render(<ProviderOperationsTable models={models} settings={settings} now={NOW}/>);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Aging")).toBeInTheDocument();
  });
});
