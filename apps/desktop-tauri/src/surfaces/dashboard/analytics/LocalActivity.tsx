import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {getCodexWorkspacesSnapshot,getProviderChartData} from '../../../lib/tauri';
import type {CodexLocalProjectUsageSnapshot,SettingsSnapshot} from '../../../types/bridge';
import {useLocale} from '../../../hooks/useLocale';
import {useDashboardStructureTheme} from './useDashboardStructureTheme';
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
 *  source -- real session list, per-project breakdown, its own data-
 *  quality disclosure. Claude has no equivalent workspace index, but
 *  `get_daily_token_history("claude", days)` (rust/src/cost_scanner.rs)
 *  already computes real per-day token counts from the same de-duplicated
 *  local-transcript walk the (permanently cost-ineligible) Claude cost
 *  chart uses -- exposed generically via `getProviderChartData`. Both are
 *  normalized into the same {day,totalTokens}[] shape for the shared
 *  chart/heatmap rendering below; the metric ribbon and disclosure text
 *  are NOT forced to matching parity where the underlying data genuinely
 *  differs (Claude has no local session list or indexed/skipped file
 *  counts to show). */
interface NormalizedActivity {
 daily: {day:string; totalTokens:number}[];
 totalTokens: number;
 sessionCount: number | null;
 topModel: string | null;
}

function normalizeCodex(snapshot: CodexLocalProjectUsageSnapshot): NormalizedActivity {
 return {daily: snapshot.daily, totalTokens: snapshot.total.totalTokens, sessionCount: snapshot.sessions.length, topModel: null};
}

export default function LocalActivity({settings,isDemo,providerId}:{settings:SettingsSnapshot;isDemo:boolean;providerId:string|null}) {
 const {t}=useLocale(),{theme}=useDashboardStructureTheme(settings);
 const [activity,setActivity]=useState<NormalizedActivity|null>(null),[codexDetail,setCodexDetail]=useState<CodexLocalProjectUsageSnapshot|null>(null),[error,setError]=useState(false),[mode,setMode]=useState<'daily'|'weekly'|'cumulative'>('daily');
 const source:'codex'|'claude'|null=!providerId||providerId==='codex'?'codex':providerId==='claude'?'claude':null;
 useEffect(()=>{let cancelled=false;setActivity(null);setCodexDetail(null);setError(false);if(isDemo||!source)return;
  if(source==='codex'){
   getCodexWorkspacesSnapshot({historyDays:30}).then(value=>{if(cancelled)return;setCodexDetail(value);setActivity(normalizeCodex(value));}).catch(()=>{if(!cancelled)setError(true);});
  } else {
   getProviderChartData('claude').then(value=>{if(cancelled)return;
    const daily=value.tokensHistory.map(p=>({day:p.date,totalTokens:p.tokens}));
    const totalTokens=value.localUsage?.thirtyDayTokens??daily.reduce((sum,p)=>sum+p.totalTokens,0);
    setActivity({daily,totalTokens,sessionCount:null,topModel:value.localUsage?.topModel??null});
   }).catch(()=>{if(!cancelled)setError(true);});
  }
  return()=>{cancelled=true;};
 },[isDemo,source]);
 const buckets=useMemo(()=>activityBuckets(activity?.daily??[],mode),[activity,mode]);
 const text=theme.material?.text??'#f0f4f8',muted=theme.material?.muted??'#aeb9c5';
 const spec:ChartSpec={label:t('V3LocalTokens'),height:320,points:buckets.length,empty:!buckets.length,option:{animation:false,aria:{enabled:true},grid:{left:65,right:24,top:25,bottom:60},tooltip:{trigger:'axis',confine:true,backgroundColor:theme.core,borderColor:theme.coreEdge,textStyle:{color:text},valueFormatter:value=>Number(value).toLocaleString()},xAxis:{type:'category',data:buckets.map(p=>p.day),axisLabel:{color:muted,hideOverlap:true}},yAxis:{type:'value',min:0,axisLabel:{color:muted},splitLine:{lineStyle:{color:theme.hairline}}},series:[{type:'bar',name:t('V3LocalTokens'),data:buckets.map(p=>p.tokens),itemStyle:{color:theme.accent,borderRadius:[4,4,0,0]},barMaxWidth:32}]}};
 const sourceLabel=source==='claude'?'Claude':'Codex';
 return <section className="analytics-section local-activity"><header><h2>{t('V3Activity')} · <bdi>{sourceLabel}</bdi></h2><p>{t('V3ActivityHelp')}</p><small>{t('DashboardHistoryChipDays').replace('{}','30')}</small></header>
  {isDemo?<p className="analytics-empty">{t('V3ActivityDemo')}</p>:!source||error?<p role="status">{t('DashboardValueUnavailable')}</p>:!activity?<p role="status">…</p>:<>
   <dl className="analytics-metric-ribbon"><div><dt>{t('V3LocalTokens')}</dt><dd>{activity.totalTokens.toLocaleString()}</dd></div>
    {activity.sessionCount!==null&&<div><dt>{t('V3LocalSessions')}</dt><dd>{activity.sessionCount.toLocaleString()}</dd></div>}
    {activity.topModel&&<div><dt>{t('PanelTopModelPrefix')}</dt><dd><bdi>{activity.topModel}</bdi></dd></div>}
   </dl>
   <nav className="v3-section-nav" aria-label={t('V3LocalTokens')}>{(['daily','weekly','cumulative'] as const).map(id=><button type="button" key={id} aria-pressed={mode===id} onClick={()=>setMode(id)}>{t(id==='daily'?'V3Daily':id==='weekly'?'V3Weekly':'V3Cumulative')}</button>)}</nav>
   {buckets.length?<Suspense fallback={<p>…</p>}><Chart spec={spec} unavailable={t('DashboardValueUnavailable')}/></Suspense>:<p>{t('DashboardValueUnavailable')}</p>}
   <div className="v3-activity-heatmap" aria-label={t('V3LocalTokens')}>{activity.daily.map(point=><span key={point.day} tabIndex={0} title={`${sourceLabel} · ${point.day} · ${point.totalTokens.toLocaleString()} ${t('V3LocalTokens')}`} style={{background:point.totalTokens>0?theme.accent:theme.hairline}}><span className="analytics-table__visually-hidden">{point.day}: {point.totalTokens}</span></span>)}</div>
   {codexDetail&&<details className="cosmic-disclosure"><summary>{t('V2DataQuality')}</summary><p>{codexDetail.sourceStatus} · {codexDetail.indexedFileCount} indexed · {codexDetail.skippedFileCount} skipped</p></details>}
  </>}
 </section>;
}
