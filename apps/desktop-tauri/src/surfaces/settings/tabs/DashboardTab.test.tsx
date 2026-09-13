import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  getCachedProviders: vi.fn(),
  refreshProviders: vi.fn(),
  refreshProvidersIfStale: vi.fn(),
  getSettingsSnapshot: vi.fn(),
  reorderProviders: vi.fn(),
  getLocaleStrings: vi.fn(),
  setUiLanguage: vi.fn(),
  getProviderChartData: vi.fn().mockResolvedValue(null),
  // Phase 3: AnalyticsDashboard now renders DashboardAnalyticsPanel, which
  // calls useDashboardSnapshot() -- this must resolve (not be undefined)
  // or the hook's synchronous call site throws inside the render effect.
  getDashboardSnapshot: vi.fn().mockResolvedValue({
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
  }),
  getAnalyticsSourceRegistry: vi.fn().mockResolvedValue([]),
}));

const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

import DashboardTab from "./DashboardTab";
import { LocaleProvider } from "../../../i18n/LocaleProvider";
import type { BootstrapState, ProviderUsageSnapshot, SettingsSnapshot } from "../../../types/bridge";

function rateWindow(used: number) {
  return {
    usedPercent: used,
    remainingPercent: 100 - used,
    windowMinutes: null,
    resetsAt: null,
    resetDescription: null,
    isExhausted: false,
    reservePercent: null,
    reserveDescription: null,
  };
}

function provider(id: string, displayName: string, used = 20): ProviderUsageSnapshot {
  return {
    providerId: id,
    displayName,
    primary: rateWindow(used),
    selectedMetric: rateWindow(used),
    primaryLabel: "Monthly",
    secondary: null,
    modelSpecific: null,
    tertiary: null,
    extraRateWindows: [],
    cost: null,
    planName: null,
    accountEmail: null,
    sourceLabel: "auto",
    updatedAt: "2026-05-24T00:00:00Z",
    error: null,
    errorState: "ready",
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
    fetchDurationMs: null,
  };
}

function settings(): SettingsSnapshot {
  return {
    enabledProviders: ["codex", "claude"],
    refreshIntervalSecs: 300,
    adaptiveRefresh: false,
    refreshAllProvidersOnMenuOpen: false,
    lowPowerMode: false,
    startAtLogin: false,
    startMinimized: false,
    showNotifications: true,
    soundEnabled: true,
    notificationSoundTheme: "windows",
    notificationSoundPaths: {
      predictiveWarning: null,
      highUsage: null,
      criticalUsage: null,
      exhausted: null,
      statusIssue: null,
      sessionDepleted: null,
      sessionRestored: null,
      expectedReset: null,
      unexpectedReset: null,
      bankedResetCredit: null,
    },
    highUsageThreshold: 70,
    criticalUsageThreshold: 90,
    predictivePaceWarningEnabled: false,
    trayIconMode: "single",
    switcherShowsIcons: true,
    menuBarShowsHighestUsage: false,
    menuBarShowsPercent: false,
    showAsUsed: true,
    showAllTokenAccountsInMenu: false,
    enableAnimations: true,
    resetTimeRelative: true,
    showResetWhenExhausted: false,
    menuBarDisplayMode: "detailed",
    hidePersonalInfo: false,
    updateChannel: "stable",
    autoDownloadUpdates: false,
    installUpdatesOnQuit: false,
    globalShortcut: "Ctrl+Shift+U",
    codexCustomSessionsDirs: [],
    uiLanguage: "english",
    theme: "dark",
    windowScalePercent: 125,
    trayScalePercent: 100,
    powertoysStatusPipeEnabled: false,
    claudeAvoidKeychainPrompts: false,
    codexSparkUsageVisible: true,
    disableKeychainAccess: false,
    providerMetrics: {},
    floatBarEnabled: false,
    floatBarOpacity: 80,
    floatBarScale: 100,
    floatBarOrientation: "horizontal",
    floatBarStyle: "floating",
    floatBarClickThrough: false,
    floatBarProviderIds: [],
    floatBarDarkText: false,
    floatBarShowResetInline: false,
    floatBarShowCost: false,
    claudeDailyRoutinesUsageVisible: true,
    claudeAllowReadingClaudeCodeCredentials: false,
    alibabaTokenPlanRegion: "cn",
    weeklyProgressWorkDays: null,
    costSummaryDisplayStyle: "compact",
    providerAccentColors: {},
  };
}

function bootstrap(settingsOverride: Partial<SettingsSnapshot> = {}): BootstrapState {
  return {
    contractVersion: "v1",
    providers: [],
    settings: { ...settings(), ...settingsOverride },
  };
}

function renderDashboardTab(
  providers: ProviderUsageSnapshot[],
  onOpenProviders = vi.fn(),
  settingsOverride: Partial<SettingsSnapshot> = {},
) {
  tauriMocks.getCachedProviders.mockResolvedValue(providers);
  tauriMocks.getSettingsSnapshot.mockResolvedValue({ ...settings(), ...settingsOverride });
  return render(
    <LocaleProvider>
      <DashboardTab state={bootstrap(settingsOverride)} onOpenProviders={onOpenProviders} />
    </LocaleProvider>,
  );
}

describe("DashboardTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tauriMocks.getLocaleStrings.mockResolvedValue({
      language: "english",
      entries: { NoProvidersConfigured: "No providers configured", EnableProvidersHint: "Enable a provider to see it here.", FetchingProviderData: "Fetching…" },
    });
    tauriMocks.refreshProviders.mockResolvedValue([]);
    tauriMocks.refreshProvidersIfStale.mockResolvedValue(undefined);
    tauriMocks.reorderProviders.mockResolvedValue(undefined);
  });

  it("renders the provider stack in-shell, with no window chrome", async () => {
    renderDashboardTab([provider("claude", "Claude"), provider("codex", "Codex")]);
    // DashboardTab now routes through DashboardHost's React.lazy-loaded
    // AnalyticsDashboard, adding a real async module-resolution tick before
    // content appears -- allow more time than the default findBy timeout.
    expect((await screen.findAllByText("Claude", {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Codex · 1").length).toBeGreaterThan(0);
    // No detached-window chrome: no title bar restore/close controls, no
    // footer Settings/About/Quit rows -- those are PopOutPanel-only.
    expect(screen.queryByText("MenuQuit")).not.toBeInTheDocument();
  });

  /**
   * Regression test for a real bug found via native CDP proof (Phase 5.1
   * follow-up, docs/validation/PHASE5_3D_PROTOTYPE.md): `useProviders()`'s
   * cached provider list is not scoped to the active profile's account
   * set -- a profile switch does not clear it. `useDashboardState`'s
   * `orderProviderSnapshots` only sorts, it never excluded a provider
   * absent from `settings.enabledProviders`, so switching to a profile
   * with a different (or empty) account set left the 2D Dashboard
   * showing the previous profile's providers -- the same bug already
   * found and fixed for the 3D Dashboard (`Providers3DDashboard.tsx`).
   */
  it("shows the empty state, not stale providers, when the active profile has zero enabled providers", async () => {
    renderDashboardTab(
      [provider("claude", "Claude"), provider("codex", "Codex")],
      vi.fn(),
      { enabledProviders: [] },
    );

    expect(await screen.findByText("No providers configured")).toBeInTheDocument();
    expect(screen.queryByText("Claude")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Codex(?: · 1)?$/)).not.toBeInTheDocument();
  });

  it("shows only the providers enabled by the active profile, not every cached provider", async () => {
    renderDashboardTab(
      [provider("claude", "Claude"), provider("codex", "Codex"), provider("cursor", "Cursor")],
      vi.fn(),
      { enabledProviders: ["claude"] },
    );

    expect((await screen.findAllByText("Claude", {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Codex(?: · 1)?$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Cursor")).not.toBeInTheDocument();
  });

  it("routes the empty-state CTA to the Providers tab instead of opening a window", async () => {
    const onOpenProviders = vi.fn();
    renderDashboardTab([], onOpenProviders);
    const button = await screen.findByText("No providers configured");
    expect(button).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpenProviders).toHaveBeenCalledTimes(1);
  });
});
