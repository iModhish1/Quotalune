import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProviderUsageSnapshot, SettingsSnapshot } from "../types/bridge";

vi.mock("../hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string) =>
      ({
        TabDashboard: "Dashboard",
        DashboardKpiActiveProviders: "Active Providers",
        DashboardKpiAlerts: "Alerts",
        DashboardKpiNextReset: "Next Reset",
        DashboardKpiHighestUsage: "Highest Usage",
      })[key] ?? key,
    language: "en",
  }),
}));

import DashboardSummaryRibbon from "./DashboardSummaryRibbon";

function rateWindow(overrides: Partial<ProviderUsageSnapshot["primary"]> = {}) {
  return {
    usedPercent: 20,
    remainingPercent: 80,
    windowMinutes: null,
    resetsAt: null,
    resetDescription: null,
    isExhausted: false,
    reservePercent: null,
    reserveDescription: null,
    ...overrides,
  };
}

function provider(overrides: Partial<ProviderUsageSnapshot> = {}): ProviderUsageSnapshot {
  return {
    providerId: "claude",
    displayName: "Claude",
    primary: rateWindow(),
    selectedMetric: rateWindow(),
    primaryLabel: "Monthly",
    secondary: null,
    modelSpecific: null,
    tertiary: null,
    extraRateWindows: [],
    cost: null,
    planName: null,
    accountEmail: null,
    sourceLabel: "auto",
    updatedAt: "2026-09-07T00:00:00Z",
    error: null,
    errorState: "ready",
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
    fetchDurationMs: null,
    ...overrides,
  };
}

const settings = {
  highUsageThreshold: 70,
  criticalUsageThreshold: 90,
  resetTimeRelative: false,
} as SettingsSnapshot;

describe("DashboardSummaryRibbon", () => {
  it("always shows the real active-provider count, even for zero providers", () => {
    render(<DashboardSummaryRibbon providers={[]} settings={settings} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("surfaces a real alert count with warning tone when providers need attention", () => {
    const providers = [provider({ providerId: "codex", errorState: "needsAuthentication" })];
    const { container } = render(<DashboardSummaryRibbon providers={providers} settings={settings} />);
    const warningValue = container.querySelector(".dashboard-summary-ribbon__item--warning .dashboard-summary-ribbon__value");
    expect(warningValue).toHaveTextContent("1");
  });

  it("never shows an alert item when there is nothing to act on", () => {
    const providers = [provider({ errorState: "ready" })];
    const { container } = render(<DashboardSummaryRibbon providers={providers} settings={settings} />);
    expect(container.querySelector(".dashboard-summary-ribbon__item--warning")).toBeNull();
  });

  it("surfaces the soonest real reset, isolated from surrounding text direction", () => {
    const soon = new Date(Date.now() + 3600_000).toISOString();
    const providers = [provider({ providerId: "codex", displayName: "Codex", primary: rateWindow({ resetsAt: soon }) })];
    render(<DashboardSummaryRibbon providers={providers} settings={settings} />);
    const nextResetLabel = screen.getByText("Next Reset");
    const bdi = nextResetLabel.parentElement?.querySelector("bdi.dashboard-summary-ribbon__value");
    expect(bdi?.tagName.toLowerCase()).toBe("bdi");
    expect(bdi?.textContent).toContain("Codex");
  });
});
