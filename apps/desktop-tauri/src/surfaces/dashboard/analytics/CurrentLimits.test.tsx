import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import CurrentLimits from "./CurrentLimits";
import type {ProviderUsageSnapshot, SettingsSnapshot} from "../../../types/bridge";
vi.mock("../../../hooks/useLocale", () => ({useLocale: () => ({t: (key: string) => key, language: "english"}), useOptionalLocale: () => null}));
const settings = {showAsUsed: true, providerMetrics: {}, providerAccentColors: {}} as SettingsSnapshot;
function provider(id: string): ProviderUsageSnapshot {
  const metric = {usedPercent: 64, remainingPercent: 36, resetsAt: null, resetDescription: null, windowMinutes: null, isExhausted: false, reservePercent: null, reserveDescription: null};
  return {providerId: id, displayName: id, primary: metric, selectedMetric: metric, secondary: null, tertiary: null, modelSpecific: null, extraRateWindows: [], cost: null, errorState: "ready", error: null, planName: null, accountEmail: null, accountOrganization: null, pace: null, trayStatusLabel: null, updatedAt: "2026-09-09T00:00:00Z", sourceLabel: "test"};
}
describe("Current Limits", () => {
  it("keeps original provider SVGs and maps the planet arc to observed usage only",()=>{
    const view=render(<CurrentLimits providers={[provider("codex"),{...provider("claude"),errorState:"needsAuthentication"}]} settings={settings}/>);
    expect(view.container.querySelectorAll(".provider-planet .provider-icon--svg")).toHaveLength(2);
    expect(view.container.querySelector('.provider-planet[data-provider="codex"] .provider-planet__arc')).toHaveAttribute("stroke-dasharray","64 100");
    expect(view.container.querySelector('.provider-planet[data-provider="claude"] .provider-planet__arc')).toBeNull();
  });
  it("does not show a missing-secondary-window warning for a valid primary-only provider",()=>{
    const view=render(<CurrentLimits providers={[provider("gemini")]} settings={settings}/>);
    expect(screen.getByText("64%")).toBeInTheDocument();
    expect(view.container.querySelector(".quota-window-list")).toBeNull();
  });
  it("keeps readings invariant across theme, density, chart style and limit template changes", () => {
    const source=Object.freeze(provider("codex"));
    const before=JSON.stringify(source);
    const view=render(<CurrentLimits providers={[source]} settings={settings}/>);
    for(const quotaTemplate of ["precision","compact","dual","rail"] as const) {
      for(const density of ["comfortable","compact","dense"] as const) {
        view.rerender(<CurrentLimits providers={[source]} settings={{...settings,catalogTheme:"02-smoked-silver",
          workspacePreferences:{density,navigation:"side"},analyticsPreferences:{sectionOrder:[],hiddenSections:[],defaultRange:"last7Days",providerFilterScope:"history",quotaTemplate,chartStyle:density==="dense"?"minimal":"detailed"}}}/>);
        expect(screen.getByText("64%")).toBeInTheDocument();
        expect(screen.getByText("36%")).toBeInTheDocument();
        expect(JSON.stringify(source)).toBe(before);
      }
    }
  });
  it("does not display money when the provider currency is missing", () => {
    const p: ProviderUsageSnapshot = {...provider("devin"), cost: {used: 12, currencyCode: "", limit: null, remaining: null, period: "balance", resetsAt: null, formattedUsed: "12", formattedLimit: null}};
    render(<CurrentLimits providers={[p]} settings={settings} />);
    expect(screen.queryByText("DashboardBalance")).not.toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
  });
  it("renders all 24 providers instead of the seven-entry compact-surface cap", () => {
    render(<CurrentLimits providers={Array.from({length: 24}, (_, i) => provider(`test-${i}`))} settings={settings} />);
    expect(screen.getAllByRole("article")).toHaveLength(24);
  });
  it("shows both used and remaining explicitly", () => {
    render(<CurrentLimits providers={[provider("codex")]} settings={settings} />);
    expect(screen.getByText("64%")).toBeInTheDocument();
    expect(screen.getByText("36%")).toBeInTheDocument();
  });
  it("does not expose cached quota as current when authentication is required", () => {
    render(<CurrentLimits providers={[{...provider("codex"), errorState: "needsAuthentication"}]} settings={settings} />);
    expect(screen.queryByText("64%")).not.toBeInTheDocument();
    expect(screen.getByText("DashboardNeedsAttention")).toBeInTheDocument();
  });
  it("keeps a provider balance distinct from reported spend", () => {
    const p: ProviderUsageSnapshot = {...provider("devin"), cost: {used: 12, currencyCode: "EUR", limit: null, remaining: null, period: "balance", resetsAt: null, formattedUsed: "12 EUR", formattedLimit: null}};
    render(<CurrentLimits providers={[p]} settings={settings} />);
    expect(screen.getByText("DashboardBalance")).toBeInTheDocument();
    expect(screen.getByText("12 EUR")).toBeInTheDocument();
    expect(screen.queryByText("DashboardMetricSpend")).not.toBeInTheDocument();
  });
});
