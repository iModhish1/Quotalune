import {useMemo,useState} from "react";
import {useLocale} from "../../../hooks/useLocale";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {defaultResetPresentationConfig,resolveResetTimeZone} from "../../../lib/resetPresentation";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";
import {physicalWindowLabel,observedAccountLabel} from "../../../lib/analytics/metricLabels";
import type {DashboardAnalyticsModel} from "../../../lib/analytics/dashboardModel";
import type {ProviderUsageSnapshot,SettingsSnapshot} from "../../../types/bridge";
import type {QuotaSeries} from "../../../lib/analytics/quotaAnalytics";

/** Latest observed quota per displayed time bucket. No interpolation, zero-fill,
 * averaging across accounts, or invented sub-day dots. Every dot has a reading. */
export default function ProviderUsageMatrix({model,providers,settings,onProvider}:{onProvider?:(id:string)=>void;model:DashboardAnalyticsModel;providers:ProviderUsageSnapshot[];settings:SettingsSnapshot}) {
 const {t}=useLocale(),options=useResetStageOptions(settings,"dashboard");
 const [expanded,setExpanded]=useState<Set<string>>(()=>new Set());
 const step=Math.max(86400,model.range.grainSeconds),first=model.range.since;
 const count=Math.min(366,Math.ceil((model.range.until-first)/step));
 const date=new Intl.DateTimeFormat(options.locale,{month:"short",day:"numeric",numberingSystem:"latn",timeZone:resolveResetTimeZone({...defaultResetPresentationConfig(),...options.config})});
 const percent=new Intl.NumberFormat(options.locale,{maximumFractionDigits:1,numberingSystem:"latn"});
 const groups=useMemo(()=>providers.map(provider=>({provider,rows:model.trends.filter(row=>row.provider===provider.providerId&&!row.invalid&&row.mean.value!==null)})).filter(group=>group.rows.length),[model.trends,providers]);
 const cells=(row:QuotaSeries)=>{
   const map=new Map<number,QuotaSeries["current"][number]>();
   for(const point of row.current){const index=Math.floor((point.observedAt-first)/step),prior=map.get(index);if(index>=0&&index<count&&(!prior||point.observedAt>prior.observedAt))map.set(index,point);}
   return Array.from({length:count},(_,index)=>{const point=map.get(index);return <td key={index}>
     {point?<span className="cosmic-matrix-dot" data-level={point.usedPercent>=settings.criticalUsageThreshold?"critical":point.usedPercent>=settings.highUsageThreshold?"high":"normal"}
       title={`${date.format(point.observedAt*1000)} · ${percent.format(point.usedPercent)}% · ${physicalWindowLabel(row.windowLabel,t)} · ${observedAccountLabel(row,model.trends,t)}`}>
       <span className="analytics-table__visually-hidden">{percent.format(point.usedPercent)}% · {date.format(point.observedAt*1000)}</span></span>:<span title={t("DashboardValueUnavailable")}>—</span>}
   </td>});
 };
 return <section className="cosmic-matrix" aria-label={t("V4UsageMatrix")}>
   <header><h3>{t("V4UsageMatrix")}</h3><span>{t("V4ObservedQuota")}</span></header>
   {groups.length?<div className="cosmic-matrix-scroll" tabIndex={0}><table><thead><tr><th scope="col">{t("TabProviders")}</th>{Array.from({length:count},(_,i)=><th scope="col" key={i}><bdi>{date.format((first+i*step)*1000)}</bdi></th>)}</tr></thead>
   <tbody>{groups.map(({provider,rows})=>{
     const show=expanded.has(provider.providerId);
     return <MatrixRows key={provider.providerId} provider={provider} rows={rows} expanded={show} toggle={()=>setExpanded(current=>{const next=new Set(current);if(show)next.delete(provider.providerId);else next.add(provider.providerId);return next;})} cells={cells} onProvider={onProvider} windowLabel={row=>physicalWindowLabel(row.windowLabel,t)}/>;
   })}</tbody></table></div>:<p className="analytics-empty">{t("V2NoPhysicalHistory")}</p>}
   <div className="cosmic-matrix-legend"><span><i data-level="normal"/> &lt;{settings.highUsageThreshold}%</span><span><i data-level="high"/> {settings.highUsageThreshold}–&lt;{settings.criticalUsageThreshold}%</span><span><i data-level="critical"/> ≥{settings.criticalUsageThreshold}%</span><span>— {t("DashboardValueUnavailable")}</span></div>
 </section>;
}
function MatrixRows({provider,rows,expanded,toggle,cells,windowLabel,onProvider}:{onProvider?:(id:string)=>void;provider:ProviderUsageSnapshot;rows:QuotaSeries[];expanded:boolean;toggle:()=>void;cells:(row:QuotaSeries)=>React.ReactNode;windowLabel:(row:QuotaSeries)=>string}) {
 return <><tr><th scope="row"><div className="cosmic-matrix-provider"><ProviderIcon providerId={provider.providerId} size={16}/>{onProvider?<button type="button" onClick={()=>onProvider(provider.providerId)}><bdi>{provider.displayName}</bdi></button>:<bdi>{provider.displayName}</bdi>}<small>{windowLabel(rows[0])}</small>{rows.length>1&&<button type="button" onClick={toggle} aria-expanded={expanded} aria-label={provider.displayName}>{expanded?"−":"+"}</button>}</div></th>{cells(rows[0])}</tr>
 {expanded&&rows.slice(1).map(row=><tr key={row.key} className="cosmic-matrix-window"><th scope="row"><bdi>{provider.displayName} · {windowLabel(row)}</bdi></th>{cells(row)}</tr>)}</>;
}
