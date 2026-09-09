import "./CurrentLimits.css";
import "../../../components/analytics/analyticsPrimitives.css";
import {QuotaGauge} from "../../../components/analytics/QuotaGauge";
import {analyticsPreferences} from "../../../lib/analytics/preferences";
import {physicalQuotaWindows} from "../../../lib/analytics/currentProviders";
import { useMemo, type CSSProperties } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { useResetStageOptions } from "../../../hooks/useResetStageOptions";
import { toStageProviders, usageConfigFromSnapshot } from "../../../components/orbit/stageProviders";
import UsageWindowList from "../../../components/orbit/UsageWindowList";
import { ProviderIcon } from "../../../components/providers/ProviderIcon";
import { providerCreditsColor } from "../../../components/charts/chartPalette";
import { formatPercentage } from "../../../design-system/percent";
import { providerMonetaryQuantityKind } from "../../../lib/providerMonetaryKind";
import { normalizePercentage } from "../../../design-system/percent";
import type { ProviderUsageSnapshot, SettingsSnapshot } from "../../../types/bridge";

/** Reuses the shared limit selection, identity and reset presentation pipeline. */
export default function CurrentLimits({ providers, settings }: {providers: ProviderUsageSnapshot[]; settings: SettingsSnapshot}) {
  const { t } = useLocale();
  const preferences = analyticsPreferences(settings.analyticsPreferences);
  const resetOptions = useResetStageOptions(settings, "dashboard");
  // The shared compact-surface adapter caps each call at seven entries.
  // Adapt each provider separately so the Dashboard never truncates the list.
  const stages = useMemo(() => providers.flatMap(provider => toStageProviders([provider], {...(usageConfigFromSnapshot(settings) ?? {global: "remaining", providerOverrides: {}}), providerLimitOrder: {}, providerDetailWindows: {}}, resetOptions)), [providers, settings, resetOptions]);
  return <section className="dashboard-limits" aria-label={t("DashboardLimitsNow")}>
    <h2>{t("DashboardLimitsNow")}</h2>
    {providers.length === 0 && <p>{t("DashboardValueUnavailable")}</p>}
    <div className="dashboard-limits__grid">
      {stages.map((stage, index) => {
        const provider = providers[index];
        // Current instruments use a physical quota window. A selected display
        // metric can be an average or cost ratio and is not an analytics series.
        const physical = physicalQuotaWindows(provider);
        const metric = physical[0]?.window;
        const ready = provider.errorState === "ready" && !provider.error;
        const quantity = providerMonetaryQuantityKind(stage.id);
        const cost = provider.cost;
        const used = metric ? normalizePercentage(metric.usedPercent) : null;
        const remaining = metric ? normalizePercentage(metric.remainingPercent) : null;
        return <article key={stage.id} className="dashboard-limits__instrument" style={{"--provider-color": providerCreditsColor(stage.id)} as CSSProperties}>
          <header><ProviderIcon providerId={stage.id} size={20} /><strong><bdi dir="ltr">{stage.name}</bdi></strong><span className="dashboard-limits__status" data-ready={ready}>{ready ? t("V2ProviderReady") : t("DashboardNeedsAttention")}</span></header>
          {stage.planName && <small><bdi>{stage.planName}</bdi></small>}
          {ready && used !== null && remaining !== null ? <>
            <small><bdi>{physical[0]?.label ?? t("V2PhysicalWindow")}</bdi></small>
            <QuotaGauge used={used} remaining={remaining} template={preferences.quotaTemplate} usedLabel={t("PanelUsedSuffix")} remainingLabel={t("FloatBarRemainingSuffix")} format={formatPercentage} emphasis={stage.resolvedMode}/>
            {(stage.windows?.length ?? 0) > 0 ? <UsageWindowList providerId={stage.id} windows={(stage.windows ?? []).filter(window => physical.some(item => (item.key === "modelSpecific" ? "model" : item.key) === window.id))} hidden={false} presentation={stage.limitPresentation} /> : <small><bdi>{stage.reset}</bdi></small>}
          </> : <p className="dashboard-limits__unavailable">{t("DashboardValueUnavailable")}</p>}
          {ready && cost && Number.isFinite(cost.used) && quantity !== "unknown" && (quantity === "credits" || !!cost.currencyCode) && <p className="dashboard-limits__remaining">
            <span>{t(quantity === "spend" ? "DashboardMetricSpend" : quantity === "balance" ? "DashboardBalance" : "DashboardCredits")}</span>
            <bdi dir="ltr">{cost.used.toLocaleString(resetOptions.locale, {maximumFractionDigits: 2})}{quantity !== "credits" && cost.currencyCode ? ` ${cost.currencyCode}` : ""}</bdi>
          </p>}
        </article>;
      })}
    </div>
  </section>;
}
