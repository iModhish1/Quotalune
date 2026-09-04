import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CATALOG_TASKBAR_FIXTURE } from "../../demo/CatalogTaskbar";
import TaskbarStage from "./TaskbarStage";

describe("TaskbarStage", () => {
  it("renders the full provider dial at the authoritative native size", () => {
    const { container } = render(
      <TaskbarStage
        catalog="01-obsidian-orbit"
        state="expanded"
        providers={CATALOG_TASKBAR_FIXTURE}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(8);
    expect(container.querySelector(".qa-taskbar-stage")).toHaveStyle({
      width: "820px",
      height: "540px",
    });
  });

  it("delegates provider focus and core expansion without owning live state", () => {
    const onFocusProvider = vi.fn();
    const onToggleExpanded = vi.fn();
    render(
      <TaskbarStage
        catalog="01-obsidian-orbit"
        state="idle"
        providers={CATALOG_TASKBAR_FIXTURE}
        focusedIndex={0}
        onFocusProvider={onFocusProvider}
        onToggleExpanded={onToggleExpanded}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Claude: 68% remaining" }));
    expect(onFocusProvider).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "Expand quota instrument" }));
    expect(onToggleExpanded).toHaveBeenCalledOnce();
  });

  it("renders an honest unavailable provider instead of inventing a value", () => {
    render(
      <TaskbarStage
        catalog="01-obsidian-orbit"
        state="idle"
        providers={[
          {
            ...CATALOG_TASKBAR_FIXTURE[0],
            arcFraction: null,
            primaryValue: null,
            secondaryValue: null,
            status: "offline",
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "OpenAI: – remaining" })).toBeInTheDocument();
    expect(screen.getAllByText("–").length).toBeGreaterThan(0);
  });

  it("renders both values when the resolved mode is hybrid", () => {
    render(
      <TaskbarStage
        catalog="01-obsidian-orbit"
        state="expanded"
        providers={[
          {
            ...CATALOG_TASKBAR_FIXTURE[0],
            resolvedMode: "hybrid",
            primaryValue: 73,
            secondaryValue: 27,
            primaryLabel: "used",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "OpenAI: 73% used, 27% remaining",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("used · 27% remaining")).toBeInTheDocument();
  });
});
