import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TopArc from "./TopArc";

const bridge = vi.hoisted(() => ({
  settings: {
    topArcForm: "orbital", topArcAnchor: "right", topArcScale: 100,
    topArcAutoHide: true, topArcAutoHideDelayMs: 900,
    interactions: { hoverDetails: true, wheelCycle: true, autoFold: true, foldDelayMs: 500 },
  },
}));
const qaFixtureMock = vi.hoisted(() => ({ fixture: null as Record<string, unknown> | null }));

vi.mock("../../hooks/useStageRuntime", () => ({
  useStageRuntime: () => ({ providers: [], catalog: "01-obsidian-orbit", initialLoading: false, isRefreshing: false }),
}));
vi.mock("../../hooks/useStructureQaFixture", () => ({
  useStructureQaFixture: () => ({ fixture: qaFixtureMock.fixture, set: vi.fn(), reset: vi.fn(), error: null }),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("../../lib/surfaceBridge", () => ({
  beginQuotaIslandDrag: vi.fn(), resizeTopArc: vi.fn().mockResolvedValue(undefined),
  getSurfaceSettings: vi.fn().mockImplementation(() => Promise.resolve(bridge.settings)),
}));
vi.mock("../flow-surface/FlowSurface", () => ({
  default: ({ state, providers, demoMode, initialLoading, isRefreshing }: {
    state: string; providers: Array<{ id: string }>; demoMode: boolean; initialLoading: boolean; isRefreshing: boolean;
  }) => (
    <div
      data-state={state}
      data-provider-count={providers.length}
      data-demo={String(demoMode)}
      data-initial-loading={String(initialLoading)}
      data-is-refreshing={String(isRefreshing)}
    />
  ),
}));

afterEach(() => {
  qaFixtureMock.fixture = null;
  vi.clearAllMocks();
});

it("Wave 1F §25: drives the real Flow Surface with fixture-generated providers when a QA fixture is active", async () => {
  qaFixtureMock.fixture = {
    providerCount: 12, nameLength: "normal", resetLength: "normal", windows: 1, dataState: "available", pinned: false,
  };
  const { container } = render(<TopArc />);
  await act(async () => {});
  const surface = container.querySelector("[data-provider-count]")!;
  expect(surface).toHaveAttribute("data-provider-count", "12");
  expect(surface).toHaveAttribute("data-demo", "true");
});

it("forces state=pinned when the fixture's pinned flag is set", async () => {
  qaFixtureMock.fixture = {
    providerCount: 3, nameLength: "normal", resetLength: "normal", windows: 1, dataState: "available", pinned: true,
  };
  const { container } = render(<TopArc />);
  await act(async () => {});
  expect(container.querySelector("[data-state]")).toHaveAttribute("data-state", "pinned");
});

it("maps dataState=loading/refreshing to the real initialLoading/isRefreshing props", async () => {
  qaFixtureMock.fixture = {
    providerCount: 3, nameLength: "normal", resetLength: "normal", windows: 1, dataState: "loading", pinned: false,
  };
  const { container, rerender } = render(<TopArc />);
  await act(async () => {});
  expect(container.querySelector("[data-initial-loading]")).toHaveAttribute("data-initial-loading", "true");

  qaFixtureMock.fixture = { ...qaFixtureMock.fixture, dataState: "refreshing" };
  rerender(<TopArc />);
  await act(async () => {});
  expect(container.querySelector("[data-is-refreshing]")).toHaveAttribute("data-is-refreshing", "true");
});

it("falls back to real production providers when no fixture is active (inert in Personal/stable, where the fixture is always null)", async () => {
  qaFixtureMock.fixture = null;
  const { container } = render(<TopArc />);
  await act(async () => {});
  expect(container.querySelector("[data-demo]")).toHaveAttribute("data-demo", "false");
});
