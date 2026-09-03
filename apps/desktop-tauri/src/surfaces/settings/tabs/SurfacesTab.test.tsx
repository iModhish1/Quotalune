import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  getSurfaceSettings: vi.fn(),
  updateSurfaceSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string) =>
      ({ TrayShowEdgeArc: "Show Edge Arc", TrayShowTopArc: "Show Top Arc", TabSurfaces: "Surfaces" })[
        key
      ] ?? key,
  }),
}));

vi.mock("../../../lib/surfaceBridge", () => ({
  getSurfaceSettings: bridge.getSurfaceSettings,
  updateSurfaceSettings: bridge.updateSurfaceSettings,
}));

import SurfacesTab from "./SurfacesTab";

const SETTINGS = {
  edgeArcEnabled: false,
  edgeArcSide: "right",
  edgeArcOpacity: 95,
  edgeArcScale: 100,
  edgeArcClickThrough: false,
  edgeArcHideFullscreen: false,
  topArcEnabled: false,
  topArcOpacity: 95,
  topArcScale: 100,
  topArcClickThrough: false,
  topArcHideFullscreen: false,
  taskbarArcEnabled: false,
  taskbarArcOpacity: 95,
  taskbarArcClickThrough: false,
  taskbarArcHideFullscreen: false,
} as const;

describe("SurfacesTab", () => {
  it("exposes named toggles for every detached arc and enables Taskbar Arc", async () => {
    bridge.getSurfaceSettings.mockResolvedValue(SETTINGS);
    render(<SurfacesTab />);

    const taskbar = await screen.findByRole("checkbox", { name: "Show Taskbar Arc" });
    expect(screen.getByRole("checkbox", { name: "Show Edge Arc" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Show Top Arc" })).toBeInTheDocument();

    fireEvent.click(taskbar);
    await waitFor(() =>
      expect(bridge.updateSurfaceSettings).toHaveBeenCalledWith({ taskbarArcEnabled: true }),
    );
  });
});
