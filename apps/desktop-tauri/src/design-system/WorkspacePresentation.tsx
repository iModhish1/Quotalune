import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useSettings } from "../hooks/useSettings";
import type { SettingsSnapshot } from "../types/bridge";
import "./workspacePresentation.css";
import {analyticsPreferences} from "../lib/analytics/preferences";

const PresentationContext = createContext({ animations: true, density: "comfortable", chartStyle: "precision" });
export const useWorkspacePresentation = () => useContext(PresentationContext);

/** A read-only presentation projection of the existing persisted settings. */
export function WorkspacePresentation({ initial, children }: { initial: SettingsSnapshot; children: ReactNode }) {
  const { settings } = useSettings(initial);
  const density = settings.workspacePreferences?.density ?? "comfortable";
  const animations = settings.enableAnimations !== false && settings.dashboardPerformancePreset !== "lowCpu";
  const chartStyle = analyticsPreferences(settings.analyticsPreferences).chartStyle;
  useEffect(() => {
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.animations = String(animations);
    return () => { delete document.documentElement.dataset.density; delete document.documentElement.dataset.animations; };
  }, [density, animations]);
  return <PresentationContext.Provider value={{animations, density, chartStyle}}>{children}</PresentationContext.Provider>;
}
