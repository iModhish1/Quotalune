import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const eventMocks = vi.hoisted(() => {
  const listeners: Record<string, () => void> = {};
  return {
    listeners,
    listen: vi.fn((name: string, cb: () => void) => {
      listeners[name] = cb;
      return Promise.resolve(() => {
        delete listeners[name];
      });
    }),
  };
});

const tauriMocks = vi.hoisted(() => ({
  getSettingsSnapshot: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => eventMocks);
vi.mock("../lib/tauri", () => tauriMocks);

import { useSettings } from "./useSettings";
import type { SettingsSnapshot } from "../types/bridge";

const snapshot = (windowScalePercent: number) =>
  ({ windowScalePercent }) as unknown as SettingsSnapshot;

describe("useSettings live sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-fetches the snapshot when settings-changed fires from another window", async () => {
    tauriMocks.getSettingsSnapshot.mockResolvedValue(snapshot(100));
    // Stable identity: the hook's bootstrap effect keys on `initial`, so a new
    // object each render would loop forever.
    const initial = snapshot(100);
    const { result } = renderHook(() => useSettings(initial));

    // The hook registers a "settings-changed" listener.
    await waitFor(() =>
      expect(eventMocks.listeners["settings-changed"]).toBeTypeOf("function"),
    );

    // A change persisted by the detached Settings window bumps the scale.
    tauriMocks.getSettingsSnapshot.mockResolvedValue(snapshot(175));
    await act(async () => {
      eventMocks.listeners["settings-changed"]();
    });

    await waitFor(() =>
      expect(result.current.settings.windowScalePercent).toBe(175),
    );
  });

  it("unsubscribes the listener on unmount", async () => {
    const unlisten = vi.fn();
    eventMocks.listen.mockResolvedValueOnce(unlisten);
    tauriMocks.getSettingsSnapshot.mockResolvedValue(snapshot(100));

    const initial = snapshot(100);
    const { unmount } = renderHook(() => useSettings(initial));
    await waitFor(() => expect(eventMocks.listen).toHaveBeenCalled());

    unmount();
    await waitFor(() => expect(unlisten).toHaveBeenCalledTimes(1));
  });
  it('refreshes on the catalog/profile settings broadcast as well',async()=>{
    tauriMocks.getSettingsSnapshot.mockResolvedValue(snapshot(100));
    const initial=snapshot(100);
    const {result,unmount}=renderHook(()=>useSettings(initial));
    await waitFor(()=>expect(eventMocks.listeners['quotalis:settings-updated']).toBeTypeOf('function'));
    tauriMocks.getSettingsSnapshot.mockResolvedValue(snapshot(125));
    await act(async()=>eventMocks.listeners['quotalis:settings-updated']());
    expect(result.current.settings.windowScalePercent).toBe(125);
    unmount();
    await waitFor(()=>expect(eventMocks.listeners['quotalis:settings-updated']).toBeUndefined());
  });
});


it("accepts a same-window persisted patch and rejects an older bootstrap fetch", async () => {
  let resolve!: (value: SettingsSnapshot) => void;
  tauriMocks.getSettingsSnapshot.mockReturnValueOnce(new Promise<SettingsSnapshot>(r => {resolve=r;}));
  const initial = snapshot(100);
  const {result} = renderHook(() => useSettings(initial));
  act(() => window.dispatchEvent(new CustomEvent("quotalis:settings-updated", {detail:snapshot(175)})));
  expect(result.current.settings.windowScalePercent).toBe(175);
  await act(async () => resolve(snapshot(100)));
  expect(result.current.settings.windowScalePercent).toBe(175);
});
