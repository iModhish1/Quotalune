import type { CSSProperties } from "react";
import type { StageProvider } from "../../components/orbit/stageTypes";
import { QaProviderIcon, formatPercentage } from "../../design-system";
import { providerAccent, type Rect } from "./notchGeometry";
import UsageWindowList from "../../components/orbit/UsageWindowList";
import { StructurePinButton } from "../../design-system/StructureControls";
import { useLocale } from "../../hooks/useLocale";
import type { LocaleKey } from "../../i18n/keys";

/**
 * Wave 1F §13/§14: the footer's status line, reusing the SAME DOM slot
 * regardless of which case applies (no geometry change, no silhouette
 * collapse) and the SAME shared locale keys `QuotalisAsyncState` already
 * uses for error/timeout — no second loading/error vocabulary invented
 * for Structures. "attention" and any future status fall back to the
 * pre-existing "Quota unavailable" text, unchanged.
 */
function footerStatusText(status: StageProvider["status"], t: (key: LocaleKey) => string): string {
  if (status === "error") return t("QuotalisLoadingError");
  if (status === "timeout") return t("QuotalisLoadingTimeout");
  if (status === "ok") return "Live quota";
  return "Quota unavailable";
}

export function NotchDetails({provider,rect,demo,pinned,onClose,onPin,color=providerAccent(provider.id)}:{provider:StageProvider;rect:Rect;demo?:boolean;pinned:boolean;onClose?:()=>void;onPin?:()=>void;color?:string}) {
  const { t } = useLocale();
  return <section className="notch-detail" style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height,"--provider-color":color} as CSSProperties}
    role="region" aria-label={`${provider.name} usage details`}>
    <header><QaProviderIcon providerId={provider.iconId === "openai"?"codex":provider.iconId} size={18}/><strong title={provider.name}>{provider.name} Usage</strong>
      <button onClick={onClose} aria-label="Collapse details">×</button></header>
    {provider.windows ? <UsageWindowList providerId={provider.id} windows={provider.windows} hidden={provider.detailsHidden} presentation={provider.limitPresentation}/> : <>
    <div className="notch-detail-meta"><span>Selected limit</span><span title={provider.reset === "—" ? "Reset unavailable" : `Resets in ${provider.reset}`}>{provider.reset === "—" ? "Reset unavailable" : `Resets in ${provider.reset}`}</span></div>
    <div className="notch-meter" role="meter" aria-label={`${provider.name} ${provider.primaryLabel}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={provider.primaryValue ?? undefined}>
      <i style={{width:`${Math.max(0,Math.min(1,provider.arcFraction ?? 0))*100}%`}}/></div>
    <div className="notch-detail-value"><b>{formatPercentage(provider.primaryValue)}</b> {provider.primaryLabel}
      {provider.secondaryValue != null && provider.resolvedMode === "hybrid" && <span>{formatPercentage(provider.secondaryValue)} used</span>}</div></>}
    <footer><span>{demo ? "DEMO DATA · NOT A REAL ACCOUNT" : footerStatusText(provider.status, t)}</span>
      <StructurePinButton pinned={pinned} onTogglePinned={onPin} /></footer>
  </section>;
}
