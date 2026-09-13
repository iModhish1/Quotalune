import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  getCachedProviders: vi.fn(),
  getDashboardSnapshot: vi.fn().mockResolvedValue(null),
  refreshProviders: vi.fn(),
  refreshProvidersIfStale: vi.fn(),
  getSettingsSnapshot: vi.fn(),
  getUpdateState: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  applyUpdate: vi.fn(),
  dismissUpdate: vi.fn(),
  openReleasePage: vi.fn(),
  openFlyoutWindow: vi.fn(),
  openSettingsWindow: vi.fn(),
  quitApp: vi.fn(),
  getProviderChartData: vi.fn(),
  getLocaleStrings: vi.fn(),
  setUiLanguage: vi.fn(),
  getDeepSeekPricingStatus: vi.fn().mockResolvedValue(null),
  getAnalyticsSourceRegistry: vi.fn().mockResolvedValue([]),
}));

const eventMocks = vi.hoisted(() => ({
  listen: vi.fn(),
}));

const windowMocks = vi.hoisted(() => {
  const setSize = vi.fn().mockResolvedValue(undefined);
  const setPosition = vi.fn().mockResolvedValue(undefined);
  const minimize = vi.fn().mockResolvedValue(undefined);
  const toggleMaximize = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn().mockResolvedValue(undefined);
  const isMaximized = vi.fn().mockResolvedValue(false);
  const onResized = vi.fn().mockResolvedValue(() => {});
  return {
    setSize,
    setPosition,
    minimize,
    toggleMaximize,
    close,
    isMaximized,
    onResized,
    getCurrentWindow: vi.fn(() => ({
      setSize,
      setPosition,
      minimize,
      toggleMaximize,
      close,
      isMaximized,
      onResized,
    })),
    LogicalSize: vi.fn((width: number, height: number) => ({ width, height })),
    LogicalPosition: vi.fn((x: number, y: number) => ({ x, y })),
  };
});

const webviewWindowMocks = vi.hoisted(() => {
  const setZoom = vi.fn().mockResolvedValue(undefined);
  return {
    setZoom,
    getCurrentWebviewWindow: vi.fn(() => ({ setZoom })),
  };
});

vi.mock("../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);
vi.mock("@tauri-apps/api/window", () => windowMocks);
vi.mock("@tauri-apps/api/webviewWindow", () => webviewWindowMocks);

import PopOutPanel from "./PopOutPanel";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { buildBundle } from "../test/localeHarness";
import { TEST_PROVIDER_CATALOG } from "../test/providerCatalog";
import type {
  BootstrapState,
  ProviderCatalogEntry,
  ProviderUsageSnapshot,
  SettingsSnapshot,
} from "../types/bridge";

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

function bootstrap(
  catalog: ProviderCatalogEntry[] = [],
  settingsOverride: Partial<SettingsSnapshot> = {},
): BootstrapState {
  return {
    contractVersion: "v1",
    providers: catalog,
    settings: { ...settings(), ...settingsOverride },
  };
}

function renderPopOut(
  providers: ProviderUsageSnapshot[],
  providerId?: string,
  catalog: ProviderCatalogEntry[] = [],
  settingsOverride: Partial<SettingsSnapshot> = {},
) {
  tauriMocks.getCachedProviders.mockResolvedValue(providers);
  tauriMocks.getSettingsSnapshot.mockResolvedValue({
    ...settings(),
    ...settingsOverride,
  });
  return render(
    <LocaleProvider>
      <PopOutPanel
        state={bootstrap(catalog, settingsOverride)}
        providerId={providerId}
      />
    </LocaleProvider>,
  );
}

describe("PopOutPanel", () => {
  it("reports settings launch errors instead of silently leaving the dashboard",async()=>{
    tauriMocks.openSettingsWindow.mockRejectedValueOnce(new Error("Window unavailable"));
    renderPopOut([]);
    fireEvent.click(await screen.findByText("TooltipSettings"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Window unavailable");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    tauriMocks.refreshProviders.mockResolvedValue(undefined);
    tauriMocks.refreshProvidersIfStale.mockResolvedValue(undefined);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings());
    tauriMocks.getUpdateState.mockResolvedValue({
      status: "idle",
      version: null,
      error: null,
      progress: null,
      releaseUrl: null,
      canDownload: false,
      canApply: false,
      lastCheckedAt: null,
    });
    tauriMocks.getProviderChartData.mockResolvedValue({
      providerId: "codex",
      costHistory: [],
      creditsHistory: [],
      usageBreakdown: [],
      localUsage: null,
    });
    tauriMocks.getLocaleStrings.mockResolvedValue(
      buildBundle({
        PanelAllProviders: "All providers",
        PanelAllProvidersShort: "All",
        PanelLeftSuffix: "left",
        PanelShowAllProviders: "Show all providers",
        PanelShowFewerProviders: "Show fewer providers",
        PanelUsedSuffix: "used",
        SummaryProvidersLabel: "providers",
      }),
    );
    tauriMocks.openFlyoutWindow.mockResolvedValue(undefined);
    eventMocks.listen.mockResolvedValue(() => {});
  });

  it("shows the provider grid and focuses provider targets", async () => {
    const { container } = renderPopOut(
      [provider("codex", "Codex", 80), provider("claude", "Claude", 30)],
      "claude",
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".provider-grid__item")).toHaveLength(3);
    });

    expect(container.querySelector(".provider-grid__item--active")?.getAttribute("aria-label")).toBe("Claude");
    expect(screen.getAllByText("Claude").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll(".menu-stack__item")).toHaveLength(1);
  });

  it("renders cleanly with the flyout-window rewiring for goTray's onClick", async () => {
    // goTray's onClick now calls openFlyoutWindow() (formerly
    // setSurfaceMode("trayPanel", ...)) — asserted directly against the mock
    // import rather than via a click because `headerActions` (the array
    // goTray's handler lives in) is currently never rendered by
    // MenuSurface: `actions` is destructured in MenuSurfaceProps but not
    // consumed in its JSX (components/MenuSurface.tsx), so there is no
    // "back to tray" button in the DOM to click today. That's a pre-existing
    // gap tracked separately, not introduced by this rewiring. This test
    // instead pins down that the component still renders without error and
    // that openFlyoutWindow is never called on mount (only on the — for now
    // unreachable — click), so the rewiring doesn't regress anything that
    // currently DOES work.
    renderPopOut([provider("codex", "Codex", 80)]);

    await waitFor(() => {
      expect(screen.getAllByText("Codex").length).toBeGreaterThan(0);
    });

    expect(tauriMocks.openFlyoutWindow).not.toHaveBeenCalled();
  });

  it("applies the persisted PopOut display scale", async () => {
    const { container } = renderPopOut(
      [provider("codex", "Codex", 80)],
      undefined,
      [],
      { windowScalePercent: 175 },
    );

    await waitFor(() => {
      expect(container.querySelector(".popout-scale-shell")).not.toBeNull();
    });

    // Scaling is applied via the webview's native zoom, not an inline
    // `--window-scale` style (which the earlier CSS-zoom approach used).
    await waitFor(() => {
      expect(webviewWindowMocks.setZoom).toHaveBeenCalledWith(1.75);
    });
  });

  it("does not resize or reposition the native window on mount", async () => {
    renderPopOut([provider("codex", "Codex", 80)]);

    await waitFor(() => {
      expect(screen.getAllByText("Codex").length).toBeGreaterThan(0);
    });

    // The PopOut title bar reads window state (isMaximized) on mount, so
    // getCurrentWindow is legitimately called; assert only that the surface
    // itself never resizes or repositions the native window.
    expect(windowMocks.setSize).not.toHaveBeenCalled();
    expect(windowMocks.setPosition).not.toHaveBeenCalled();
  });

  it("localizes static popout panel footer labels in Japanese", async () => {
    tauriMocks.getLocaleStrings.mockResolvedValue(
      buildBundle(
        {
          MenuAbout: "CodexBar について",
          MenuQuit: "終了",
          TooltipSettings: "設定",
        },
        "japanese",
      ),
    );

    renderPopOut([provider("codex", "Codex", 80)]);

    expect(await screen.findByText("設定")).toBeInTheDocument();
    expect(screen.getByText("CodexBar について")).toBeInTheDocument();
    expect(screen.getByText("終了")).toBeInTheDocument();
  });

  it("renders overview cards in settings catalog order instead of fetch order", async () => {
    const catalog: ProviderCatalogEntry[] = [
      { id: "codex", displayName: "Codex", cookieDomain: null },
      { id: "claude", displayName: "Claude", cookieDomain: null },
      { id: "cursor", displayName: "Cursor", cookieDomain: null },
    ];

    const { container } = renderPopOut(
      [
        provider("cursor", "Cursor", 15),
        provider("codex", "Codex", 95),
        provider("claude", "Claude", 40),
      ],
      undefined,
      catalog,
      // This test exercises catalog-order sorting, not enabled-provider
      // filtering (see `useDashboardState.ts`'s `enabledProviders` filter,
      // added to fix a real profile-switch bug) -- "cursor" must be
      // explicitly enabled here or it would be correctly excluded rather
      // than sorted last.
      { enabledProviders: ["codex", "claude", "cursor"] },
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".provider-rail__node")).toHaveLength(3);
    });

    expect(
      Array.from(container.querySelectorAll(".provider-rail__node > strong")).map(
        (node) => node.textContent,
      ),
    ).toEqual(["Codex · 1", "Claude", "Cursor"]);
  });

  it("bounds the provider rail at large counts without a canvas", async () => {
    const providers = TEST_PROVIDER_CATALOG.map(([id, name]) => provider(id, name));
    const {container} = renderPopOut(providers, undefined, [], {enabledProviders: providers.map(p => p.providerId)});
    await waitFor(() => expect(container.querySelectorAll(".provider-rail__node")).toHaveLength(Math.min(4, providers.length)));
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".provider-grid")).toBeNull();
  });
});
