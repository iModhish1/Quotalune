import {act, fireEvent, render, renderHook, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {SidebarResizeHandle, SidebarToggle, useSidebarLayout} from "./SidebarControls";
import ProductNavigation from "./ProductNavigation";

vi.mock("../../hooks/useLocale", () => ({useLocale: () => ({t: (key: string) => key})}));
afterEach(() => vi.unstubAllGlobals());

describe("workspace sidebar", () => {
  it("collapses navigation out of the accessibility tree and exposes a named recovery button", () => {
    const toggle = vi.fn();
    render(<><SidebarToggle collapsed onToggle={toggle}/><ProductNavigation activeTab="general" icons={{}} onNavigate={vi.fn()} hidden/></>);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("button", {name:"V2Settings"})).toBeNull();
    const button = screen.getByRole("button", {name:"WorkspaceExpandSidebar"});
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledOnce();
  });

  it.each(["ltr", "rtl"])("resizes by keyboard with physical arrow direction (%s) and explicit bounds", direction => {
    const commit = vi.fn();
    render(<SidebarResizeHandle width={232} onPreview={vi.fn()} onCommit={commit}/>);
    const handle = screen.getByRole("separator");
    handle.style.direction = direction;
    fireEvent.keyDown(handle, {key:"ArrowRight"});
    expect(commit).toHaveBeenLastCalledWith(direction === "rtl" ? 216 : 248);
    fireEvent.keyDown(handle, {key:"Home"});
    expect(commit).toHaveBeenLastCalledWith(184);
    fireEvent.keyDown(handle, {key:"End"});
    expect(commit).toHaveBeenLastCalledWith(360);
    fireEvent.doubleClick(handle);
    expect(commit).toHaveBeenLastCalledWith(232);
  });

  it.each(["ltr", "rtl"])("previews drag without writes; commits once on release (%s)", direction => {
    // jsdom has no PointerEvent/capture implementation. Supply only these browser primitives.
    vi.stubGlobal("PointerEvent", MouseEvent);
    const preview = vi.fn(), commit = vi.fn();
    render(<SidebarResizeHandle width={232} onPreview={preview} onCommit={commit}/>);
    const handle = screen.getByRole("separator");
    handle.style.direction = direction;
    handle.setPointerCapture = vi.fn(); handle.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(handle, {button:0,clientX:232});
    fireEvent.pointerMove(handle, {clientX:280});
    expect(preview).toHaveBeenLastCalledWith(direction === "rtl" ? 184 : 280);
    expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerUp(handle, {clientX:280});
    fireEvent.lostPointerCapture(handle);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(direction === "rtl" ? 184 : 280);
  });

  it("cancels a drag without persisting its preview", () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const preview = vi.fn(), commit = vi.fn();
    render(<SidebarResizeHandle width={232} onPreview={preview} onCommit={commit}/>);
    const handle = screen.getByRole("separator");
    handle.setPointerCapture = vi.fn(); handle.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(handle, {button:0,clientX:232});
    fireEvent.pointerMove(handle, {clientX:900});
    expect(preview).toHaveBeenLastCalledWith(360);
    fireEvent.keyDown(handle, {key:"Escape"});
    fireEvent.pointerUp(handle);
    expect(preview).toHaveBeenLastCalledWith(null);
    expect(commit).not.toHaveBeenCalled();
  });

  it.each(["ltr", "rtl"])("finishes outside the handle when native pointer capture is ineffective (%s)", direction => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const preview = vi.fn(), commit = vi.fn();
    render(<SidebarResizeHandle width={256} onPreview={preview} onCommit={commit}/>);
    const handle = screen.getByRole("separator");
    handle.style.direction = direction;
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, {button:0, clientX:300});
    fireEvent.pointerMove(document.body, {clientX:340});
    fireEvent.pointerUp(document.body, {clientX:350});
    expect(commit).toHaveBeenCalledExactlyOnceWith(direction === "rtl" ? 206 : 306);
    expect(handle).toHaveAttribute("data-dragging", "false");
    preview.mockClear();
    fireEvent.pointerMove(document.body, {clientX:380});
    fireEvent.pointerUp(document.body, {clientX:380});
    expect(preview).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it.each(["blur", "unmount"])("removes global drag listeners on %s without saving", exit => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const preview = vi.fn(), commit = vi.fn();
    const {unmount} = render(<SidebarResizeHandle width={232} onPreview={preview} onCommit={commit}/>);
    const handle = screen.getByRole("separator");
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, {button:0, clientX:232});
    fireEvent.pointerMove(document.body, {clientX:280});
    if (exit === "blur") fireEvent.blur(window);
    else unmount();
    preview.mockClear();
    fireEvent.pointerMove(document.body, {clientX:320});
    fireEvent.pointerUp(document.body, {clientX:320});
    expect(preview).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("preserves density/navigation and stored width when toggling; syncs external preferences", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const prefs = {density:"dense" as const, navigation:"side" as const, sidebarWidth:288, sidebarCollapsed:false};
    const {result, rerender} = renderHook(({preferences}) => useSidebarLayout(preferences, "side", update), {initialProps:{preferences:prefs}});
    await act(async () => result.current.toggle());
    expect(update).toHaveBeenLastCalledWith({workspacePreferences:{...prefs,sidebarCollapsed:true}});
    act(() => result.current.preview(320));
    expect(result.current.width).toBe(320);
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => result.current.resize(320));
    expect(update).toHaveBeenLastCalledWith({workspacePreferences:{...prefs,sidebarWidth:320}});
    rerender({preferences:{...prefs,sidebarWidth:200,sidebarCollapsed:true}});
    expect(result.current.width).toBe(200);
    expect(result.current.collapsed).toBe(true);
  });

  it("never hides top/bottom navigation using the sidebar preference", () => {
    const {result} = renderHook(() => useSidebarLayout({density:"compact",navigation:"top",sidebarCollapsed:true}, "top", vi.fn()));
    expect(result.current.collapsed).toBe(false);
  });

  it("bounds the narrow overlay and restores desktop width without persisting viewport changes", () => {
    vi.stubGlobal("innerWidth", 320);
    const update = vi.fn();
    const {result} = renderHook(() => useSidebarLayout({density:"compact",navigation:"side",sidebarWidth:360}, "side", update));
    expect(result.current.width).toBe(256);
    expect(result.current.maxWidth).toBe(256);
    vi.stubGlobal("innerWidth", 1216);
    act(() => window.dispatchEvent(new Event("resize")));
    expect(result.current.width).toBe(360);
    expect(update).not.toHaveBeenCalled();
  });
});
