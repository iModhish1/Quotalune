import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BootstrapState } from "../../types/bridge";

const mountLog: string[] = [];
const unmountLog: string[] = [];

function trackedMode(name: string) {
  return function TrackedMode() {
    useEffect(() => {
      mountLog.push(name);
      return () => {
        unmountLog.push(name);
      };
    }, []);
    return <div data-testid={`mode-${name}`}>{name} content</div>;
  };
}

vi.mock("./AnalyticsDashboard", () => ({ default: trackedMode("analytics2d") }));
vi.mock("./Providers3DDashboard", () => ({ default: trackedMode("providers3d") }));
vi.mock("./HybridDashboard", () => ({
  default: () => {
    throw new Error("hybrid boom");
  },
}));

import DashboardHost from "./DashboardHost";

function bootstrapState(): BootstrapState {
  return { contractVersion: "v1", providers: [], settings: {} as never };
}

describe("DashboardHost", () => {
  it("mounts only the selected mode", async () => {
    render(
      <DashboardHost
        mode="analytics2d"
        state={bootstrapState()}
        onOpenProviders={vi.fn()}
        onSwitchToDefault={vi.fn()}
      />,
    );
    expect(await screen.findByTestId("mode-analytics2d")).toBeInTheDocument();
    expect(screen.queryByTestId("mode-providers3d")).not.toBeInTheDocument();
  });

  it("unmounts the old mode and mounts the new one on switch", async () => {
    mountLog.length = 0;
    unmountLog.length = 0;
    const { rerender } = render(
      <DashboardHost
        mode="analytics2d"
        state={bootstrapState()}
        onOpenProviders={vi.fn()}
        onSwitchToDefault={vi.fn()}
      />,
    );
    await screen.findByTestId("mode-analytics2d");

    rerender(
      <DashboardHost
        mode="providers3d"
        state={bootstrapState()}
        onOpenProviders={vi.fn()}
        onSwitchToDefault={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.queryByTestId("mode-analytics2d")).not.toBeInTheDocument());
    expect(await screen.findByTestId("mode-providers3d")).toBeInTheDocument();
    expect(unmountLog).toContain("analytics2d");
    expect(mountLog).toContain("providers3d");
  });

  it("falls back to 2D Analytics for an invalid stored mode", async () => {
    render(
      <DashboardHost
        mode={"legacy3d" as never}
        state={bootstrapState()}
        onOpenProviders={vi.fn()}
        onSwitchToDefault={vi.fn()}
      />,
    );
    expect(await screen.findByTestId("mode-analytics2d")).toBeInTheDocument();
  });

  it("isolates a mode's render failure behind an error boundary with a switch-back action", async () => {
    const onSwitchToDefault = vi.fn();
    render(
      <DashboardHost
        mode="hybrid"
        state={bootstrapState()}
        onOpenProviders={vi.fn()}
        onSwitchToDefault={onSwitchToDefault}
      />,
    );
    expect(await screen.findByText(/Unable to load Hybrid Dashboard/)).toBeInTheDocument();
    screen.getByRole("button", { name: "Switch to 2D Analytics" }).click();
    expect(onSwitchToDefault).toHaveBeenCalledTimes(1);
  });
});
