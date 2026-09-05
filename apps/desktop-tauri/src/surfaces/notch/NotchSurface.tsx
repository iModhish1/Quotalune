import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { FlowSurfaceProps } from "../flow-surface/FlowSurface";
import { QaProviderIcon, formatPercentage } from "../../design-system";
import { NotchGauge } from "./NotchGauge";
import { notchLayout, notchNodes, providerAccent, type NotchForm } from "./notchGeometry";
import { wheelStep } from "../reel/reelGeometry";
import { NotchBody } from "./NotchBody";
import { NotchDetails } from "./NotchDetails";
import "./NotchSurface.css";

export default function NotchSurface(props:FlowSurfaceProps & {form:NotchForm}) {
  const {form,settings,state,providers,focusedIndex=0,onFocusProvider,onToggleExpanded,onRequestCompact,onReveal,onStartDrag,onTogglePinned,demoMode}=props;
  const root=useRef<HTMLElement>(null);
  const [fit,setFit]=useState(settings.scale/100);
  const wheel=useRef({sum:0,lastAt:-Infinity});
  const hoverTimer=useRef<ReturnType<typeof setTimeout>>();
  const clearHover=()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);};
  useEffect(()=>()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);},[]);
  const focus=Math.max(0,Math.min(focusedIndex,providers.length-1));
  const selected=providers[focus];
  const layout=notchLayout(form,state,settings.anchor,providers.length);
  const hidden=state === "hidden" || state === "peek";
  const mirror=settings.anchor.includes("left");
  const nodes=notchNodes(form,providers.length);
  const page=Math.floor(focus/3)*3;
  const cycle=(step:number)=>{if(providers.length) onFocusProvider?.((focus+step+providers.length)%providers.length);};
  useLayoutEffect(()=>{
    if(!root.current || typeof ResizeObserver === "undefined") return;
    const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width && height)setFit(Math.min(width/layout.width,height/layout.height));});
    observer.observe(root.current);return()=>observer.disconnect();
  },[layout.width,layout.height]);
  return <section ref={root} tabIndex={0} className="notch-host" aria-label={`${form} provider selector`}
    onMouseEnter={clearHover} onMouseLeave={()=>{clearHover();if(layout.detail && state!=="pinned")hoverTimer.current=setTimeout(()=>onRequestCompact?.(),220);}}
    onWheel={e=>{if(e.ctrlKey)return;clearHover();const next=wheelStep(wheel.current,e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?200:1),performance.now());wheel.current=next.state;if(next.step)cycle(next.step);}}
    onKeyDown={e=>{if(!["ArrowDown","ArrowUp","ArrowRight","ArrowLeft","Home","End","Escape"].includes(e.key))return;e.preventDefault();e.stopPropagation();
      clearHover();root.current?.focus({preventScroll:true});if(e.key==="Escape")onRequestCompact?.();else if(e.key==="Home")onFocusProvider?.(0);else if(e.key==="End")onFocusProvider?.(Math.max(0,providers.length-1));else cycle(["ArrowDown","ArrowRight"].includes(e.key)?1:-1);}}>
    <div className="notch-stage" data-form={form} data-anchor={settings.anchor} style={{width:layout.width,height:layout.height,transform:`scale(${fit})`}}>
      {hidden ? <button className="notch-reveal" onClick={onReveal} aria-label="Reveal QuotaArc"><span/></button> : <>
        <div className="notch-core" style={{left:layout.core.x,top:layout.core.y,width:layout.core.width,height:layout.core.height}}>
          <NotchBody form={form} empty={!providers.length} width={layout.core.width} height={layout.core.height} mirror={mirror && form!=="ribbon"} flip={(form==="ribbon" && settings.anchor==="bottom") || (form==="cradle" && settings.anchor.startsWith("top"))}/>
          {nodes.map((node,slot)=>{
            const index=form === "deck" ? focus : form === "satellite" ? (focus+(slot===2?-1:slot)+providers.length)%providers.length : (page+slot)%providers.length;
            const provider=providers[index];
            const x=mirror && form!=="deck" ? layout.core.width-node.x : node.x;
            const y=form==="cradle" && settings.anchor.startsWith("top") ? layout.core.height-node.y : node.y;
            return <button key={provider.id} className="notch-provider" data-focused={index===focus} aria-pressed={index===focus}
              aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}`} title={`${provider.name} · ${provider.primaryLabel}`}
              style={{transform:`translate3d(${x-node.size/2}px,${y-node.size/2}px,0)`,"--gauge-size":`${node.size}px`,"--provider-color":providerAccent(provider.id)} as CSSProperties}
              onMouseEnter={()=>{clearHover();hoverTimer.current=setTimeout(()=>{onFocusProvider?.(index);if(!layout.detail)onToggleExpanded?.();},180);}}
              onMouseLeave={clearHover}
              onClick={()=>{clearHover();onFocusProvider?.(index);if(!layout.detail)onToggleExpanded?.();}}>
              <span className="notch-gauge" key={provider.id}><NotchGauge fraction={provider.arcFraction} size={node.size} color={providerAccent(provider.id)} label={`${provider.name} quota`}/>
                <QaProviderIcon providerId={provider.iconId==="openai"?"codex":provider.iconId} size={Math.round(node.size*.49)}/></span>
              <span className="notch-value">{formatPercentage(provider.primaryValue)}</span>
            </button>;
          })}
          {form==="deck" && selected && <div className="notch-deck-label"><strong title={selected.name}>{selected.name}</strong><span>{selected.primaryLabel}</span><div className="notch-page-dots" aria-hidden="true">{providers.map((p,i)=><i key={p.id} data-active={i===focus}/>)}</div></div>}
          {!selected && <span className="notch-empty">No data</span>}
          <button className="notch-grip" aria-label="Move QuotaArc" title="Drag to move" onMouseDown={e=>{if(e.button===0){e.preventDefault();onStartDrag?.();}}}><span/></button>
          {demoMode && <span className="notch-demo">DEMO</span>}
        </div>
        {layout.detail && selected && <NotchDetails provider={selected} rect={layout.detail} demo={demoMode} pinned={state==="pinned"} onClose={onRequestCompact} onPin={onTogglePinned}/>}
        {layout.detail && <svg className="notch-connector" aria-hidden="true" style={{position:"absolute",pointerEvents:"none",
          left:settings.anchor==="top" || settings.anchor==="bottom" ? layout.width/2-8 : mirror?layout.core.width:layout.detail.width,
          top:settings.anchor==="top" ? layout.core.height : settings.anchor==="bottom" ? layout.detail.height : layout.detail.y+layout.detail.height/2-8}}
          width={settings.anchor==="top" || settings.anchor==="bottom"?16:12} height={settings.anchor==="top" || settings.anchor==="bottom"?12:16}>
          <path fill="#030303" d={settings.anchor==="top"?"M0 12L8 0L16 12Z":settings.anchor==="bottom"?"M0 0L8 12L16 0Z":mirror?"M12 0L0 8L12 16Z":"M0 0L12 8L0 16Z"}/>
        </svg>}
      </>}
      <span className="notch-sr" aria-live="polite">{selected ? `${selected.name}, ${formatPercentage(selected.primaryValue)} ${selected.primaryLabel}, ${focus+1} of ${providers.length}` : "No quota data"}</span>
    </div>
  </section>;
}
