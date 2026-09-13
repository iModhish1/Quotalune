import {ProviderResetBadge,ProviderResetDetails} from '../../../components/providers/ProviderResets';
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {ProviderUsageSnapshot,SettingsSnapshot,ProviderDetail,ProviderInstanceSnapshot,ProviderInstancePresentation,ProviderBadgePosition} from "../../../types/bridge";
import {useLocale} from "../../../hooks/useLocale";
import {currentProviderModel} from "../../../lib/analytics/currentProviders";
import {formatResetPresentation} from "../../../lib/resetPresentation";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {ProviderPlanBadge} from "../../../components/providers/ProviderPlanBadge";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";
import QuotalisSelect from "../../../components/analytics/QuotalisSelect";
import {refreshProviders,codexAccountFetch,getProviderDetail,openProviderDashboard,openProviderStatusPage} from "../../../lib/tauri";
import {DEFAULT_INSTANCE_PRESENTATION,moveCircularProviderInstance,providerInstanceName} from "../../../lib/providerInstances";
import {useReducedMotion} from "../../../design-system/motion";
import type {LocaleKey} from "../../../i18n/keys";
const badgeOptions: [ProviderBadgePosition, LocaleKey][] = [
 ['top-left','BadgeTopLeft'],['top-center','BadgeTopCenter'],['top-right','BadgeTopRight'],
 ['middle-left','BadgeMiddleLeft'],['middle-right','BadgeMiddleRight'],
 ['bottom-left','BadgeBottomLeft'],['bottom-center','BadgeBottomCenter'],['bottom-right','BadgeBottomRight'],
];
import ProviderPlanet from "./ProviderPlanet";
import CurrentLimits from "./CurrentLimits";
import {railDestination,circularRailIndices} from "./railModel";
import {useDashboardStructureTheme} from "./useDashboardStructureTheme";
import {chartProviderColor} from "../../../components/analytics/charts/chartTheme";

function BadgePositionPicker({label,value,onChange}: {label:string;value:ProviderBadgePosition;onChange:(value:ProviderBadgePosition)=>void}) {
 const {t}=useLocale();
 return <fieldset className="provider-position-picker"><legend>{label}</legend>
  <div className="provider-position-picker__grid" dir="ltr">
   {badgeOptions.map(([position,key],index)=><button type="button" key={position}
    style={{gridArea:`${Math.floor((index<4?index:index+1)/3)+1} / ${(index<4?index:index+1)%3+1}`}}
    aria-label={`${label}: ${t(key)}`} aria-pressed={value===position} onClick={()=>onChange(position)}>{t(key)}</button>)}
   <span className="provider-position-picker__center" aria-hidden="true">◉</span>
  </div>
 </fieldset>;
}

export default function ProviderRail({providers,settings,isDemo,onOpenProviders,onAnalytics,instances,presentation=DEFAULT_INSTANCE_PRESENTATION,onPresentationChange,savingPresentation=false}: {
 providers:ProviderUsageSnapshot[];settings:SettingsSnapshot;isDemo:boolean;
 onOpenProviders:(id?:string)=>void;onAnalytics:(id?:string)=>void;
 instances?:ProviderInstanceSnapshot[];presentation?:ProviderInstancePresentation;
 onPresentationChange?:(value:Partial<ProviderInstancePresentation>)=>Promise<void>;savingPresentation?:boolean;
}) {
 const {t}=useLocale(),{theme}=useDashboardStructureTheme(settings);
 const systemReducedMotion=useReducedMotion();
 const animateMovement=settings.enableAnimations!==false&&!systemReducedMotion;
 const resetOptions=useResetStageOptions(settings,"dashboard");
 const [focusedId,setFocusedId]=useState<string|null>(null),[selected,setSelected]=useState<string|null>(null),[capacity,setCapacity]=useState(4),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const [detail,setDetail]=useState<ProviderDetail|null>(null);
 const rail=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null),origin=useRef<HTMLElement|null>(null),drag=useRef<number|null>(null),lastWheel=useRef(-Infinity),suppressClick=useRef(false);
 const cards:ProviderInstanceSnapshot[]=instances??providers.map(snapshot=>({instanceId:snapshot.providerId,providerId:snapshot.providerId,accountId:null,accountOrdinal:null,accountLabel:null,snapshot}));
 const preferredId=focusedId??presentation.anchorId;
 const index=Math.max(0,cards.findIndex(card=>card.instanceId===preferredId));
 const visible=circularRailIndices(cards.length,index,Math.min(capacity,presentation.visibleCount??4));
 const positions=useRef(new Map<string,number>());
 useLayoutEffect(()=>{
  const next=new Map<string,number>();
  rail.current?.querySelectorAll<HTMLElement>('[data-instance-id]').forEach(node=>{
   const id=node.dataset.instanceId!,left=node.offsetLeft;
   const previous=positions.current.get(id);next.set(id,left);
   if(previous!==undefined&&previous!==left&&animateMovement&&!rail.current?.closest('[data-qa-motion="off"], [data-qa-motion="reduced"]'))
    node.animate?.([{transform:`translateX(${previous-left}px)`},{transform:'translateX(0)'}],{duration:180,easing:'ease-out'});
  });positions.current=next;
 });
 const focus=(next:number)=>{const id=cards[next]?.instanceId;if(!id)return;setFocusedId(id);void onPresentationChange?.({anchorId:id});};
 const rtl=document.documentElement.dir==='rtl';
 const badgePosition=presentation.badgePosition==='start'?(rtl?'top-right':'top-left'):presentation.badgePosition==='end'?(rtl?'top-left':'top-right'):presentation.badgePosition;
 const resetPosition=presentation.resetPosition==='start'?(rtl?'top-right':'top-left'):presentation.resetPosition==='end'?(rtl?'top-left':'top-right'):presentation.resetPosition??'bottom-center';
 const models=cards.map(card=>card.snapshot?currentProviderModel([card.snapshot],settings,Date.now())[0]:null);
 const chosenInstance=cards.find(card=>card.instanceId===selected);
 const chosen=chosenInstance?.snapshot;
 const managed=Boolean(chosenInstance?.accountId&&chosenInstance.instanceId!==chosenInstance.providerId);
 const rearrange=(delta:number)=>{
  if(!chosenInstance||!onPresentationChange)return;
  const order=moveCircularProviderInstance(cards.map(c=>c.instanceId),chosenInstance.instanceId,delta);
  const anchorId=order[index]??null;setFocusedId(anchorId);
  void onPresentationChange({order,anchorId});
 };
 const move=(delta:number)=>focus(railDestination(cards.length,index,delta));
 useEffect(()=>{const el=rail.current;if(!el||typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(([entry])=>setCapacity(Math.max(1,Math.min(4,Math.floor(entry.contentRect.width/148)))));observer.observe(el);return()=>observer.disconnect();},[]);
 useEffect(()=>{const el=rail.current;if(!el)return;
  const wheel=(event:WheelEvent)=>{if(event.ctrlKey||Math.abs(event.deltaY)+Math.abs(event.deltaX)<2)return;const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
   const next=railDestination(cards.length,index,Math.sign(delta));if(next===index)return;event.preventDefault();
   if(performance.now()-lastWheel.current<90)return;lastWheel.current=performance.now();focus(next);};
  el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[index,cards.map(c=>c.instanceId).join("|"),onPresentationChange]);
 useEffect(()=>{if(chosenInstance&&!dialog.current?.open){origin.current=document.activeElement as HTMLElement;dialog.current?.showModal?.();}else if(!chosenInstance&&dialog.current?.open)dialog.current.close();},[chosenInstance]);
 useEffect(()=>{let canceled=false;setDetail(null);setError(null);if(chosenInstance&&!managed&&!isDemo){void(async()=>{try{const result=await getProviderDetail(chosenInstance.providerId);if(!canceled)setDetail(result);}catch{/* Usage remains available when action metadata cannot be read. */}})();}return()=>{canceled=true;};},[selected,managed,isDemo]);
 const external=async(action:()=>Promise<void>)=>{setError(null);try{await action();}catch(cause){setError(String(cause));}};
 const close=()=>{setSelected(null);dialog.current?.close();origin.current?.focus();};
 const reset=(time:number|null)=>time?formatResetPresentation({...resetOptions,locale:resetOptions.locale??'en-US',resetAt:new Date(time).toISOString()}).fullAriaLabel:t('DashboardValueUnavailable');
 return <section className="provider-rail" data-motion={animateMovement?'full':'off'} aria-label={t('V3Browse')}>
  <header className="provider-rail__header"><div><h2>{t('DashboardLimitsNow')}</h2><p>{t('V3RailHelp')}</p></div><QuotalisSelect label={t('V3Browse')} value={cards[index]?.instanceId??''} searchable options={cards.map(p=>({value:p.instanceId,label:providerInstanceName(p),providerId:p.providerId}))} onChange={id=>focus(cards.findIndex(p=>p.instanceId===id))}/></header>
  <div className="provider-rail__viewport" ref={rail} onPointerDown={e=>{if(e.button===0){drag.current=e.clientX;suppressClick.current=false;}}} onPointerUp={e=>{if(drag.current!==null&&Math.abs(e.clientX-drag.current)>40){suppressClick.current=true;setTimeout(()=>{suppressClick.current=false;},0);move((e.clientX<drag.current?1:-1)*(document.documentElement.dir==='rtl'?-1:1));drag.current=null;e.preventDefault();}else drag.current=null;}} onPointerCancel={()=>drag.current=null}>
   <div className="provider-rail__track" role="toolbar" aria-label={t('V3Browse')} onKeyDown={e=>{const rtl=document.documentElement.dir==='rtl';const delta=e.key==='Home'?-cards.length:e.key==='End'?cards.length:e.key==='PageDown'?capacity:e.key==='PageUp'?-capacity:e.key===(rtl?'ArrowLeft':'ArrowRight')?1:e.key===(rtl?'ArrowRight':'ArrowLeft')?-1:0;
    if(delta){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?cards.length-1:railDestination(cards.length,index,delta);focus(next);requestAnimationFrame(()=>rail.current?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus());}}}>
    {visible.map(i=>{const card=cards[i],provider=card.snapshot,model=models[i],window=model?.windows[0]?.window;return <button type="button" aria-haspopup="dialog" aria-current={i===index ? "true" : undefined} tabIndex={i===index?0:-1} className="provider-rail__node" data-index={i} data-instance-id={card.instanceId} key={card.instanceId} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}focus(i);setSelected(card.instanceId);}} aria-label={`${providerInstanceName(card)}, ${model?.ready&&window?`${window.usedPercent}% ${t('PanelUsedSuffix')}`:t('DashboardNeedsAttention')}`}>
      <span className="provider-instance-mark" data-badge-position={badgePosition}
       data-account-badge={Boolean(presentation.showAccountNumbers&&card.accountOrdinal)} data-reset-position={presentation.showResetBadge!==false?resetPosition:undefined}>
      <ProviderPlanet providerId={card.providerId} used={window?.usedPercent??null} color={chartProviderColor(theme,settings,card.providerId,document.documentElement)}/>
      {presentation.showAccountNumbers&&card.accountOrdinal&&<span className="provider-instance-badge" aria-hidden="true">{card.accountOrdinal}</span>}
      {presentation.showResetBadge!==false&&<span className="provider-reset-position" data-position={resetPosition}><ProviderResetBadge facts={card.resetFacts??provider?.resetFacts}/></span>}</span>
      <strong><bdi>{providerInstanceName(card)}</bdi></strong>{card.accountLabel&&!settings.hidePersonalInfo&&<small><bdi>{card.accountLabel}</bdi></small>}<ProviderPlanBadge plan={provider?.planName??null}/>
      {window?<span className="provider-rail__quota"><bdi>{window.remainingPercent.toFixed(0)}%</bdi> {t('FloatBarRemainingSuffix')}<small><bdi>{window.usedPercent.toFixed(0)}%</bdi> {t('PanelUsedSuffix')}</small></span>:<span className="provider-rail__attention">{t(!provider?'CodexAccountsUsageUnavailable':model?.ready?'DashboardValueUnavailable':'DashboardNeedsAttention')}</span>}
      <small>{reset(model?.nextReset??null)}</small>
     </button>;})}
   </div>
  </div>
  <footer className="provider-rail__navigation"><button type="button" disabled={cards.length<2} aria-label={t('V3Previous')} onClick={()=>move(-1)}>‹</button><span aria-live="polite"><bdi>{cards.length?index+1:0} · {visible.length} / {cards.length}</bdi></span><button type="button" disabled={cards.length<2} aria-label={t('V3Next')} onClick={()=>move(1)}>›</button></footer>
  <dialog ref={dialog} className="provider-quick-panel" aria-label={t('V3Details')} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===dialog.current)close();}}>
   {chosenInstance&&isDemo&&<p className="demo-indicator__badge" role="status">{t('DemoIndicatorBadge')} · {t('DemoIndicatorDetail').replace('{}','1')}</p>}
   {chosenInstance&&<><header><ProviderIcon providerId={chosenInstance.providerId} size={32}/><div><h2><bdi>{providerInstanceName(chosenInstance)}</bdi></h2><ProviderPlanBadge plan={chosen?.planName??null}/></div><button type="button" onClick={close} aria-label={t('V3Close')}>×</button></header>
    {chosenInstance.accountLabel&&!settings.hidePersonalInfo&&<p><bdi>{chosenInstance.accountLabel}</bdi></p>}
    {chosen?<><CurrentLimits providers={[chosen]} settings={settings} expanded/>{managed&&<p>{t('LastUpdated')}: <bdi>{chosen.updatedAt}</bdi></p>}</>:<p role="status">{t('CodexAccountsUsageUnavailable')}</p>}
    {!chosen&&<ProviderResetDetails facts={chosenInstance.resetFacts}/>}
    {managed&&<p>{t('InstanceHistoryUnavailable')}</p>}
    {onPresentationChange&&<fieldset className="provider-instance-preferences" disabled={savingPresentation}>
      <legend>{t('InstanceArrangement')}</legend>
      <div className="provider-quick-panel__actions">
        <button type="button" disabled={cards.length<2} onClick={()=>rearrange(rtl?1:-1)}>{t('InstanceMoveLeft')}</button>
        <button type="button" disabled={cards.length<2} onClick={()=>rearrange(rtl?-1:1)}>{t('InstanceMoveRight')}</button>
      </div>
      <BadgePositionPicker label={t('InstanceBadgePosition')} value={badgePosition} onChange={value=>void onPresentationChange({badgePosition:value})}/>
      <BadgePositionPicker label={t('ResetBadgePosition')} value={resetPosition} onChange={value=>void onPresentationChange({resetPosition:value})}/>
      <button type="button" role="switch" aria-checked={presentation.showResetBadge!==false} onClick={()=>void onPresentationChange({showResetBadge:presentation.showResetBadge===false})}>{t('ResetShowBadge')}</button>
      <fieldset className="provider-instance-count"><legend>{t('InstanceVisibleCount')}</legend>
        <div className="provider-instance-count__choices">
          {([3,4] as const).map(count=><button type="button" key={count}
            aria-pressed={(presentation.visibleCount??4)===count}
            onClick={()=>void onPresentationChange({visibleCount:count})}>{count}</button>)}
        </div>
      </fieldset>
      <button type="button" role="switch" aria-checked={presentation.showAccountNumbers} onClick={()=>void onPresentationChange({showAccountNumbers:!presentation.showAccountNumbers})}>{t('InstanceShowNumbers')}</button>
    </fieldset>}
    <div className="provider-quick-panel__actions">
      <button type="button" className="primary" onClick={()=>{close();onOpenProviders(chosenInstance.providerId);}}>{t(managed?'ProviderAccountsTitle':detail?.canConnect&&chosen&&!currentProviderModel([chosen],settings,Date.now())[0].ready?'ActionSignIn':'V3Details')}</button>
      {detail?.dashboardUrl&&!managed&&<button type="button" onClick={()=>void external(()=>openProviderDashboard(chosenInstance.providerId))}>{t('OpenProviderDashboard').replace('{}',chosen?.displayName??chosenInstance.providerId)}</button>}
      {detail?.statusPageUrl&&!managed&&<button type="button" onClick={()=>void external(()=>openProviderStatusPage(chosenInstance.providerId))}>{t('ActionStatusPage')}</button>}
      {!managed&&<button type="button" onClick={()=>{close();onAnalytics(chosenInstance.providerId);}}>{t('V3ViewAnalytics')}</button>}
      <button type="button" disabled={isDemo||busy} onClick={async()=>{setBusy(true);setError(null);try{if(managed&&chosenInstance.accountId)await codexAccountFetch(chosenInstance.accountId);else await refreshProviders();}catch{setError(t('InstanceRefreshFailed'));}finally{setBusy(false);}}}>{t('ActionRefresh')}</button>
    </div>{error&&<p role="alert">{error}</p>}
   </>}

  </dialog>
 </section>;
}
