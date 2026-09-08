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
import { catalogBySlug } from "../../../design-system/themeCatalog";
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
  DashboardHistoryChipCollecting: "Collecting history",
  DashboardHistoryChipToday: "History from today",
  DashboardHistoryChipDays: "{} days of history",
  DashboardCurrentStatusEyebrow: "Current Status",
  DashboardSelectedRangeEyebrow: "Selected Range",
  DashboardKpiActiveProviders: "Active Providers",
  DashboardKpiHighestUsage: "Highest Usage",
  DashboardKpiNextReset: "Next Reset",
  DashboardKpiEstimatedSpend: "Reported Spend",
  DashboardKpiAlerts: "Alerts",
  DashboardValueUnavailable: "Not available",
  DashboardDataStatusCostUnavailable: "Cost data unavailable",
  DashboardUsageTrendTitle: "Usage Trend",
  DashboardMetricUsage: "Usage %",
  DashboardMetricSpend: "Reported Spend",
  DashboardTrendEmptyForRange: "No data in this range yet",
  DashboardCollectingHistory: "Collecting local usage history…",
  DashboardDistributionTitle: "Historical Usage Share",
  DashboardDistributionEmpty: "Not enough usage yet to show a distribution",
  DashboardDistributionCaption: "Share of usage in the selected range",
  DashboardDistributionSoloAll: "{} accounts for all usage in this range",
  DashboardAlertsTitle: "Alerts",
  DashboardAlertsEmpty: "No alerts — everything looks fine",
  DashboardAlertAuthRequired: "{} needs sign-in",
  DashboardReconnect: "Reconnect",
  DashboardResetScheduleTitle: "Reset Schedule",
  DashboardResetScheduleEmpty: "No upcoming resets to show yet",
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
  settings: SettingsSnapshot = SETTINGS,
) {
  tauriMocks.getLocaleStrings.mockResolvedValue({ language: "english", entries: LOCALE_ENTRIES });
  tauriMocks.getDashboardSnapshot.mockResolvedValue(snap);
  return render(
    <LocaleProvider>
      <DashboardAnalyticsPanel
        liveProviders={liveProviders}
        settings={settings}
        onOpenProviders={onOpenProviders}
      />
    </LocaleProvider>,
  );
}

describe("DashboardAnalyticsPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("wires the header, KPIs, trend, distribution, alerts, and data status together from one snapshot call", async () => {
    renderPanel([provider()], snapshot());
    // The native app chrome already shows "QUOTALIS / Dashboard" -- the
    // control strip no longer repeats a giant title (owner Phase 3.5
    // section 2), so "Today" (a range button, always synchronous) is the
    // render-complete anchor instead.
    expect(await screen.findByText("Today")).toBeInTheDocument();
    // "Data Status" only renders once the async snapshot resolves (DataStatusPanel
    // returns null while snapshot is still null) -- wait on it before asserting
    // on the rest so this isn't racing the header's synchronous render.
    expect(await screen.findByText("Data Status")).toBeInTheDocument();
    expect(screen.getByText("Current Status")).toBeInTheDocument();
    expect(screen.getByText("Selected Range")).toBeInTheDocument();
    expect(screen.getByText("Active Providers")).toBeInTheDocument();
    expect(screen.getByText("Usage Trend")).toBeInTheDocument();
    expect(screen.getByText("Historical Usage Share")).toBeInTheDocument();
    // Exactly one fetch for the default range -- no widget re-fetches independently.
    expect(tauriMocks.getDashboardSnapshot).toHaveBeenCalledTimes(1);
  });

  it("changing the range triggers exactly one new snapshot fetch with the new range", async () => {
    renderPanel([provider()], snapshot());
    await screen.findByText("Today");
    fireEvent.click(screen.getByRole("radio", { name: "30 Days" }));
    await vi.waitFor(() =>
      expect(tauriMocks.getDashboardSnapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({ range: "last30Days" }),
      ),
    );
  });

  it("the provider filter genuinely scopes the Selected Range fetch, while Current Status (KPIs/Alerts/Reset Schedule) stays live and unfiltered -- the explicit Phase 3.5 section 8 semantics", async () => {
    renderPanel(
      [provider({ providerId: "claude", displayName: "Claude" }), provider({ providerId: "codex", displayName: "Codex" })],
      snapshot(),
    );
    await screen.findByText("Today");
    // Two real providers -- "Active Providers" (a Current Status KPI) must
    // read 2 regardless of any Selected Range provider filter.
    expect(screen.getByText("Active Providers").closest(".dashboard-kpi")).toHaveTextContent("2");

    // Filtering Selected Range to just Codex must genuinely re-scope the
    // snapshot fetch (the historical/range-based widgets)...
    fireEvent.change(screen.getByLabelText("All Providers"), { target: { value: "codex" } });
    await vi.waitFor(() =>
      expect(tauriMocks.getDashboardSnapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({ providers: ["codex"] }),
      ),
    );
    // ...but must NOT silently narrow the unfiltered Current Status count --
    // it stays 2, because that section is explicitly live/global, not
    // scoped by the Selected Range control sitting above it.
    expect(screen.getByText("Active Providers").closest(".dashboard-kpi")).toHaveTextContent("2");
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
    // Data Status merges what used to be separate rows into one compact
    // line (owner Phase 3.5 section 11) -- match on substring.
    expect(await screen.findByText(/Local history: collecting/)).toBeInTheDocument();
    expect(screen.getByText("Collecting local usage history…")).toBeInTheDocument();
  });

  it("Phase 3.6: the rendered root actually carries the resolved Structure Theme's real colors as --qa-analytics-* inline custom properties, and a different theme setting produces genuinely different values", async () => {
    const smokedSilver = catalogBySlug("smoked-silver")!;
    const emberAlloy = catalogBySlug("ember-alloy")!;

    const first = renderPanel([provider()], snapshot(), vi.fn(), {
      ...SETTINGS,
      catalogTheme: smokedSilver.slug,
    } as SettingsSnapshot);
    await screen.findByText("Today");
    const rootA = document.querySelector(".dashboard-analytics") as HTMLElement;
    expect(rootA.style.getPropertyValue("--qa-analytics-accent")).toBe(smokedSilver.accent);
    expect(rootA.style.getPropertyValue("--qa-analytics-hairline")).toBe(smokedSilver.hairline);
    first.unmount();

    renderPanel([provider()], snapshot(), vi.fn(), {
      ...SETTINGS,
      catalogTheme: emberAlloy.slug,
    } as SettingsSnapshot);
    await screen.findByText("Today");
    const rootB = document.querySelector(".dashboard-analytics") as HTMLElement;
    expect(rootB.style.getPropertyValue("--qa-analytics-accent")).toBe(emberAlloy.accent);
    // The whole point of Phase 3.6: two different real Structure Themes
    // must genuinely differ, not render one hardcoded value regardless of
    // selection.
    expect(rootB.style.getPropertyValue("--qa-analytics-accent")).not.toBe(
      rootA.style.getPropertyValue("--qa-analytics-accent"),
    );
  });
});
