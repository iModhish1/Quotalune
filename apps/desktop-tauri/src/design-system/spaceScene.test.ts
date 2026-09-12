import {afterEach,describe,expect,it,vi} from "vitest";
import {attachSpaceScene} from "./spaceScene";
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
describe("space scene lifecycle",()=>{
 it("bounds drawing and cancels scheduled work plus listeners on dispose",()=>{
  vi.useFakeTimers();const frames=new Map<number,FrameRequestCallback>();let next=0;
  vi.stubGlobal("requestAnimationFrame",(f:FrameRequestCallback)=>{frames.set(++next,f);return next;});vi.stubGlobal("cancelAnimationFrame",(id:number)=>frames.delete(id));
  const context={clearRect:vi.fn(),setTransform:vi.fn(),beginPath:vi.fn(),arc:vi.fn(),fill:vi.fn(),fillRect:vi.fn(),globalAlpha:1,fillStyle:""};
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const root=document.createElement('div'),canvas=document.createElement('canvas');const remove=vi.spyOn(root,'removeEventListener');
  const stop=attachSpaceScene(canvas,root,24);expect(frames.size).toBe(1);
  const fire=(time:number)=>{const [id,fn]=[...frames][0];frames.delete(id);fn(time);};fire(100);
  expect(context.arc).toHaveBeenCalledTimes(96);expect(frames.size).toBe(0);vi.advanceTimersByTime(40);expect(frames.size).toBe(0);vi.advanceTimersByTime(3);expect(frames.size).toBe(1);
  stop();expect(frames.size).toBe(0);vi.advanceTimersByTime(1000);expect(frames.size).toBe(0);expect(remove).toHaveBeenCalledWith('pointermove',expect.any(Function));expect(remove).toHaveBeenCalledWith('pointerleave',expect.any(Function));
 });
});
