import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  getAppInfo: vi.fn(),
  openExternalUrl: vi.fn(),
}));

const updateMocks = vi.hoisted(() => ({
  checkNow: vi.fn(),
  download: vi.fn(),
  apply: vi.fn(),
  dismiss: vi.fn(),
  openRelease: vi.fn(),
}));

vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("../../../hooks/useLocale", () => ({
  useOptionalLocale: () => null, useLocale: () => ({ t: (key: string) => key }),
}));
vi.mock("../../../hooks/useUpdateState", () => ({
  useUpdateState: () => ({
    updateState: {
      status: "idle",
      version: null,
      error: null,
      progress: null,
      releaseUrl: null,
      canDownload: false,
      canApply: false,
      lastCheckedAt: null,
    },
    ...updateMocks,
  }),
}));

import AboutTab from "./AboutTab";
import type { SettingsSnapshot } from "../../../types/bridge";

const settings: SettingsSnapshot = {
  enabledProviders: [],
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
  menuBarShowsHighestUsage: true,
  menuBarShowsPercent: true,
  showAsUsed: false,
  showAllTokenAccountsInMenu: true,
  enableAnimations: true,
  resetTimeRelative: true,
  showResetWhenExhausted: false,
  menuBarDisplayMode: "compact",
  hidePersonalInfo: false,
  autoDownloadUpdates: false,
  installUpdatesOnQuit: false,
  globalShortcut: "",
  codexCustomSessionsDirs: [],
  updateChannel: "stable",
  uiLanguage: "english",
  theme: "dark",
  windowScalePercent: 125,
  trayScalePercent: 100,
  powertoysStatusPipeEnabled: false,
  claudeAvoidKeychainPrompts: true,
  codexSparkUsageVisible: true,
  disableKeychainAccess: false,
  providerMetrics: {},
  floatBarEnabled: false,
  floatBarOpacity: 0.9,
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

describe("AboutTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tauriMocks.getAppInfo.mockResolvedValue({
      name: "Quotalis",
      version: "0.30.3",
      buildNumber: "dev",
      updateChannel: "stable",
      tagline: "Keep agent limits in view.",
    });
    tauriMocks.openExternalUrl.mockResolvedValue(undefined);
  });

  it("opens about links through the Tauri URL bridge", async () => {
    render(<AboutTab settings={settings} set={vi.fn()} saving={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "Win-CodexBar" }));
    fireEvent.click(screen.getByRole("button", { name: "AboutContactWhatsApp" }));
    fireEvent.click(screen.getByRole("button", { name: "CodexBar" }));

    expect(screen.getByText("Mohammed Modhish")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "SubmitIssue" })).not.toBeInTheDocument();
    expect(tauriMocks.openExternalUrl).toHaveBeenNthCalledWith(
      1,
      "https://github.com/nesszer/Win-CodexBar",
    );
    expect(tauriMocks.openExternalUrl).toHaveBeenNthCalledWith(
      2,
      "https://wa.me/966570966094",
    );
    expect(tauriMocks.openExternalUrl).toHaveBeenNthCalledWith(
      3,
      "https://github.com/steipete/CodexBar",
    );
  });

  it("shows a link error if the OS browser launch fails", async () => {
    tauriMocks.openExternalUrl.mockRejectedValue("no browser");

    render(<AboutTab settings={settings} set={vi.fn()} saving={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "Win-CodexBar" }));

    await waitFor(() => {
      expect(screen.getByText("ErrorPrefix no browser")).toBeInTheDocument();
    });
  });

  it("presents the original mark, owner contribution and runtime roles with upstream credit", async () => {
    render(<AboutTab settings={settings} set={vi.fn()} saving={false} />);
    expect(await screen.findByRole("heading", { name: "Quotalis" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "AppName" })).toHaveAttribute("data-quotaarc-mark", "official");
    expect(screen.getByText("0.30.3")).toBeInTheDocument();
    expect(screen.getByText("AboutOwnerRole")).toBeInTheDocument();
    expect(screen.getByText("AboutDirectionBody")).toBeInTheDocument();
    expect(screen.getByText("AboutTechCore")).toBeInTheDocument();
    expect(screen.getByText("AboutLicenseBody")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "codexcontrol" }));
    expect(tauriMocks.openExternalUrl).toHaveBeenCalledWith("https://github.com/ademisler/codexcontrol");
    expect(screen.getByText("WorkflowGuideTitle").closest("details")).not.toHaveAttribute("open");
  });

  it("shows the local channel and prevents a false up-to-date result without checking", async () => {
    render(<AboutTab settings={{ ...settings, updateChannel: "local" }} set={vi.fn()} saving={false} />);
    const channel = await screen.findByRole("button", { name: "UpdateChannelChoice" });
    expect(channel).toHaveTextContent("UpdateChannelLocalOption");
    expect(screen.getByRole("button", { name: "AboutCheckForUpdates" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "AutoDownloadUpdates" })).toBeDisabled();
    expect(screen.getByText("AboutLocalUpdatesBody")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AboutCheckForUpdates" }));
    expect(updateMocks.checkNow).not.toHaveBeenCalled();
    expect(screen.queryByText("AboutUpToDate")).not.toBeInTheDocument();
  });
});
