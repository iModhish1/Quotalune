import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key, language: "english" }),
}));

import SpatialObservatoryScene from "./SpatialObservatoryScene";
import { CANONICAL_THEME } from "../../../design-system/themeCatalog";
import type { ProviderUsageSnapshot, SettingsSnapshot } from "../../../types/bridge";

const SETTINGS = {
  highUsageThreshold: 70,
  criticalUsageThreshold: 90,
  dashboardPerformancePreset: "balanced",
} as unknown as SettingsSnapshot;

function provider(id: string, usedPercent = 40): ProviderUsageSnapshot {
  return {
    providerId: id,
    displayName: id,
    primary: {
      usedPercent,
      remainingPercent: 100 - usedPercent,
      windowMinutes: null,
      resetsAt: null,
      resetDescription: null,
      isExhausted: false,
      reservePercent: null,
      reserveDescription: null,
    },
    selectedMetric: {
      usedPercent,
      remainingPercent: 100 - usedPercent,
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

describe("SpatialObservatoryScene", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never throws and creates zero WebGL/canvas surfaces (owner section 47: DOM/SVG/CSS only)", () => {
    const { container } = render(
      <SpatialObservatoryScene
        liveProviders={[provider("codex"), provider("claude")]}
        settings={SETTINGS}
        theme={CANONICAL_THEME}
        onOpenProviders={vi.fn()}
        provenance="live"
        onExitDemo={vi.fn()}
      />,
    );
    expect(container.querySelectorAll("canvas")).toHaveLength(0);
  });

  it("renders one instrument node per provider", () => {
    render(
      <SpatialObservatoryScene
        liveProviders={[provider("codex"), provider("claude"), provider("gemini")]}
        settings={SETTINGS}
        theme={CANONICAL_THEME}
        onOpenProviders={vi.fn()}
        provenance="live"
        onExitDemo={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("selects a provider via the navigator and shows the shared detail panel", () => {
    render(
      <SpatialObservatoryScene
        liveProviders={[provider("codex"), provider("claude")]}
        settings={SETTINGS}
        theme={CANONICAL_THEME}
        onOpenProviders={vi.fn()}
        provenance="live"
        onExitDemo={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("provider-detail-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /claude/i }));
    expect(screen.getByTestId("provider-detail-panel")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /claude/i })).toHaveAttribute("aria-selected", "true");
  });

  it("supports arrow-key navigation and Escape to deselect from the navigator list", () => {
    render(
      <SpatialObservatoryScene
        liveProviders={[provider("claude"), provider("codex")]}
        settings={SETTINGS}
        theme={CANONICAL_THEME}
        onOpenProviders={vi.fn()}
        provenance="live"
        onExitDemo={vi.fn()}
      />,
    );
    const list = screen.getByRole("navigation").querySelector("ul")!;
    fireEvent.click(screen.getByRole("button", { name: /^claude/i }));
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(screen.getByTestId("provider-detail-panel")).toHaveTextContent("codex");
    fireEvent.keyDown(list, { key: "Escape" });
    expect(screen.queryByTestId("provider-detail-panel")).not.toBeInTheDocument();
  });

  it("shows the DEMO indicator only when provenance is demo, never for real data", () => {
    const { rerender } = render(
      <SpatialObservatoryScene
        liveProviders={[provider("codex")]}
        settings={SETTINGS}
        theme={CANONICAL_THEME}
        onOpenProviders={vi.fn()}
        provenance="live"
        onExitDemo={vi.fn()}
      />,
    );
    expect(screen.queryByText("DemoIndicatorBadge")).not.toBeInTheDocument();

    rerender(
      <SpatialObservatoryScene
        liveProviders={[provider("codex")]}
        settings={SETTINGS}
        theme={CANONICAL_THEME}
        onOpenProviders={vi.fn()}
        provenance="demo"
        onExitDemo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /codex/i }));
    expect(screen.getByTestId("provider-detail-panel")).toHaveTextContent("DemoIndicatorBadge");
  });

  it("renders the empty state and manage-providers escape hatch when there are no providers", () => {
    const onOpenProviders = vi.fn();
    render(
      <SpatialObservatoryScene
        liveProviders={[]}
        settings={SETTINGS}
        theme={CANONICAL_THEME}
        onOpenProviders={onOpenProviders}
        provenance="live"
        onExitDemo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Providers3DManageProviders" }));
    expect(onOpenProviders).toHaveBeenCalledTimes(1);
  });
});
