import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsSnapshot } from "../../../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getCodexWorkspacesSnapshot: vi.fn(),
  getProviderChartData: vi.fn(),
  getAnalyticsSourceRegistry: vi.fn().mockResolvedValue([
    { id: "codexLocalActivity", label: "Codex local activity", scope: "device", capabilities: { quota: false, resets: false, monetary: false, tokens: true, models: true, sessionCount: true, dailyActivity: true }, availability: "available", reads: "", doesNotRead: "" },
    { id: "claudeLocalActivity", label: "Claude local activity", scope: "device", capabilities: { quota: false, resets: false, monetary: false, tokens: true, models: true, sessionCount: false, dailyActivity: true }, availability: "available", reads: "", doesNotRead: "" },
  ]),
}));
vi.mock("../../../lib/tauri", () => tauriMocks);

const locale = vi.hoisted(() => ({
  t: (key: string) =>
    ({
      V3Activity: "Activity",
      V3ActivityHelp: "Local activity help",
      V3ActivityDemo: "Demo activity",
      V3LocalTokens: "Local tokens",
      V3LocalSessions: "Local sessions",
      V3Daily: "Daily",
      V3Weekly: "Weekly",
      V3Cumulative: "Cumulative",
      PanelTopModelPrefix: "Top model",
      DashboardHistoryChipDays: "Last {} days",
      DashboardValueUnavailable: "Unavailable",
      V2DataQuality: "Data quality",
      V3ActivityAll: "All compatible",
      V3ActivitySourceLabel: "Activity source",
      V3ActivityHeatmapHeading: "Activity heatmap",
      V3ActivityMissingNote: "Missing note",
      V3ActivityViewAsTable: "View as a table",
      V3ActivityTableDate: "Date",
      V3ActivityTableTokens: "Tokens",
      TokenScopeLocalDevice: "Local device activity",
    })[key] ?? key,
}));
vi.mock("../../../hooks/useLocale", () => ({ useLocale: () => locale }));
vi.mock("./useDashboardStructureTheme", () => ({
  useDashboardStructureTheme: () => ({ theme: { core: "#000", coreEdge: "#111", hairline: "#222", accent: "#0ff", material: {} } }),
}));
vi.mock("../../../components/analytics/charts/EChartsSurface", () => ({ default: () => <div data-testid="chart" /> }));

import LocalActivity from "./LocalActivity";

const settings = {} as SettingsSnapshot;

describe("LocalActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Codex's own richer workspace snapshot (session count, data-quality disclosure)", async () => {
    tauriMocks.getCodexWorkspacesSnapshot.mockResolvedValue({
      daily: [{ day: "2026-09-07", totalTokens: 100 }],
      total: { totalTokens: 100 },
      sessions: [{ id: "a" }, { id: "b" }],
      sourceStatus: "ok",
      indexedFileCount: 5,
      skippedFileCount: 1,
    });
    render(<LocalActivity settings={settings} isDemo={false} providerId="codex" />);
    // "100" now legitimately appears twice: the ribbon total and the new
    // accessible "view as a table" heatmap-data row for the same one day.
    await waitFor(() => expect(screen.getAllByText("100").length).toBeGreaterThan(0));
    expect(screen.getByText("2")).toBeInTheDocument(); // session count
    expect(screen.getByText(/ok · 5 indexed · 1 skipped/)).toBeInTheDocument();
  });

  it("renders real Claude local activity from the generic provider chart data -- a real capability the backend already supports, previously unused by this view", async () => {
    tauriMocks.getProviderChartData.mockResolvedValue({
      tokensHistory: [
        { date: "2026-09-07", tokens: 40 },
        { date: "2026-09-08", tokens: 60 },
      ],
      localUsage: { thirtyDayTokens: 100, latestTokens: 60, topModel: "claude-sonnet-4-6", todayCost: null, thirtyDayCost: null, estimateNote: "", tokenCostUpdatedAtMs: 0 },
    });
    render(<LocalActivity settings={settings} isDemo={false} providerId="claude" />);
    await waitFor(() => expect(screen.getByText("100")).toBeInTheDocument());
    expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument();
    expect(tauriMocks.getCodexWorkspacesSnapshot).not.toHaveBeenCalled();
    // Claude has no local session list or indexed/skipped file counts --
    // never fabricate parity with Codex's data-quality disclosure.
    expect(screen.queryByText("Data quality")).not.toBeInTheDocument();
  });

  it("never fetches or fabricates activity for a provider with no real local source", async () => {
    render(<LocalActivity settings={settings} isDemo={false} providerId="gemini" />);
    await waitFor(() => expect(screen.getByText("Unavailable")).toBeInTheDocument());
    expect(tauriMocks.getCodexWorkspacesSnapshot).not.toHaveBeenCalled();
    expect(tauriMocks.getProviderChartData).not.toHaveBeenCalled();
  });

  /**
   * Semantic regression test (owner: "sessions_count is a per-file proxy
   * for BOTH providers, not a real session semantic" --
   * docs/validation/LOCAL_ACTIVITY_FIELD_MATRIX.md). Claude's chart-data
   * bridge has no genuine session identity to count -- `normalizeClaude`
   * must always resolve `sessionCount: null` so the "Local sessions" metric
   * never renders for Claude, even if a future backend change starts
   * returning a `localUsage.sessionCount`-shaped field. This test fails
   * loudly if Claude ever regains a "Sessions" number from a source that
   * cannot honestly back it.
   */
  it("never shows a Sessions metric for Claude, even if the chart-data payload grows a session-shaped field", async () => {
    tauriMocks.getProviderChartData.mockResolvedValue({
      tokensHistory: [{ date: "2026-09-07", tokens: 40 }],
      localUsage: {
        thirtyDayTokens: 100,
        latestTokens: 40,
        topModel: "claude-sonnet-4-6",
        todayCost: null,
        thirtyDayCost: null,
        estimateNote: "",
        tokenCostUpdatedAtMs: 0,
        // Not a real bridge field -- simulates a naive future change that
        // starts threading cost_scanner.rs's file-count `sessions_count`
        // through this same payload. LocalActivity must ignore it.
        sessionCount: 7,
      },
    });
    render(<LocalActivity settings={settings} isDemo={false} providerId="claude" />);
    await waitFor(() => expect(screen.getByText("100")).toBeInTheDocument());
    expect(screen.queryByText("Local sessions")).not.toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
  });

  it("shows the explicit demo label instead of fetching in demo mode", async () => {
    render(<LocalActivity settings={settings} isDemo={true} providerId="claude" />);
    expect(screen.getByText("Demo activity")).toBeInTheDocument();
    expect(tauriMocks.getProviderChartData).not.toHaveBeenCalled();
    // useAnalyticsSources() still fetches the registry in the background
    // (it has no isDemo concept of its own) -- await its resolution so the
    // test doesn't unmount before that state update lands.
    await waitFor(() => expect(tauriMocks.getAnalyticsSourceRegistry).toHaveBeenCalled());
  });
});
