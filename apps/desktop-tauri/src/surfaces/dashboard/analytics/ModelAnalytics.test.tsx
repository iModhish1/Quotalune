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
        V3Models: "Models",
        V3ModelsHelp: "help",
        ModelColumnModel: "Model",
        ModelColumnTokens: "Tokens",
        ModelColumnShare: "Share",
        ModelColumnLastObserved: "Last observed",
        ModelNoBreakdownNote: "Only a single most-used model is available for this source.",
        PanelTopModelPrefix: "Top model",
        V3ActivityDemo: "Demo mode",
        DashboardValueUnavailable: "Unavailable",
        NeverUpdated: "Never",
      })[key] ?? key,
  }),
}));

import ModelAnalytics from "./ModelAnalytics";
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

describe("ModelAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Codex's real ranked model breakdown with computed share and last-observed", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([source()]);
    tauriMocks.getCodexWorkspacesSnapshot.mockResolvedValue({
      modelTotals: [
        { model: "gpt-5", totalTokens: 3600, lastObserved: "2026-09-11T00:00:00Z" },
        { model: "gpt-5-mini", totalTokens: 150, lastObserved: "2026-09-10T00:00:00Z" },
      ],
    });
    render(<ModelAnalytics settings={settings} providerId="codex" isDemo={false} />);
    // "gpt-5" appears twice by design: once in the new ranked bar list,
    // once in the still-present detailed table below it.
    await waitFor(() => expect(screen.getAllByText("gpt-5").length).toBeGreaterThan(0));
    expect(screen.getAllByText("gpt-5-mini").length).toBeGreaterThan(0);
    expect(screen.getByText("3.6k")).toBeInTheDocument();
    // 3600 / 3750 = 96.0%
    expect(screen.getByText("96.0%")).toBeInTheDocument();
    expect(screen.getByText("4.0%")).toBeInTheDocument();
  });

  it("never fabricates a ranked breakdown for Claude -- shows only the single top model with an explicit note", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([
      source({ id: "claudeLocalActivity", label: "Claude local activity" }),
    ]);
    tauriMocks.getProviderChartData.mockResolvedValue({
      localUsage: { topModel: "claude-sonnet-4-6" },
    });
    render(<ModelAnalytics settings={settings} providerId="claude" isDemo={false} />);
    await waitFor(() => expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument());
    expect(screen.queryByText("Share")).not.toBeInTheDocument();
    expect(screen.getByText("Only a single most-used model is available for this source.")).toBeInTheDocument();
  });

  it("skips real IPC calls and shows the demo notice in Demo Mode", async () => {
    render(<ModelAnalytics settings={settings} providerId={null} isDemo={true} />);
    expect(await screen.findByText("Demo mode")).toBeInTheDocument();
    expect(tauriMocks.getCodexWorkspacesSnapshot).not.toHaveBeenCalled();
    expect(tauriMocks.getProviderChartData).not.toHaveBeenCalled();
  });
});
