import {useEffect,useRef,useState} from "react";
import type {ProviderUsageSnapshot,SettingsSnapshot,ProviderDetail} from "../../../types/bridge";
import {useLocale} from "../../../hooks/useLocale";
import {currentProviderModel} from "../../../lib/analytics/currentProviders";
import {formatResetPresentation} from "../../../lib/resetPresentation";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {ProviderPlanBadge} from "../../../components/providers/ProviderPlanBadge";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";
import QuotalisSelect from "../../../components/analytics/QuotalisSelect";
import {refreshProviders,getProviderDetail,openProviderDashboard,openProviderStatusPage} from "../../../lib/tauri";
import ProviderPlanet from "./ProviderPlanet";
import CurrentLimits from "./CurrentLimits";
import {railDestination,railWindow} from "./railModel";
import {useDashboardStructureTheme} from "./useDashboardStructureTheme";
import {chartProviderColor} from "../../../components/analytics/charts/chartTheme";

export default function ProviderRail({providers,settings,isDemo,onOpenProviders,onAnalytics}: {
 providers:ProviderUsageSnapshot[];settings:SettingsSnapshot;isDemo:boolean;
 onOpenProviders:(id?:string)=>void;onAnalytics:(id?:string)=>void;
}) {
 const {t}=useLocale(),{theme}=useDashboardStructureTheme(settings);
 const resetOptions=useResetStageOptions(settings,"dashboard");
 const [focused,setFocused]=useState(0),[selected,setSelected]=useState<string|null>(null),[capacity,setCapacity]=useState(6),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const [detail,setDetail]=useState<ProviderDetail|null>(null);
 const rail=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null),origin=useRef<HTMLElement|null>(null),drag=useRef<number|null>(null),lastWheel=useRef(-Infinity),suppressClick=useRef(false);
 const index=Math.min(focused,Math.max(0,providers.length-1));
 const {start,end}=railWindow(providers.length,index,capacity);
 const models=currentProviderModel(providers,settings,Date.now());
 const chosen=providers.find(provider=>provider.providerId===selected);
 const move=(delta:number)=>setFocused(current=>railDestination(providers.length,current,delta));
 useEffect(()=>{const el=rail.current;if(!el||typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(([entry])=>setCapacity(Math.max(1,Math.min(7,Math.floor(entry.contentRect.width/148)))));observer.observe(el);return()=>observer.disconnect();},[]);
 useEffect(()=>{const el=rail.current;if(!el)return;
  const wheel=(event:WheelEvent)=>{if(event.ctrlKey||Math.abs(event.deltaY)+Math.abs(event.deltaX)<2)return;const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
   const next=railDestination(providers.length,index,Math.sign(delta));if(next===index)return;event.preventDefault();
   if(performance.now()-lastWheel.current<90)return;lastWheel.current=performance.now();setFocused(next);};
  el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[index,providers.length]);
 useEffect(()=>{if(chosen&&!dialog.current?.open){origin.current=document.activeElement as HTMLElement;dialog.current?.showModal?.();}else if(!chosen&&dialog.current?.open)dialog.current.close();},[chosen]);
 useEffect(()=>{let canceled=false;setDetail(null);setError(null);if(selected&&!isDemo){void(async()=>{try{const result=await getProviderDetail(selected);if(!canceled)setDetail(result);}catch{/* Usage remains available when action metadata cannot be read. */}})();}return()=>{canceled=true;};},[selected,isDemo]);
 const external=async(action:()=>Promise<void>)=>{setError(null);try{await action();}catch(cause){setError(String(cause));}};
 const close=()=>{setSelected(null);dialog.current?.close();origin.current?.focus();};
 const reset=(time:number|null)=>time?formatResetPresentation({...resetOptions,locale:resetOptions.locale??'en-US',resetAt:new Date(time).toISOString()}).fullAriaLabel:t('DashboardValueUnavailable');
 return <section className="provider-rail" aria-label={t('V3Browse')}>
  <header className="provider-rail__header"><div><h2>{t('DashboardLimitsNow')}</h2><p>{t('V3RailHelp')}</p></div><QuotalisSelect label={t('V3Browse')} value={providers[index]?.providerId??''} searchable options={providers.map(p=>({value:p.providerId,label:p.displayName,providerId:p.providerId}))} onChange={id=>setFocused(providers.findIndex(p=>p.providerId===id))}/></header>
  <div className="provider-rail__viewport" ref={rail} onPointerDown={e=>{if(e.button===0){drag.current=e.clientX;suppressClick.current=false;}}} onPointerUp={e=>{if(drag.current!==null&&Math.abs(e.clientX-drag.current)>40){suppressClick.current=true;setTimeout(()=>{suppressClick.current=false;},0);move((e.clientX<drag.current?1:-1)*(document.documentElement.dir==='rtl'?-1:1));drag.current=null;e.preventDefault();}else drag.current=null;}} onPointerCancel={()=>drag.current=null}>
   <div className="provider-rail__track" role="toolbar" aria-label={t('V3Browse')} onKeyDown={e=>{const rtl=document.documentElement.dir==='rtl';const delta=e.key==='Home'?-providers.length:e.key==='End'?providers.length:e.key==='PageDown'?capacity:e.key==='PageUp'?-capacity:e.key===(rtl?'ArrowLeft':'ArrowRight')?1:e.key===(rtl?'ArrowRight':'ArrowLeft')?-1:0;
    if(delta){e.preventDefault();const next=railDestination(providers.length,index,delta);setFocused(next);requestAnimationFrame(()=>rail.current?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus());}}}>
    {providers.slice(start,end).map((provider,offset)=>{const i=start+offset,model=models[i],window=model.windows[0]?.window;return <button type="button" aria-haspopup="dialog" aria-current={i===index ? "true" : undefined} tabIndex={i===index?0:-1} className="provider-rail__node" data-index={i} key={provider.providerId} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}setFocused(i);setSelected(provider.providerId);}} aria-label={`${provider.displayName}, ${model.ready&&window?`${window.usedPercent}% ${t('PanelUsedSuffix')}`:t('DashboardNeedsAttention')}`}>
      <ProviderPlanet providerId={provider.providerId} used={window?.usedPercent??null} color={chartProviderColor(theme,settings,provider.providerId,document.documentElement)}/>
      <strong><bdi>{provider.displayName}</bdi></strong><ProviderPlanBadge plan={provider.planName}/>
      {window?<span className="provider-rail__quota"><bdi>{window.remainingPercent.toFixed(0)}%</bdi> {t('FloatBarRemainingSuffix')}<small><bdi>{window.usedPercent.toFixed(0)}%</bdi> {t('PanelUsedSuffix')}</small></span>:<span className="provider-rail__attention">{t(model.ready?'DashboardValueUnavailable':'DashboardNeedsAttention')}</span>}
      <small>{reset(model.nextReset)}</small>
     </button>;})}
   </div>
  </div>
  <footer className="provider-rail__navigation"><button type="button" disabled={index===0} aria-label={t('V3Previous')} onClick={()=>move(-1)}>‹</button><span aria-live="polite"><bdi>{providers.length?start+1:0}–{end} / {providers.length}</bdi></span><button type="button" disabled={index>=providers.length-1} aria-label={t('V3Next')} onClick={()=>move(1)}>›</button></footer>
  <dialog ref={dialog} className="provider-quick-panel" aria-label={t('V3Details')} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===dialog.current)close();}}>
   {chosen&&isDemo&&<p className="demo-indicator__badge" role="status">{t('DemoIndicatorBadge')} · {t('DemoIndicatorDetail').replace('{}','1')}</p>}
   {chosen&&<><header><ProviderIcon providerId={chosen.providerId} size={32}/><div><h2><bdi>{chosen.displayName}</bdi></h2><ProviderPlanBadge plan={chosen.planName}/></div><button type="button" onClick={close} aria-label={t('V3Close')}>×</button></header>
    <CurrentLimits providers={[chosen]} settings={settings} expanded/>
    <div className="provider-quick-panel__actions"><button type="button" className="primary" onClick={()=>{close();onOpenProviders(chosen.providerId);}}>{t(detail?.canConnect&&!currentProviderModel([chosen],settings,Date.now())[0].ready?'ActionSignIn':'V3Details')}</button>{detail?.dashboardUrl&&<button type="button" onClick={()=>void external(()=>openProviderDashboard(chosen.providerId))}>{t('OpenProviderDashboard')}</button>}{detail?.statusPageUrl&&<button type="button" onClick={()=>void external(()=>openProviderStatusPage(chosen.providerId))}>{t('ActionStatusPage')}</button>}<button type="button" onClick={()=>{close();onAnalytics(chosen.providerId);}}>{t('V3ViewAnalytics')}</button><button type="button" disabled={isDemo||busy} onClick={async()=>{setBusy(true);setError(null);try{await refreshProviders();}catch(cause){setError(String(cause));}finally{setBusy(false);}}}>{t('ActionRefresh')}</button></div>{error&&<p role="alert">{error}</p>}
   </>}
  </dialog>
 </section>;
}
