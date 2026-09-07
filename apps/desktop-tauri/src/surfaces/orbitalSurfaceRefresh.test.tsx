import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EdgeArc from "./edge-arc/EdgeArc";
import TopArc from "./top-arc/TopArc";

const runtime = vi.hoisted(() => ({
  refresh: vi.fn(),
  providers: [
    {
      id: "codex",
      name: "Codex",
      iconId: "openai",
      resolvedMode: "remaining",
      arcFraction: 0.79,
      primaryValue: 79,
      secondaryValue: 21,
      primaryLabel: "remaining",
      reset: "4h 12m",
      status: "ok",
    },
  ],
}));

vi.mock("../hooks/useStageRuntime", () => ({
  useStageRuntime: () => ({
    catalog: "01-obsidian-orbit",
    catalogSource: "global",
    providers: runtime.providers,
    settingsError: null,
    refresh: runtime.refresh,
    isRefreshing: false,
  }),
}));

vi.mock("../lib/surfaceBridge", () => ({
  resizeEdgeArc: vi.fn().mockResolvedValue(undefined),
  resizeTopArc: vi.fn().mockResolvedValue(undefined),
  getSurfaceSettings: vi.fn().mockResolvedValue({
    topArcForm: "flowline",
    topArcAnchor: "right",
    topArcScale: 100,
    topArcAutoHide: true,
    topArcAutoHideDelayMs: 900,
  }),
  beginQuotaIslandDrag: vi.fn().mockResolvedValue(undefined),
}));

describe("live orbital surface expansion", () => {
  beforeEach(() => runtime.refresh.mockClear());

  it.each([
    ["Quota Island", TopArc, "Expand Codex details"],
    ["Edge", EdgeArc, "Expand right edge orbit"],
  ])("does not turn %s expansion into a forced provider refresh", async (_name, Surface, label) => {
    render(<Surface />);

    const reveal = screen.queryByRole("button", { name: "Reveal Quotalis" });
    if (reveal) fireEvent.click(reveal);
    fireEvent.click(await screen.findByRole("button", { name: label }));

    expect(runtime.refresh).not.toHaveBeenCalled();
  });
});
