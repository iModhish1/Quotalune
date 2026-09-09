import "./CurrentLimits.css";
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
  const resetOptions = useResetStageOptions(settings, "dashboard");
  // The shared compact-surface adapter caps each call at seven entries.
  // Adapt each provider separately so the Dashboard never truncates the list.
  const stages = useMemo(() => providers.flatMap(provider => toStageProviders([provider], usageConfigFromSnapshot(settings), resetOptions)), [providers, settings, resetOptions]);
  return <section className="dashboard-limits" aria-label={t("DashboardLimitsNow")}>
    <h2>{t("DashboardLimitsNow")}</h2>
    {providers.length === 0 && <p>{t("DashboardValueUnavailable")}</p>}
    <div className="dashboard-limits__grid">
      {stages.map((stage, index) => {
        const provider = providers[index];
        const metric = provider.selectedMetric ?? provider.primary;
        const ready = provider.errorState === "ready" && !provider.error;
        const quantity = providerMonetaryQuantityKind(stage.id);
        const cost = provider.cost;
        const used = normalizePercentage(metric.usedPercent);
        const remaining = normalizePercentage(metric.remainingPercent);
        return <article key={stage.id} className="dashboard-limits__instrument" style={{"--provider-color": providerCreditsColor(stage.id)} as CSSProperties}>
          <header><ProviderIcon providerId={stage.id} size={20} /><strong><bdi dir="ltr">{stage.name}</bdi></strong><span className="dashboard-limits__status" data-ready={ready}>{ready ? t("DashboardConnected") : t("DashboardNeedsAttention")}</span></header>
          {stage.planName && <small><bdi>{stage.planName}</bdi></small>}
          {ready ? <>
            <div className="dashboard-limits__reading">
              <svg viewBox="0 0 48 48" aria-hidden="true"><circle className="dashboard-limits__track" cx="24" cy="24" r="19"/><circle className="dashboard-limits__arc" cx="24" cy="24" r="19" pathLength="100" strokeDasharray={`${used ?? 0} 100`} /></svg>
              <div><strong><bdi dir="ltr">{formatPercentage(used)}</bdi></strong><span>{t("PanelUsedSuffix")}</span></div>
              <div><strong><bdi dir="ltr">{formatPercentage(remaining)}</bdi></strong><span>{t("FloatBarRemainingSuffix")}</span></div>
            </div>
            {(stage.windows?.length ?? 0) > 0 ? <UsageWindowList providerId={stage.id} windows={stage.windows ?? []} hidden={stage.detailsHidden} presentation={stage.limitPresentation} /> : <small><bdi>{stage.reset}</bdi></small>}
          </> : <p className="dashboard-limits__unavailable">{t("DashboardValueUnavailable")}</p>}
          {ready && cost && Number.isFinite(cost.used) && quantity !== "unknown" && (quantity === "credits" || !!cost.currencyCode) && <p className="dashboard-limits__remaining">
            <span>{t(quantity === "spend" ? "DashboardMetricSpend" : quantity === "balance" ? "DashboardBalance" : "DashboardCredits")}</span>
            <bdi dir="ltr">{cost.used.toLocaleString(undefined, {maximumFractionDigits: 2})}{quantity !== "credits" && cost.currencyCode ? ` ${cost.currencyCode}` : ""}</bdi>
          </p>}
        </article>;
      })}
    </div>
  </section>;
}
