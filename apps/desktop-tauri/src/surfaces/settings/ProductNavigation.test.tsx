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
