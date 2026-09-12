import {afterEach, describe, expect, it, vi} from "vitest";
import {attachBackgroundInteraction} from "./backgroundMotion";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup() {
  vi.spyOn(document,"hasFocus").mockReturnValue(true);
  let callback: FrameRequestCallback = () => {};
  const request = vi.fn((fn:FrameRequestCallback) => {callback=fn;return 7;});
  const cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame",request); vi.stubGlobal("cancelAnimationFrame",cancel);
  const now = vi.spyOn(performance,"now").mockReturnValue(100);
  const root = document.createElement("div"), glow = document.createElement("div");
  const stop = attachBackgroundInteraction(root,glow);
  const move = (pointerType="mouse") => {
    const event = new MouseEvent("pointermove", {clientX:200,clientY:220});
    Object.defineProperty(event,"pointerType",{value:pointerType});
    root.dispatchEvent(event);
  };
  return {request,cancel,now,root,glow,stop,move,paint:(stamp=performance.now())=>callback(stamp)};
}
describe("bounded workspace background interaction", () => {
  it("does no idle work, coalesces input and never schedules its next frame", () => {
    const s=setup();
    expect(s.request).not.toHaveBeenCalled();
    for(let i=0;i<80;i++)s.move();
    expect(s.request).toHaveBeenCalledTimes(1);
    s.paint();
    expect(s.glow.style.transform).toBe("translate3d(20px,40px,0)");
    expect(s.request).toHaveBeenCalledTimes(1);
    s.now.mockReturnValue(116);s.move();
    expect(s.request).toHaveBeenCalledTimes(1);
    s.now.mockReturnValue(140);s.move();
    expect(s.request).toHaveBeenCalledTimes(2);
    s.stop();
  });
  it("cancels pending work on blur and blocks input until focus returns", () => {
    const s=setup();s.move();window.dispatchEvent(new Event("blur"));
    expect(s.cancel).toHaveBeenCalledWith(7);
    expect(s.glow.style.opacity).toBe("0");
    s.move();expect(s.request).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("focus"));s.move();
    expect(s.request).toHaveBeenCalledTimes(2);s.stop();
  });
  it("keeps the rate cap when the frame timestamp predates the actual callback", () => {
    const s=setup();s.move();s.paint(80);
    s.now.mockReturnValue(120);s.move();
    expect(s.request).toHaveBeenCalledTimes(1);
    s.now.mockReturnValue(140);s.move();
    expect(s.request).toHaveBeenCalledTimes(2);s.stop();
  });
  it("cleans up all input work and ignores touch", () => {
    const s=setup();s.move("touch");expect(s.request).not.toHaveBeenCalled();
    s.move();s.stop();s.move();window.dispatchEvent(new Event("focus"));s.move();
    expect(s.request).toHaveBeenCalledTimes(1);expect(s.cancel).toHaveBeenCalledWith(7);
  });
  it("clears the glow on pointer exit", () => {
    const s=setup();s.move();s.paint();
    s.root.dispatchEvent(new Event("pointerleave"));
    expect(s.glow.style.opacity).toBe("0");s.stop();
  });
});
