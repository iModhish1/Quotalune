import { useLocale } from "../../../hooks/useLocale";
import { providerCreditsColor } from "../../../components/charts/chartPalette";
import { formatPercentage } from "../../../design-system/percent";
import { rankProviderQuotas } from "./dashboardSelectors";
import type { DashboardProviderSummary } from "../../../types/bridge";

/** Independent quota observations; no invented common unit or cross-provider total. */
export default function ProviderDistribution({providers}: {providers: DashboardProviderSummary[]}) {
  const { t } = useLocale();
  const ranked = rankProviderQuotas(providers);
  return <section className="dashboard-analytics__distribution" aria-label={t("DashboardDistributionTitle")}>
    <h2>{t("DashboardDistributionTitle")}</h2>
    <p className="dashboard-analytics__caption">{t("DashboardDistributionCaption")}</p>
    {!ranked.length ? <p className="dashboard-analytics__empty">{t("DashboardDistributionEmpty")}</p> :
      <table className="quota-observations"><thead><tr><th>{t("TabProviders")}</th><th>{t("PanelUsedSuffix")}</th><th>{t("FloatBarRemainingSuffix")}</th></tr></thead>
        <tbody>{ranked.map(entry => <tr key={JSON.stringify([entry.provider, entry.accountId])}>
          <th scope="row"><bdi>{entry.provider}</bdi>{ranked.filter(p => p.provider === entry.provider).length > 1 && <small><bdi>{t("Account")} {ranked.filter(p => p.provider === entry.provider).findIndex(p => p.accountId === entry.accountId) + 1}</bdi></small>}</th>
          <td><bdi>{formatPercentage(entry.usedPercent)}</bdi><span className="quota-observations__track" aria-hidden="true"><span style={{width: `${entry.usedPercent}%`, background: providerCreditsColor(entry.provider)}} /></span></td>
          <td><bdi>{formatPercentage(entry.remainingPercent)}</bdi></td>
        </tr>)}</tbody>
      </table>}
  </section>;
}
