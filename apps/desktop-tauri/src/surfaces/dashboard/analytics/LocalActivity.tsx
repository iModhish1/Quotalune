import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {getCodexWorkspacesSnapshot,getProviderChartData} from '../../../lib/tauri';
import type {CodexLocalProjectUsageSnapshot,SettingsSnapshot} from '../../../types/bridge';
import {useLocale} from '../../../hooks/useLocale';
import {useAnalyticsSources} from '../../../hooks/useAnalyticsSources';
import {useDashboardStructureTheme} from './useDashboardStructureTheme';
import {formatCompactTokens,formatExactTokens} from '../../../lib/analytics/formatTokens';
import type {ChartSpec} from '../../../components/analytics/charts/chartSpec';
const Chart=lazy(()=>import('../../../components/analytics/charts/EChartsSurface'));
export function activityBuckets(daily:{day:string;totalTokens:number}[],mode:'daily'|'weekly'|'cumulative') {
 const grouped=new Map<string,number>();
 for(const point of daily){if(!/^\d{4}-\d{2}-\d{2}$/.test(point.day)||!Number.isFinite(point.totalTokens)||point.totalTokens<0)continue;
  const d=new Date(point.day+'T00:00:00Z');if(!Number.isFinite(d.getTime()))continue;
  if(mode==='weekly')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const key=d.toISOString().slice(0,10);
  grouped.set(key,(grouped.get(key)??0)+point.totalTokens);
 }
 let cumulative=0;return [...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([day,tokens])=>({day,tokens:mode==='cumulative'?(cumulative+=tokens):tokens}));
}

/** Local activity, normalized across the two real local sources this
 *  product has (owner: "device-wide != account-scoped", "do not invent
 *  parity with Codex if fields differ"). Codex's own workspace/project
 *  index (`getCodexWorkspacesSnapshot`) is the richer, Codex-specific
 *  source -- real session list (a genuine structured session record from
 *  Codex's own data model, NOT a file-count guess -- kept deliberately,
 *  see LocalActivity.render.test.tsx), per-project breakdown, its own
 *  data-quality disclosure. Claude has no equivalent workspace index,
 *  but `get_daily_token_history("claude", days)` (rust/src/cost_scanner.rs)
 *  already computes real per-day token counts from the same de-duplicated
 *  local-transcript walk the (permanently cost-ineligible) Claude cost
 *  chart uses -- exposed generically via `getProviderChartData`. Both are
 *  normalized into the same {day,totalTokens}[] shape for the shared
 *  chart/heatmap rendering below; the metric ribbon and disclosure text
 *  are NOT forced to matching parity where the underlying data genuinely
 *  differs (Claude has no local session list or indexed/skipped file
 *  counts to show, and the merged "All compatible" view shows neither,
 *  since a session count or a single top model cannot be honestly summed
 *  across two independent sources). */
interface NormalizedActivity {
 daily: {day:string; totalTokens:number}[];
 totalTokens: number;
 sessionCount: number | null;
 topModel: string | null;
}

function normalizeCodex(snapshot: CodexLocalProjectUsageSnapshot): NormalizedActivity {
 return {daily: snapshot.daily, totalTokens: snapshot.total.totalTokens, sessionCount: snapshot.sessions.length, topModel: null};
}
function mergeDaily(a:{day:string;totalTokens:number}[],b:{day:string;totalTokens:number}[]) {
 const merged=new Map<string,number>();
 for(const p of a)merged.set(p.day,(merged.get(p.day)??0)+p.totalTokens);
 for(const p of b)merged.set(p.day,(merged.get(p.day)??0)+p.totalTokens);
 return [...merged].sort(([x],[y])=>x.localeCompare(y)).map(([day,totalTokens])=>({day,totalTokens}));
}

export default function LocalActivity({settings,isDemo,providerId}:{settings:SettingsSnapshot;isDemo:boolean;providerId:string|null}) {
 const {t}=useLocale(),{theme}=useDashboardStructureTheme(settings);
 const {sources}=useAnalyticsSources();
 const codexAvailable=!isDemo&&sources.some(s=>s.id==='codexLocalActivity'&&s.availability==='available'&&s.capabilities.dailyActivity);
 const claudeAvailable=!isDemo&&sources.some(s=>s.id==='claudeLocalActivity'&&s.availability==='available'&&s.capabilities.dailyActivity);
 const [pickedSource,setPickedSource]=useState<'codex'|'claude'|'all'>('all');
 const [activity,setActivity]=useState<NormalizedActivity|null>(null),[codexDetail,setCodexDetail]=useState<CodexLocalProjectUsageSnapshot|null>(null),[error,setError]=useState(false),[mode,setMode]=useState<'daily'|'weekly'|'cumulative'>('daily');
 // A provider-scoped view (the shared Analytics provider filter) always
 // locks to that one provider -- the "All compatible" merge only makes
 // sense when no single provider is selected, and only when BOTH real
 // sources are actually available (never offer a merge of one).
 const canPickSource=!providerId&&codexAvailable&&claudeAvailable;
 const source:'codex'|'claude'|'all'|null=
  providerId==='codex'?(codexAvailable?'codex':null):
  providerId==='claude'?(claudeAvailable?'claude':null):
  providerId?null:
  canPickSource?pickedSource:codexAvailable?'codex':claudeAvailable?'claude':null;
 useEffect(()=>{let cancelled=false;setActivity(null);setCodexDetail(null);setError(false);if(isDemo||!source)return;
  if(source==='codex'){
   getCodexWorkspacesSnapshot({historyDays:30}).then(value=>{if(cancelled)return;setCodexDetail(value);setActivity(normalizeCodex(value));}).catch(()=>{if(!cancelled)setError(true);});
  } else if(source==='claude') {
   getProviderChartData('claude').then(value=>{if(cancelled)return;
    const daily=value.tokensHistory.map(p=>({day:p.date,totalTokens:p.tokens}));
    const totalTokens=value.localUsage?.thirtyDayTokens??daily.reduce((sum,p)=>sum+p.totalTokens,0);
    setActivity({daily,totalTokens,sessionCount:null,topModel:value.localUsage?.topModel??null});
   }).catch(()=>{if(!cancelled)setError(true);});
  } else {
   Promise.all([getCodexWorkspacesSnapshot({historyDays:30}),getProviderChartData('claude')]).then(([codex,claude])=>{if(cancelled)return;
    const claudeDaily=claude.tokensHistory.map(p=>({day:p.date,totalTokens:p.tokens}));
    const daily=mergeDaily(codex.daily,claudeDaily);
    setActivity({daily,totalTokens:daily.reduce((sum,p)=>sum+p.totalTokens,0),sessionCount:null,topModel:null});
   }).catch(()=>{if(!cancelled)setError(true);});
  }
  return()=>{cancelled=true;};
 },[isDemo,source]);
 const buckets=useMemo(()=>activityBuckets(activity?.daily??[],mode),[activity,mode]);
 const text=theme.material?.text??'#f0f4f8',muted=theme.material?.muted??'#aeb9c5';
 // `aria:{enabled:false}` is deliberate (owner Phase 3N accessibility
 // closure, same root cause as chartSpec.ts's `base()`): with no custom
 // `aria.label.description` set here, ECharts' own AriaComponent was
 // generating a verbose per-bar narration ("This is a chart with type
 // Bar chart named ... the data for 2026-08-14 is 0, 2155839271, ...")
 // and writing it directly over this surface's real `role="img"
 // aria-label={spec.label}` (EChartsSurface.tsx) -- found via a native
 // CDP accessibility audit. The `label` above is already the clean,
 // human summary; disabling ECharts' own generator lets it stand alone.
 const spec:ChartSpec={label:t('V3LocalTokens'),height:320,points:buckets.length,empty:!buckets.length,option:{animation:false,aria:{enabled:false},grid:{left:65,right:24,top:25,bottom:60},tooltip:{trigger:'axis',confine:true,backgroundColor:theme.core,borderColor:theme.coreEdge,textStyle:{color:text},valueFormatter:value=>formatExactTokens(Number(value))},xAxis:{type:'category',data:buckets.map(p=>p.day),axisLabel:{color:muted,hideOverlap:true}},yAxis:{type:'value',min:0,axisLabel:{color:muted,formatter:(v:number)=>formatCompactTokens(v)},splitLine:{lineStyle:{color:theme.hairline}}},series:[{type:'bar',name:t('V3LocalTokens'),data:buckets.map(p=>p.tokens),itemStyle:{color:theme.accent,borderRadius:[4,4,0,0]},barMaxWidth:32}]}};
 const sourceLabel=source==='claude'?'Claude':source==='all'?t('V3ActivityAll'):'Codex';

 // Calendar heatmap (owner: "build a professional contribution/calendar-
 // style visualization now" -- mandatory this phase). Real per-day totals
 // only; no per-day model breakdown exists for either provider (only a
 // 30-day aggregate does), so the tooltip never shows a model field here.
 const daily=activity?.daily??[];
 const maxDaily=daily.reduce((m,p)=>Math.max(m,p.totalTokens),0);
 const calendarRange:[string,string]|null=daily.length?[daily[0].day,daily[daily.length-1].day]:null;
 // See the token-bar `spec` above for why `aria.enabled` is false here too.
 const heatmapSpec:ChartSpec|null=calendarRange?{label:t('V3ActivityHeatmapHeading'),height:180,points:daily.length,empty:!daily.length,option:{
  animation:false,aria:{enabled:false},
  tooltip:{confine:true,backgroundColor:theme.core,borderColor:theme.coreEdge,textStyle:{color:text},formatter:(params:unknown)=>{
   const p=params as {value?:[string,number]};
   if(!p.value)return '';
   const [day,tokens]=p.value;
   return `<div><strong>${day}</strong><br/>${sourceLabel}<br/><small>${t('TokenScopeLocalDevice')}</small><br/>${t('V3ActivityTableTokens')}: <b>${formatExactTokens(tokens)}</b></div>`;
  }},
  visualMap:{show:true,min:0,max:Math.max(1,maxDaily),orient:'horizontal',left:'center',bottom:0,itemWidth:10,itemHeight:70,text:[formatCompactTokens(maxDaily),'0'],textStyle:{color:muted,fontSize:10},inRange:{color:[theme.hairline,theme.accent]}},
  calendar:{range:calendarRange,cellSize:['auto',16],left:50,right:20,top:20,bottom:60,yearLabel:{show:false},monthLabel:{color:muted,fontSize:10},dayLabel:{color:muted,fontSize:9,nameMap:'en'},splitLine:{lineStyle:{color:theme.hairline,width:1}},itemStyle:{color:theme.core,borderColor:theme.hairline,borderWidth:2}},
  series:[{type:'heatmap',coordinateSystem:'calendar',data:daily.map(p=>[p.day,p.totalTokens])}],
 }}:null;

 return <section className="analytics-section local-activity"><header><h2>{t('V3Activity')} · <bdi>{sourceLabel}</bdi></h2><p>{t('V3ActivityHelp')}</p><small>{t('DashboardHistoryChipDays').replace('{}','30')}</small></header>
  {canPickSource&&<nav className="v3-section-nav" aria-label={t('V3ActivitySourceLabel')}>{(['all','codex','claude'] as const).map(id=><button type="button" key={id} aria-pressed={pickedSource===id} onClick={()=>setPickedSource(id)}>{id==='all'?t('V3ActivityAll'):id==='codex'?'Codex':'Claude'}</button>)}</nav>}
  {isDemo?<p className="analytics-empty">{t('V3ActivityDemo')}</p>:!source||error?<p role="status">{t('DashboardValueUnavailable')}</p>:!activity?<p role="status">…</p>:<>
   <dl className="analytics-metric-ribbon"><div className="analytics-comparison-stat"><dt>{t('V3LocalTokens')}</dt><dd title={formatExactTokens(activity.totalTokens)}>{formatCompactTokens(activity.totalTokens)}</dd></div>
    {activity.sessionCount!==null&&<div className="analytics-comparison-stat"><dt>{t('V3LocalSessions')}</dt><dd>{activity.sessionCount.toLocaleString()}</dd></div>}
    {activity.topModel&&<div className="analytics-comparison-stat"><dt>{t('PanelTopModelPrefix')}</dt><dd className="analytics-comparison-stat--text"><bdi>{activity.topModel}</bdi></dd></div>}
   </dl>
   <nav className="v3-section-nav" aria-label={t('V3LocalTokens')}>{(['daily','weekly','cumulative'] as const).map(id=><button type="button" key={id} aria-pressed={mode===id} onClick={()=>setMode(id)}>{t(id==='daily'?'V3Daily':id==='weekly'?'V3Weekly':'V3Cumulative')}</button>)}</nav>
   {buckets.length?<Suspense fallback={<p>…</p>}><Chart spec={spec} unavailable={t('DashboardValueUnavailable')}/></Suspense>:<p>{t('DashboardValueUnavailable')}</p>}

   <h3 className="v3-activity-heatmap-heading">{t('V3ActivityHeatmapHeading')}</h3>
   {heatmapSpec&&heatmapSpec.points?<Suspense fallback={<p>…</p>}><Chart spec={heatmapSpec} unavailable={t('DashboardValueUnavailable')}/></Suspense>:<p role="status">{t('DashboardValueUnavailable')}</p>}
   <small className="analytics-note">{t('V3ActivityMissingNote')}</small>
   <details className="cosmic-disclosure">
    <summary>{t('V3ActivityViewAsTable')}</summary>
    <table className="analytics-table">
     <thead><tr><th>{t('V3ActivityTableDate')}</th><th>{t('V3ActivityTableTokens')}</th></tr></thead>
     <tbody>{[...daily].sort((a,b)=>b.day.localeCompare(a.day)).map(p=><tr key={p.day}><td>{p.day}</td><td title={formatExactTokens(p.totalTokens)}>{p.totalTokens.toLocaleString()}</td></tr>)}</tbody>
    </table>
   </details>

   {codexDetail&&<details className="cosmic-disclosure"><summary>{t('V2DataQuality')}</summary><p>{codexDetail.sourceStatus} · {codexDetail.indexedFileCount} indexed · {codexDetail.skippedFileCount} skipped</p></details>}
  </>}
 </section>;
}
