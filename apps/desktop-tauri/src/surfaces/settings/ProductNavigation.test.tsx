import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import ProductNavigation from "./ProductNavigation";
vi.mock("../../hooks/useLocale", () => ({useLocale: () => ({t: (key: string) => key})}));
describe("ProductNavigation", () => {
  it("exposes task workspaces including About and analytics",()=>{
    const navigate=vi.fn();
    render(<ProductNavigation activeTab="usageSpend" onNavigate={navigate} icons={{}}/>);
    expect(screen.getAllByRole("button")).toHaveLength(12);
    expect(screen.getByRole("button",{name:"TabUsageSpend"})).toHaveAttribute("aria-current","page");
    fireEvent.click(screen.getByRole("button",{name:"TabAbout"}));
    expect(navigate).toHaveBeenCalledWith("about");
    fireEvent.click(screen.getByRole("button",{name:"V3Analytics"}));
    expect(navigate).toHaveBeenCalledWith("analytics");
  });
  it("unifies appearance and keeps general settings compact",()=>{
    const navigate=vi.fn();
    const {rerender}=render(<ProductNavigation activeTab="resetDisplay" onNavigate={navigate} icons={{}}/>);
    expect(screen.getByRole("button",{name:"V2Appearance"})).toHaveAttribute("aria-current","page");
    expect(screen.queryByRole("button",{name:"TabResetDisplay"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"V2Settings"}));
    expect(navigate).toHaveBeenCalledWith("general");
    rerender(<ProductNavigation activeTab="general" onNavigate={navigate} icons={{}}/>);
    expect(screen.getByRole("button",{name:"TabGeneral"})).toBeVisible();
    expect(screen.queryByRole("button",{name:"TabProviderDisplay"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"V2Settings"}));
    expect(screen.queryByRole("button",{name:"TabGeneral"})).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("closes Settings when moving to a primary page",()=>{
    const {rerender}=render(<ProductNavigation activeTab="general" onNavigate={vi.fn()} icons={{}}/>);
    fireEvent.click(screen.getByRole("button",{name:"TabDashboard"}));
    expect(screen.getByRole("button",{name:/V2Settings/})).toHaveAttribute("aria-expanded","false");
    rerender(<ProductNavigation activeTab="profiles" onNavigate={vi.fn()} icons={{}}/>);
    expect(screen.getByRole("button",{name:"TabProfiles"})).toHaveAttribute("aria-current","page");
  });
  it("skips collapsed children during keyboard navigation",()=>{
    render(<ProductNavigation activeTab="general" onNavigate={vi.fn()} icons={{}}/>);
    const settings=screen.getByRole("button",{name:/V2Settings/});fireEvent.click(settings);settings.focus();
    fireEvent.keyDown(settings,{key:"End"});
    const about=screen.getByRole("button",{name:"TabAbout"});expect(about).toHaveFocus();
    fireEvent.keyDown(about,{key:"Home"});
    expect(screen.getByRole("button",{name:"TabDashboard"})).toHaveFocus();
  });
});
