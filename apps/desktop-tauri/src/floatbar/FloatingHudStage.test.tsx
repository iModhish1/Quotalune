import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StageProvider } from "../components/orbit/stageTypes";
import FloatingHudStage from "./FloatingHudStage";

const providers: StageProvider[] = Array.from({ length: 7 }, (_, index) => ({
  id: `provider-${index}`,
  name: `Provider ${index + 1}`,
  iconId: ["openai", "claude", "gemini", "llama", "mistral", "deepseek", "perplexity"][index],
  resolvedMode: "remaining",
  arcFraction: (74 - index * 6) / 100,
  primaryValue: 74 - index * 6,
  secondaryValue: null,
  primaryLabel: "remaining",
  reset: `${index + 1}h`,
  status: "ok",
}));

describe("FloatingHudStage", () => {
  it("renders seven live provider instruments in the selected catalog world", () => {
    render(
      <FloatingHudStage
        catalog="01-obsidian-orbit"
        providers={providers}
        selectedProviderId="provider-1"
      />,
    );

    expect(screen.getByLabelText("Obsidian Orbit floating HUD")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Provider \d:/ })).toHaveLength(7);
    expect(screen.getAllByText("68%")).toHaveLength(2);
    expect(screen.getAllByText("Provider 2")).toHaveLength(2);
  });

  it("changes focus through the provider orbit", () => {
    const onSelect = vi.fn();
    render(
      <FloatingHudStage
        catalog="01-obsidian-orbit"
        providers={providers}
        onSelectProvider={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Provider 4:/ }));
    expect(onSelect).toHaveBeenCalledWith("provider-3");
  });
});
