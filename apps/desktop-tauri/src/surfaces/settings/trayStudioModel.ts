import type {ProviderTrayConfig,ProviderUsageSnapshot,RateWindowSnapshot} from "../../types/bridge";
export const DEFAULT_PROVIDER_TRAY:ProviderTrayConfig={enabled:false,limitId:"",style:"ring",showAsUsed:false,tooltipLimitIds:[],showName:true,showPlan:true,tokenRange:"none",precision:1,color:"provider",stroke:2};
/** Exact observed identity mirrors provider_tray::limits; no quota inference. */
export function trayLimits(snapshot?:ProviderUsageSnapshot) {
 const result:{id:string;label:string;window:RateWindowSnapshot}[]=[];if(!snapshot)return result;
 const add=(lane:string,label:string,w?:RateWindowSnapshot|null)=>{if(w&&!w.isInformational)result.push({id:`${lane}:${label}:${w.windowMinutes??""}`,label,window:w});};
 add("primary",snapshot.primaryLabel??"primary",snapshot.primary);add("secondary",snapshot.secondaryLabel??"secondary",snapshot.secondary);add("tertiary",snapshot.tertiaryLabel??"tertiary",snapshot.tertiary);add("model","Model",snapshot.modelSpecific);
 for(const extra of snapshot.extraRateWindows??[])if(!extra.window.isInformational)result.push({id:`extra:${extra.id}:${extra.window.windowMinutes??""}`,label:extra.title,window:extra.window});
 return result;
}
export function trayPercent(s:ProviderUsageSnapshot|undefined,c:ProviderTrayConfig):number|null {
 if(!s||s.error||s.errorState!=="ready")return null;
 const w=trayLimits(s).find(w=>w.id===c.limitId)?.window;const n=w?(c.showAsUsed?w.usedPercent:w.remainingPercent):null;
 return n!==null&&Number.isFinite(n)&&n>=0&&n<=100?n:null;
}
