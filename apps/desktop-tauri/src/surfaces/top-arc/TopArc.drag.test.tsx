import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TopArc from "./TopArc";

const bridge = vi.hoisted(() => ({
  drag: vi.fn(), resize: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../hooks/useStageRuntime", () => ({
  useStageRuntime: () => ({ providers: [], catalog: "01-obsidian-orbit" }),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("../../lib/surfaceBridge", () => ({
  beginQuotaIslandDrag: bridge.drag, resizeTopArc: bridge.resize,
  getSurfaceSettings: vi.fn().mockResolvedValue({
    topArcForm: "orbital", topArcAnchor: "right", topArcScale: 100,
    topArcAutoHide: true, topArcAutoHideDelayMs: 900,
  }),
}));
vi.mock("../flow-surface/FlowSurface", () => ({
  default: ({ state, onStartDrag }: { state: string; onStartDrag: () => void }) =>
    <button onMouseDown={onStartDrag}>{state}</button>,
}));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

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
