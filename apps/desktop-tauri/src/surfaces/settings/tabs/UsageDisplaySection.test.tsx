import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ProviderCatalogEntry,
  ProviderUsageSnapshot,
  SettingsSnapshot,
} from "../../../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getSettingsSnapshot: vi.fn(),
  setUsageSettings: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

const providerMocks = vi.hoisted(() => ({
  useProviders: vi.fn(),
}));

vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);
vi.mock("../../../hooks/useProviders", () => providerMocks);

import UsageDisplaySection from "./UsageDisplaySection";

const catalog: ProviderCatalogEntry[] = [
  { id: "codex", displayName: "Codex", cookieDomain: null },
  { id: "claude", displayName: "Claude", cookieDomain: null },
  { id: "gemini", displayName: "Gemini", cookieDomain: null },
];

function usage(
  providerId: string,
  displayName: string,
  remainingPercent: number,
): ProviderUsageSnapshot {
  const window = {
    usedPercent: 100 - remainingPercent,
    remainingPercent,
    windowMinutes: null,
    resetsAt: null,
    resetDescription: null,
    isExhausted: false,
    reservePercent: null,
    reserveDescription: null,
  };
  return {
    providerId,
    displayName,
    primary: window,
    selectedMetric: window,
    secondary: null,
    modelSpecific: null,
    tertiary: null,
    extraRateWindows: [],
    cost: null,
    planName: null,
    accountEmail: null,
    sourceLabel: "test",
    updatedAt: "2026-09-04T00:00:00Z",
    error: null,
    errorState: "ready",
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
  };
}

const settings = {
  usageDisplayMode: "remaining",
  providerUsageOverrides: {},
} as SettingsSnapshot;

describe("UsageDisplaySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventMocks.listen.mockResolvedValue(() => {});
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings);
    tauriMocks.setUsageSettings.mockResolvedValue(undefined);
    providerMocks.useProviders.mockReturnValue({
      providers: [usage("codex", "Codex", 34), usage("claude", "Claude", 61)],
      isRefreshing: false,
      refreshingProviderIds: new Set(),
      refresh: vi.fn(),
      lastRefresh: null,
      hasCachedData: true,
      hasLoadedCache: true,
    });
  });

  it("previews current provider data and never substitutes canonical fixture values", async () => {
    render(<UsageDisplaySection providerCatalog={catalog} />);

    await waitFor(() => expect(screen.getByText("34% remaining")).toBeInTheDocument());
    expect(screen.getByText("61% remaining")).toBeInTheDocument();
    expect(screen.queryByText("79% remaining")).not.toBeInTheDocument();
    expect(screen.getByText("Unavailable", { selector: "output" })).toBeInTheDocument();
  });

  it("surfaces a settings-load failure instead of silently swallowing it", async () => {
    tauriMocks.getSettingsSnapshot.mockRejectedValue(new Error("settings unavailable"));

    render(<UsageDisplaySection providerCatalog={catalog} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("settings unavailable");
  });

  it("persists a global mode through the typed bridge", async () => {
    render(<UsageDisplaySection providerCatalog={catalog} />);
    await screen.findByText("34% remaining");

    fireEvent.click(screen.getByRole("radio", { name: "Used" }));

    await waitFor(() => {
      expect(tauriMocks.setUsageSettings).toHaveBeenCalledWith("used", {});
    });
  });
});
