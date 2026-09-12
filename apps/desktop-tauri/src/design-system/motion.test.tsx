import {act, renderHook} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {useReducedMotion} from "./motion";

afterEach(() => vi.unstubAllGlobals());
describe("live system motion preference", () => {
  it("updates mounted consumers in both directions and removes its listener", () => {
    const media = new EventTarget();
    let matches = false;
    Object.defineProperty(media, "matches", {get: () => matches});
    const remove = vi.spyOn(media, "removeEventListener");
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    const {result, unmount} = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => {matches = true; media.dispatchEvent(new Event("change"));});
    expect(result.current).toBe(true);
    act(() => {matches = false; media.dispatchEvent(new Event("change"));});
    expect(result.current).toBe(false);
    unmount();
    expect(remove).toHaveBeenCalledWith("change", expect.any(Function));
  });
  it("reports unknown when the platform has no motion query", () => {
    vi.stubGlobal("matchMedia", undefined);
    const {result} = renderHook(() => useReducedMotion());
    expect(result.current).toBeNull();
  });
});
