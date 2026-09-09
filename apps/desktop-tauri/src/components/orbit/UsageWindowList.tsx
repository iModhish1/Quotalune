import type {StageUsageWindow} from "./stageTypes";
import {formatPercentage} from "../../design-system/percent";
import "./UsageWindowList.css";
import "./UsageWindowIdentityContrast.css";
import {resetLabel} from './resetLabel';
import {useState,useRef,type CSSProperties} from 'react';

import type {LimitPresentation} from '../../design-system/limitPresentation';
import {PROVIDER_PRESENTATION_IDENTITY_TOKENS,providerPresentationSemanticTokens} from '../../design-system/providerPresentationIdentity';
import {useOptionalLocale} from '../../hooks/useLocale';
import type {LocaleKey} from '../../i18n/keys';
import {usageTone} from './usageTone';
export type {LimitPresentation} from '../../design-system/limitPresentation';

interface UsageWindowListProps {providerId?:string;windows:StageUsageWindow[];hidden?:boolean;paginate?:boolean;presentation?:LimitPresentation}

export default function UsageWindowList(props:UsageWindowListProps){
  // Reset only when the provider or ordered selection changes, not on quota refresh.
  const identity=JSON.stringify([props.providerId,props.windows.map(window=>window.id)]);
  return <PagedUsageWindows key={identity} {...props}/>;
}

function PagedUsageWindows({windows,hidden=false,presentation,paginate=true}:UsageWindowListProps){
  const locale=useOptionalLocale();
  const text=(key:LocaleKey,fallback:string)=>locale?.t(key)??fallback;
  const [page,setPage]=useState(0);
  const lastWheel=useRef(-Infinity);
  const pages=presentation&&paginate?Math.max(1,Math.ceil(windows.length/2)):1;
  const activePage=Math.min(page,pages-1);
  const visible=presentation&&paginate?windows.slice(activePage*2,activePage*2+2):windows;
  const shape=presentation?.shape??'horizontal',content=presentation?.content??'both';
  const presentationIdentity=presentation?.identity??'adaptive';
  const identityTokens=PROVIDER_PRESENTATION_IDENTITY_TOKENS[presentationIdentity];
  const semanticTokens=providerPresentationSemanticTokens(presentationIdentity);
  const identityStyle={
    '--pi-text':identityTokens.text,
    '--pi-muted':identityTokens.muted,
    '--pi-track':identityTokens.track,
    '--pi-warning':semanticTokens?.warning,
    '--pi-critical':semanticTokens?.critical,
    '--pi-exhausted':semanticTokens?.exhausted,
  } as CSSProperties;
  const advance=(delta:number)=>setPage((activePage+delta+pages)%pages);
  if(hidden)return <p className="quota-window-list">Limit details are hidden for this provider.</p>;
  return <div className="quota-window-list" style={identityStyle} data-provider-identity={presentationIdentity} data-shape={content==='value'?'none':shape} data-paged={!!presentation&&paginate} data-direction={presentation?.direction??'forward'} tabIndex={0} aria-label="Usage limits" onWheel={event=>{
    if(!presentation||!paginate)return;
    event.stopPropagation();
    if(event.ctrlKey||pages<2)return;
    const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
    const now=performance.now();
    if(Math.abs(delta)<4||now-lastWheel.current<160)return;
    lastWheel.current=now;advance(delta>0?1:-1);
  }}>
    {windows.length===0 && <p>No matching limit is available from this provider.</p>}
    {visible.map(window=>{
      const normalizedId=window.id.toLowerCase();
      const normalizedLabel=window.label.toLowerCase();
      const label=normalizedId.includes('weekly')?text('LimitWeeklyLabel','Weekly'):normalizedId.includes('five')||normalizedId.includes('5-hour')?text('LimitFiveHourLabel','5-hour'):normalizedId==='session'&&normalizedLabel==='session'?text('ProviderSessionLabel','Session'):window.label;
      const valueLabel=window.primaryLabel.toLowerCase()==='remaining'?text('FloatBarRemainingSuffix','remaining'):window.primaryLabel.toLowerCase()==='used'?text('PanelUsedSuffix','used'):window.primaryLabel;
      const reset=resetLabel(window.reset,{unavailable:text('ResetUnavailableShort','Reset unavailable'),resetsIn:text('ResetsInShort','Resets in'),reset:text('ResetLabelPrefix','Reset')});
      const tone=usageTone(window.primaryValue,window.primaryLabel);
      return <section key={window.id} className="quota-window-row" data-usage-tone={tone} aria-label={label}>
      <div><strong>{label}</strong>{content!=='bar'&&<span>{formatPercentage(window.primaryValue)} {valueLabel}</span>}</div>
      {content!=='value'&&<div className={`quota-window-meter ${shape==='ring'?'quota-window-meter--ring':''}`} role="meter" aria-label={`${label} ${valueLabel}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={window.primaryValue??undefined}>
        {shape==='ring'?<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="16" pathLength="100" strokeDasharray={`${Math.max(0,Math.min(1,window.arcFraction??0))*100} 100`}/></svg>:<i style={shape==='vertical'?{height:`${Math.max(0,Math.min(1,window.arcFraction??0))*100}%`}:{width:`${Math.max(0,Math.min(1,window.arcFraction??0))*100}%`}}/>}
      </div>}
      <small><bdi>{reset}</bdi></small>
    </section>;})}
    {presentation&&pages>1&&<nav className="quota-window-pages" aria-label="Limit pages"><button type="button" aria-label="Previous limits" onClick={()=>advance(-1)}>‹</button><span aria-live="polite">{activePage+1} / {pages}</span><button type="button" aria-label="Next limits" onClick={()=>advance(1)}>›</button></nav>}
  </div>;
}
