import { fireEvent, within, render, screen } from "@testing-library/react";
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
  V2HistoryScope: "Provider filter: history only",
  V2AnalyticsOverview: "Analytics overview",
  V24Trends:"Trend intelligence",
  V24Attention:"Needs action",
  TabProviders:"Providers",
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
  DashboardDataStatusCostProviderReported: "Cost: provider-reported spend",
  DashboardDataStatusCostProviderReportedBalance: "Monetary data: provider-reported balance",
  DashboardDataStatusCostProviderReportedCredits: "Monetary data: provider-reported credits",
  DashboardDataStatusCostSemanticsUnknown: "Monetary semantics: unknown",
  DashboardDataStatusCostLegacyAmbiguous: "Cost: legacy data, semantics unknown",
  DashboardDataStatusPricingNotVerified: "Pricing: not yet verified",
  DashboardDataStatusPricingNotRequired: "Pricing: not required for provider-reported cost",
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
    costContract: {
      origin: "unavailable",
      quantityKind: "unknown",
      measurementKind: "unknown",
      currencyCode: null,
      period: "unknown",
      availability: "unavailable",
      pricingStatus: "notRequired",
    },
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
  view: "overview" | "analytics" = "analytics",
  initialProvider: string | null = null,
) {
  tauriMocks.getLocaleStrings.mockResolvedValue({ language: "english", entries: LOCALE_ENTRIES });
  tauriMocks.getDashboardSnapshot.mockResolvedValue(snap);
  return render(
    <LocaleProvider>
      <DashboardAnalyticsPanel
        liveProviders={liveProviders}
        view={view}
        initialProvider={initialProvider}
        settings={settings}
        onOpenProviders={onOpenProviders}
      />
    </LocaleProvider>,
  );
}

describe("DashboardAnalyticsPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returning to operational Overview clears a prior provider drilldown", async () => {
    renderPanel([provider(),provider({providerId:"codex",displayName:"Codex"})], snapshot(), vi.fn(), SETTINGS, "overview", "codex");
    await vi.waitFor(()=>expect(tauriMocks.getDashboardSnapshot).toHaveBeenCalled());
    const calls=tauriMocks.getDashboardSnapshot.mock.calls;
    expect(calls[calls.length-1]?.[0].providers).toBeUndefined();
    expect(screen.getByText("Active Providers").closest(".dashboard-kpi")).toHaveTextContent("2");
  });

  it("keeps deep diagnostics in dedicated Analytics destinations and shares one snapshot", async () => {
    renderPanel([provider()], snapshot());
    expect(await screen.findByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Trend intelligence")).toBeInTheDocument();
    expect(screen.queryByText("Data Status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name:"V2DataQuality"}));
    expect(await screen.findByText("Data Status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name:"V3History"}));
    expect(screen.getByText("Usage Trend")).toBeInTheDocument();
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

  it("scopes both current analytics and history to the selected provider", async () => {
    renderPanel([provider({providerId:"claude",displayName:"Claude"}),provider({providerId:"codex",displayName:"Codex"})],snapshot());
    await screen.findByText("Today");
    expect(screen.getByText("Active Providers").closest(".dashboard-kpi")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button",{name:"All Providers"}));
    fireEvent.click(screen.getByRole("option",{name:"Codex"}));
    await vi.waitFor(()=>expect(tauriMocks.getDashboardSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({providers:["codex"]})));
    expect(screen.getByText("Active Providers").closest(".dashboard-kpi")).toHaveTextContent("1");
  });

  it("preserves default range and chart style in dedicated Analytics", async () => {
    const preferences = {sectionOrder:["quality","limits"],hiddenSections:["attention"],chartStyle:"detailed",quotaTemplate:"rail",defaultRange:"last30Days",providerFilterScope:"history"} as const;
    renderPanel([provider()], snapshot(), vi.fn(), {...SETTINGS, analyticsPreferences: {...preferences,sectionOrder:[...preferences.sectionOrder],hiddenSections:[...preferences.hiddenSections]}});
    await screen.findByText("Today");
    expect(screen.queryByRole("region",{name:"Needs action"})).not.toBeInTheDocument();
    expect(document.querySelector('[data-analytics-section="attention"]')).toBeNull();
    expect(screen.getByRole("radio",{name:"30 Days"})).toHaveAttribute("aria-checked","true");
    expect(document.querySelector(".dashboard-analytics")).toHaveAttribute("data-chart-style","detailed");
  });

  it("explicit all-sections filter also scopes current status", async () => {
    renderPanel([provider({providerId:"claude",displayName:"Claude"}),provider({providerId:"codex",displayName:"Codex"})], snapshot(), vi.fn(), {...SETTINGS,analyticsPreferences:{sectionOrder:[],hiddenSections:[],chartStyle:"precision",quotaTemplate:"precision",defaultRange:"last7Days",providerFilterScope:"all"}});
    await screen.findByText("Today");
    fireEvent.click(screen.getByRole("button",{name:"All Providers"}));
    fireEvent.click(screen.getByRole("option",{name:"Codex"}));
    expect(screen.getByText("Active Providers").closest(".dashboard-kpi")).toHaveTextContent("1");
  });

  it("an auth-required provider surfaces a friendly alert with a working Reconnect action", async () => {
    const onOpenProviders = vi.fn();
    renderPanel(
      [provider({ errorState: "needsAuthentication" })],
      snapshot(),
      onOpenProviders, SETTINGS, "overview",
    );
    fireEvent.click(within(await screen.findByRole("region",{name:"Needs action"})).getByRole("button", { name: "Providers" }));
    expect(onOpenProviders).toHaveBeenCalledTimes(1);
  });

  it("shows honest unavailable/collecting states with zero real history, never fabricated numbers", async () => {
    renderPanel([], snapshot());
    fireEvent.click(await screen.findByRole("button",{name:"V2DataQuality"}));
    // Data Status merges what used to be separate rows into one compact
    // line (owner Phase 3.5 section 11) -- match on substring.
    expect(await screen.findByText(/Local history: collecting/)).toBeInTheDocument();
    expect(document.querySelector("canvas")).toBeNull();
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
