import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {getCodexWorkspacesSnapshot} from '../../../lib/tauri';
import type {CodexLocalProjectUsageSnapshot,SettingsSnapshot} from '../../../types/bridge';
import {useLocale} from '../../../hooks/useLocale';
import {useDashboardStructureTheme} from './useDashboardStructureTheme';
import type {ChartSpec} from '../../../components/analytics/charts/chartSpec';
const Chart=lazy(()=>import('../../../components/analytics/charts/EChartsSurface'));
export function activityBuckets(daily:CodexLocalProjectUsageSnapshot['daily'],mode:'daily'|'weekly'|'cumulative') {
 const grouped=new Map<string,number>();
 for(const point of daily){if(!/^\d{4}-\d{2}-\d{2}$/.test(point.day)||!Number.isFinite(point.totalTokens)||point.totalTokens<0)continue;
  const d=new Date(point.day+'T00:00:00Z');if(!Number.isFinite(d.getTime()))continue;
  if(mode==='weekly')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const key=d.toISOString().slice(0,10);
  grouped.set(key,(grouped.get(key)??0)+point.totalTokens);
 }
 let cumulative=0;return [...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([day,tokens])=>({day,tokens:mode==='cumulative'?(cumulative+=tokens):tokens}));
}
export default function LocalActivity({settings,isDemo,providerId}:{settings:SettingsSnapshot;isDemo:boolean;providerId:string|null}) {
 const {t}=useLocale(),{theme}=useDashboardStructureTheme(settings);
 const [snapshot,setSnapshot]=useState<CodexLocalProjectUsageSnapshot|null>(null),[error,setError]=useState(false),[mode,setMode]=useState<'daily'|'weekly'|'cumulative'>('daily');
 const supported=!providerId||providerId==='codex';
 useEffect(()=>{let cancelled=false;setSnapshot(null);setError(false);if(!isDemo&&supported)getCodexWorkspacesSnapshot({historyDays:30}).then(value=>{if(!cancelled)setSnapshot(value);}).catch(()=>{if(!cancelled)setError(true);});return()=>{cancelled=true;};},[isDemo,supported]);
 const buckets=useMemo(()=>activityBuckets(snapshot?.daily??[],mode),[snapshot,mode]);
 const text=theme.material?.text??'#f0f4f8',muted=theme.material?.muted??'#aeb9c5';
 const spec:ChartSpec={label:t('V3LocalTokens'),height:320,points:buckets.length,empty:!buckets.length,option:{animation:false,aria:{enabled:true},grid:{left:65,right:24,top:25,bottom:60},tooltip:{trigger:'axis',confine:true,backgroundColor:theme.core,borderColor:theme.coreEdge,textStyle:{color:text},valueFormatter:value=>Number(value).toLocaleString()},xAxis:{type:'category',data:buckets.map(p=>p.day),axisLabel:{color:muted,hideOverlap:true}},yAxis:{type:'value',min:0,axisLabel:{color:muted},splitLine:{lineStyle:{color:theme.hairline}}},series:[{type:'bar',name:t('V3LocalTokens'),data:buckets.map(p=>p.tokens),itemStyle:{color:theme.accent,borderRadius:[4,4,0,0]},barMaxWidth:32}]}};
 return <section className="analytics-section local-activity"><header><h2>{t('V3Activity')} · <bdi>Codex</bdi></h2><p>{t('V3ActivityHelp')}</p><small>{t('DashboardHistoryChipDays').replace('{}','30')}</small></header>
  {isDemo?<p className="analytics-empty">{t('V3ActivityDemo')}</p>:!supported||error?<p role="status">{t('DashboardValueUnavailable')}</p>:!snapshot?<p role="status">…</p>:<>
   <dl className="analytics-metric-ribbon"><div><dt>{t('V3LocalTokens')}</dt><dd>{snapshot.total.totalTokens.toLocaleString()}</dd></div><div><dt>{t('V3LocalSessions')}</dt><dd>{snapshot.sessions.length.toLocaleString()}</dd></div></dl>
   <nav className="v3-section-nav" aria-label={t('V3LocalTokens')}>{(['daily','weekly','cumulative'] as const).map(id=><button type="button" key={id} aria-pressed={mode===id} onClick={()=>setMode(id)}>{t(id==='daily'?'V3Daily':id==='weekly'?'V3Weekly':'V3Cumulative')}</button>)}</nav>
   {buckets.length?<Suspense fallback={<p>…</p>}><Chart spec={spec} unavailable={t('DashboardValueUnavailable')}/></Suspense>:<p>{t('DashboardValueUnavailable')}</p>}
   <div className="v3-activity-heatmap" aria-label={t('V3LocalTokens')}>{snapshot.daily.map(point=><span key={point.day} tabIndex={0} title={`Codex · ${point.day} · ${point.totalTokens.toLocaleString()} ${t('V3LocalTokens')}`} style={{background:point.totalTokens>0?theme.accent:theme.hairline}}><span className="analytics-table__visually-hidden">{point.day}: {point.totalTokens}</span></span>)}</div>
   <details className="cosmic-disclosure"><summary>{t('V2DataQuality')}</summary><p>{snapshot.sourceStatus} · {snapshot.indexedFileCount} indexed · {snapshot.skippedFileCount} skipped</p></details>
  </>}
 </section>;
}
