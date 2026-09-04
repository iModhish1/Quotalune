import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CATALOG_TASKBAR_FIXTURE } from "../../demo/CatalogTaskbar";
import TopOrbitStage from "./TopOrbitStage";

describe("TopOrbitStage", () => {
  it("renders all seven providers in the expanded orbital notch", () => {
    const { container } = render(
      <TopOrbitStage
        catalog="01-obsidian-orbit"
        state="expanded"
        providers={CATALOG_TASKBAR_FIXTURE}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(8);
    expect(container.querySelector(".qa-top-orbit")).toHaveStyle({
      width: "760px",
      height: "430px",
    });
  });

  it("delegates focus and expansion actions", () => {
    const onFocusProvider = vi.fn();
    const onToggleExpanded = vi.fn();
    render(
      <TopOrbitStage
        catalog="01-obsidian-orbit"
        state="idle"
        providers={CATALOG_TASKBAR_FIXTURE}
        onFocusProvider={onFocusProvider}
        onToggleExpanded={onToggleExpanded}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gemini: 55% remaining" }));
    expect(onFocusProvider).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: "Expand top orbital notch" }));
    expect(onToggleExpanded).toHaveBeenCalledOnce();
  });
});
