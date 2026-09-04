import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CATALOG_TASKBAR_FIXTURE } from "../demo/CatalogTaskbar";
import CatalogUsageHero from "./CatalogUsageHero";

describe("CatalogUsageHero", () => {
  it("derives used and remaining values without a second semantics engine", () => {
    render(
      <CatalogUsageHero
        variant="quick"
        catalog="01-obsidian-orbit"
        providers={CATALOG_TASKBAR_FIXTURE}
      />,
    );

    expect(screen.getByText("26%")).toBeInTheDocument();
    expect(screen.getAllByText("74%").length).toBeGreaterThan(0);
    expect(screen.getByText("Resets 3h 40m", { exact: false })).toBeInTheDocument();
  });

  it("renders a seven-provider dashboard orbit and delegates selection", () => {
    const onSelectProvider = vi.fn();
    render(
      <CatalogUsageHero
        variant="dashboard"
        catalog="01-obsidian-orbit"
        providers={CATALOG_TASKBAR_FIXTURE}
        selectedProviderId="claude"
        onSelectProvider={onSelectProvider}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Gemini: 55% remaining" }));
    expect(onSelectProvider).toHaveBeenCalledWith("gemini");
    expect(screen.getByLabelText("Obsidian Orbit dashboard orbit")).toHaveAttribute(
      "data-theme",
      "01-obsidian-orbit",
    );
  });
});
