import {act, renderHook, waitFor} from "@testing-library/react";
import {beforeEach, expect, it, vi} from "vitest";
import {useProviderInstances} from "./useProviderInstances";
import {getProviderInstances} from "../lib/tauri";
import type {ProviderInstanceSnapshot} from "../types/bridge";

const {events, stops} = vi.hoisted(() => ({events:new Map<string, ()=>void>(),stops:[] as ReturnType<typeof vi.fn>[]}));
vi.mock("@tauri-apps/api/event", () => ({listen:vi.fn((name:string, callback:()=>void)=>{events.set(name,callback);const stop=vi.fn();stops.push(stop);return Promise.resolve(stop);})}));
vi.mock("../lib/tauri",()=>({getProviderInstances:vi.fn()}));
const account:ProviderInstanceSnapshot={instanceId:"codex:two",providerId:"codex",accountId:"two",accountOrdinal:2,accountLabel:null,snapshot:null};
beforeEach(()=>{events.clear();stops.length=0;vi.mocked(getProviderInstances).mockReset();});

it("does not read real accounts in Demo and cancels subscriptions on unmount",async()=>{
  const hook=renderHook(({enabled})=>useProviderInstances(enabled),{initialProps:{enabled:false}});
  expect(getProviderInstances).not.toHaveBeenCalled();
  vi.mocked(getProviderInstances).mockResolvedValue([account]);
  hook.rerender({enabled:true});
  await waitFor(()=>expect(hook.result.current.instances).toEqual([account]));
  hook.rerender({enabled:false});
  expect(hook.result.current.instances).toEqual([]);
  expect(stops.every(stop=>stop.mock.calls.length===1)).toBe(true);
});

it("an older read cannot restore a removed account after a profile change",async()=>{
  let finish!:(value:ProviderInstanceSnapshot[])=>void;
  vi.mocked(getProviderInstances).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue([]);
  const hook=renderHook(()=>useProviderInstances(true));
  await waitFor(()=>expect(getProviderInstances).toHaveBeenCalledTimes(1));
  await act(async()=>{events.get("quotalis:settings-updated")!();});
  await act(async()=>{finish([account]);});
  expect(hook.result.current.instances).toEqual([]);
});

it("store errors clear former account cards instead of silently keeping them",async()=>{
  vi.mocked(getProviderInstances).mockResolvedValueOnce([account]).mockRejectedValue(new Error("unavailable"));
  const hook=renderHook(()=>useProviderInstances(true));
  await waitFor(()=>expect(hook.result.current.instances).toHaveLength(1));
  await act(async()=>{events.get("codex-accounts-updated")!();});
  expect(hook.result.current).toEqual({instances:[],error:true});
});

it("saving presentation does not remove the selected account during the reload",async()=>{
  let finish!:(value:ProviderInstanceSnapshot[])=>void;
  vi.mocked(getProviderInstances).mockResolvedValueOnce([account]).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const hook=renderHook(()=>useProviderInstances(true));
  await waitFor(()=>expect(hook.result.current.instances).toEqual([account]));
  act(()=>{events.get("settings-changed")!();});
  expect(hook.result.current.instances).toEqual([account]);
  await act(async()=>{finish([]);});
  expect(hook.result.current.instances).toEqual([]);
});
