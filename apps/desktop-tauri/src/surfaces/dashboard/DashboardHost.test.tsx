import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BootstrapState } from "../../types/bridge";
vi.mock("./AnalyticsDashboard", () => ({ default: () => <div>Analytics content</div> }));
import DashboardHost from "./DashboardHost";
describe("single Dashboard compatibility", () => {
  it.each(["analytics2d", "providers3d", "hybrid", "spatial", "unknown"])("renders Analytics for persisted %s without changing settings", async (dashboardMode) => {
    const state = {contractVersion: "v1", providers: [], settings: {dashboardMode}} as unknown as BootstrapState;
    render(<DashboardHost state={state} onOpenProviders={vi.fn()} />);
    expect(await screen.findByText("Analytics content")).toBeInTheDocument();
    expect(state.settings.dashboardMode).toBe(dashboardMode);
  });
});
