import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/event",()=>({listen:vi.fn().mockResolvedValue(()=>{})}));

const bridge = vi.hoisted(() => ({
  getSurfaceSettings: vi.fn(),
  updateSurfaceSettings: vi.fn().mockResolvedValue(undefined),
  resetQuotaIslandPosition: vi.fn().mockResolvedValue(undefined),
}));

const { locale } = vi.hoisted(() => ({
  locale: {
    t: (key: string) =>
      ({ TrayShowEdgeArc: "Show Edge Arc", TrayShowTopArc: "Show Top Arc", TabSurfaces: "Surfaces" } as Record<string, string>)[
        key
      ] ?? key,
  },
}));
vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => locale,
  useOptionalLocale: () => locale,
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
  it("persists interaction toggles and a bounded fold delay",async()=>{
    bridge.getSurfaceSettings.mockResolvedValue({...SETTINGS,topArcEnabled:true,topArcForm:"satellite"});
    render(<SurfacesTab/>);
    fireEvent.click(await screen.findByRole("checkbox",{name:"Show details on hover"}));
    expect(bridge.updateSurfaceSettings).toHaveBeenLastCalledWith({interactions:{hoverDetails:false,wheelCycle:true,autoFold:true,foldDelayMs:500}});
    fireEvent.change(screen.getByRole("spinbutton",{name:"Fold delay (ms)"}),{target:{value:"9000"}});
    expect(bridge.updateSurfaceSettings).toHaveBeenLastCalledWith({interactions:{hoverDetails:false,wheelCycle:true,autoFold:true,foldDelayMs:3000}});
  });
  it("persists size presets and restores default without changing structure", async () => {
    bridge.getSurfaceSettings.mockResolvedValue({...SETTINGS,topArcEnabled:true,topArcForm:"pebble"});
    render(<SurfacesTab/>);
    fireEvent.click(await screen.findByRole("button",{name:"Small · 75%"}));
    expect(bridge.updateSurfaceSettings).toHaveBeenLastCalledWith({topArcScale:75});
    expect(screen.getByRole("slider",{name:"Scale 75"})).toHaveValue("75");
    fireEvent.click(screen.getByRole("button",{name:"Large · 125%"}));
    expect(bridge.updateSurfaceSettings).toHaveBeenLastCalledWith({topArcScale:125});
    fireEvent.click(screen.getByRole("button",{name:"Default · 100%"}));
    expect(bridge.updateSurfaceSettings).toHaveBeenLastCalledWith({topArcScale:100});
  });
  it("shows live range values and exposes every interaction for every structure", async () => {
    bridge.getSurfaceSettings.mockResolvedValue({...SETTINGS,topArcEnabled:true,topArcForm:"flowline"});
    render(<SurfacesTab/>);

    expect(await screen.findByText("95%")).toBeInTheDocument();
    expect(screen.getByText("900 ms")).toBeInTheDocument();
    expect(screen.queryByText("Not available for this structure.")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Show details on hover" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Cycle with the mouse wheel" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Fold details automatically" })).toBeEnabled();

    fireEvent.change(screen.getByRole("slider",{name:"Opacity 95"}),{target:{value:"80"}});
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(bridge.updateSurfaceSettings).toHaveBeenLastCalledWith({topArcOpacity:80});
  });
  it("exposes one bounded Quotalis surface control and persists its visibility", async () => {
    bridge.getSurfaceSettings.mockResolvedValue(SETTINGS);
    render(<SurfacesTab />);

    const island = await screen.findByRole("checkbox", { name: "Show Quotalis Surface" });
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
    // Position is a QuotalisSelect (trigger button, not a native <select>).
    expect(screen.getByLabelText("Quotalis surface position")).toHaveTextContent("Top");
  });

  it("offers true wall docking for compact orbital structures", async () => {
    bridge.getSurfaceSettings.mockResolvedValue({ ...SETTINGS, topArcEnabled: true, topArcForm: "orbital", topArcAnchor: "right" });
    render(<SurfacesTab />);

    const position = await screen.findByLabelText("Quotalis surface position");
    expect(position).toHaveTextContent("Right wall");
    // The option list only exists once the trigger opens it (portal-rendered).
    fireEvent.click(position);
    expect(await screen.findByRole("option", { name: "Right wall" })).toBeInTheDocument();
  });

  it("offers Lens as a bounded capsule structure with side-wall placement", async () => {
    bridge.getSurfaceSettings.mockResolvedValue({ ...SETTINGS, topArcEnabled: true, topArcForm: "lens", topArcAnchor: "left" });
    render(<SurfacesTab />);

    expect(await screen.findByRole("button", { name: /Lens/ })).toBeInTheDocument();
    const position = screen.getByLabelText("Quotalis surface position");
    expect(position).toHaveTextContent("Left wall");
    fireEvent.click(position);
    expect(await screen.findByRole("option", { name: "Left wall" })).toBeInTheDocument();
  });
});
