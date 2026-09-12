import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import ProductNavigation from "./ProductNavigation";
vi.mock("../../hooks/useLocale", () => ({useLocale: () => ({t: (key: string) => key})}));
describe("ProductNavigation", () => {
  it("exposes eight direct destinations including About and analytics",()=>{
    const navigate=vi.fn();
    render(<ProductNavigation activeTab="usageSpend" onNavigate={navigate} icons={{}}/>);
    expect(screen.getAllByRole("button")).toHaveLength(8);
    expect(screen.getByRole("button",{name:"TabUsageSpend"})).toHaveAttribute("aria-current","page");
    fireEvent.click(screen.getByRole("button",{name:"TabAbout"}));
    expect(navigate).toHaveBeenCalledWith("about");
    fireEvent.click(screen.getByRole("button",{name:"V3Analytics"}));
    expect(navigate).toHaveBeenCalledWith("analytics");
  });
  it("expands settings in place and groups related editors",()=>{
    const navigate=vi.fn();
    render(<ProductNavigation activeTab="resetDisplay" onNavigate={navigate} icons={{}}/>);
    const reset=screen.getByRole("button",{name:"TabResetDisplay"});
    expect(reset.closest(".product-nav__category")).toHaveTextContent("TabThemes");
    expect(reset.closest(".product-nav__category")).toHaveTextContent("TabProviderDisplay");
    const settings=screen.getByRole("button",{name:/V2Settings/});
    fireEvent.click(settings);
    expect(settings).toHaveAttribute("aria-expanded","false");
    expect(screen.queryByRole("button",{name:"TabGeneral"})).toBeNull();
    fireEvent.click(settings);
    fireEvent.click(screen.getByRole("button",{name:"TabThemes"}));
    expect(navigate).toHaveBeenCalledWith("themes");
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
