import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {listWorkspaceBackgrounds, removeWorkspaceBackground} from "../../lib/workspaceBackgrounds";
import {getSettingsSnapshot} from "../../lib/tauri";
import {beforeEach,describe,expect,it,vi} from "vitest";
import WorkspaceBackgroundControl from "./WorkspaceBackgroundControl";
import type {SettingsSnapshot} from "../../types/bridge";
vi.mock("../../hooks/useLocale",()=>({useLocale:()=>({t:(key:string)=>key})}));
vi.mock("../../design-system/motion",()=>({useReducedMotion:()=>false}));
vi.mock("@tauri-apps/api/event",()=>({listen:vi.fn(async()=>vi.fn())}));
vi.mock("../../lib/workspaceBackgrounds",()=>({listWorkspaceBackgrounds:vi.fn(async()=>[]),removeWorkspaceBackground:vi.fn(async()=>{}),importWorkspaceBackground:vi.fn()}));
vi.mock("../../lib/tauri",()=>({getSettingsSnapshot:vi.fn()}));
describe("background choices",()=>{
  beforeEach(()=>vi.clearAllMocks());
  it("persists explicit choices while preserving sidebar and density preferences",async()=>{
    const prefs={density:"dense",navigation:"side",sidebarWidth:280,sidebarCollapsed:true,background:"cosmic"} as const;
    const update=vi.fn();
    render(<WorkspaceBackgroundControl settings={{workspacePreferences:prefs} as unknown as SettingsSnapshot} navigation="side" update={update} disabled={false}/>);
    fireEvent.click(screen.getByRole("button",{name:/^WorkspaceScene01 WorkspaceBackgroundStaticOnly/}));
    expect(update).toHaveBeenLastCalledWith({workspacePreferences:{...prefs,background:"atmosphere-01"}});
    fireEvent.click(screen.getByRole("button",{name:"WorkspaceBackgroundInteractive"}));
    expect(update).toHaveBeenLastCalledWith({workspacePreferences:{...prefs,backgroundMotion:"interactive"}});
    fireEvent.click(screen.getByRole("button",{name:"WorkspaceBackgroundSubtle"}));
    expect(update).toHaveBeenLastCalledWith({workspacePreferences:{...prefs,backgroundIntensity:"subtle"}});
    await waitFor(()=>expect(listWorkspaceBackgrounds).toHaveBeenCalled());
  });
  it("filters static and animated collections and makes motion opt in by selection",async()=>{
    const update=vi.fn();
    render(<WorkspaceBackgroundControl settings={{} as unknown as SettingsSnapshot} navigation="side" update={update} disabled={false}/>);
    fireEvent.click(screen.getByRole("button",{name:"WorkspaceBackgroundAnimated"}));
    expect(screen.getAllByRole("button",{name:/^WorkspaceScene/})).toHaveLength(4);
    expect(screen.queryByRole("button",{name:/^WorkspaceBackgroundCosmic /})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:/^WorkspaceScene01 /}));
    expect(update).toHaveBeenLastCalledWith({workspacePreferences:{density:"comfortable",navigation:"side",background:"motion-01",backgroundMotion:"interactive"}});
    fireEvent.click(screen.getByRole("button",{name:"WorkspaceBackgroundMine"}));
    expect(screen.getByText("WorkspaceBackgroundEmpty")).toBeInTheDocument();
    await waitFor(()=>expect(listWorkspaceBackgrounds).toHaveBeenCalled());
  });
  it("persists the fallback before deleting the selected custom image",async()=>{
    const id="03c5b5a4-d164-486a-86b2-c5b8394e055f";
    vi.mocked(listWorkspaceBackgrounds).mockResolvedValueOnce([{id,name:"my-photo",thumbnailDataUrl:"data:image/png;base64,"}]);
    const update=vi.fn(async()=>{});
    const before={workspacePreferences:{density:"comfortable",navigation:"side",background:`custom:${id}`}} as unknown as SettingsSnapshot;
    vi.mocked(getSettingsSnapshot).mockResolvedValueOnce(before).mockResolvedValueOnce(before).mockResolvedValueOnce({workspacePreferences:{density:"comfortable",navigation:"side",background:"cosmic"}} as unknown as SettingsSnapshot);
    render(<WorkspaceBackgroundControl settings={{workspacePreferences:{density:"comfortable",navigation:"side",background:`custom:${id}`}} as unknown as SettingsSnapshot} navigation="side" update={update} disabled={false}/>);
    fireEvent.click(await screen.findByRole("button",{name:"WorkspaceBackgroundRemove my-photo"}));
    await waitFor(()=>expect(removeWorkspaceBackground).toHaveBeenCalledWith(id));
    expect(update).toHaveBeenCalledWith({workspacePreferences:{density:"comfortable",navigation:"side",background:"cosmic"}});
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(removeWorkspaceBackground).mock.invocationCallOrder[0]);
  });
  it("keeps the image when the settings hook resolves but persistence did not succeed",async()=>{
    const id="03c5b5a4-d164-486a-86b2-c5b8394e055f";
    const current={workspacePreferences:{density:"comfortable",navigation:"side",background:`custom:${id}`}} as unknown as SettingsSnapshot;
    vi.mocked(getSettingsSnapshot).mockResolvedValue(current);
    vi.mocked(listWorkspaceBackgrounds).mockResolvedValueOnce([{id,name:"keep-me",thumbnailDataUrl:"data:image/png;base64,"}]);
    render(<WorkspaceBackgroundControl settings={current} navigation="side" update={vi.fn(async()=>{})} disabled={false}/>);
    fireEvent.click(await screen.findByRole("button",{name:"WorkspaceBackgroundRemove keep-me"}));
    await screen.findByRole("alert");
    expect(removeWorkspaceBackground).not.toHaveBeenCalled();
  });
});


