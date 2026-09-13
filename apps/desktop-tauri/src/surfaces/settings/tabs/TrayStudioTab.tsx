import {useState} from "react";
import {useLocale} from "../../../hooks/useLocale";
import {useProviders} from "../../../hooks/useProviders";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";
import {getProviderIcon} from "../../../components/providers/providerIcons";
import {Field,Select,Toggle} from "../../../components/FormControls";
import QuotalisSelect from "../../../components/analytics/QuotalisSelect";
import type {ProviderCatalogEntry,ProviderTrayConfig} from "../../../types/bridge";
import type {TabProps} from "../settingsTabs";
import {DEFAULT_PROVIDER_TRAY,trayLimits,trayPercent} from "../trayStudioModel";
import "./TrayStudioTab.css";
export default function TrayStudioTab({settings,set,saving,catalog}:TabProps&{catalog:ProviderCatalogEntry[]}) {
 const {t}=useLocale();const {providers}=useProviders({refreshOnMount:false});
 const [id,setId]=useState(catalog[0]?.id??"codex");
 const snapshot=providers.find(p=>p.providerId===id);const configured=settings.providerTrayConfigs?.[id];
 const c=configured??{...DEFAULT_PROVIDER_TRAY,enabled:settings.trayIconMode==="perProvider"&&settings.enabledProviders.includes(id),limitId:trayLimits(snapshot)[0]?.id??""};
 const patch=(value:Partial<ProviderTrayConfig>)=>set({providerTrayConfigs:{...settings.providerTrayConfigs,[id]:{...c,...value}}});
 const limits=trayLimits(snapshot);const percent=trayPercent(snapshot,c);
 const styles=[['ring','TrayStudioRing'],['arc','TrayStudioArc'],['bar','TrayStudioBar'],['badge','TrayStudioBadge']] as const;
 const accent=c.color==='silver'?'#c2d1e4':c.color==='identity'?({silver:'#d8dfe8',arctic:'#46ccff',aurora:'#8570ff',ember:'#ff7e2f',violet:'#ad5cff'}[settings.logoVariant??'silver']??'#d8dfe8'):getProviderIcon(id).brandColor;
 return <section className="tray-studio">
  <header><h2>{t("TrayStudioTitle")}</h2><p>{t("TrayStudioHelp")}</p></header>
  <div className="tray-studio__layout">
   <aside className="tray-studio__preview" style={{'--tray-accent':accent} as React.CSSProperties}>
    <Select value={id} options={catalog.map(p=>({value:p.id,label:p.displayName}))} onChange={setId} ariaLabel={t('TabProviders')} disabled={saving}/>
    <div className="tray-studio__emblem" data-style={c.style}>
     <svg viewBox="0 0 100 100" aria-hidden="true">{c.style==='bar'?<><path d="M8 94H92" stroke="currentColor" opacity=".2" strokeWidth={c.stroke+1}/>{percent!==null&&<path d={`M8 94H${8+84*percent/100}`} stroke="var(--tray-accent)" strokeWidth={c.stroke+1}/>}</>:<><circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" opacity=".2" strokeWidth={c.stroke+1} pathLength="100" strokeDasharray={c.style==="arc"?"80 100":undefined} transform="rotate(-90 50 50)"/>{percent!==null&&<circle cx="50" cy="50" r="45" fill="none" stroke="var(--tray-accent)" strokeWidth={c.stroke+1} pathLength="100" strokeDasharray={`${percent*(c.style==='arc'?.8:1)} 100`} transform="rotate(-90 50 50)"/>}</>}</svg>
     <ProviderIcon providerId={id} size={64}/>
     {c.style==='badge'&&percent!==null&&<b>{Math.round(percent)}%</b>}
    </div>
    <strong>{snapshot?.displayName??catalog.find(p=>p.id===id)?.displayName}</strong>
    {snapshot?.planName&&<span>{snapshot.planName}</span>}
    <output>{percent===null?'—':`${percent.toFixed(c.precision)}% ${t(c.showAsUsed?'TrayStudioUsed':'TrayStudioRemaining')}`}</output>
    <p>{t('TrayStudioPreview')}</p>
    <Toggle label={t('TrayStudioPin')} checked={c.enabled} disabled={saving} onChange={enabled=>patch({enabled})}/>
   </aside>
   <div className="tray-studio__controls">
    <div className="tray-studio__templates">{styles.map(([style,label])=><button key={style} type="button" aria-pressed={c.style===style} disabled={saving} onClick={()=>patch({style})}><span className={`tray-template tray-template--${style}`} aria-hidden="true"><ProviderIcon providerId={id} size={25}/></span>{t(label)}</button>)}</div>
    <section className="settings-section">
     <Field label={t('TrayStudioLimit')}><Select value={c.limitId} options={[{value:'',label:t('TrayStudioUnselected')},...limits.map(w=>({value:w.id,label:w.label}))]} disabled={saving} onChange={limitId=>patch({limitId})}/></Field>
     {!snapshot||snapshot.error||limits.length===0?<p role="status">{t('TrayStudioUnavailable')}</p>:null}
     <Field label={t('TrayStudioUsed')}><Select value={c.showAsUsed?'used':'remaining'} options={[{value:'used',label:t('TrayStudioUsed')},{value:'remaining',label:t('TrayStudioRemaining')}]} onChange={v=>patch({showAsUsed:v==='used'})} disabled={saving}/></Field>
     <Field label={t('TrayStudioHover')}><QuotalisSelect label={t('TrayStudioHover')} multiple={c.tooltipLimitIds} value="" onChange={()=>{}} options={limits.map(w=>({value:w.id,label:w.label,disabled:c.tooltipLimitIds.length>=3&&!c.tooltipLimitIds.includes(w.id)}))} onMultipleChange={ids=>patch({tooltipLimitIds:ids.slice(0,3)})} disabled={saving}/></Field>
     <div className="tray-studio__toggles"><Toggle label={t('TrayStudioName')} checked={c.showName} disabled={saving} onChange={showName=>patch({showName})}/><Toggle label={t('TrayStudioPlan')} checked={c.showPlan} disabled={saving} onChange={showPlan=>patch({showPlan})}/></div>
     <Field label={t('TrayStudioTokens')} description={t('TrayStudioTokenHelp')}><Select value={c.tokenRange} disabled={saving} onChange={v=>patch({tokenRange:v as ProviderTrayConfig['tokenRange']})} options={([['none','TrayStudioOff'],['today','TrayStudioToday'],['week','TrayStudioWeek'],['month','TrayStudioMonth'],['year','TrayStudioYear'],['lifetime','TrayStudioLifetime']] as const).map(([value,key])=>({value,label:t(key)}))}/></Field>
     <Field label={t('TrayStudioColor')}><Select value={c.color} disabled={saving} onChange={v=>patch({color:v as ProviderTrayConfig['color']})} options={([['provider','TrayStudioProviderColor'],['identity','TrayStudioAppColor'],['silver','TrayStudioSilver']] as const).map(([value,key])=>({value,label:t(key)}))}/></Field>
     <Field label={t('TrayStudioPrecision')}><Select value={String(c.precision)} disabled={saving} onChange={v=>patch({precision:Number(v)})} options={[0,1,2].map(v=>({value:String(v),label:`${v}`}))}/></Field>
     <Field label={t('TrayStudioStroke')}><input aria-label={t('TrayStudioStroke')} type="range" min="1" max="4" value={c.stroke} onChange={e=>patch({stroke:Number(e.target.value)})} disabled={saving}/></Field>
    </section>
   </div>
  </div>
 </section>;
}
