import {useEffect, useRef, useState, type CSSProperties} from "react";
import {listen} from "@tauri-apps/api/event";
import {backgroundById, customBackgroundId} from "./backgroundCatalog";
import {readWorkspaceBackground} from "../lib/workspaceBackgrounds";
import type {SettingsSnapshot} from "../types/bridge";
import {useReducedMotion} from "./motion";
import {attachBackgroundInteraction} from "./backgroundMotion";
import "./WorkspaceBackdrop.css";
import {attachSpaceScene} from "./spaceScene";

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
  const stars = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();
  const enabled = backgroundInteractionAllowed(settings, reducedMotion);
  const background = settings.workspacePreferences?.background ?? "cosmic";
  const selected=backgroundById(background);
  const customId=customBackgroundId(background);
  const [customImage,setCustomImage]=useState<{id:string;url:string}|null>(null);
  const [active,setActive]=useState(()=>document.visibilityState==="visible"&&document.hasFocus());
  const animate=enabled&&active&&selected?.kind==="animated";
  useEffect(()=>{
    if(!animate||!stars.current||!layer.current?.parentElement)return;
    return attachSpaceScene(stars.current,layer.current.parentElement,settings.dashboardPerformancePreset==="highFidelity"?30:24);
  },[animate,settings.dashboardPerformancePreset]);
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
  // Large data URLs exceed WebView2's CSS custom-property token limit. Keep
  // imported pixels in an image element, with a separate theme scrim.
  const art = customId||selected?.image ? "none" : selected?.art;
  const imageUrl=customId?(customImage?.id===customId?customImage.url:null):selected?.image;
  return <div ref={layer} className="workspace-backdrop" aria-hidden="true" data-interactive={enabled}
    data-motion={selected?.motion} data-animate={animate}
    style={art ? {"--workspace-art":art} as CSSProperties : undefined}>
    <div className="workspace-backdrop__art">
      {imageUrl&&<><img className="workspace-backdrop__image" src={imageUrl} alt=""/><span className="workspace-backdrop__scrim"/></>}
    </div>
    {selected?.kind==="animated"&&<canvas ref={stars} className="workspace-backdrop__stars"/>}
    <div ref={glow} className="workspace-backdrop__glow"/>
  </div>;
}
