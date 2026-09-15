import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../i18n/LocaleProvider";
import { buildBundle } from "../../test/localeHarness";

const tauriMocks = vi.hoisted(() => ({
  isDevChannel: vi.fn(),
  updateSettings: vi.fn().mockResolvedValue(undefined),
  getLocaleStrings: vi.fn(),
  setUiLanguage: vi.fn().mockResolvedValue(undefined),
}));
const bridgeMocks = vi.hoisted(() => ({
  showTopArc: vi.fn().mockResolvedValue(undefined),
  updateSurfaceSettings: vi.fn().mockResolvedValue(undefined),
}));
const qaFixtureMocks = vi.hoisted(() => ({
  fixture: null as Record<string, unknown> | null,
  set: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/tauri", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/tauri")>()),
  ...tauriMocks,
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("../../lib/surfaceBridge", () => bridgeMocks);
vi.mock("../../hooks/useStructureQaFixture", () => ({
  useStructureQaFixture: () => ({ fixture: qaFixtureMocks.fixture, set: qaFixtureMocks.set, reset: qaFixtureMocks.reset, error: null }),
}));

import StructureQaController from "./StructureQaController";

function renderController() {
  tauriMocks.getLocaleStrings.mockResolvedValue(buildBundle({}, "english"));
  return render(
    <LocaleProvider>
      <StructureQaController />
    </LocaleProvider>,
  );
}

describe("StructureQaController (Wave 1F §22-30)", () => {
  afterEach(() => {
    qaFixtureMocks.fixture = null;
    vi.clearAllMocks();
  });

  it("renders the Dev-only unavailable message, not the controls, when isDevChannel resolves false", async () => {
    tauriMocks.isDevChannel.mockResolvedValue(false);
    renderController();
    expect(await screen.findByRole("alert")).toHaveTextContent("StructureQaUnavailable");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders the full control set when isDevChannel resolves true", async () => {
    tauriMocks.isDevChannel.mockResolvedValue(true);
    renderController();
    expect(await screen.findByRole("main")).toBeInTheDocument();
    expect(screen.getByLabelText("StructureQaStructure")).toBeInTheDocument();
    expect(screen.getByLabelText("StructureQaProviderCount")).toBeInTheDocument();
    expect(screen.getByLabelText("StructureQaData")).toBeInTheDocument();
  });

  it("changing provider count writes through the real set_structure_qa_fixture command", async () => {
    tauriMocks.isDevChannel.mockResolvedValue(true);
    renderController();
    await screen.findByRole("main");
    fireEvent.change(screen.getByLabelText("StructureQaProviderCount"), { target: { value: "24" } });
    await act(async () => {});
    expect(qaFixtureMocks.set).toHaveBeenCalledWith(expect.objectContaining({ providerCount: 24 }));
  });

  it("changing the structure form drives the real native window via update_surface_settings + showTopArc", async () => {
    tauriMocks.isDevChannel.mockResolvedValue(true);
    renderController();
    await screen.findByRole("main");
    fireEvent.change(screen.getByLabelText("StructureQaStructure"), { target: { value: "reel" } });
    await act(async () => {});
    expect(bridgeMocks.updateSurfaceSettings).toHaveBeenCalledWith(
      expect.objectContaining({ topArcEnabled: true, topArcForm: "reel" }),
    );
    expect(bridgeMocks.showTopArc).toHaveBeenCalled();
  });

  it("the Reset button clears the fixture and restores the default placement", async () => {
    tauriMocks.isDevChannel.mockResolvedValue(true);
    qaFixtureMocks.fixture = { providerCount: 70, nameLength: "long", resetLength: "long", windows: 2, dataState: "error", pinned: true };
    renderController();
    await screen.findByRole("main");
    fireEvent.click(screen.getByRole("button", { name: "StructureQaReset" }));
    await act(async () => {});
    expect(qaFixtureMocks.reset).toHaveBeenCalled();
    expect(bridgeMocks.updateSurfaceSettings).toHaveBeenCalledWith(
      expect.objectContaining({ topArcForm: "seam", topArcAnchor: "right", topArcScale: 100 }),
    );
  });

  it("real language switching is available here (unlike the browser-only demo route, which is stubbed)", async () => {
    tauriMocks.isDevChannel.mockResolvedValue(true);
    renderController();
    await screen.findByRole("main");
    const languageSelect = screen.getByLabelText("StructureQaLanguage");
    fireEvent.change(languageSelect, { target: { value: "arabic" } });
    await act(async () => {});
    expect(tauriMocks.setUiLanguage).toHaveBeenCalledWith("arabic");
  });
});
