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
    const p = {...provider("devin"), cost: {used: 12, currencyCode: "EUR", limit: null, remaining: null, period: "balance"}} as ProviderUsageSnapshot;
    render(<CurrentLimits providers={[p]} settings={settings} />);
    expect(screen.getByText("DashboardBalance")).toBeInTheDocument();
    expect(screen.getByText("12 EUR")).toBeInTheDocument();
    expect(screen.queryByText("DashboardMetricSpend")).not.toBeInTheDocument();
  });
});
