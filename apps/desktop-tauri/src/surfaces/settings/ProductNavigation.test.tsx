import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import ProductNavigation from "./ProductNavigation";
vi.mock("../../hooks/useLocale", () => ({useLocale: () => ({t: (key: string) => key})}));

describe("ProductNavigation", () => {
  it("expands settings in place and navigates directly to the existing editor", () => {
    const navigate = vi.fn();
    render(<ProductNavigation activeTab="general" onNavigate={navigate} icons={{}} />);
    const settings = screen.getByRole("button", {name: /V2Settings/});
    expect(settings).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(settings);
    expect(settings).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", {name: "TabGeneral"})).toBeNull();
    fireEvent.click(settings);
    fireEvent.click(screen.getByRole("button", {name: "TabThemes"}));
    expect(navigate).toHaveBeenCalledWith("themes");
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("only expands the active branch, collapsing siblings when switching (fixes ~38vh nav height in top/bottom layouts)", () => {
    const navigate = vi.fn();
    const {rerender} = render(<ProductNavigation activeTab="general" onNavigate={navigate} icons={{}} />);
    // Starting on a Settings tab: only Settings is expanded, not Dashboard/Workspace too.
    expect(screen.getByRole("button", {name: /V2Settings/})).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", {name: "TabDashboard"})).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", {name: "TabDashboard"}));
    expect(navigate).toHaveBeenCalledWith("dashboard");
    // Switching branches expands Dashboard and collapses Settings -- it
    // used to stay expanded forever once opened, regardless of navigation.
    expect(screen.getByRole("button", {name: "TabDashboard"})).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", {name: /V2Settings/})).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", {name: "TabGeneral"})).toBeNull();

    // Navigating to a different branch's tab from outside this component's
    // own click handler (e.g. a search result) re-syncs the expanded branch too.
    rerender(<ProductNavigation activeTab="profiles" onNavigate={navigate} icons={{}} />);
    expect(screen.getByRole("button", {name: "V2Workspace"})).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", {name: "TabDashboard"})).toHaveAttribute("aria-expanded", "false");
  });

  it("skips collapsed children during keyboard navigation", () => {
    render(<ProductNavigation activeTab="general" onNavigate={vi.fn()} icons={{}} />);
    const settings = screen.getByRole("button", {name: /V2Settings/});
    fireEvent.click(settings);
    settings.focus();
    fireEvent.keyDown(settings, {key:"End"});
    expect(settings).toHaveFocus();
    fireEvent.keyDown(settings, {key:"Home"});
    expect(screen.getByRole("button", {name:"TabDashboard"})).toHaveFocus();
  });
});
