import {render,screen,fireEvent,waitFor,act} from "@testing-library/react";
import {describe,expect,it,vi,beforeEach} from "vitest";
import CollectionsNativeView from "./CollectionsNativeView";
import type {CollectionLayoutSnapshot} from "../../lib/collectionBridge";

const stageRuntimeMock=vi.fn();
vi.mock("../../hooks/useStageRuntime",()=>({useStageRuntime:()=>stageRuntimeMock()}));

const getCollectionLayoutMock=vi.fn();
vi.mock("../../lib/collectionBridge",()=>({getCollectionLayout:()=>getCollectionLayoutMock()}));

let collectionsChangedHandler:(()=>void)|undefined;
vi.mock("@tauri-apps/api/event",()=>({
  listen:vi.fn((event:string,handler:()=>void)=>{
    if(event==="quotaarc:collections-changed")collectionsChangedHandler=handler;
    return Promise.resolve(()=>{});
  }),
}));

function providers(){
  return [
    {id:"codex",name:"Codex",iconId:"codex",resolvedMode:"remaining",primaryValue:73,secondaryValue:null,primaryLabel:"remaining",arcFraction:.73,reset:"3h",status:"ok"},
    {id:"claude",name:"Claude",iconId:"claude",resolvedMode:"remaining",primaryValue:41,secondaryValue:null,primaryLabel:"remaining",arcFraction:.41,reset:"4d",status:"ok"},
  ];
}
function layout(overrides:Partial<CollectionLayoutSnapshot> = {}):CollectionLayoutSnapshot{
  return {version:1,revision:0,view:"horizontal",scale:100,groups:[{id:"main",items:["codex","claude"],x:20,y:24}],fields:{},...overrides};
}

beforeEach(()=>{
  collectionsChangedHandler=undefined;
  stageRuntimeMock.mockReturnValue({providers:providers(),settingsError:null});
  getCollectionLayoutMock.mockResolvedValue(layout());
});

describe("CollectionsNativeView",()=>{
  it("renders the saved groups with live provider data",async()=>{
    render(<CollectionsNativeView/>);
    expect(await screen.findByRole("button",{name:"Codex quota details"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Claude quota details"})).toBeInTheDocument();
    expect(screen.getAllByTestId("collection-group")).toHaveLength(1);
  });

  it("shows an empty state pointing to Settings when no collections are saved",async()=>{
    getCollectionLayoutMock.mockResolvedValue(layout({groups:[]}));
    render(<CollectionsNativeView/>);
    expect(await screen.findByText(/No collections saved yet/)).toBeInTheDocument();
  });

  it("keeps a saved-but-missing provider visible as offline rather than dropping it",async()=>{
    getCollectionLayoutMock.mockResolvedValue(layout({groups:[{id:"main",items:["codex","gone"],x:0,y:0}]}));
    render(<CollectionsNativeView/>);
    expect(await screen.findByRole("button",{name:"gone quota details"})).toBeInTheDocument();
  });

  it("opens and closes provider detail on click",async()=>{
    render(<CollectionsNativeView/>);
    fireEvent.click(await screen.findByRole("button",{name:"Codex quota details"}));
    expect(screen.getByRole("region",{name:"Codex usage details"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Close details"}));
    expect(screen.queryByRole("region",{name:"Codex usage details"})).not.toBeInTheDocument();
  });

  it("refreshes when Settings broadcasts a new saved layout",async()=>{
    render(<CollectionsNativeView/>);
    await screen.findByRole("button",{name:"Codex quota details"});
    getCollectionLayoutMock.mockResolvedValue(layout({groups:[{id:"solo",items:["claude"],x:0,y:0}]}));
    await act(async()=>{collectionsChangedHandler?.();});
    await waitFor(()=>expect(screen.queryByRole("button",{name:"Codex quota details"})).not.toBeInTheDocument());
    expect(screen.getByRole("button",{name:"Claude quota details"})).toBeInTheDocument();
  });

  it("surfaces a settings error instead of silently showing nothing",async()=>{
    stageRuntimeMock.mockReturnValue({providers:[],settingsError:"Settings unavailable"});
    render(<CollectionsNativeView/>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Settings unavailable");
  });
});
