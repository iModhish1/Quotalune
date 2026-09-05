import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  getSurfaceSettings: vi.fn(),
  updateSurfaceSettings: vi.fn().mockResolvedValue(undefined),
  resetQuotaIslandPosition: vi.fn().mockResolvedValue(undefined),
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
  resetQuotaIslandPosition: bridge.resetQuotaIslandPosition,
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
  topArcPlacement: "top-center",
  topArcForm: "flowline",
  topArcAnchor: "right",
  topArcAutoHide: true,
  topArcAutoHideDelayMs: 900,
  topArcClickThrough: false,
  topArcHideFullscreen: false,
  taskbarArcEnabled: false,
  taskbarArcOpacity: 95,
  taskbarArcClickThrough: false,
  taskbarArcHideFullscreen: false,
} as const;

describe("SurfacesTab", () => {
  it("exposes one bounded QuotaArc surface control and persists its visibility", async () => {
    bridge.getSurfaceSettings.mockResolvedValue(SETTINGS);
    render(<SurfacesTab />);

    const island = await screen.findByRole("checkbox", { name: "Show QuotaArc Surface" });
    expect(screen.queryByRole("checkbox", { name: "Show Edge Arc" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Show Taskbar Arc" })).not.toBeInTheDocument();

    fireEvent.click(island);
    await waitFor(() =>
      expect(bridge.updateSurfaceSettings).toHaveBeenCalledWith({ topArcEnabled: true }),
    );
  });

  it("changes a form and its valid anchor together", async () => {
    bridge.getSurfaceSettings.mockResolvedValue({ ...SETTINGS, topArcEnabled: true });
    render(<SurfacesTab />);

    fireEvent.click(await screen.findByRole("button", { name: /Horizon/ }));

    await waitFor(() => expect(bridge.updateSurfaceSettings).toHaveBeenCalledWith({
      topArcForm: "horizon",
      topArcAnchor: "top",
    }));
    expect(screen.getByRole("combobox", { name: "QuotaArc surface position" })).toHaveValue("top");
  });
});
