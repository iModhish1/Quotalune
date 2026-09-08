import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  getLocaleStrings: vi.fn(),
  setUiLanguage: vi.fn(),
  getDashboardSnapshot: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

import DashboardAnalyticsPanel from "./DashboardAnalyticsPanel";
import { LocaleProvider } from "../../../i18n/LocaleProvider";
import type { DashboardSnapshot, ProviderUsageSnapshot, SettingsSnapshot } from "../../../types/bridge";

const LOCALE_ENTRIES = {
  TabDashboard: "Dashboard",
  DashboardSubtitle: "What you're using, what's left, and what changed",
  DashboardRangeToday: "Today",
  DashboardRangeLast7Days: "7 Days",
  DashboardRangeLast30Days: "30 Days",
  DashboardRangeThisMonth: "This Month",
  DashboardRangeLast3Months: "3 Months",
  DashboardRangeThisYear: "Year",
  DashboardProviderFilterAll: "All Providers",
  DashboardKpiActiveProviders: "Active Providers",
  DashboardKpiHighestUsage: "Highest Usage",
  DashboardKpiNextReset: "Next Reset",
  DashboardKpiEstimatedSpend: "Estimated Spend",
  DashboardKpiAlerts: "Alerts",
  DashboardValueUnavailable: "Not available",
  DashboardDataStatusCostUnavailable: "Cost data unavailable",
  DashboardUsageTrendTitle: "Usage Trend",
  DashboardMetricUsage: "Usage %",
  DashboardMetricSpend: "Estimated Cost",
  DashboardTrendEmptyForRange: "No data in this range yet",
  DashboardCollectingHistory: "Collecting local usage history…",
  DashboardDistributionTitle: "Provider Distribution",
  DashboardDistributionEmpty: "Not enough usage yet to show a distribution",
  DashboardAlertsTitle: "Alerts",
  DashboardAlertsEmpty: "No alerts — everything looks fine",
  DashboardAlertAuthRequired: "{} needs sign-in",
  DashboardReconnect: "Reconnect",
  DashboardDataStatusTitle: "Data Status",
  DashboardDataStatusHistoryActive: "Local history: active",
  DashboardDataStatusHistoryCollecting: "Local history: collecting",
  DashboardDataStatusCostEstimated: "Cost: estimated (provider-reported)",
  DashboardDataStatusPricingNotVerified: "Pricing: not yet verified",
  DashboardDataAvailableSince: "Data available since {}",
  DashboardDataSamples: "{} samples",
};

function rateWindow(usedPercent = 20) {
  return {
    usedPercent,
    remainingPercent: 100 - usedPercent,
    windowMinutes: null,
    resetsAt: null,
    resetDescription: null,
    isExhausted: false,
    reservePercent: null,
    reserveDescription: null,
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
    updatedAt: "2026-09-08T00:00:00Z",
    error: null,
    errorState: "ready",
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
    fetchDurationMs: null,
    ...overrides,
  };
}

function snapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    generatedAt: 0,
    rangeSince: 0,
    rangeUntil: 0,
    grain: "daily",
    timezone: "UTC",
    availability: {
      firstSampleAt: null,
      lastSampleAt: null,
      sampleCount: 0,
      hasCostData: false,
      hasTokenData: false,
      hasRequestData: false,
      hasModelData: false,
    },
    providers: [],
    usageTrend: [],
    spendTrend: [],
    ...overrides,
  };
}

const SETTINGS = {
  highUsageThreshold: 70,
  criticalUsageThreshold: 90,
  resetTimeRelative: true,
} as unknown as SettingsSnapshot;

function renderPanel(
  liveProviders: ProviderUsageSnapshot[],
  snap: DashboardSnapshot,
  onOpenProviders = vi.fn(),
) {
  tauriMocks.getLocaleStrings.mockResolvedValue({ language: "english", entries: LOCALE_ENTRIES });
  tauriMocks.getDashboardSnapshot.mockResolvedValue(snap);
  return render(
    <LocaleProvider>
      <DashboardAnalyticsPanel
        liveProviders={liveProviders}
        settings={SETTINGS}
        onOpenProviders={onOpenProviders}
      />
    </LocaleProvider>,
  );
}

describe("DashboardAnalyticsPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("wires the header, KPIs, trend, distribution, alerts, and data status together from one snapshot call", async () => {
    renderPanel([provider()], snapshot());
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    // "Data Status" only renders once the async snapshot resolves (DataStatusPanel
    // returns null while snapshot is still null) -- wait on it before asserting
    // on the rest so this isn't racing the header's synchronous render.
    expect(await screen.findByText("Data Status")).toBeInTheDocument();
    expect(screen.getByText("Active Providers")).toBeInTheDocument();
    expect(screen.getByText("Usage Trend")).toBeInTheDocument();
    expect(screen.getByText("Provider Distribution")).toBeInTheDocument();
    // Exactly one fetch for the default range -- no widget re-fetches independently.
    expect(tauriMocks.getDashboardSnapshot).toHaveBeenCalledTimes(1);
  });

  it("changing the range triggers exactly one new snapshot fetch with the new range", async () => {
    renderPanel([provider()], snapshot());
    await screen.findByText("Dashboard");
    fireEvent.click(screen.getByRole("radio", { name: "30 Days" }));
    await vi.waitFor(() =>
      expect(tauriMocks.getDashboardSnapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({ range: "last30Days" }),
      ),
    );
  });

  it("an auth-required provider surfaces a friendly alert with a working Reconnect action", async () => {
    const onOpenProviders = vi.fn();
    renderPanel(
      [provider({ errorState: "needsAuthentication" })],
      snapshot(),
      onOpenProviders,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Reconnect" }));
    expect(onOpenProviders).toHaveBeenCalledTimes(1);
  });

  it("shows honest unavailable/collecting states with zero real history, never fabricated numbers", async () => {
    renderPanel([], snapshot());
    expect(await screen.findByText("Local history: collecting")).toBeInTheDocument();
    expect(screen.getByText("Collecting local usage history…")).toBeInTheDocument();
  });
});
