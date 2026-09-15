import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AnalyticsDashboard from "./AnalyticsDashboard";
import type { BootstrapState } from "../../types/bridge";

vi.mock("../../hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key, language: "english", direction: "ltr" }),
  useOptionalLocale: () => null,
}));
vi.mock("../../hooks/useSettings", () => ({
  useSettings: () => ({ settings: {}, update: vi.fn() }),
}));
vi.mock("./analytics/DashboardAnalyticsPanel", () => ({
  default: () => <div>analytics panel</div>,
}));

const useEffectiveProvidersMock = vi.fn();
vi.mock("../../hooks/useEffectiveProviders", () => ({
  useEffectiveProviders: (...args: unknown[]) => useEffectiveProvidersMock(...args),
}));
vi.mock("../../hooks/useDashboardState", () => ({
  useDashboardState: () => ({ sorted: [] }),
}));

const emptyState = {} as BootstrapState;

describe("AnalyticsDashboard empty state (Wave 1F §4/§5)", () => {
  it("shows the real loading treatment (not 'no providers configured') while the first fetch hasn't resolved yet", () => {
    useEffectiveProvidersMock.mockReturnValue({ providers: [], provenance: "live", hasLoadedCache: false });
    render(<AnalyticsDashboard state={emptyState} onOpenProviders={vi.fn()} />);
    expect(screen.getByText("FetchingProviderData")).toBeInTheDocument();
    expect(screen.queryByText("NoProvidersConfigured")).not.toBeInTheDocument();
  });

  it("shows 'no providers configured' once the cache has genuinely resolved to empty", () => {
    useEffectiveProvidersMock.mockReturnValue({ providers: [], provenance: "live", hasLoadedCache: true });
    render(<AnalyticsDashboard state={emptyState} onOpenProviders={vi.fn()} />);
    expect(screen.getByText("NoProvidersConfigured")).toBeInTheDocument();
    expect(screen.queryByText("FetchingProviderData")).not.toBeInTheDocument();
  });
});
