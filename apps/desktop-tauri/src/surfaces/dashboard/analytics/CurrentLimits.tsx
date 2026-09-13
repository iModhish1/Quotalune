import {ProviderResetDetails} from '../../../components/providers/ProviderResets';
import {formatResetPresentation} from "../../../lib/resetPresentation";
import {physicalWindowLabel} from "../../../lib/analytics/metricLabels";
import "./CurrentLimits.css";
import "../../../components/analytics/analyticsPrimitives.css";
import {QuotaGauge} from "../../../components/analytics/QuotaGauge";
import {ProviderPlanBadge} from "../../../components/providers/ProviderPlanBadge";
import ProviderPlanet from "./ProviderPlanet";
import {useDashboardStructureTheme} from "./useDashboardStructureTheme";
import {chartProviderColor} from "../../../components/analytics/charts/chartTheme";
import {analyticsPreferences} from "../../../lib/analytics/preferences";
import {currentProviderModel, type CurrentProviderModel, physicalQuotaWindows} from "../../../lib/analytics/currentProviders";
import { useMemo, type CSSProperties } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { useResetStageOptions } from "../../../hooks/useResetStageOptions";
import { toStageProviders, usageConfigFromSnapshot } from "../../../components/orbit/stageProviders";
import UsageWindowList from "../../../components/orbit/UsageWindowList";
import { providerCreditsColor } from "../../../components/charts/chartPalette";
import { formatPercentage } from "../../../design-system/percent";
import { providerMonetaryQuantityKind } from "../../../lib/providerMonetaryKind";
import { normalizePercentage } from "../../../design-system/percent";
import type { ProviderUsageSnapshot, SettingsSnapshot } from "../../../types/bridge";

/** Reuses the shared limit selection, identity and reset presentation pipeline. */
export default function CurrentLimits({ providers, settings, models, expanded = false }: {providers: ProviderUsageSnapshot[]; settings: SettingsSnapshot; models?: CurrentProviderModel[]; expanded?: boolean}) {
  const { t } = useLocale();
  const {theme}=useDashboardStructureTheme(settings);
  const preferences = analyticsPreferences(settings.analyticsPreferences);
  const states = models ?? currentProviderModel(providers,settings,Date.now());
  const resetOptions = useResetStageOptions(settings, "dashboard");
  // The shared compact-surface adapter caps each call at seven entries.
  // Adapt each provider separately so the Dashboard never truncates the list.
  const stages = useMemo(() => providers.flatMap(provider => toStageProviders([provider], {...(usageConfigFromSnapshot(settings) ?? {global: "remaining", providerOverrides: {}}), providerLimitOrder: {}, providerDetailWindows: {}}, resetOptions)), [providers, settings, resetOptions]);
  return <section className="dashboard-limits" aria-label={t("DashboardLimitsNow")}>
    <h2>{t("DashboardLimitsNow")}</h2>
    {providers.length === 0 && <p>{t("DashboardValueUnavailable")}</p>}
    <div className="dashboard-limits__grid" data-provider-count={stages.length}>
      {stages.map((stage, index) => {
        const provider = providers[index];
        // Current instruments use a physical quota window. A selected display
        // metric can be an average or cost ratio and is not an analytics series.
        const physical = physicalQuotaWindows(provider);
        const metric = physical[0]?.window;
        const state = states.find(model=>model.provider.providerId===provider.providerId);
        const ready = provider.errorState === "ready" && !provider.error;
        const quantity = providerMonetaryQuantityKind(stage.id);
        const cost = provider.cost;
        const used = metric ? normalizePercentage(metric.usedPercent) : null;
        const remaining = metric ? normalizePercentage(metric.remainingPercent) : null;
        const identityColor=chartProviderColor(theme,settings,stage.id,document.documentElement);
        return <article key={stage.id} className="dashboard-limits__instrument" style={{"--provider-color": providerCreditsColor(stage.id)} as CSSProperties}>
          <ProviderPlanet providerId={stage.id} used={ready ? used : null} color={identityColor}/>
          <header><strong><bdi dir="ltr">{stage.name}</bdi></strong><ProviderPlanBadge plan={provider.planName}/>{!ready && <span className="dashboard-limits__status">{t("DashboardNeedsAttention")}</span>}</header>
          {ready && used !== null && remaining !== null ? <>
            <QuotaGauge used={used} remaining={remaining} template={preferences.quotaTemplate} usedLabel={t("PanelUsedSuffix")} remainingLabel={t("FloatBarRemainingSuffix")} format={formatPercentage} emphasis={stage.resolvedMode}/>
            <small><bdi>{metric?.resetsAt ? formatResetPresentation({...resetOptions,locale:resetOptions.locale??"en-US",resetAt:metric.resetsAt}).fullAriaLabel : t("DashboardValueUnavailable")}</bdi></small>
          </> : <p className="dashboard-limits__unavailable">{t("DashboardValueUnavailable")}</p>}
          <details className="dashboard-limits__details" open={expanded || undefined}><summary>{physicalWindowLabel(physical[0]?.label,t)}</summary>
            <div className="dashboard-limits__metadata"><span>{t(state?.freshness.state === "fresh" ? "V24Fresh" : state?.freshness.state === "aging" ? "V24Aging" : state?.freshness.state === "stale" ? "V24Stale" : "V24ReadingAge")}</span>{stage.planName && <bdi>{stage.planName}</bdi>}</div>
            {ready && physical.length > 1 ? <UsageWindowList providerId={stage.id} windows={(stage.windows ?? []).filter(window => physical.slice(1).some(item => (item.key === "modelSpecific" ? "model" : item.key) === window.id)).map(window=>({...window,label:physicalWindowLabel(window.label,t)}))} hidden={false} paginate={false} presentation={stage.limitPresentation} /> : null}
          {ready && cost && Number.isFinite(cost.used) && quantity !== "unknown" && (quantity === "credits" || !!cost.currencyCode) && <p className="dashboard-limits__remaining">
            <span>{t(quantity === "spend" ? "DashboardMetricSpend" : quantity === "balance" ? "DashboardBalance" : "DashboardCredits")}</span>
            <bdi dir="ltr">{cost.used.toLocaleString(resetOptions.locale, {maximumFractionDigits: 2})}{quantity !== "credits" && cost.currencyCode ? ` ${cost.currencyCode}` : ""}</bdi>
          </p>}
          </details>
          <ProviderResetDetails facts={provider.resetFacts} provider={provider}/>
        </article>;
      })}
    </div>
  </section>;
}
