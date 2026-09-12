import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  ProviderCatalogEntry,
  ProviderUsageSnapshot,
  RateWindowSnapshot,
  SettingsSnapshot,
} from "../../../types/bridge";

const hookMocks = vi.hoisted(() => ({
  useProviders: vi.fn(),
  detail: vi.fn(() => null),
}));

vi.mock("../../../hooks/useProviders", () => hookMocks);
vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key }),
  useOptionalLocale: () => ({ t: (key: string) => key }),
}));
vi.mock("../../../lib/tauri", () => ({
  reorderProviders: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../providers/ProviderDetailPane", () => ({
  ProviderDetailPane: hookMocks.detail,
}));

import ProvidersTab from "./ProvidersTab";

function rateWindow(
  usedPercent: number,
  isInformational?: boolean,
): RateWindowSnapshot {
  return {
    usedPercent,
    remainingPercent: 100 - usedPercent,
    windowMinutes: null,
    resetsAt: null,
    resetDescription: null,
    isExhausted: false,
    isInformational,
    reservePercent: null,
    reserveDescription: null,
  };
}

const provider: ProviderCatalogEntry = {
  id: "codex",
  displayName: "Codex",
  cookieDomain: null,
};

const settings = {
  enabledProviders: [provider.id],
  resetTimeRelative: true,
  providerMetrics: {},
} as SettingsSnapshot;

describe("ProvidersTab", () => {
  it("keeps enabled providers visible without a usage snapshot and disables monitoring without deleting accounts",()=>{
    hookMocks.useProviders.mockReturnValue({providers:[]});
    const set=vi.fn();
    render(<ProvidersTab settings={settings} providers={[provider]} set={set} saving={false}/>);
    const toggle=screen.getByRole("switch",{name:"Codex ProviderEnabled"});
    expect(toggle).toBeChecked();
    expect(screen.getByText(/WaitingForUsage/)).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(set).toHaveBeenCalledWith({enabledProviders:[]});
  });
  it("shows the real secondary percentage when the primary is informational", () => {
    const snapshot: ProviderUsageSnapshot = {
      providerId: provider.id,
      displayName: provider.displayName,
      primary: rateWindow(0, true),
      selectedMetric: rateWindow(42),
      secondary: rateWindow(42),
      modelSpecific: null,
      tertiary: null,
      extraRateWindows: [],
      cost: null,
      planName: null,
      accountEmail: null,
      sourceLabel: "auto",
      updatedAt: new Date().toISOString(),
      error: null,
      errorState: "ready",
      pace: null,
      accountOrganization: null,
      trayStatusLabel: null,
    };
    hookMocks.useProviders.mockReturnValue({ providers: [snapshot] });

    render(
      <ProvidersTab
        settings={settings}
        providers={[provider]}
        set={vi.fn()}
        saving={false}
      />,
    );

    expect(screen.getByText("42%")).toBeInTheDocument();
  });
});


it("Demo previews never mount the real credential detail pane or enable provider mutations", () => {
 hookMocks.detail.mockClear();
 hookMocks.useProviders.mockReturnValue({providers: []});
 render(<ProvidersTab settings={{...settings, demoModeEnabled:true,demoProviderCount:1,providerAccentColors:{}}} providers={[provider]} set={vi.fn()} saving={false}/>);
 expect(hookMocks.detail).not.toHaveBeenCalled();
 expect(screen.getByText("ProviderDemoReadOnly")).toBeInTheDocument();
 expect(screen.getByRole("switch",{name:"Codex ProviderEnabled"})).toBeDisabled();
});


