import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useRememberSettingsTab } from "./useRememberSettingsTab";
import type { SettingsTabId } from "../../types/bridge";

it("does not fight a different window's remembered tab on shared settings refresh", () => {
  const update = vi.fn().mockResolvedValue(undefined);
  const { rerender } = renderHook(({ active, persisted }: {active: SettingsTabId; persisted: string}) => useRememberSettingsTab(active, persisted, update), {initialProps: {active: "providers" as SettingsTabId, persisted: "providers"}});
  rerender({active: "providers", persisted: "dashboard"});
  rerender({active: "providers", persisted: "general"});
  expect(update).not.toHaveBeenCalled();
  rerender({active: "profiles", persisted: "general"});
  expect(update).toHaveBeenCalledExactlyOnceWith({lastSettingsTab: "profiles"});
});
