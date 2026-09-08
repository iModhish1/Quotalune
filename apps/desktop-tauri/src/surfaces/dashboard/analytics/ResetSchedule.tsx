import { useLocale } from "../../../hooks/useLocale";
import { useFormattedResetTime } from "../../../hooks/useFormattedResetTime";
import { rankProvidersByResetTime } from "./dashboardSelectors";
import type { ProviderUsageSnapshot } from "../../../types/bridge";

/**
 * Cross-provider reset schedule (owner build-order item F): every
 * connected provider with a real future reset, soonest first. Distinct
 * from the single "Next Reset" KPI (which only ever shows the soonest
 * one) and from any one provider's own detail card in the overview
 * stack below -- this is the "what resets when, across everything"
 * view. Countdown/date formatting is entirely delegated to the existing
 * Reset Presentation system (`useFormattedResetTime`) so timezone,
 * 12h/24h, and relative-vs-absolute display stay identical to every
 * other reset time shown in the app -- no local formatting invented
 * here.
 */
function ResetRow({
  providerName,
  resetsAt,
  relative,
}: {
  providerName: string;
  resetsAt: string;
  relative: boolean;
}) {
  const formatted = useFormattedResetTime(resetsAt, null, relative, "reset");
  return (
    <li className="dashboard-analytics__reset-schedule-row">
      <span className="dashboard-analytics__reset-schedule-name">
        <bdi>{providerName}</bdi>
      </span>
      <span className="dashboard-analytics__reset-schedule-value">
        <bdi>{formatted}</bdi>
      </span>
    </li>
  );
}

export default function ResetSchedule({
  providers,
  relative,
}: {
  providers: ProviderUsageSnapshot[];
  relative: boolean;
}) {
  const { t } = useLocale();
  const ranked = rankProvidersByResetTime(providers);

  return (
    <section
      className="dashboard-analytics__reset-schedule"
      aria-label={t("DashboardResetScheduleTitle")}
    >
      <h2>{t("DashboardResetScheduleTitle")}</h2>
      {ranked.length === 0 ? (
        <p className="dashboard-analytics__empty">{t("DashboardResetScheduleEmpty")}</p>
      ) : (
        <ul className="dashboard-analytics__reset-schedule-list">
          {ranked.map((entry) => (
            <ResetRow
              key={entry.providerId}
              providerName={entry.providerName}
              resetsAt={entry.resetsAt}
              relative={relative}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
