import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StageProvider } from "../../components/orbit/stageTypes";
import QuotaIsland from "./QuotaIsland";

const providers: StageProvider[] = [
  {
    id: "codex", name: "Codex", iconId: "openai", resolvedMode: "remaining",
    arcFraction: 0.79, primaryValue: 79, secondaryValue: 21, primaryLabel: "remaining",
    reset: "3h 40m", status: "ok",
  },
  {
    id: "claude", name: "Claude", iconId: "claude", resolvedMode: "remaining",
    arcFraction: 0.27, primaryValue: 27, secondaryValue: 73, primaryLabel: "remaining",
    reset: "26h", status: "attention",
  },
];

describe("QuotaIsland", () => {
  it("keeps compact mode to one concise trigger", () => {
    render(<QuotaIsland catalog="01-obsidian-orbit" state="compact" providers={providers} />);

    expect(screen.getByRole("button", { name: "Expand quota details" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Quota details" })).not.toBeInTheDocument();
    expect(screen.getByText("79%")).toBeInTheDocument();
  });

  it("renders provider details only when expanded and delegates focus", () => {
    const onFocusProvider = vi.fn();
    const onRequestCompact = vi.fn();
    render(
      <QuotaIsland
        catalog="01-obsidian-orbit"
        state="expanded"
        providers={providers}
        onFocusProvider={onFocusProvider}
        onRequestCompact={onRequestCompact}
      />,
    );

    const details = screen.getByRole("dialog", { name: "Quota details" });
    expect(details).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Claude: 27% remaining" }));
    expect(onFocusProvider).toHaveBeenCalledWith(1);
    fireEvent.click(within(details).getByRole("button", { name: "Collapse quota details" }));
    expect(onRequestCompact).toHaveBeenCalledOnce();
  });

  it("exposes explicit move and pin controls without nesting interactive elements", () => {
    const onStartDrag = vi.fn();
    const onTogglePinned = vi.fn();
    render(
      <QuotaIsland
        catalog="01-obsidian-orbit"
        state="expanded"
        providers={providers}
        onStartDrag={onStartDrag}
        onTogglePinned={onTogglePinned}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("button", { name: "Move Quota Island" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin quota details" }));
    expect(onStartDrag).toHaveBeenCalledOnce();
    expect(onTogglePinned).toHaveBeenCalledOnce();
  });

  it("falls back to the canonical theme for an archived slug", () => {
    const { container } = render(
      <QuotaIsland catalog="12-crimson-nova" state="compact" providers={providers} />,
    );

    expect(container.querySelector(".quota-island")).toHaveAttribute(
      "data-theme",
      "01-obsidian-orbit",
    );
  });
});
