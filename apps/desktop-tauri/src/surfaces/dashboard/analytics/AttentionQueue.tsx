import {useLocale} from "../../../hooks/useLocale";
import {AnalyticsSection, StatusRail} from "../../../components/analytics/AnalyticsPrimitives";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";
import type {AttentionItem} from "../../../lib/analytics/dashboardIntelligence";

export default function AttentionQueue({items,onOpenProviders,isDemo}: {items:AttentionItem[];onOpenProviders:()=>void;isDemo:boolean}) {
  const {t}=useLocale();
  return <AnalyticsSection title={t("V24Attention")} className="attention-queue">
    {items.length ? <StatusRail>{items.map(item=>{
      const [before,after]=t(item.labelKey).split("{}");
      return <li key={item.id} data-attention={item.kind}><ProviderIcon providerId={item.providerId} size={16}/><span>{before}<bdi>{item.providerName}</bdi>{after}</span>
        {(item.kind==="auth" || item.kind==="failure") && <button type="button" disabled={isDemo} onClick={onOpenProviders}>{t(isDemo?"DashboardDemoState":"TabProviders")}</button>}
      </li>;
    })}</StatusRail> : <p className="analytics-empty">{t("V24NoAttention")}</p>}
  </AnalyticsSection>;
}
