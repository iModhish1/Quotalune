import type {ProviderResetFacts,ProviderUsageSnapshot,ResetDatum} from '../../types/bridge';
import {useLocale} from '../../hooks/useLocale';
import './ProviderResets.css';

export function resetCount(facts:ProviderResetFacts|null|undefined):number|null {
 const data=facts?.bankedResetCards;
 return data?.state==='known'&&Number.isSafeInteger(data.value.reportedAvailableCount)&&data.value.reportedAvailableCount>=0?data.value.reportedAvailableCount:null;
}
export function ProviderResetBadge({facts}:{facts?:ProviderResetFacts|null}) {
 const {t}=useLocale();const count=resetCount(facts);
 return <span className="provider-reset-badge" title={`${t('ResetBanked')}${count===null?`: ${t('ResetUnknown')}`:''}`} aria-label={count===null?t('ResetUnknown'):undefined}>
  {count===null?`— ${t('ResetPlural')}`:count===0?t('ResetNone'):`+${count} ${t(count===1?'ResetSingular':'ResetPlural')}`}
 </span>;
}
/** One shared evidence view; card expiries never become quota reset times. */
export function ProviderResetDetails({facts,provider}:{facts?:ProviderResetFacts|null;provider?:ProviderUsageSnapshot}) {
 const {t,language}=useLocale();const locale=language==='arabic'?'ar-SA':'en-US';
 const date=(value:string)=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString(locale):t('DashboardValueUnavailable');
 const unavailable=(datum?:ResetDatum<unknown>)=>t(datum?.state==='unsupported'?'ResetUnsupported':'DashboardValueUnavailable');
 const windows=provider?[provider.primary,provider.secondary,provider.tertiary,provider.modelSpecific,...(provider.extraRateWindows??[]).map(x=>x.window)]:[];
 const weekly=facts?.nextWeeklyReset;
 const future=(value:string|null|undefined)=>!!value&&Number.isFinite(Date.parse(value))&&Date.parse(value)>Date.now();
 const fallback=!weekly&&provider?.errorState==='ready'?windows.find(w=>w&&!w.isInformational&&w.windowMinutes===10080&&future(w.resetsAt))?.resetsAt:null;
 const last=facts?.lastActualReset,issued=facts?.providerIssuedResets,banked=facts?.bankedResetCards;
 return <details className="provider-reset-details"><summary>{t('ResetDetailsTitle')}</summary>
  <dl>
   <div><dt>{t('ResetLastActual')}</dt><dd>{last?.state==='known'?date(last.value.observedAt):unavailable(last)}</dd></div>
   <div><dt>{t('ResetNextWeekly')}</dt><dd>{weekly?.state==='known'&&future(weekly.value.resetsAt)?date(weekly.value.resetsAt):fallback?date(fallback):unavailable(weekly)}</dd></div>
   <div><dt>{t('ResetProviderIssued')}</dt><dd>{issued?.state==='known'?issued.value:unavailable(issued)}</dd></div>
   <div><dt>{t('ResetBanked')}</dt><dd><ProviderResetBadge facts={facts}/></dd></div>
  </dl>
  {banked?.state==='known'&&<>
   {!banked.value.detailsComplete&&<p>{t('ResetIncompleteDetails')}</p>}
   <ul>{banked.value.cards.map((card,i)=><li key={`${card.opaqueId??'card'}:${i}`}>
    <strong>{t('ResetCard')} {i+1}</strong><span>{t(card.status==='available'?'ResetCardAvailable':card.status==='used'?'ResetCardUsed':card.status==='expired'?'ResetCardExpired':'ResetUnknown')}</span>
    <span>{t('ResetExpires')}: {card.expiresAt.state==='known'?date(card.expiresAt.value):unavailable(card.expiresAt)}</span>
   </li>)}</ul>
  </>}
  {facts&&<small>{t('LastUpdated')}: <bdi>{date(facts.observedAt)}</bdi></small>}
 </details>;
}
