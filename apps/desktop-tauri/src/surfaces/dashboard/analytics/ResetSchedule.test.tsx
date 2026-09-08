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

import ResetSchedule from "./ResetSchedule";
import { LocaleProvider } from "../../../i18n/LocaleProvider";
import type { ProviderUsageSnapshot } from "../../../types/bridge";

function rateWindow(resetsAt: string | null) {
  return {
    usedPercent: 20,
    remainingPercent: 80,
    windowMinutes: null,
    resetsAt,
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
    primary: rateWindow(null),
    selectedMetric: rateWindow(null),
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

function renderPanel(providers: ProviderUsageSnapshot[], relative = true) {
  tauriMocks.getLocaleStrings.mockResolvedValue({
    language: "english",
    entries: {
      DashboardResetScheduleTitle: "Reset Schedule",
      DashboardResetScheduleEmpty: "No upcoming resets to show yet",
      ResetsInDaysHours: "Resets in { \"{}\" }d { \"{}\" }h",
      ResetsInHoursMinutes: "Resets in { \"{}\" }h { \"{}\" }m",
      ResetsInMinutes: "Resets in { \"{}\" }m",
    },
  });
  return render(
    <LocaleProvider>
      <ResetSchedule providers={providers} relative={relative} />
    </LocaleProvider>,
  );
}

describe("ResetSchedule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the honest empty state when no provider has a real future reset", async () => {
    renderPanel([provider({ primary: rateWindow(null), selectedMetric: rateWindow(null) })]);
    expect(await screen.findByText("No upcoming resets to show yet")).toBeInTheDocument();
  });

  it("never shows a provider whose reset has already passed", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    renderPanel([
      provider({ primary: rateWindow(past), selectedMetric: rateWindow(past) }),
    ]);
    expect(await screen.findByText("No upcoming resets to show yet")).toBeInTheDocument();
  });

  it("orders providers with real future resets soonest-first", async () => {
    const soon = new Date(Date.now() + 30 * 60_000).toISOString();
    const later = new Date(Date.now() + 5 * 60 * 60_000).toISOString();
    renderPanel([
      provider({
        providerId: "codex",
        displayName: "Codex",
        primary: rateWindow(later),
        selectedMetric: rateWindow(later),
      }),
      provider({
        providerId: "claude",
        displayName: "Claude",
        primary: rateWindow(soon),
        selectedMetric: rateWindow(soon),
      }),
    ]);
    const rows = await screen.findAllByText(/Claude|Codex/);
    expect(rows[0]).toHaveTextContent("Claude");
    expect(rows[1]).toHaveTextContent("Codex");
  });

  it("excludes providers that need authentication rather than showing a stale/fabricated reset", async () => {
    const soon = new Date(Date.now() + 30 * 60_000).toISOString();
    renderPanel([
      provider({
        errorState: "needsAuthentication",
        primary: rateWindow(soon),
        selectedMetric: rateWindow(soon),
      }),
    ]);
    expect(await screen.findByText("No upcoming resets to show yet")).toBeInTheDocument();
  });
});
