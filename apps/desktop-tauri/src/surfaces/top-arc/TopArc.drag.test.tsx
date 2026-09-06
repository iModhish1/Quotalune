import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TopArc from "./TopArc";

const bridge = vi.hoisted(() => ({
  drag: vi.fn(), resize: vi.fn().mockResolvedValue(undefined),
  settings: {
    topArcForm: "orbital", topArcAnchor: "right", topArcScale: 100,
    topArcAutoHide: true, topArcAutoHideDelayMs: 900,
    interactions: { hoverDetails: true, wheelCycle: true, autoFold: true, foldDelayMs: 500 },
  },
  providers: [] as Array<Record<string, unknown>>,
}));
vi.mock("../../hooks/useStageRuntime", () => ({
  useStageRuntime: () => ({ providers: bridge.providers, catalog: "01-obsidian-orbit" }),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("../../lib/surfaceBridge", () => ({
  beginQuotaIslandDrag: bridge.drag, resizeTopArc: bridge.resize,
  getSurfaceSettings: vi.fn().mockImplementation(() => Promise.resolve(bridge.settings)),
}));
vi.mock("../flow-surface/FlowSurface", () => ({
  default: ({ state, onStartDrag }: { state: string; onStartDrag: () => void }) =>
    <button onMouseDown={onStartDrag}>{state}</button>,
}));
afterEach(() => {
  bridge.providers.length = 0;
  Object.assign(bridge.settings, {
    topArcForm: "orbital", topArcAnchor: "right", topArcScale: 100,
    topArcAutoHide: true, topArcAutoHideDelayMs: 900,
    interactions: { hoverDetails: true, wheelCycle: true, autoFold: true, foldDelayMs: 500 },
  });
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("does not hide or resize during a native drag, then resumes after release", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  bridge.drag.mockReturnValue(new Promise<void>((resolve) => { release = resolve; }));
  const { container } = render(<TopArc />);
  await act(async () => {});
  const host = container.firstChild as HTMLElement;
  fireEvent.mouseEnter(host);
  expect(screen.getByRole("button").textContent).toBe("hover");
  fireEvent.mouseDown(screen.getByRole("button"));
  bridge.resize.mockClear();
  fireEvent.mouseLeave(host);
  await act(async () => { vi.advanceTimersByTime(10_000); });
  expect(screen.getByRole("button").textContent).toBe("hover");
  expect(bridge.resize).not.toHaveBeenCalled();
  await act(async () => { release(); });
  await act(async () => { vi.advanceTimersByTime(901); });
  expect(screen.getByRole("button").textContent).toBe("hidden");
});

it("reveals and folds details for a non-notch structure using the shared interaction settings", async () => {
  vi.useFakeTimers();
  bridge.providers.push({
    id: "codex", name: "Codex", iconId: "codex", resolvedMode: "remaining",
    arcFraction: 0.74, primaryValue: 74, secondaryValue: 26,
    primaryLabel: "remaining", reset: "3h", status: "ok",
  });
  const { container } = render(<TopArc />);
  await act(async () => {});
  const host = container.firstChild as HTMLElement;
  fireEvent.mouseEnter(host);
  expect(screen.getByRole("button").textContent).toBe("expanded");
  fireEvent.mouseLeave(host);
  await act(async () => { vi.advanceTimersByTime(499); });
  expect(screen.getByRole("button").textContent).toBe("expanded");
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(screen.getByRole("button").textContent).toBe("compact");
});

it("keeps hover reveal and auto-fold independently disableable", async () => {
  vi.useFakeTimers();
  bridge.providers.push({
    id: "codex", name: "Codex", iconId: "codex", resolvedMode: "remaining",
    arcFraction: 0.74, primaryValue: 74, secondaryValue: 26,
    primaryLabel: "remaining", reset: "3h", status: "ok",
  });
  bridge.settings.interactions = { hoverDetails: false, wheelCycle: true, autoFold: false, foldDelayMs: 500 };
  const { container } = render(<TopArc />);
  await act(async () => {});
  const host = container.firstChild as HTMLElement;
  fireEvent.mouseEnter(host);
  expect(screen.getByRole("button").textContent).toBe("hover");
  fireEvent.mouseLeave(host);
  await act(async () => { vi.advanceTimersByTime(10_000); });
  expect(screen.getByRole("button").textContent).toBe("hidden");
});
