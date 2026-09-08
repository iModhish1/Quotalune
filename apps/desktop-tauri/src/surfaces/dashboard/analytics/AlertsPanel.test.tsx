import { fireEvent, render, screen } from "@testing-library/react";
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

import AlertsPanel from "./AlertsPanel";
import { LocaleProvider } from "../../../i18n/LocaleProvider";
import type { ProviderUsageSnapshot } from "../../../types/bridge";

function rateWindow(usedPercent = 20, resetsAt: string | null = null) {
  return {
    usedPercent,
    remainingPercent: 100 - usedPercent,
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

function renderPanel(providers: ProviderUsageSnapshot[], onOpenProviders = vi.fn()) {
  tauriMocks.getLocaleStrings.mockResolvedValue({
    language: "english",
    entries: {
      DashboardAlertsTitle: "Alerts",
      DashboardAlertsEmpty: "No alerts — everything looks fine",
      DashboardAlertAuthRequired: "{} needs sign-in",
      DashboardAlertQuotaCritical: "{} has nearly exhausted its quota",
      DashboardReconnect: "Reconnect",
    },
  });
  return render(
    <LocaleProvider>
      <AlertsPanel
        providers={providers}
        settings={{ highUsageThreshold: 70, criticalUsageThreshold: 90 }}
        onOpenProviders={onOpenProviders}
      />
    </LocaleProvider>,
  );
}

describe("AlertsPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the empty state when nothing needs attention", async () => {
    renderPanel([provider({ primary: rateWindow(10) })]);
    expect(await screen.findByText("No alerts — everything looks fine")).toBeInTheDocument();
  });

  it("renders a friendly auth-required alert, never the raw error text", async () => {
    renderPanel([
      provider({ errorState: "needsAuthentication", error: "OAuth token expired: refresh_token invalid" }),
    ]);
    // The provider name renders inside a <bdi> for RTL isolation (owner
    // section 16), so the sentence is split across nodes -- match on the
    // alert-text container's full textContent instead of a single node.
    const alertText = await screen.findByText(
      (_, element) => element?.className === "dashboard-analytics__alert-text",
    );
    expect(alertText).toHaveTextContent("Claude needs sign-in");
    expect(screen.queryByText(/OAuth token expired/)).not.toBeInTheDocument();
  });

  it("the Reconnect action on an auth alert routes to Providers", async () => {
    const onOpenProviders = vi.fn();
    renderPanel([provider({ errorState: "needsAuthentication" })], onOpenProviders);
    fireEvent.click(await screen.findByRole("button", { name: "Reconnect" }));
    expect(onOpenProviders).toHaveBeenCalledTimes(1);
  });

  it("renders a quota-critical alert using the real reported usage", async () => {
    renderPanel([provider({ primary: rateWindow(95) })]);
    const alertText = await screen.findByText(
      (_, element) => element?.className === "dashboard-analytics__alert-text",
    );
    expect(alertText).toHaveTextContent("Claude has nearly exhausted its quota");
  });
});
