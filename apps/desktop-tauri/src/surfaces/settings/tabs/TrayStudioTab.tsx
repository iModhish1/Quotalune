import {useEffect,useState} from "react";
import {useLocale} from "../../../hooks/useLocale";
import {useProviders} from "../../../hooks/useProviders";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";
import {Field,Select,Toggle} from "../../../components/FormControls";
import QuotalisSelect from "../../../components/analytics/QuotalisSelect";
import {QuotalisRefreshingBadge} from "../../../design-system/QuotalisLoadingStates";
import type {ProviderCatalogEntry,ProviderTrayConfig} from "../../../types/bridge";
import type {TabProps} from "../settingsTabs";
import {DEFAULT_PROVIDER_TRAY,TRAY_STYLE_OPTIONS,effectiveTokenRange,filterTrayProviders,trayLimits,trayPercent,trayTokenPeriodOptions} from "../trayStudioModel";
import {getTrayTokenPeriods,type TokenPeriodCapability} from "../../../lib/trayQa";
import {TrayNativePreview} from "./TrayNativePreview";
import "./TrayStudioTab.css";
export default function TrayStudioTab({settings,set,saving,catalog}:TabProps&{catalog:ProviderCatalogEntry[]}) {
 const {t,language}=useLocale();const {providers,isRefreshing}=useProviders({refreshOnMount:false});
 const [id,setId]=useState(catalog[0]?.id??"codex");
 const [filter,setFilter]=useState("");
 const [tokenPeriods,setTokenPeriods]=useState<{provider:string;periods:TokenPeriodCapability[]}|null>(null);
 useEffect(()=>{let current=true;getTrayTokenPeriods(id).then(periods=>{if(current)setTokenPeriods({provider:id,periods});}).catch(()=>{if(current)setTokenPeriods({provider:id,periods:[]});});return()=>{current=false;};},[id]);
 const periods=tokenPeriods?.provider===id?tokenPeriods.periods:[];
 const matches=filterTrayProviders(catalog,filter);
 const snapshot=providers.find(p=>p.providerId===id);const configured=settings.providerTrayConfigs?.[id];
 const c:ProviderTrayConfig={...DEFAULT_PROVIDER_TRAY,...(configured??{enabled:settings.trayIconMode==="perProvider"&&settings.enabledProviders.includes(id),limitId:trayLimits(snapshot)[0]?.id??""})};
 const patch=(value:Partial<ProviderTrayConfig>)=>set({providerTrayConfigs:{...settings.providerTrayConfigs,[id]:{...c,...value}}});
 const limits=trayLimits(snapshot);const percent=trayPercent(snapshot,c);
 const followsAppearance=settings.appearanceComposition?.tray==="global";
 const revision=[snapshot?.updatedAt,snapshot?.error,settings.appearanceComposition?.tray,settings.logoVariant,language].join("|");
 const selectable=matches.some(p=>p.id===id)?matches:[...catalog.filter(p=>p.id===id),...matches];
 return <section className="tray-studio">
  <header><h2>{t("TrayStudioTitle")}</h2><p>{t("TrayStudioHelp")}</p></header>
  <div className="tray-studio__layout">
   <aside className="tray-studio__preview">
    <label className="tray-studio__filter"><span>{t("TrayStudioFilterProviders")}</span><input type="search" value={filter} maxLength={60} onChange={e=>setFilter(e.target.value)}/></label>
    {matches.length===0&&<p role="status">{t("TrayStudioNoProviderMatch")}</p>}
    <Select value={id} options={selectable.map(p=>({value:p.id,label:p.displayName}))} onChange={setId} ariaLabel={t('TabProviders')} disabled={saving}/>
    <TrayNativePreview providerId={id} config={c} revision={revision}/>
    <strong><bdi>{snapshot?.displayName??catalog.find(p=>p.id===id)?.displayName}</bdi>{isRefreshing&&snapshot?<> <QuotalisRefreshingBadge dotOnly/></>:null}</strong>
    {snapshot?.planName&&<span><bdi>{snapshot.planName}</bdi></span>}
    <output><bdi>{percent===null?'—':`${percent.toFixed(c.precision)}% ${t(c.showAsUsed?'TrayStudioUsed':'TrayStudioRemaining')}`}</bdi></output>
    {c.style==="mark"&&<p>{t("TrayStudioMarkNoReading")}</p>}
    <p>{t('TrayStudioPreview')}</p>
    <Toggle label={t('TrayStudioPin')} checked={c.enabled} disabled={saving} onChange={enabled=>patch({enabled})}/>
   </aside>
   <div className="tray-studio__controls">
    <div className="tray-studio__templates">{TRAY_STYLE_OPTIONS.map(([style,label])=><button key={style} type="button" aria-pressed={c.style===style} disabled={saving} onClick={()=>patch({style})}><span className={`tray-template tray-template--${style}`} aria-hidden="true"><ProviderIcon providerId={id} size={25}/></span>{t(label)}</button>)}</div>
    <section className="settings-section">
     <Field label={t('TrayStudioIdentity')}><Select value={c.identity??"provider"} disabled={saving} onChange={v=>patch({identity:v as ProviderTrayConfig['identity']})} options={([['provider','TrayStudioIdentityProvider'],['quotalis','TrayStudioIdentityQuotalis']] as const).map(([value,key])=>({value,label:t(key)}))}/></Field>
     <Field label={t('TrayStudioLimit')}><Select value={c.limitId} options={[{value:'',label:t('TrayStudioUnselected')},...limits.map(w=>({value:w.id,label:w.label}))]} disabled={saving} onChange={limitId=>patch({limitId})}/></Field>
     {!snapshot||snapshot.error||limits.length===0?<p role="status">{t('TrayStudioUnavailable')}</p>:null}
     <Field label={t('TrayStudioUsed')}><Select value={c.showAsUsed?'used':'remaining'} options={[{value:'used',label:t('TrayStudioUsed')},{value:'remaining',label:t('TrayStudioRemaining')}]} onChange={v=>patch({showAsUsed:v==='used'})} disabled={saving}/></Field>
     <Field label={t('TrayStudioHover')}><QuotalisSelect label={t('TrayStudioHover')} multiple={c.tooltipLimitIds} value="" onChange={()=>{}} options={limits.map(w=>({value:w.id,label:w.label,disabled:c.tooltipLimitIds.length>=3&&!c.tooltipLimitIds.includes(w.id)}))} onMultipleChange={ids=>patch({tooltipLimitIds:ids.slice(0,3)})} disabled={saving}/></Field>
     <div className="tray-studio__toggles"><Toggle label={t('TrayStudioName')} checked={c.showName} disabled={saving} onChange={showName=>patch({showName})}/><Toggle label={t('TrayStudioPlan')} checked={c.showPlan} disabled={saving} onChange={showPlan=>patch({showPlan})}/></div>
     <Field label={t('TrayStudioTokens')} description={t(periods.length?'TrayStudioTokenHelp':'TrayStudioTokenUnsupported')}><Select value={effectiveTokenRange(c.tokenRange,periods)} disabled={saving||!periods.length} onChange={v=>patch({tokenRange:v as ProviderTrayConfig['tokenRange']})} options={trayTokenPeriodOptions(periods,t)}/></Field>
     <Field label={t('TrayStudioColor')} description={followsAppearance?t('TrayStudioFollowsAppearance'):undefined}><Select value={c.color} disabled={saving||followsAppearance} onChange={v=>patch({color:v as ProviderTrayConfig['color']})} options={([['provider','TrayStudioProviderColor'],['identity','TrayStudioAppColor'],['silver','TrayStudioSilver']] as const).map(([value,key])=>({value,label:t(key)}))}/></Field>
     <Field label={t('TrayStudioPrecision')}><Select value={String(c.precision)} disabled={saving} onChange={v=>patch({precision:Number(v)})} options={[0,1,2].map(v=>({value:String(v),label:`${v}`}))}/></Field>
     <Field label={t('TrayStudioStroke')}><input aria-label={t('TrayStudioStroke')} type="range" min="1" max="4" value={c.stroke} onChange={e=>patch({stroke:Number(e.target.value)})} disabled={saving||c.style==="mark"}/></Field>
    </section>
   </div>
  </div>
 </section>;
}
