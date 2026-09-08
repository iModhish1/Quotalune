import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  getLocaleStrings: vi.fn(),
  setUiLanguage: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

import ProviderDistribution from "./ProviderDistribution";
import { LocaleProvider } from "../../../i18n/LocaleProvider";
import type { DashboardProviderSummary } from "../../../types/bridge";

function summary(overrides: Partial<DashboardProviderSummary> = {}): DashboardProviderSummary {
  return {
    provider: "claude",
    accountId: "acct-1",
    usedPercent: 40,
    remainingPercent: 60,
    resetsAt: null,
    lastSampleAt: 1000,
    ...overrides,
  };
}

function renderPanel(providers: DashboardProviderSummary[]) {
  tauriMocks.getLocaleStrings.mockResolvedValue({
    language: "english",
    entries: {
      DashboardDistributionTitle: "Historical Usage Share",
      DashboardDistributionEmpty: "Not enough usage yet to show a distribution",
      DashboardDistributionCaption: "Share of usage in the selected range",
      DashboardDistributionSoloAll: "{} accounts for all usage in this range",
    },
  });
  return render(
    <LocaleProvider>
      <ProviderDistribution providers={providers} />
    </LocaleProvider>,
  );
}

describe("ProviderDistribution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the honest empty state when no provider has real usage", async () => {
    renderPanel([]);
    expect(
      await screen.findByText("Not enough usage yet to show a distribution"),
    ).toBeInTheDocument();
  });

  it("never fabricates a distribution for providers with zero usage", async () => {
    renderPanel([summary({ usedPercent: 0 }), summary({ provider: "codex", usedPercent: 0 })]);
    expect(
      await screen.findByText("Not enough usage yet to show a distribution"),
    ).toBeInTheDocument();
  });

  it("renders a compact one-line statement for a single real provider instead of a redundant 100%-filled bar", async () => {
    renderPanel([summary({ provider: "codex", usedPercent: 42 })]);
    expect(
      await screen.findByText("accounts for all usage in this range", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText("codex")).toBeInTheDocument();
    // The full bar-list markup (only meaningful for comparing multiple
    // providers) must not render for a lone provider.
    expect(document.querySelector(".dashboard-analytics__distribution-bar-track")).toBeNull();
  });

  it("ranks real providers by usage share", async () => {
    renderPanel([
      summary({ provider: "claude", usedPercent: 30 }),
      summary({ provider: "codex", accountId: "acct-2", usedPercent: 70 }),
    ]);
    const rows = await screen.findAllByText(/claude|codex/);
    expect(rows[0]).toHaveTextContent("codex");
    expect(rows[1]).toHaveTextContent("claude");
  });
});
