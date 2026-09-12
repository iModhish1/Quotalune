import {fireEvent,render,screen} from "@testing-library/react";
import {describe,expect,it,vi} from "vitest";
import WorkspaceBackgroundControl from "./WorkspaceBackgroundControl";
import type {SettingsSnapshot} from "../../types/bridge";
vi.mock("../../hooks/useLocale",()=>({useLocale:()=>({t:(key:string)=>key})}));
vi.mock("../../design-system/motion",()=>({useReducedMotion:()=>false}));
describe("background choices",()=>{
  it("persists explicit choices while preserving sidebar and density preferences",()=>{
    const prefs={density:"dense",navigation:"side",sidebarWidth:280,sidebarCollapsed:true,background:"cosmic"} as const;
    const update=vi.fn();
    render(<WorkspaceBackgroundControl settings={{workspacePreferences:prefs} as SettingsSnapshot} navigation="side" update={update} disabled={false}/>);
    fireEvent.click(screen.getByRole("button",{name:/^WorkspaceBackgroundAurora /}));
    expect(update).toHaveBeenLastCalledWith({workspacePreferences:{...prefs,background:"aurora"}});
    fireEvent.click(screen.getByRole("button",{name:"WorkspaceBackgroundInteractive"}));
    expect(update).toHaveBeenLastCalledWith({workspacePreferences:{...prefs,backgroundMotion:"interactive"}});
    fireEvent.click(screen.getByRole("button",{name:"WorkspaceBackgroundSubtle"}));
    expect(update).toHaveBeenLastCalledWith({workspacePreferences:{...prefs,backgroundIntensity:"subtle"}});
  });
});
