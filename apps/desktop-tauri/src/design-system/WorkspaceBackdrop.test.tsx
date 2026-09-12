import {act,render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import WorkspaceBackdrop, {backgroundInteractionAllowed} from "./WorkspaceBackdrop";
import type {SettingsSnapshot} from "../types/bridge";
vi.mock("./motion",()=>({useReducedMotion:()=>false}));
const settings = {enableAnimations:true,dashboardPerformancePreset:"balanced",workspacePreferences:{density:"comfortable",navigation:"side",background:"aurora",backgroundMotion:"interactive"}} as SettingsSnapshot;
describe("workspace backdrop",()=>{
  it("pauses the animated layer on blur and Low CPU while keeping a static frame",()=>{
    const focus=vi.spyOn(document,"hasFocus").mockReturnValue(true);
    const animated={...settings,workspacePreferences:{...settings.workspacePreferences!,background:"motion-01" as const}};
    const {container,rerender}=render(<WorkspaceBackdrop settings={animated}/>);
    expect(container.firstChild).toHaveAttribute("data-animate","true");
    focus.mockReturnValue(false);act(()=>window.dispatchEvent(new Event("blur")));
    expect(container.firstChild).toHaveAttribute("data-animate","false");
    focus.mockReturnValue(true);act(()=>window.dispatchEvent(new Event("focus")));
    expect(container.firstChild).toHaveAttribute("data-animate","true");
    rerender(<WorkspaceBackdrop settings={{...animated,dashboardPerformancePreset:"lowCpu"}}/>);
    expect(container.firstChild).toHaveAttribute("data-animate","false");
    focus.mockRestore();
  });
  it("is decorative and introduces no focusable controls or canvas",()=>{
    const {container}=render(<WorkspaceBackdrop settings={settings}/>);
    expect(container.firstChild).toHaveAttribute("aria-hidden","true");
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("canvas,video,iframe")).toBeNull();
  });
  it("fails closed for unknown/reduced motion, disabled animations, low CPU and plain backgrounds",()=>{
    expect(backgroundInteractionAllowed(settings,false)).toBe(true);
    for(const reduced of [true,null]) expect(backgroundInteractionAllowed(settings,reduced)).toBe(false);
    expect(backgroundInteractionAllowed({...settings,enableAnimations:false},false)).toBe(false);
    expect(backgroundInteractionAllowed({...settings,dashboardPerformancePreset:"lowCpu"},false)).toBe(false);
    expect(backgroundInteractionAllowed({...settings,workspacePreferences:{...settings.workspacePreferences!,background:"none"}},false)).toBe(false);
    expect(backgroundInteractionAllowed({...settings,workspacePreferences:{...settings.workspacePreferences!,backgroundMotion:"static"}},false)).toBe(false);
  });
});
