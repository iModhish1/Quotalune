import type { DashboardRangeKind } from "../../../types/bridge";
import { useLocale } from "../../../hooks/useLocale";
import QuotalisSelect from "../../../components/analytics/QuotalisSelect";
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
  /** Real history-availability summary (owner Phase 3.5 section 2), e.g.
   *  "Collecting history" / "7 days of history" -- null while the first
   *  snapshot hasn't resolved yet. Never a fabricated placeholder. */
  historyChip: string | null;
}

/**
 * The Analytics Control Strip (owner Phase 3.5 section 2): the native app
 * chrome already shows "QUOTALIS / Dashboard" as the page identity, so this
 * no longer repeats a giant "Dashboard" title -- it's purely the shared
 * range/provider-scope controls plus a real history-availability chip, the
 * one state every widget below implicitly depends on. `DashboardSubtitle`
 * is kept only as the range radiogroup's accessible name (not rendered as
 * visible text) so screen readers still get context without a second
 * on-screen "Dashboard" heading nested under the real one.
 */
export default function DashboardHeader({
  range,
  onRangeChange,
  providerOptions,
  providerFilter,
  onProviderFilterChange,
  historyChip,
}: DashboardHeaderProps) {
  const { t } = useLocale();
  return (
    <header className="dashboard-analytics__header">
      <div
        className="dashboard-analytics__range"
        role="radiogroup"
        aria-label={t("DashboardSubtitle")}
      >
        {SELECTABLE_RANGES.slice(0,4).map((r) => (
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
        <QuotalisSelect label={t("V4More")} value={SELECTABLE_RANGES.slice(4).includes(range)?range:""} options={[{value:"",label:t("V4More")},...SELECTABLE_RANGES.slice(4).map(value=>({value,label:t(RANGE_KEYS[value])}))]} onChange={value=>{if(value)onRangeChange(value as DashboardRangeKind);}}/>
      </div>
      <div className="dashboard-analytics__controls">
        {providerOptions.length > 1 && (
          <QuotalisSelect label={t("DashboardProviderFilterAll")} value={providerFilter??""} searchable onChange={value=>onProviderFilterChange(value||null)} options={[{value:"",label:t("DashboardProviderFilterAll")},...providerOptions.map(provider=>({value:provider.id,label:provider.name,providerId:provider.id}))]}/>
        )}
        {historyChip && <span className="dashboard-analytics__history-chip">{historyChip}</span>}
      </div>
    </header>
  );
}
