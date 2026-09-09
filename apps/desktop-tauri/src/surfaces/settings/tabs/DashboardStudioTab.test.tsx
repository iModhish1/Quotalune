import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BootstrapState, SettingsSnapshot } from "../../../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getSettingsSnapshot: vi.fn(),
  updateSettings: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

import DashboardStudioTab from "./DashboardStudioTab";

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

  it("renders exactly the 3 production dashboard mode cards, plus 3 performance presets", async () => {
    render(
      <DashboardStudioTab state={bootstrap()} onOpenThemes={vi.fn()} onOpenProviderDisplay={vi.fn()} />,
    );
    // Phase S1: the visible picker is Analytics / Spatial / Experimental
    // 3D -- Hybrid stays a real DASHBOARD_REGISTRY entry but is no
    // longer offered in this picker (see dashboardRegistry.ts).
    expect(await screen.findByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Spatial")).toBeInTheDocument();
    expect(screen.getByText("Experimental 3D")).toBeInTheDocument();
    expect(screen.queryByText("Hybrid Dashboard")).not.toBeInTheDocument();
    expect(screen.getByText("Low CPU")).toBeInTheDocument();
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(screen.getByText("High Fidelity")).toBeInTheDocument();
  });

  it("marks the currently-selected mode and preset", async () => {
    const overridden = settings({ dashboardMode: "providers3d", dashboardPerformancePreset: "highFidelity" });
    tauriMocks.getSettingsSnapshot.mockResolvedValue(overridden);
    render(
      <DashboardStudioTab
        state={{ contractVersion: "v1", providers: [], settings: overridden }}
        onOpenThemes={vi.fn()}
        onOpenProviderDisplay={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /Experimental 3D/ })).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    expect(screen.getByRole("radio", { name: /High Fidelity/ })).toHaveAttribute("aria-checked", "true");
  });

  it("selecting a mode persists it via updateSettings", async () => {
    render(
      <DashboardStudioTab state={bootstrap()} onOpenThemes={vi.fn()} onOpenProviderDisplay={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole("radio", { name: /Experimental 3D/ }));
    await waitFor(() => {
      expect(tauriMocks.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ dashboardMode: "providers3d" }),
      );
    });
  });

  it("selecting Spatial persists the spatial mode via updateSettings", async () => {
    render(
      <DashboardStudioTab state={bootstrap()} onOpenThemes={vi.fn()} onOpenProviderDisplay={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole("radio", { name: /Spatial/ }));
    await waitFor(() => {
      expect(tauriMocks.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ dashboardMode: "spatial" }),
      );
    });
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
    const changeButtons = await screen.findAllByRole("button", { name: "Change" });
    fireEvent.click(changeButtons[0]);
    expect(onOpenThemes).toHaveBeenCalledTimes(1);
    fireEvent.click(changeButtons[1]);
    expect(onOpenProviderDisplay).toHaveBeenCalledTimes(1);
  });
});
