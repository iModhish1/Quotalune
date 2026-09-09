import { fireEvent, render as baseRender, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BootstrapState, SettingsSnapshot } from "../../../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getLocaleStrings: vi.fn().mockResolvedValue({language:"english",entries:{DashboardPreferences:"Dashboard Preferences",DashboardLowCpu:"Low CPU",V2Appearance:"Appearance"}}),
  getSettingsSnapshot: vi.fn(),
  updateSettings: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

import DashboardStudioTab from "./DashboardStudioTab";
import {LocaleProvider} from "../../../i18n/LocaleProvider";
import type {ReactNode} from "react";
const render = (node:ReactNode) => baseRender(<LocaleProvider>{node}</LocaleProvider>);

function settings(overrides: Partial<SettingsSnapshot> = {}): SettingsSnapshot {
  return {
    enabledProviders: ["codex", "claude"],
    refreshIntervalSecs: 300,
    adaptiveRefresh: false,
    refreshAllProvidersOnMenuOpen: false,
    lowPowerMode: false,
    dashboardMode: "analytics2d",
    dashboardPerformancePreset: "balanced",
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
    catalogTheme: "01-obsidian-orbit",
    ...overrides,
  };
}

function bootstrap(overrides: Partial<SettingsSnapshot> = {}): BootstrapState {
  return { contractVersion: "v1", providers: [], settings: settings(overrides) };
}

describe("DashboardStudioTab", () => {
  beforeEach(() => {
    tauriMocks.getSettingsSnapshot.mockReset().mockResolvedValue(settings());
    // The real update_settings command resolves with the new SettingsSnapshot
    // (useSettings.update() calls setSettings(next) with it) -- resolving
    // undefined here would clobber `settings` and crash the next render.
    tauriMocks.updateSettings.mockReset().mockImplementation((patch: Partial<SettingsSnapshot>) =>
      Promise.resolve(settings(patch)),
    );
  });

  it("retains performance controls without a mode selector, including legacy settings", async () => {
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings({dashboardMode: "providers3d"}));
    render(<DashboardStudioTab state={bootstrap()} onOpenThemes={vi.fn()} onOpenProviderDisplay={vi.fn()} />);
    expect(await screen.findByText("Dashboard Preferences")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", {name: "Dashboard Experience"})).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.queryByText("Experimental 3D")).not.toBeInTheDocument();
    expect(tauriMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("selecting a performance preset persists it via updateSettings", async () => {
    render(
      <DashboardStudioTab state={bootstrap()} onOpenThemes={vi.fn()} onOpenProviderDisplay={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole("radio", { name: /Low CPU/ }));
    await waitFor(() => {
      expect(tauriMocks.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ dashboardPerformancePreset: "lowCpu" }),
      );
    });
  });

  it("routes the identity 'Change' buttons to the requested tab", async () => {
    const onOpenThemes = vi.fn();
    const onOpenProviderDisplay = vi.fn();
    render(
      <DashboardStudioTab state={bootstrap()} onOpenThemes={onOpenThemes} onOpenProviderDisplay={onOpenProviderDisplay} />,
    );
    const changeButtons = await screen.findAllByRole("button", { name: "Appearance" });
    fireEvent.click(changeButtons[0]);
    expect(onOpenThemes).toHaveBeenCalledTimes(1);
    fireEvent.click(changeButtons[1]);
    expect(onOpenProviderDisplay).toHaveBeenCalledTimes(1);
  });
});
