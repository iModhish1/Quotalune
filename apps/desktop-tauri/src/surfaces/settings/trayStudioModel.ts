import type {LocaleKey} from "../../i18n/keys";
import type {ProviderCatalogEntry,ProviderTrayConfig,ProviderUsageSnapshot,RateWindowSnapshot,SettingsSnapshot} from "../../types/bridge";
export const DEFAULT_PROVIDER_TRAY:ProviderTrayConfig={enabled:false,limitId:"",style:"ring",showAsUsed:false,tooltipLimitIds:[],showName:true,showPlan:true,tokenRange:"none",precision:1,color:"provider",stroke:2,identity:"provider"};
/** Mirrors quotalis_core::settings::TRAY_STYLES, in presentation order. */
export const TRAY_STYLE_OPTIONS:readonly (readonly [ProviderTrayConfig["style"],LocaleKey])[]=[["ring","TrayStudioRing"],["arc","TrayStudioArc"],["bar","TrayStudioBar"],["badge","TrayStudioBadge"],["orbit","TrayStudioOrbit"],["mark","TrayStudioMark"]];
/** Exact observed identity mirrors provider_tray::limits; no quota inference. */
export function trayLimits(snapshot?:ProviderUsageSnapshot) {
 const result:{id:string;label:string;window:RateWindowSnapshot}[]=[];if(!snapshot)return result;
 const add=(lane:string,label:string,w?:RateWindowSnapshot|null)=>{if(w&&!w.isInformational)result.push({id:`${lane}:${label}:${w.windowMinutes??""}`,label,window:w});};
 add("primary",snapshot.primaryLabel??"primary",snapshot.primary);add("secondary",snapshot.secondaryLabel??"secondary",snapshot.secondary);add("tertiary",snapshot.tertiaryLabel??"tertiary",snapshot.tertiary);add("model","Model",snapshot.modelSpecific);
 for(const extra of snapshot.extraRateWindows??[])if(!extra.window.isInformational)result.push({id:`extra:${extra.id}:${extra.window.windowMinutes??""}`,label:extra.title,window:extra.window});
 return result;
}
/** Mirrors provider_tray::healthy: a snapshot the native icon would not measure never shows a reading here. */
export function trayPercent(s:ProviderUsageSnapshot|undefined,c:ProviderTrayConfig):number|null {
 if(!s||s.error||s.errorState!=="ready"||s.sourceLabel==="unavailable"||s.sourceLabel==="disabled")return null;
 const w=trayLimits(s).find(w=>w.id===c.limitId)?.window;const n=w?(c.showAsUsed?w.usedPercent:w.remainingPercent):null;
 return n!==null&&Number.isFinite(n)&&n>=0&&n<=100?n:null;
}
/** Case-insensitive match on display name or id; stays usable with any registry size. */
export function filterTrayProviders(catalog:readonly ProviderCatalogEntry[],query:string):ProviderCatalogEntry[] {
 const needle=query.trim().toLocaleLowerCase();
 return needle?catalog.filter(p=>p.displayName.toLocaleLowerCase().includes(needle)||p.id.toLowerCase().includes(needle)):[...catalog];
}
/** Real tray treatment for the Appearance summary when the Tray scope is Override. */
export function trayAppearanceValueKey(snapshot:Pick<SettingsSnapshot,"trayIconMode"|"providerTrayConfigs">):LocaleKey {
 const colors=new Set(Object.values(snapshot.providerTrayConfigs??{}).filter(c=>c.enabled).map(c=>c.color));
 if(colors.size===0)return snapshot.trayIconMode==="perProvider"?"AppearanceTrayProviderAccent":"AppearanceTraySingleIcon";
 if(colors.size>1)return "AppearanceTrayMixed";
 const [color]=colors;
 return color==="identity"?"AppearanceTrayQuotalisPalette":color==="silver"?"AppearanceTraySilver":"AppearanceTrayProviderAccent";
}

const TOKEN_PERIOD_LABELS:Record<string,LocaleKey>={today:"TrayStudioToday",week:"TrayStudioWeek",month:"TrayStudioMonth",year:"TrayStudioYear",lifetime:"TrayStudioLifetime"};
/** Selector options: Off plus only the periods the provider's local source can state. */
export function trayTokenPeriodOptions(capabilities:readonly {period:string;bestBound:"exact"|"lowerBound"}[],t:(key:LocaleKey)=>string) {
 return [{value:"none",label:t("TrayStudioOff")},...capabilities.filter(c=>TOKEN_PERIOD_LABELS[c.period]).map(c=>({value:c.period,label:c.bestBound==="lowerBound"?`${t(TOKEN_PERIOD_LABELS[c.period])} · ${t("TrayStudioTokenLowerBound")}`:t(TOKEN_PERIOD_LABELS[c.period])}))];
}
/** The period the runtime will actually use: an unsupported persisted choice behaves as Off. */
export function effectiveTokenRange(range:ProviderTrayConfig["tokenRange"],capabilities:readonly {period:string}[]):ProviderTrayConfig["tokenRange"] {
 return range!=="none"&&capabilities.some(c=>c.period===range)?range:"none";
}
