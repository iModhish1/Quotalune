import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { surfaceMaterialStyle } from "../../design-system/surfaceMaterial";
import type { FlowSurfaceProps } from "../flow-surface/FlowSurface";
import { QaProviderIcon, formatPercentage, providerGlyphSize } from "../../design-system";
import { NotchGauge } from "./NotchGauge";
import { notchLayout, notchNodes, notchRotates, rotateNotchNode, type NotchForm } from "./notchGeometry";
import { CANONICAL_THEME, catalogBySlug, providerColor } from "../../design-system/themeCatalog";
import { wheelStep } from "../reel/reelGeometry";
import { NotchBody } from "./NotchBody";
import { NotchDetails } from "./NotchDetails";
import "./NotchSurface.css";
import {normalizeSurfaceInteractions} from "../../design-system/surfaceInteractions";
import QuotaArcMark from '../../components/QuotaArcMark';

export default function NotchSurface(props:FlowSurfaceProps & {form:NotchForm}) {
  const theme=catalogBySlug(props.catalog) ?? CANONICAL_THEME;
  const providerAccent=(id:string)=>providerColor(theme,id);
  const {form,settings,state,providers,focusedIndex=0,onFocusProvider,onToggleExpanded,onRequestCompact,onReveal,onStartDrag,onTogglePinned,demoMode,showDemoBadge=true}=props;
  const root=useRef<HTMLElement>(null);
  const interactions=normalizeSurfaceInteractions(settings.interactions);
  const [fit,setFit]=useState(settings.scale/100);
  const wheel=useRef({sum:0,lastAt:-Infinity});
  const hoverTimer=useRef<ReturnType<typeof setTimeout>>();
  const [previewId,setPreviewId]=useState<string>();
  const clearHover=()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);};
  useEffect(()=>()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);},[]);
  useEffect(()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);},[interactions.hoverDetails,interactions.autoFold,interactions.foldDelayMs]);
  const focus=Math.max(0,Math.min(focusedIndex,providers.length-1));
  const selected=(form==="satellite" && providers.find(p=>p.id===previewId)) || providers[focus];
  const layout=notchLayout(form,state,settings.anchor,providers.length);
  const rotated=notchRotates(form,settings.anchor,state,providers.length);
  const clockwise=settings.anchor==="bottom" || settings.anchor.includes("right");
  const hidden=state === "hidden" || state === "peek";
  const mirror=settings.anchor.includes("left");
  const satelliteFolded=form==="satellite" && state==="compact";
  const nodes=satelliteFolded ? (providers.length?[{x:32,y:32,size:44}]:[]) : notchNodes(form,providers.length);
  const page=Math.floor(focus/3)*3;
  const cycle=(step:number)=>{setPreviewId(undefined);if(providers.length) onFocusProvider?.((focus+step+providers.length)%providers.length);};
  useLayoutEffect(()=>{
    if(!root.current || typeof ResizeObserver === "undefined") return;
    const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width && height)setFit(Math.min(width/layout.width,height/layout.height));});
    observer.observe(root.current);return()=>observer.disconnect();
  },[layout.width,layout.height]);
  return <section ref={root} tabIndex={0} className="notch-host" aria-label={`${form} provider selector`}
    style={surfaceMaterialStyle(theme)}
    onMouseEnter={()=>{clearHover();if(satelliteFolded && interactions.hoverDetails)onToggleExpanded?.();}} onMouseLeave={()=>{clearHover();if(interactions.autoFold && state!=="pinned" && (layout.detail || form==="satellite"))hoverTimer.current=setTimeout(()=>{setPreviewId(undefined);onRequestCompact?.();},interactions.foldDelayMs);}}
    onWheel={e=>{if(e.ctrlKey || !interactions.wheelCycle)return;clearHover();const next=wheelStep(wheel.current,e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?200:1),performance.now());wheel.current=next.state;if(next.step)cycle(next.step);}}
    onKeyDown={e=>{if(!["ArrowDown","ArrowUp","ArrowRight","ArrowLeft","Home","End","Escape"].includes(e.key))return;e.preventDefault();e.stopPropagation();
      clearHover();root.current?.focus({preventScroll:true});if(e.key==="Escape")onRequestCompact?.();else if(e.key==="Home")onFocusProvider?.(0);else if(e.key==="End")onFocusProvider?.(Math.max(0,providers.length-1));else cycle(["ArrowDown","ArrowRight"].includes(e.key)?1:-1);}}>
    <div className="notch-stage" data-form={form} data-rotated={rotated} data-folded={satelliteFolded} data-anchor={settings.anchor} style={{width:layout.width,height:layout.height,transform:`scale(${fit})`}}>
      {hidden ? <button className="notch-reveal" onClick={onReveal} aria-label="Reveal Quotalis"><QuotaArcMark size={18}/></button> : <>
        <div className="notch-core" style={{left:layout.core.x,top:layout.core.y,width:layout.core.width,height:layout.core.height}}>
          {satelliteFolded ? <svg className="notch-body" viewBox="0 0 64 84" aria-hidden="true"><rect width="64" height="84" rx="24" fill="#030303"/></svg> : <div style={{position:"absolute",width:rotated?layout.core.height:layout.core.width,height:rotated?layout.core.width:layout.core.height,transformOrigin:"0 0",transform:rotated?(clockwise?`matrix(0,1,-1,0,${layout.core.width},0)`:`matrix(0,-1,1,0,0,${layout.core.height})`):undefined}}><NotchBody form={form} empty={!providers.length} width={rotated?layout.core.height:layout.core.width} height={rotated?layout.core.width:layout.core.height} mirror={!rotated && mirror && form!=="ribbon"} flip={!rotated && ((form==="ribbon" && settings.anchor==="bottom") || (form==="cradle" && settings.anchor.startsWith("top")))}/></div>}
          {nodes.map((node,slot)=>{
            const index=form === "deck" ? focus : form === "satellite" ? (focus+(slot===2?-1:slot)+providers.length)%providers.length : (page+slot)%providers.length;
            const provider=providers[index];
            const oriented=rotated?rotateNotchNode(node,layout.core,settings.anchor):node;
            const x=!rotated && mirror && form!=="deck" ? layout.core.width-node.x : oriented.x;
            const y=!rotated && form==="cradle" && settings.anchor.startsWith("top") ? layout.core.height-node.y : oriented.y;
            return <button key={provider.id} className="notch-provider" data-focused={index===focus} aria-pressed={index===focus}
              aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}`} title={`${provider.name} · ${provider.primaryLabel}`}
              style={{transform:`translate3d(${x-node.size/2}px,${y-node.size/2}px,0)`,"--gauge-size":`${node.size}px`,"--provider-color":providerAccent(provider.id)} as CSSProperties}
              onMouseEnter={()=>{clearHover();if(!interactions.hoverDetails)return;hoverTimer.current=setTimeout(()=>{if(form==="satellite")setPreviewId(provider.id);else onFocusProvider?.(index);if(!layout.detail)onToggleExpanded?.();},180);}}
              onMouseLeave={clearHover}
              onClick={()=>{clearHover();if(form==="satellite")setPreviewId(provider.id);else onFocusProvider?.(index);if(!layout.detail)onToggleExpanded?.();}}>
              <span className="notch-gauge" key={provider.id}><NotchGauge fraction={provider.arcFraction} size={node.size} color={providerAccent(provider.id)} label={`${provider.name} quota`}/>
                <QaProviderIcon providerId={provider.iconId==="openai"?"codex":provider.iconId} size={providerGlyphSize(node.size)}/></span>
              <span className="notch-value">{formatPercentage(provider.primaryValue)}</span>
            </button>;
          })}
          {form==="deck" && selected && <div className="notch-deck-label"><strong title={selected.name}>{selected.name}</strong><span>{selected.primaryLabel}</span><div className="notch-page-dots" aria-hidden="true">{providers.map((p,i)=><i key={p.id} data-active={i===focus}/>)}</div></div>}
          {!selected && <span className="notch-empty">No data</span>}
          <button className="notch-grip" aria-label="Move Quotalis" title="Drag to move" onMouseDown={e=>{if(e.button===0){e.preventDefault();onStartDrag?.();}}}><span/></button>
          {demoMode && showDemoBadge && <span className="notch-demo">DEMO</span>}
        </div>
        {layout.detail && selected && <NotchDetails provider={selected} color={providerAccent(selected.id)} rect={layout.detail} demo={demoMode && showDemoBadge} pinned={state==="pinned"} onClose={onRequestCompact} onPin={onTogglePinned}/>}
        {layout.detail && <svg className="notch-connector" aria-hidden="true" style={{position:"absolute",pointerEvents:"none",
          left:settings.anchor==="top" || settings.anchor==="bottom" ? layout.width/2-8 : mirror?layout.core.width:layout.detail.width,
          top:settings.anchor==="top" ? layout.core.height : settings.anchor==="bottom" ? layout.detail.height : Math.max(layout.core.y+8,Math.min(layout.core.y+layout.core.height-8,layout.detail.y+layout.detail.height/2))-8}}
          width={settings.anchor==="top" || settings.anchor==="bottom"?16:12} height={settings.anchor==="top" || settings.anchor==="bottom"?12:16}>
          <rect fill="#030303" x="0" y="0" width={settings.anchor==="top" || settings.anchor==="bottom"?16:12} height={settings.anchor==="top" || settings.anchor==="bottom"?12:16} rx="6"/>
        </svg>}
      </>}
      <span className="notch-sr" aria-live="polite">{selected ? `${selected.name}, ${formatPercentage(selected.primaryValue)} ${selected.primaryLabel}, ${focus+1} of ${providers.length}` : "No quota data"}</span>
    </div>
  </section>;
}
