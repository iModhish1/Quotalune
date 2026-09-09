import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { SettingsSnapshot } from "../types/bridge";
import { WorkspacePresentation, useWorkspacePresentation } from "./WorkspacePresentation";
vi.mock("../hooks/useSettings", () => ({useSettings: (settings: SettingsSnapshot) => ({settings})}));
function Probe() {const prefs=useWorkspacePresentation();return <span>{String(prefs.animations)}:{prefs.density}</span>;}
it("projects density and motion from persisted settings and reacts without remounting", () => {
  const initial={enableAnimations:false,workspacePreferences:{density:"compact",navigation:"side"}} as SettingsSnapshot;
  const {rerender,unmount}=render(<WorkspacePresentation initial={initial}><Probe/></WorkspacePresentation>);
  expect(screen.getByText("false:compact")).toBeInTheDocument();
  expect(document.documentElement.dataset.density).toBe("compact");
  rerender(<WorkspacePresentation initial={{...initial,enableAnimations:true,workspacePreferences:{density:"comfortable",navigation:"side"}}}><Probe/></WorkspacePresentation>);
  expect(screen.getByText("true:comfortable")).toBeInTheDocument();
  unmount();expect(document.documentElement.dataset.density).toBeUndefined();
});
it("low CPU disables chart animation even when general animation is enabled", () => {
  render(<WorkspacePresentation initial={{enableAnimations:true,dashboardPerformancePreset:"lowCpu"} as SettingsSnapshot}><Probe/></WorkspacePresentation>);
  expect(screen.getByText("false:comfortable")).toBeInTheDocument();
});
