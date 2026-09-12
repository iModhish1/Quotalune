import {useEffect, useRef} from "react";
import type {SettingsSnapshot} from "../types/bridge";
import {useReducedMotion} from "./motion";
import {attachBackgroundInteraction} from "./backgroundMotion";
import "./WorkspaceBackdrop.css";

export function backgroundInteractionAllowed(settings: SettingsSnapshot, reducedMotion: boolean | null): boolean {
  return settings.workspacePreferences?.backgroundMotion === "interactive"
    && settings.workspacePreferences?.background !== "none"
    && settings.enableAnimations !== false
    && settings.dashboardPerformancePreset !== "lowCpu"
    && reducedMotion === false;
}

export default function WorkspaceBackdrop({settings}: {settings: SettingsSnapshot}) {
  const layer = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const enabled = backgroundInteractionAllowed(settings, reducedMotion);
  useEffect(() => {
    const root = layer.current?.parentElement;
    if (!enabled || !root || !glow.current) return;
    return attachBackgroundInteraction(root, glow.current);
  }, [enabled]);
  return <div ref={layer} className="workspace-backdrop" aria-hidden="true" data-interactive={enabled}>
    <div className="workspace-backdrop__art"/>
    <div ref={glow} className="workspace-backdrop__glow"/>
  </div>;
}
