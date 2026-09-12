import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsSourceDescriptor, DashboardSnapshot } from "../../../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getAnalyticsSourceRegistry: vi.fn(),
  getCodexWorkspacesSnapshot: vi.fn(),
  getProviderChartData: vi.fn(),
}));
vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string) =>
      ({
        V3AnalyticsOverviewTitle: "Data universe",
        V3AnalyticsOverviewHelp: "help",
        OverviewAvailableSources: "Available sources",
        OverviewHistorySpan: "History span",
        OverviewLocalActivitySources: "Local activity sources",
        OverviewTokenActivity: "Token activity (30d)",
        OverviewModelsObserved: "Models observed",
        OverviewUpcomingResets: "Upcoming resets",
        OverviewFreshness: "Freshness",
        V3ActivityDemo: "Demo mode",
        OverviewDaysOfHistorySuffix: "days of history",
        DashboardHistoryChipCollecting: "Collecting history",
        NeverUpdated: "Never",
        UpdatedJustNow: "Updated just now",
      })[key] ?? key,
  }),
}));

import AnalyticsOverview from "./AnalyticsOverview";
import type { SettingsSnapshot } from "../../../types/bridge";

function source(overrides: Partial<AnalyticsSourceDescriptor> = {}): AnalyticsSourceDescriptor {
  return {
    id: "codexLocalActivity",
    label: "Codex local activity",
    scope: "device",
    capabilities: { quota: true, resets: true, monetary: false, tokens: true, models: true, sessionCount: true, dailyActivity: true },
    availability: "available",
    reads: [],
    doesNotRead: [],
    ...overrides,
  };
}

const settings = {} as SettingsSnapshot;

function snapshot(overrides: Partial<DashboardSnapshot["availability"]> = {}): DashboardSnapshot {
  return {
    generatedAt: 0,
    rangeSince: 0,
    rangeUntil: 0,
    grain: "daily",
    timezone: "UTC",
    providers: [],
    usageTrend: [],
    spendTrend: [],
    availability: {
      firstSampleAt: 1_000,
      lastSampleAt: 1_000 + 30 * 86400,
      sampleCount: 30,
      hasCostData: false,
      hasTokenData: true,
      hasRequestData: false,
      hasModelData: false,
      ...overrides,
    },
  } as unknown as DashboardSnapshot;
}

describe("AnalyticsOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summarizes the real data universe -- sources, history span, tokens, models, resets, freshness", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([
      source(),
      source({ id: "claudeLocalActivity", label: "Claude local activity", capabilities: { quota: false, resets: false, monetary: false, tokens: true, models: true, sessionCount: false, dailyActivity: true } }),
      source({ id: "providerReportedMonetary", label: "Provider-reported monetary data", availability: "unsupported", capabilities: { quota: false, resets: false, monetary: true, tokens: false, models: false, sessionCount: false, dailyActivity: false } }),
    ]);
    tauriMocks.getCodexWorkspacesSnapshot.mockResolvedValue({
      total: { totalTokens: 1_500_000 },
      modelTotals: [{ model: "gpt-5", totalTokens: 1_200_000, lastObserved: null }, { model: "gpt-5-mini", totalTokens: 300_000, lastObserved: null }],
    });
    tauriMocks.getProviderChartData.mockResolvedValue({
      localUsage: { thirtyDayTokens: 500_000 },
    });

    render(<AnalyticsOverview settings={settings} snapshot={snapshot()} resetCount={3} isDemo={false} />);

    // 2 of 3 registered sources are available.
    await waitFor(() => expect(screen.getByText("2/3")).toBeInTheDocument());
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("days of history")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("2M")).toBeInTheDocument()); // 1.5M + 0.5M = 2M total tokens
    // Codex + Claude both available and token/dailyActivity-capable (2
    // local activity sources); Codex reports 2 real models; 3 resets
    // passed through -- all distinguishable, no ambiguous duplicate text.
    expect(screen.getByText("3")).toBeInTheDocument(); // resets
  });

  it("never shows a Session KPI, a global quota percentage, or an estimated cost", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([source()]);
    tauriMocks.getCodexWorkspacesSnapshot.mockResolvedValue({
      total: { totalTokens: 100 },
      modelTotals: [],
    });
    render(<AnalyticsOverview settings={settings} snapshot={snapshot()} resetCount={0} isDemo={false} />);
    await waitFor(() => expect(screen.getByText("1/1")).toBeInTheDocument());
    expect(screen.queryByText(/session/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cost/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("skips real IPC calls and shows the demo notice in Demo Mode", async () => {
    render(<AnalyticsOverview settings={settings} snapshot={null} resetCount={0} isDemo={true} />);
    expect(await screen.findByText("Demo mode")).toBeInTheDocument();
    expect(tauriMocks.getCodexWorkspacesSnapshot).not.toHaveBeenCalled();
    expect(tauriMocks.getProviderChartData).not.toHaveBeenCalled();
  });
});
