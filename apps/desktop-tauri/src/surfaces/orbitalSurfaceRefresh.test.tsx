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
}));

describe("live orbital surface expansion", () => {
  beforeEach(() => runtime.refresh.mockClear());

  it.each([
    ["Top", TopArc, "Expand top orbital notch"],
    ["Edge", EdgeArc, "Expand right edge orbit"],
  ])("does not turn %s expansion into a forced provider refresh", (_name, Surface, label) => {
    render(<Surface />);

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(runtime.refresh).not.toHaveBeenCalled();
  });
});
