import {useEffect, useRef, useState, type CSSProperties} from "react";
import {listen} from "@tauri-apps/api/event";
import {backgroundById, customBackgroundId} from "./backgroundCatalog";
import {readWorkspaceBackground} from "../lib/workspaceBackgrounds";
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
  const background = settings.workspacePreferences?.background ?? "cosmic";
  const selected=backgroundById(background);
  const customId=customBackgroundId(background);
  const [customImage,setCustomImage]=useState<{id:string;url:string}|null>(null);
  const [active,setActive]=useState(()=>document.visibilityState==="visible"&&document.hasFocus());
  useEffect(()=>{
    const sync=()=>setActive(document.visibilityState==="visible"&&document.hasFocus());
    window.addEventListener("focus",sync);window.addEventListener("blur",sync);document.addEventListener("visibilitychange",sync);
    return ()=>{window.removeEventListener("focus",sync);window.removeEventListener("blur",sync);document.removeEventListener("visibilitychange",sync);};
  },[]);
  useEffect(()=>{
    if(!customId) return;
    let alive=true;
    const refresh=()=>{void readWorkspaceBackground(customId).then(url=>{if(alive)setCustomImage({id:customId,url});}).catch(()=>{if(alive)setCustomImage(null);});};
    refresh();
    const subscription=listen("workspace-backgrounds-changed",refresh).catch(()=>()=>{});
    return ()=>{alive=false;void subscription.then(unlisten=>unlisten());};
  },[customId]);
  useEffect(() => {
    const root = layer.current?.parentElement;
    if (!enabled || !root || !glow.current) return;
    return attachBackgroundInteraction(root, glow.current);
  }, [enabled]);
  const art = customId ? (customImage?.id===customId ? `linear-gradient(110deg,color-mix(in srgb,var(--workspace-bg) 60%,transparent),transparent),url("${customImage.url}") center/cover` : "none") : selected?.art;
  return <div ref={layer} className="workspace-backdrop" aria-hidden="true" data-interactive={enabled}
    data-motion={selected?.motion} data-animate={enabled&&active&&selected?.kind==="animated"}
    style={art ? {"--workspace-art":art} as CSSProperties : undefined}>
    <div className="workspace-backdrop__art"/>
    <div ref={glow} className="workspace-backdrop__glow"/>
  </div>;
}
