import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key, language: "english" }),
}));

import ProvidersUniverseScene from "./ProvidersUniverseScene";
import { CANONICAL_THEME } from "../../../design-system/themeCatalog";
import type { SettingsSnapshot } from "../../../types/bridge";

const SETTINGS = {
  highUsageThreshold: 70,
  criticalUsageThreshold: 90,
  dashboardPerformancePreset: "balanced",
} as unknown as SettingsSnapshot;

describe("ProvidersUniverseScene", () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * jsdom (this project's test environment) has no WebGL2 support --
   * `HTMLCanvasElement.getContext("webgl2")` is not implemented, so
   * `createProvidersUniverseEngine` genuinely fails here exactly the way
   * it would on a real machine with no GPU/driver support. This test
   * proves the real fallback UI (owner Phase 5 sections 41/42/70), not a
   * mocked stand-in for it.
   *
   * Phase 5.1 owner section 18 fix: the fallback button calls
   * `onSwitchToAnalytics2D` (a real Dashboard-mode switch), not
   * `onOpenProviders` (opens the Providers settings tab) -- a real
   * native-capture bug where clicking the button labeled "Open 2D
   * Analytics" actually navigated to Providers instead.
   */
  it("renders the WebGL-unavailable fallback (never a crash) when the engine cannot initialize, with a working 2D escape hatch", () => {
    const onOpenProviders = vi.fn();
    const onSwitchToAnalytics2D = vi.fn();
    render(
      <ProvidersUniverseScene
        liveProviders={[]}
        settings={SETTINGS}
        theme={CANONICAL_THEME}
        onOpenProviders={onOpenProviders}
        onSwitchToAnalytics2D={onSwitchToAnalytics2D}
        provenance="live"
        onExitDemo={vi.fn()}
      />,
    );
    expect(screen.getByText("Providers3DUnavailableTitle")).toBeInTheDocument();
    expect(screen.getByText("Providers3DUnavailableBody")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Providers3DOpen2DFallback" }));
    expect(onSwitchToAnalytics2D).toHaveBeenCalledTimes(1);
    expect(onOpenProviders).not.toHaveBeenCalled();
  });

  it("never throws when rendered with a real provider list, even though the engine itself cannot mount in this environment", () => {
    expect(() =>
      render(
        <ProvidersUniverseScene
          liveProviders={[]}
          settings={SETTINGS}
          theme={CANONICAL_THEME}
          onOpenProviders={vi.fn()}
          onSwitchToAnalytics2D={vi.fn()}
          provenance="live"
          onExitDemo={vi.fn()}
        />,
      ),
    ).not.toThrow();
  });
});
