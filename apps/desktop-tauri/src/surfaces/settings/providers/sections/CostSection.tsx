import type { CostSnapshotBridge } from "../../../../types/bridge";
import type { LocaleKey } from "../../../../i18n/keys";
import { providerMonetaryQuantityKind } from "../../../../lib/providerMonetaryKind";
import { useFormattedResetTime } from "../../../../hooks/useFormattedResetTime";

export function CostSection({providerId, cost, t, relative = true}: {
  providerId: string; cost: CostSnapshotBridge | null; t: (key: LocaleKey) => string; relative?: boolean;
}) {
  const reset = useFormattedResetTime(cost?.resetsAt ?? null, null, relative);
  if (!cost) return null;
  const kind = providerMonetaryQuantityKind(providerId);
  const known = kind !== "unknown" && Number.isFinite(cost.used) && (kind === "credits" || !!cost.currencyCode);
  const title = kind === "spend" ? "DashboardMetricSpend" : kind === "balance" ? "DashboardBalance" : kind === "credits" ? "DashboardCredits" : "DetailCostTitle";
  const format = (value: number) => `${value.toLocaleString(undefined, {maximumFractionDigits: 2})}${kind === "credits" ? "" : ` ${cost.currencyCode}`}`;
  return <section className="provider-detail-section">
    <h4>{t(title)}</h4>
    {!known ? <p>{t("DashboardValueUnavailable")}</p> : <dl className="provider-detail-grid">
      <dt>{t(title)}</dt><dd><bdi dir="ltr">{format(cost.used)}</bdi></dd>
      {kind === "spend" && cost.limit !== null && Number.isFinite(cost.limit) && <><dt>{t("DetailCostLimit")}</dt><dd><bdi dir="ltr">{format(cost.limit)}</bdi></dd></>}
      {cost.period && <><dt>{t("MonetaryReportingPeriod")}</dt><dd><bdi>{cost.period}</bdi></dd></>}
      {reset && <><dt>{t("DetailCostResets")}</dt><dd>{reset}</dd></>}
    </dl>}
  </section>;
}
