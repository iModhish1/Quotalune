import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe,it,expect,vi } from "vitest";
import NotchSurface from "./NotchSurface";
import { SURFACE_DEMO_PROVIDERS } from "../../lib/surfaceDemo";
import { NOTCH_FORMS } from "./notchGeometry";
const settings={form:"flowline" as const,anchor:"right" as const,scale:100,autoHide:true,autoHideDelayMs:900};
describe("notch family controls",()=>{
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
    expect(focus).toHaveBeenCalledWith(0);expect(expand).toHaveBeenCalledOnce();
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
