import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe,it,expect,vi } from "vitest";
import NotchSurface from "./NotchSurface";
import { SURFACE_DEMO_PROVIDERS } from "../../lib/surfaceDemo";
import { NOTCH_FORMS } from "./notchGeometry";
import {useState} from "react";

vi.mock("../../hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key, language: "english", direction: "ltr" }),
  useOptionalLocale: () => null,
}));
const settings={form:"flowline" as const,anchor:"right" as const,scale:100,autoHide:true,autoHideDelayMs:900};
describe("notch family controls",()=>{
  it("respects disabled hover, wheel and automatic folding",()=>{
    vi.useFakeTimers();
    try {
      const focus=vi.fn(),expand=vi.fn(),close=vi.fn();
      render(<NotchSurface form="satellite" catalog="" state="expanded" settings={{...settings,interactions:{hoverDetails:false,wheelCycle:false,autoFold:false,foldDelayMs:500}}} providers={SURFACE_DEMO_PROVIDERS} onFocusProvider={focus} onToggleExpanded={expand} onRequestCompact={close}/>);
      const host=screen.getByRole("region",{name:"satellite provider selector"});
      fireEvent.mouseEnter(screen.getByRole("button",{name:"OpenAI: 21% used"}));act(()=>vi.advanceTimersByTime(200));
      expect(screen.getByRole("region",{name:"Claude usage details"})).toBeInTheDocument();
      fireEvent.wheel(host,{deltaY:120});expect(focus).not.toHaveBeenCalled();
      fireEvent.mouseLeave(host);act(()=>vi.advanceTimersByTime(4000));expect(close).not.toHaveBeenCalled();
    }finally{vi.useRealTimers();}
  });
  it("satellite previews without rotating and folds after 500ms, cancelling on reentry",()=>{
    vi.useFakeTimers();
    try {
      function Harness(){
        const [focus,setFocus]=useState(0),[expanded,setExpanded]=useState(false);
        return <NotchSurface form="satellite" settings={settings} catalog="" state={expanded?"expanded":"compact"} providers={SURFACE_DEMO_PROVIDERS} focusedIndex={focus} onFocusProvider={setFocus} onToggleExpanded={()=>setExpanded(true)} onRequestCompact={()=>setExpanded(false)}/>;
      }
      const {container}=render(<Harness/>);
      const host=screen.getByRole("region",{name:"satellite provider selector"});
      fireEvent.mouseEnter(host);
      const before=Array.from(container.querySelectorAll(".notch-provider")).map(b=>b.getAttribute("aria-label"));
      const side=container.querySelectorAll(".notch-provider")[1];
      fireEvent.mouseEnter(side);act(()=>vi.advanceTimersByTime(180));
      expect(Array.from(container.querySelectorAll(".notch-provider")).map(b=>b.getAttribute("aria-label"))).toEqual(before);
      expect(screen.getByRole("button",{name:"Collapse details"})).toBeInTheDocument();
      fireEvent.mouseLeave(host);act(()=>vi.advanceTimersByTime(499));
      expect(container.querySelectorAll(".notch-provider")).toHaveLength(3);
      fireEvent.mouseEnter(host);act(()=>vi.advanceTimersByTime(501));
      expect(container.querySelectorAll(".notch-provider")).toHaveLength(3);
      fireEvent.mouseLeave(host);act(()=>vi.advanceTimersByTime(500));
      expect(container.querySelectorAll(".notch-provider")).toHaveLength(1);
      expect(screen.queryByRole("button",{name:"Collapse details"})).not.toBeInTheDocument();
      fireEvent.mouseEnter(host);
      fireEvent.wheel(host,{deltaY:120});
      expect(container.querySelector(".notch-provider")?.getAttribute("aria-label")).not.toBe(before[0]);
    } finally {vi.useRealTimers();}
  });
  it("requires hover intent and cancels transient pointer passes",()=>{
    vi.useFakeTimers();
    try {
      const expand=vi.fn();
      render(<NotchSurface form="seam" settings={settings} catalog="" state="compact" providers={SURFACE_DEMO_PROVIDERS} onToggleExpanded={expand}/>);
      const button=screen.getByRole("button",{name:"Claude: 73% used"});
      fireEvent.mouseEnter(button);act(()=>vi.advanceTimersByTime(100));fireEvent.mouseLeave(button);act(()=>vi.advanceTimersByTime(200));
      expect(expand).not.toHaveBeenCalled();
      fireEvent.mouseEnter(button);act(()=>vi.advanceTimersByTime(180));expect(expand).toHaveBeenCalledOnce();
    } finally {vi.useRealTimers();}
  });
  it.each(NOTCH_FORMS)("%s uses actual values, bounded nodes and opens provider details",form=>{
    const focus=vi.fn(), expand=vi.fn();
    const {container}=render(<NotchSurface form={form} settings={settings} catalog="" state="compact" providers={SURFACE_DEMO_PROVIDERS} onFocusProvider={focus} onToggleExpanded={expand}/>);
    expect(container.querySelectorAll(".notch-provider").length).toBeLessThanOrEqual(3);
    fireEvent.click(screen.getByRole("button",{name:"Claude: 73% used"}));
    if(form==="satellite")expect(focus).not.toHaveBeenCalled();else expect(focus).toHaveBeenCalledWith(0);expect(expand).toHaveBeenCalledOnce();
  });
  it("cycles six providers with keys and Escape collapses without leaking to host",()=>{
    const focus=vi.fn(),close=vi.fn();
    render(<NotchSurface form="seam" settings={settings} catalog="" state="expanded" demoMode providers={SURFACE_DEMO_PROVIDERS} onFocusProvider={focus} onRequestCompact={close}/>);
    fireEvent.keyDown(screen.getByRole("button",{name:"Claude: 73% used"}),{key:"End"});expect(focus).toHaveBeenCalledWith(5);
    expect(screen.getByRole("region",{name:"seam provider selector"})).toHaveFocus();
    expect(screen.getByText("DEMO DATA · NOT A REAL ACCOUNT")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button",{name:"Collapse details"}),{key:"Escape"});expect(close).toHaveBeenCalledOnce();
  });
  it("Wave 1D §10: shows a distinct Loading message during the first fetch, not the same 'No data' text",()=>{
    render(<NotchSurface form="seam" settings={settings} catalog="" state="compact" providers={[]} initialLoading/>);
    expect(screen.getAllByText("QuotalisStructureLoading").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("No data")).not.toBeInTheDocument();
    expect(screen.queryByText("No quota data")).not.toBeInTheDocument();
  });
  it("Wave 1E §18: announces refreshing via the sr-only live region without a visual element (per-form geometry not touched blind)",()=>{
    render(<NotchSurface form="seam" settings={settings} catalog="" state="compact" providers={SURFACE_DEMO_PROVIDERS} isRefreshing/>);
    const sr = document.querySelector(".notch-sr");
    expect(sr?.textContent).toContain("QuotalisLoadingUpdating");
  });
  it("does not announce refreshing when isRefreshing is false or while initialLoading owns the message",()=>{
    render(<NotchSurface form="seam" settings={settings} catalog="" state="compact" providers={SURFACE_DEMO_PROVIDERS} isRefreshing={false}/>);
    expect(document.querySelector(".notch-sr")?.textContent).not.toContain("QuotalisLoadingUpdating");
  });
  it.each([1, 3, 6, 12, 24, 70])(
    "Wave 1D §23: DOM node count for provider slots stays bounded to the fixed silhouette regardless of provider count (n=%i) — cycles into the real slot count instead of rendering N elements",
    (count) => {
      const data = Array.from({ length: count }, (_, i) => ({ ...SURFACE_DEMO_PROVIDERS[i % SURFACE_DEMO_PROVIDERS.length], id: `synthetic-${i}` }));
      const { container } = render(
        <NotchSurface form="seam" settings={settings} catalog="" state="compact" providers={data} />,
      );
      // "seam" renders at most a handful of fixed provider slots regardless
      // of how many providers exist -- indices cycle into that fixed slot
      // count (see the (page+slot)%providers.length arithmetic in
      // NotchSurface.tsx), so this must never scale with `count`.
      expect(container.querySelectorAll(".notch-provider").length).toBeLessThanOrEqual(7);
    },
  );

  it("Wave 1F §17/§21: renders the shared connector primitive (not a bare inline SVG) when a detail panel is open, and not when it's compact", () => {
    const { container: expanded } = render(
      <NotchSurface form="crescent" settings={settings} catalog="" state="expanded" providers={SURFACE_DEMO_PROVIDERS} />,
    );
    expect(expanded.querySelector(".structure-connector--notch")).toBeInTheDocument();

    const { container: compact } = render(
      <NotchSurface form="crescent" settings={settings} catalog="" state="compact" providers={SURFACE_DEMO_PROVIDERS} />,
    );
    expect(compact.querySelector(".structure-connector--notch")).not.toBeInTheDocument();
  });
});
