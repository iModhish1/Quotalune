import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import SettingsShell, {WorkspaceShell} from "./SettingsShell";
vi.mock("../../hooks/useLocale", () => ({useLocale: () => ({t: (key: string) => key})}));

describe("SettingsShell", () => {
  it("has one compact category heading and no duplicate Settings introduction", () => {
    render(<SettingsShell activeTab="providerDisplay" onNavigate={vi.fn()}><p>Provider display editor</p></SettingsShell>);
    expect(screen.getAllByRole("heading", {level:2})).toHaveLength(1);
    expect(screen.queryByText("V2SettingsHelp")).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveAccessibleName("V2SearchSettings");
  });
  it("opens the matching legacy editor from search and keeps the current editor mounted while searching", () => {
    const navigate = vi.fn();
    render(<SettingsShell activeTab="general" onNavigate={navigate}><input aria-label="current draft" defaultValue="unsaved" /></SettingsShell>);
    fireEvent.change(screen.getByRole("searchbox"), {target: {value: "density"}});
    expect(screen.getByLabelText("current draft")).toHaveValue("unsaved");
    fireEvent.click(screen.getByRole("button", {name: /V2Appearance/}));
    expect(navigate).toHaveBeenCalledWith("themes");
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
  it("keeps Profiles and Collections as separate internal destinations", () => {
    const navigate = vi.fn();
    render(<WorkspaceShell activeTab="profiles" onNavigate={navigate}><p>Profile content</p></WorkspaceShell>);
    fireEvent.click(screen.getByRole("button", {name: "TabCollections"}));
    expect(navigate).toHaveBeenCalledWith("collections");
    expect(screen.getByRole("button", {name: "TabProfiles"})).toHaveAttribute("aria-current", "page");
  });
});
