import type { DashboardRangeKind } from "../../../types/bridge";
import { useLocale } from "../../../hooks/useLocale";
import type { LocaleKey } from "../../../i18n/keys";

const RANGE_KEYS: Record<DashboardRangeKind, LocaleKey> = {
  today: "DashboardRangeToday",
  last7Days: "DashboardRangeLast7Days",
  last30Days: "DashboardRangeLast30Days",
  thisMonth: "DashboardRangeThisMonth",
  last3Months: "DashboardRangeLast3Months",
  thisYear: "DashboardRangeThisYear",
  // Custom range picker is architecture-only this phase (owner section
  // 53) -- not offered in the selector yet.
  custom: "DashboardRangeThisYear",
};

const SELECTABLE_RANGES: DashboardRangeKind[] = [
  "today",
  "last7Days",
  "last30Days",
  "thisMonth",
  "last3Months",
  "thisYear",
];

export interface DashboardHeaderProps {
  range: DashboardRangeKind;
  onRangeChange: (range: DashboardRangeKind) => void;
  providerOptions: { id: string; name: string }[];
  providerFilter: string | null;
  onProviderFilterChange: (providerId: string | null) => void;
}

/** Dashboard title/subtitle + the one global range selector every widget
 *  below shares -- no widget queries its own independent date window
 *  (owner section 7). */
export default function DashboardHeader({
  range,
  onRangeChange,
  providerOptions,
  providerFilter,
  onProviderFilterChange,
}: DashboardHeaderProps) {
  const { t } = useLocale();
  return (
    <header className="dashboard-analytics__header">
      <div className="dashboard-analytics__heading">
        <h1>{t("TabDashboard")}</h1>
        <p>{t("DashboardSubtitle")}</p>
      </div>
      <div className="dashboard-analytics__controls">
        <div
          className="dashboard-analytics__range"
          role="radiogroup"
          aria-label={t("DashboardSubtitle")}
        >
          {SELECTABLE_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              className={`dashboard-analytics__range-btn${range === r ? " dashboard-analytics__range-btn--active" : ""}`}
              onClick={() => onRangeChange(r)}
            >
              {t(RANGE_KEYS[r])}
            </button>
          ))}
        </div>
        {providerOptions.length > 1 && (
          <select
            className="dashboard-analytics__provider-filter"
            aria-label={t("DashboardProviderFilterAll")}
            value={providerFilter ?? ""}
            onChange={(e) => onProviderFilterChange(e.target.value || null)}
          >
            <option value="">{t("DashboardProviderFilterAll")}</option>
            {providerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </header>
  );
}
