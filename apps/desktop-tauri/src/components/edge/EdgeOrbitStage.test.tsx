import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CATALOG_TASKBAR_FIXTURE } from "../../demo/CatalogTaskbar";
import EdgeOrbitStage from "./EdgeOrbitStage";

describe("EdgeOrbitStage", () => {
  it("renders the full seven-provider half orbit", () => {
    const { container } = render(
      <EdgeOrbitStage
        catalog="14-sapphire-observatory"
        state="expanded"
        providers={CATALOG_TASKBAR_FIXTURE}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(8);
    expect(container.querySelector(".qa-edge-orbit")).toHaveStyle({
      width: "420px",
      height: "600px",
    });
  });

  it("delegates focus and expansion actions", () => {
    const onFocusProvider = vi.fn();
    const onToggleExpanded = vi.fn();
    render(
      <EdgeOrbitStage
        catalog="12-crimson-nova"
        state="idle"
        providers={CATALOG_TASKBAR_FIXTURE}
        onFocusProvider={onFocusProvider}
        onToggleExpanded={onToggleExpanded}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "DeepSeek: 70% remaining" }));
    expect(onFocusProvider).toHaveBeenCalledWith(5);
    fireEvent.click(screen.getByRole("button", { name: "Expand right edge orbit" }));
    expect(onToggleExpanded).toHaveBeenCalledOnce();
  });
});
