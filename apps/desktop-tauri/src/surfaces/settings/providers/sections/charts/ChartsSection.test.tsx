import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ChartsSection } from "./ChartsSection";
import { LocaleProvider } from "../../../../../i18n/LocaleProvider";
import { buildBundle } from "../../../../../test/localeHarness";
import { getProviderChartData } from "../../../../../lib/tauri";
import type { ProviderChartData } from "../../../../../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getProviderChartData: vi.fn(),
  getSettingsSnapshot: vi.fn().mockResolvedValue({ enableAnimations: false }),
  getLocaleStrings: vi.fn(),
  setUiLanguage: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  listen: vi.fn(),
}));

vi.mock("../../../../../lib/tauri", () => tauriMocks);
vi.mock("../../../../../lib/providerCharts", () => ({
  providerSupportsChartData: () => true,
}));
vi.mock("@tauri-apps/api/event", () => eventMocks);

const mockChart = vi.mocked(getProviderChartData);

function chartData(overrides: Partial<ProviderChartData>): ProviderChartData {
  return {
    providerId: "codex",
    costHistory: [{ date: "2026-08-16", value: 1.5 }],
    creditsHistory: [],
    usageBreakdown: [],
    localUsage: null,
    tokensHistory: [{ date: "2026-08-16", tokens: 9000 }],
    tokensIncomplete: false,
    ...overrides,
  };
}

describe("ChartsSection tokens mode (upstream 0.50.0 #2930)", () => {
  beforeEach(() => {
    tauriMocks.getLocaleStrings.mockResolvedValue(buildBundle());
    eventMocks.listen.mockResolvedValue(() => {});
  });

  it("defaults Codex to the Tokens tab when exact token data exists", async () => {
    mockChart.mockResolvedValue(chartData({}));
    render(
      <LocaleProvider>
        <ChartsSection
          providerId="codex"
          accountEmail={null}
          t={(key) => key}
        />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("tab", { selected: true }).textContent).toBe(
        "DetailChartTokens",
      );
    });
  });

  it("keeps Cost as the default for non-Codex providers", async () => {
    mockChart.mockResolvedValue(chartData({ providerId: "claude" }));
    render(
      <LocaleProvider>
        <ChartsSection
          providerId="claude"
          accountEmail={null}
          t={(key) => key}
        />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("tab", { selected: true }).textContent).toBe(
        "DetailChartCost",
      );
    });
  });

  it("shows the Refreshing marker while local history backfill is incomplete", async () => {
    mockChart.mockResolvedValue(chartData({ tokensIncomplete: true }));
    render(
      <LocaleProvider>
        <ChartsSection
          providerId="codex"
          accountEmail={null}
          t={(key) => key}
        />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("DetailChartRefreshing")).toBeTruthy();
    });
  });

  it("hides the Tokens tab when no day carries token data", async () => {
    mockChart.mockResolvedValue(
      chartData({ tokensHistory: [{ date: "2026-08-16", tokens: 0 }] }),
    );
    render(
      <LocaleProvider>
        <ChartsSection
          providerId="codex"
          accountEmail={null}
          t={(key) => key}
        />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("tab", { selected: true }).textContent).toBe(
        "DetailChartCost",
      );
    });
    expect(screen.queryByText("DetailChartTokens")).toBeNull();
  });
});
