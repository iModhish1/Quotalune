import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsSourceDescriptor } from "../../../types/bridge";

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
        V3Tokens: "Tokens",
        V3TokensHelp: "help",
        TokenCardTotal: "Total Tokens",
        TokenCardInput: "Input",
        TokenCardOutput: "Output",
        TokenCardCached: "Cached",
        TokenNoBreakdownNote: "Only a daily total is available for this source.",
        TokenCompareHeading: "Shared across providers",
        TokenCardObservedDays: "Observed Days",
        TokenCardModels: "Models",
        TokenScopeLocalDevice: "Local device activity",
        TokenTrendHeading: "Token trend",
        PanelTopModelPrefix: "Top model",
        V3Daily: "Daily",
        V3Weekly: "Weekly",
        V3ActivityDemo: "Demo mode",
        DashboardValueUnavailable: "Unavailable",
      })[key] ?? key,
  }),
}));

import TokenAnalytics from "./TokenAnalytics";
import type { SettingsSnapshot } from "../../../types/bridge";

function source(overrides: Partial<AnalyticsSourceDescriptor> = {}): AnalyticsSourceDescriptor {
  return {
    id: "codexLocalActivity",
    label: "Codex local activity",
    scope: "device",
    capabilities: { quota: false, resets: false, monetary: false, tokens: true, models: true, sessionCount: true, dailyActivity: true },
    availability: "available",
    reads: [],
    doesNotRead: [],
    ...overrides,
  };
}

const settings = {} as SettingsSnapshot;

describe("TokenAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Codex's real input/cached/output breakdown", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([source()]);
    tauriMocks.getCodexWorkspacesSnapshot.mockResolvedValue({
      total: { inputTokens: 100, cachedInputTokens: 20, outputTokens: 50, totalTokens: 150 },
      modelTotals: [{ model: "gpt-5", totalTokens: 150, lastObserved: null }],
    });
    tauriMocks.getProviderChartData.mockResolvedValue({
      localUsage: { topModel: "gpt-5" },
      tokensHistory: [],
    });
    render(<TokenAnalytics settings={settings} providerId="codex" isDemo={false} />);
    await waitFor(() => expect(screen.getByText("150")).toBeInTheDocument());
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.queryByText(/no breakdown/i)).not.toBeInTheDocument();
  });

  it("shows only a total for Claude -- no fabricated input/output/cache cards", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([
      source({ id: "claudeLocalActivity", label: "Claude local activity" }),
    ]);
    tauriMocks.getProviderChartData.mockResolvedValue({
      localUsage: { thirtyDayTokens: 4200 },
      tokensHistory: [],
    });
    render(<TokenAnalytics settings={settings} providerId="claude" isDemo={false} />);
    await waitFor(() => expect(screen.getByText("4.2k")).toBeInTheDocument());
    expect(screen.queryByText("Input")).not.toBeInTheDocument();
    expect(screen.queryByText("Cached")).not.toBeInTheDocument();
    expect(screen.getByText("Only a daily total is available for this source.")).toBeInTheDocument();
  });

  it("shows the shared-field comparison (Total only) when no provider is selected", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([
      source(),
      source({ id: "claudeLocalActivity", label: "Claude local activity" }),
    ]);
    tauriMocks.getCodexWorkspacesSnapshot.mockResolvedValue({
      total: { inputTokens: 100, cachedInputTokens: 20, outputTokens: 50, totalTokens: 150 },
      modelTotals: [{ model: "gpt-5", totalTokens: 150, lastObserved: null }],
    });
    tauriMocks.getProviderChartData.mockResolvedValue({
      localUsage: { thirtyDayTokens: 4200, topModel: "claude-opus" },
      tokensHistory: [],
    });
    render(<TokenAnalytics settings={settings} providerId={null} isDemo={false} />);
    await waitFor(() => expect(screen.getByText("Shared across providers")).toBeInTheDocument());
    expect(screen.getAllByText("Codex").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Claude").length).toBeGreaterThan(0);
  });

  /**
   * Regression test for a real defect found via native inspection against
   * a machine with tens of billions of accumulated local Codex tokens
   * (docs/validation/ANALYTICS_PHASE3B_VISUAL_REVIEW.md): the card showed
   * a raw 11-digit integer ("63,747,046,211") rather than a compact,
   * readable figure. The exact value must still be recoverable (title
   * attribute), just not as the primary display text.
   */
  it("shows a large real value compactly, not as a raw giant integer", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([source()]);
    tauriMocks.getCodexWorkspacesSnapshot.mockResolvedValue({
      total: { inputTokens: 63_747_046_211, cachedInputTokens: 59_510_984_827, outputTokens: 118_632_705, totalTokens: 63_865_678_916 },
      modelTotals: [],
    });
    tauriMocks.getProviderChartData.mockResolvedValue({ localUsage: null, tokensHistory: [] });
    render(<TokenAnalytics settings={settings} providerId="codex" isDemo={false} />);
    await waitFor(() => expect(screen.getByText("63.9B")).toBeInTheDocument());
    expect(screen.queryByText("63,865,678,916")).not.toBeInTheDocument();
    expect(screen.getByText("63.9B")).toHaveAttribute("title", "63,865,678,916");
  });

  it("skips real IPC calls and shows the demo notice in Demo Mode", async () => {
    render(<TokenAnalytics settings={settings} providerId={null} isDemo={true} />);
    expect(await screen.findByText("Demo mode")).toBeInTheDocument();
    expect(tauriMocks.getCodexWorkspacesSnapshot).not.toHaveBeenCalled();
    expect(tauriMocks.getProviderChartData).not.toHaveBeenCalled();
  });
});
