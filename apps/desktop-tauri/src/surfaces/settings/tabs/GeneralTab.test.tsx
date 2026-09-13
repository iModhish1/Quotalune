import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGO_APPEARANCE_STORAGE_KEY } from "../../../design-system/logoAppearance";

vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key }),
  useOptionalLocale: () => null,
}));

// Mock Tauri invoke for get_available_languages
vi.mock("@tauri-apps/api/core", () => ({
  // Keep the mount-only language refresh pending in unit tests. The component
  // intentionally ships the same fallback list, and resolving this request
  // after a synchronous assertion creates unrelated React act() warnings.
  invoke: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import GeneralTab from "./GeneralTab";
import type { SettingsSnapshot } from "../../../types/bridge";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const settings: SettingsSnapshot = {
  enabledProviders: [],
  refreshIntervalSecs: 300,
    adaptiveRefresh: false,
  refreshAllProvidersOnMenuOpen: false,
  lowPowerMode: false,
  startAtLogin: false,
  startMinimized: false,
  showNotifications: true,
  notificationEvents: {
    highUsage: true,
    criticalUsage: true,
    exhausted: true,
    statusIssue: true,
    sessionDepleted: true,
    sessionRestored: true,
    expectedReset: true,
    unexpectedReset: true,
    bankedResetCredit: true,
  },
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
  usageStepNotificationPercent: undefined,
  predictivePaceWarningEnabled: false,
  trayIconMode: "single",
  switcherShowsIcons: true,
  menuBarShowsHighestUsage: true,
  menuBarShowsPercent: true,
  showAsUsed: false,
  showAllTokenAccountsInMenu: true,
  enableAnimations: true,
  resetTimeRelative: true,
  menuBarDisplayMode: "compact",
  windowScalePercent: 125,
  trayScalePercent: 100,
  powertoysStatusPipeEnabled: false,
  hidePersonalInfo: false,
  autoDownloadUpdates: false,
  installUpdatesOnQuit: false,
  globalShortcut: "",
  codexCustomSessionsDirs: [],
  updateChannel: "stable",
  uiLanguage: "english",
  theme: "dark",
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
  showResetWhenExhausted: false,
};

beforeEach(() => localStorage.removeItem(LOGO_APPEARANCE_STORAGE_KEY));

describe("GeneralTab language picker", () => {
  it("renders all supported language options", () => {
    render(<GeneralTab settings={settings} set={vi.fn()} saving={false} />);

    fireEvent.click(screen.getByRole("button", { name: "InterfaceLanguage" }));
    expect(screen.getAllByRole("option")).toHaveLength(9);
  });

  it("includes spanish as a selectable option", () => {
    render(<GeneralTab settings={settings} set={vi.fn()} saving={false} />);

    fireEvent.click(screen.getByRole("button", { name: "InterfaceLanguage" }));
    expect(
      screen.getByRole("option", { name: "Español" }),
    ).toBeInTheDocument();
  });

  it("includes russian as a selectable option", () => {
    render(<GeneralTab settings={settings} set={vi.fn()} saving={false} />);

    fireEvent.click(screen.getByRole("button", { name: "InterfaceLanguage" }));
    expect(screen.getByRole("option", { name: "Русский" })).toBeInTheDocument();
  });

  it("includes turkish as a selectable option", () => {
    render(<GeneralTab settings={settings} set={vi.fn()} saving={false} />);

    fireEvent.click(screen.getByRole("button", { name: "InterfaceLanguage" }));
    expect(screen.getByRole("option", { name: "Türkçe" })).toBeInTheDocument();
  });

  it("includes korean as a selectable option", () => {
    render(<GeneralTab settings={settings} set={vi.fn()} saving={false} />);

    fireEvent.click(screen.getByRole("button", { name: "InterfaceLanguage" }));
    expect(
      screen.getByRole("option", { name: "한국어" }),
    ).toBeInTheDocument();
  });

  it("includes Traditional Chinese as a selectable option", () => {
    render(<GeneralTab settings={settings} set={vi.fn()} saving={false} />);

    fireEvent.click(screen.getByRole("button", { name: "InterfaceLanguage" }));
    expect(screen.getByRole("option", { name: "繁體中文" })).toBeInTheDocument();
  });

  it("updates the predictive pace warning preference", () => {
    const set = vi.fn();
    render(
      <GeneralTab
        mode="notifications"
        settings={settings}
        set={set}
        saving={false}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "PredictivePaceWarnings" }));

    expect(set).toHaveBeenCalledWith({ predictivePaceWarningEnabled: true });
  });

  it("configures quiet hours independently from the notification master switch", () => {
    const set = vi.fn();
    render(
      <GeneralTab
        mode="notifications"
        settings={{...settings, notificationQuietHours:{enabled:false,startMinute:1320,endMinute:420}}}
        set={set}
        saving={false}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "NotificationQuietHours" }));
    expect(set).toHaveBeenCalledWith({
      notificationQuietHours:{enabled:true,startMinute:1320,endMinute:420},
    });
  });

  it("updates the low power mode preference", () => {
    const set = vi.fn();
    render(<GeneralTab settings={settings} set={set} saving={false} />);

    fireEvent.click(screen.getByRole("button", { name: "LowPowerMode" }));
    fireEvent.click(screen.getByRole("option", { name: "LowPowerModeAutomatic" }));

    expect(set).toHaveBeenCalledWith({ lowPowerModePreference: "automatic" });
  });

  it("updates the default notification sound set", () => {
    const set = vi.fn();
    render(
      <GeneralTab mode="notifications" settings={settings} set={set} saving={false} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "NotificationSoundTheme" }));
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.click(screen.getByRole("option", { name: "NotificationSoundThemeQuotaArc" }));

    expect(set).toHaveBeenCalledWith({ notificationSoundTheme: "codexBar" });
  });

  it("renders and previews all ten notification events", () => {
    render(
      <GeneralTab mode="notifications" settings={settings} set={vi.fn()} saving={false} />,
    );

    const previewButtons = screen.getAllByRole("button", {
      name: /NotificationTestSound$/,
    });
    expect(previewButtons).toHaveLength(10);

    fireEvent.click(
      screen.getByRole("button", {
        name: "NotificationSoundEventExpectedReset: NotificationTestSound",
      }),
    );
    expect(invoke).toHaveBeenCalledWith("play_notification_sound", {
      event: "expectedReset",
    });
  });

  it("assigns and clears a custom WAV for one notification", async () => {
    const set = vi.fn();
    vi.mocked(open).mockResolvedValue("C:\\sounds\\high-usage.wav");
    const { rerender } = render(
      <GeneralTab mode="notifications" settings={settings} set={set} saving={false} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "NotificationSoundEventHighUsage: NotificationSoundChooseFile",
      }),
    );
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith({
        notificationSoundPaths: {
          ...settings.notificationSoundPaths,
          highUsage: "C:\\sounds\\high-usage.wav",
        },
      }),
    );

    rerender(
      <GeneralTab
        mode="notifications"
        settings={{
          ...settings,
          notificationSoundPaths: {
            ...settings.notificationSoundPaths,
            highUsage: "C:\\sounds\\high-usage.wav",
          },
        }}
        set={set}
        saving={false}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "NotificationSoundEventHighUsage: high-usage.wav, NotificationSoundChooseFile",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "NotificationSoundEventHighUsage: NotificationSoundClearFile",
      }),
    );
    expect(set).toHaveBeenLastCalledWith({
      notificationSoundPaths: settings.notificationSoundPaths,
    });
  });

  it("reenables sound previews immediately when playback fails", async () => {
    render(
      <GeneralTab mode="notifications" settings={settings} set={vi.fn()} saving={false} />,
    );
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("get_available_languages"),
    );
    vi.mocked(invoke).mockRejectedValueOnce(new Error("playback failed"));

    const preview = screen.getByRole("button", {
      name: "NotificationSoundEventCriticalUsage: NotificationTestSound",
    });
    fireEvent.click(preview);

    expect(await screen.findByRole("alert")).toHaveTextContent("playback failed");
    expect(preview).toBeEnabled();
  });

  it("saves a window override on blur and clears it to resume inheritance", () => {
    const set = vi.fn();
    const { rerender } = render(
      <GeneralTab mode="notifications" settings={settings} set={set} saving={false} />,
    );
    const input = screen.getByRole("spinbutton", {
      name: "ProviderNameCodex · ProviderSession HighUsageAlert",
    });

    fireEvent.change(input, { target: { value: "80" } });
    fireEvent.blur(input);
    expect(set).toHaveBeenLastCalledWith({
      providerUsageThresholds: { "codex:session": { high: 80 } },
    });

    rerender(
      <GeneralTab
        mode="notifications"
        settings={{
          ...settings,
          providerUsageThresholds: { "codex:session": { high: 80 } },
        }}
        set={set}
        saving={false}
      />,
    );
    const saved = screen.getByRole("spinbutton", {
      name: "ProviderNameCodex · ProviderSession HighUsageAlert",
    });
    fireEvent.change(saved, { target: { value: "" } });
    fireEvent.blur(saved);
    expect(set).toHaveBeenLastCalledWith({ providerUsageThresholds: {} });
  });

  it("defaults the startup destination selector to Provider Display and persists a change", () => {
    const set = vi.fn();
    render(
      <GeneralTab mode="general" settings={settings} set={set} saving={false} />,
    );
    expect(screen.getByRole("button", { name: "StartupDestination" })).toHaveTextContent("StartupDestinationProviderDisplay");
    fireEvent.click(screen.getByRole("button", { name: "StartupDestination" }));
    fireEvent.click(screen.getByRole("option", { name: "StartupDestinationLastOpened" }));
    expect(set).toHaveBeenLastCalledWith({ startupDestination: "lastOpened" });
  });

  it("respects a saved startup destination other than the default", () => {
    render(
      <GeneralTab
        mode="general"
        settings={{ ...settings, startupDestination: "dashboard" }}
        set={vi.fn()}
        saving={false}
      />,
    );
    expect(screen.getByRole("button", { name: "StartupDestination" })).toHaveTextContent("StartupDestinationDashboard");
  });

  it("toggles each notification category without disabling the others", () => {
    const set = vi.fn();
    render(
      <GeneralTab mode="notifications" settings={settings} set={set} saving={false} />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "NotificationSoundEventStatusIssue" }));
    expect(set).toHaveBeenCalledWith({
      notificationEvents: {...settings.notificationEvents, statusIssue: false},
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "ExpectedResetNotifications" }));
    expect(set).toHaveBeenLastCalledWith({
      notificationEvents: {...settings.notificationEvents, expectedReset: false},
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "BankedResetCreditNotifications" }));
    expect(set).toHaveBeenLastCalledWith({
      notificationEvents: {...settings.notificationEvents, bankedResetCredit: false},
    });
  });

  it("enables an arbitrary usage-step notification interval independently", () => {
    const set = vi.fn();
    render(
      <GeneralTab mode="notifications" settings={settings} set={set} saving={false} />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "UsageStepNotifications" }));
    expect(set).toHaveBeenCalledWith({ usageStepNotificationPercent: 10 });
  });

  it("offers every catalog provider with independent session, five-hour, and weekly rules", () => {
    render(
      <GeneralTab
        mode="notifications"
        settings={settings}
        set={vi.fn()}
        saving={false}
        providerCatalog={[
          { id: "codex", displayName: "Codex", cookieDomain: null },
          { id: "gemini", displayName: "Gemini", cookieDomain: null },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "TabProviders" }));
    fireEvent.click(screen.getByRole("option", { name: "Gemini" }));

    expect(
      screen.getByRole("spinbutton", {
        name: "Gemini · ProviderSession HighUsageAlert",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", {
        name: "Gemini · PanelFiveHours HighUsageAlert",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", {
        name: "Gemini · ProviderWeekly HighUsageAlert",
      }),
    ).toBeInTheDocument();
  });
});


  it("renders the theme picker with auto/light/dark options in appearance mode", () => {
    render(<GeneralTab mode="appearance" settings={settings} set={vi.fn()} saving={false} />);

    fireEvent.click(screen.getByRole("button", { name: "ThemeLabel" }));
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("option", { name: "ThemeLightOption" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ThemeDarkOption" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ThemeAutoOption" })).toBeInTheDocument();
  });

  it("persists a light theme choice via updateSettings", () => {
    const set = vi.fn();
    render(<GeneralTab mode="appearance" settings={settings} set={set} saving={false} />);

    fireEvent.click(screen.getByRole("button", { name: "ThemeLabel" }));
    fireEvent.click(screen.getByRole("option", { name: "ThemeLightOption" }));

    expect(set).toHaveBeenCalledWith({ theme: "light" });
  });

  it("does not render the theme picker in notifications mode", () => {
    render(
      <GeneralTab mode="notifications" settings={settings} set={vi.fn()} saving={false} />,
    );

    expect(screen.queryByRole("button", { name: "ThemeLabel" })).toBeNull();
  });

  it("offers independent logo finishes and prominence with a live persisted preview", () => {
    render(<GeneralTab mode="appearance" settings={settings} set={vi.fn()} saving={false} />);

    fireEvent.click(screen.getByRole("button", { name: "LogoAurora" }));
    fireEvent.click(screen.getByRole("button", { name: "LogoBalanced" }));

    expect(JSON.parse(localStorage.getItem(LOGO_APPEARANCE_STORAGE_KEY) ?? "null")).toEqual({
      variant: "aurora",
      size: "balanced",
    });
    expect(screen.getByRole("button", { name: "LogoAurora" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "LogoBalanced" })).toHaveAttribute("aria-pressed", "true");
  });
