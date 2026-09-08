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
vi.mock("./providers3d/ProvidersUniverseScene", () => ({
  default: (props: { liveProviders: ProviderUsageSnapshot[] }) => {
    sceneSpy(props.liveProviders);
    return null;
  },
}));

import Providers3DDashboard from "./Providers3DDashboard";

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

describe("Providers3DDashboard", () => {
  /**
   * Regression test for a real gap found via native CDP proof (Phase 5.1
   * follow-up, docs/validation/PHASE5_3D_PROTOTYPE.md): `useProviders()`
   * returns the backend's global provider cache, which is NOT scoped to
   * the active profile's `enabledProviders` -- switching to a profile
   * with a different (or empty) account set does not clear or re-filter
   * that cache. Every other real provider-list surface (FloatBar,
   * useTrayPanelController) already filters by `settings.enabledProviders`
   * at the point of use; this component didn't.
   */
  it("filters liveProviders down to settings.enabledProviders (a profile with zero accounts shows zero providers, not the stale cache)", () => {
    providersMock.providers = [provider("codex"), provider("claude")];
    settingsMock.settings = { enabledProviders: [] } as unknown as SettingsSnapshot;

    render(<Providers3DDashboard state={bootstrapState()} onOpenProviders={vi.fn()} onSwitchToAnalytics2D={vi.fn()} />);

    expect(sceneSpy).toHaveBeenCalledWith([]);
  });

  it("passes through only the providers enabled by the active profile", () => {
    providersMock.providers = [provider("codex"), provider("claude"), provider("cursor")];
    settingsMock.settings = { enabledProviders: ["claude", "cursor"] } as unknown as SettingsSnapshot;

    render(<Providers3DDashboard state={bootstrapState()} onOpenProviders={vi.fn()} onSwitchToAnalytics2D={vi.fn()} />);

    const calls = sceneSpy.mock.calls;
    const passed = calls[calls.length - 1][0] as ProviderUsageSnapshot[];
    expect(passed.map((p) => p.providerId).sort()).toEqual(["claude", "cursor"]);
  });
});
