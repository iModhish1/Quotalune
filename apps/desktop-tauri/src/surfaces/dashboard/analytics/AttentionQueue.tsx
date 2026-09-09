import {useLocale} from "../../../hooks/useLocale";
import {AnalyticsSection, StatusRail} from "../../../components/analytics/AnalyticsPrimitives";
import type {AttentionItem} from "../../../lib/analytics/dashboardIntelligence";
import ProviderPlanet from "./ProviderPlanet";
import type {CurrentProviderModel} from "../../../lib/analytics/currentProviders";
import {formatPercentage} from "../../../design-system/percent";

export default function AttentionQueue({items,onOpenProviders,isDemo,models=[]}: {items:AttentionItem[];onOpenProviders:()=>void;isDemo:boolean;models?:CurrentProviderModel[]}) {
  const {t}=useLocale();
  return <AnalyticsSection title={t("V24Attention")} className="attention-queue">
    {items.length ? <StatusRail>{items.map(item=>{
      const [before,after]=t(item.labelKey).split("{}");
      const model=models.find(model=>model.provider.providerId===item.providerId);
      const used=model?.ready?model.highest?.window.usedPercent:null;
      return <li key={item.id} data-attention={item.kind} title={`${before}${item.providerName}${after}`}><ProviderPlanet providerId={item.providerId} used={null} small/>
        <strong><bdi>{item.providerName}</bdi></strong>
        {(item.kind==="high"||item.kind==="critical")&&used!=null?<span className="cosmic-attention-reading"><bdi>{formatPercentage(used)}</bdi> {t("PanelUsedSuffix")}</span>:<span>{before}<bdi>{item.providerName}</bdi>{after}</span>}
        {(item.kind==="auth" || item.kind==="failure") && <button type="button" disabled={isDemo} onClick={onOpenProviders}>{t(isDemo?"DashboardDemoState":"TabProviders")}</button>}
      </li>;
    })}</StatusRail> : <p className="analytics-empty">{t("V24NoAttention")}</p>}
  </AnalyticsSection>;
}
