import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe,it,expect,vi } from "vitest";
import NotchSurface from "./NotchSurface";
import { SURFACE_DEMO_PROVIDERS } from "../../lib/surfaceDemo";
import { NOTCH_FORMS } from "./notchGeometry";
import {useState} from "react";
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
      expect(screen.getByRole("button",{name:"Close usage details"})).toBeInTheDocument();
      fireEvent.mouseLeave(host);act(()=>vi.advanceTimersByTime(499));
      expect(container.querySelectorAll(".notch-provider")).toHaveLength(3);
      fireEvent.mouseEnter(host);act(()=>vi.advanceTimersByTime(501));
      expect(container.querySelectorAll(".notch-provider")).toHaveLength(3);
      fireEvent.mouseLeave(host);act(()=>vi.advanceTimersByTime(500));
      expect(container.querySelectorAll(".notch-provider")).toHaveLength(1);
      expect(screen.queryByRole("button",{name:"Close usage details"})).not.toBeInTheDocument();
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
    fireEvent.keyDown(screen.getByRole("button",{name:"Close usage details"}),{key:"Escape"});expect(close).toHaveBeenCalledOnce();
  });
});
