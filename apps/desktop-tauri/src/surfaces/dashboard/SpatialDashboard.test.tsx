import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProviderUsageSnapshot, SettingsSnapshot, BootstrapState } from "../../types/bridge";

const providersMock = vi.hoisted(() => ({ providers: [] as ProviderUsageSnapshot[] }));
const settingsMock = vi.hoisted(() => ({ settings: {} as SettingsSnapshot }));
const sceneSpy = vi.hoisted(() => vi.fn());

vi.mock("../../hooks/useProviders", () => ({
  useProviders: () => providersMock,
}));
vi.mock("../../hooks/useSettings", () => ({
  useSettings: () => settingsMock,
}));
vi.mock("./spatial/SpatialObservatoryScene", () => ({
  default: (props: { liveProviders: ProviderUsageSnapshot[] }) => {
    sceneSpy(props.liveProviders);
    return null;
  },
}));

import SpatialDashboard from "./SpatialDashboard";

function provider(id: string): ProviderUsageSnapshot {
  return {
    providerId: id,
    displayName: id,
    primary: {
      usedPercent: 10,
      remainingPercent: 90,
      windowMinutes: null,
      resetsAt: null,
      resetDescription: null,
      isExhausted: false,
      reservePercent: null,
      reserveDescription: null,
    },
    selectedMetric: {
      usedPercent: 10,
      remainingPercent: 90,
      windowMinutes: null,
      resetsAt: null,
      resetDescription: null,
      isExhausted: false,
      reservePercent: null,
      reserveDescription: null,
    },
    primaryLabel: "Session",
    secondary: null,
    modelSpecific: null,
    tertiary: null,
    extraRateWindows: [],
    cost: null,
    planName: null,
    accountEmail: null,
    sourceLabel: "CLI",
    updatedAt: new Date().toISOString(),
    error: null,
    errorState: "ready",
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
    fetchDurationMs: null,
  };
}

function bootstrapState(): BootstrapState {
  return { contractVersion: "v1", providers: [], settings: settingsMock.settings };
}

describe("SpatialDashboard", () => {
  /** Same real gap Providers3DDashboard was fixed for (see its own test
   *  file): `useProviders()`'s global cache is not scoped to the active
   *  profile's `enabledProviders` -- every real provider-list surface
   *  must filter at the point of use, and Spatial reuses that exact
   *  filtering rule rather than a second copy that could drift. */
  it("filters liveProviders down to settings.enabledProviders", () => {
    providersMock.providers = [provider("codex"), provider("claude")];
    settingsMock.settings = { enabledProviders: [] } as unknown as SettingsSnapshot;

    render(<SpatialDashboard state={bootstrapState()} onOpenProviders={vi.fn()} onSwitchToAnalytics2D={vi.fn()} />);

    expect(sceneSpy).toHaveBeenCalledWith([]);
  });

  it("passes through only the providers enabled by the active profile", () => {
    providersMock.providers = [provider("codex"), provider("claude"), provider("cursor")];
    settingsMock.settings = { enabledProviders: ["claude", "cursor"] } as unknown as SettingsSnapshot;

    render(<SpatialDashboard state={bootstrapState()} onOpenProviders={vi.fn()} onSwitchToAnalytics2D={vi.fn()} />);

    const calls = sceneSpy.mock.calls;
    const passed = calls[calls.length - 1][0] as ProviderUsageSnapshot[];
    expect(passed.map((p) => p.providerId).sort()).toEqual(["claude", "cursor"]);
  });
});
