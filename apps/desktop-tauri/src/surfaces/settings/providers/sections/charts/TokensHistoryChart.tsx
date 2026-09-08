import { useMemo } from "react";
import { BarChart } from "../../../../../components/charts/BarChart";
import { providerCostColor } from "../../../../../components/charts/chartPalette";
import { useLocale } from "../../../../../hooks/useLocale";
import { resolveIntlLocale } from "../../../../../i18n/resolveIntlLocale";
import type { LocaleKey } from "../../../../../i18n/keys";
import type { DailyTokenPoint } from "../../../../../types/bridge";

interface Props {
  data: DailyTokenPoint[];
  title: string;
  ariaLabel: string;
  providerId: string;
  animations: boolean;
  emptyMessage: string;
  /** Local history backfill has not reached the requested depth yet. */
  incomplete: boolean;
  t: (key: LocaleKey) => string;
}

/**
 * Tokens chart mode (upstream 0.50.0 #2930): exact local token totals per
 * day, defaulting Codex to this view. An incomplete backfill shows a
 * "Refreshing" marker instead of silently missing days.
 */
export function TokensHistoryChart({
  data,
  title,
  ariaLabel,
  providerId,
  animations,
  emptyMessage,
  incomplete,
  t,
}: Props) {
  const { language } = useLocale();
  const uiLocale = resolveIntlLocale(language);
  // `p.date` is a raw "YYYY-MM-DD" string from the Rust side. Previously
  // passed straight through and relied on BarChart's now-removed
  // `.slice(-5)` axis trim to compact it (which broke non-English labels,
  // the same bug fixed for LineChart/CreditsHistoryChart/CostHistoryChart)
  // -- format it into a real, locale-aware short label here instead.
  const dateFormatter = useMemo(
    // numberingSystem: "latn" matches the app's established digit policy
    // (resetPresentation.ts hardcodes the same) -- dates stay Latin-digit
    // even in Arabic.
    () => new Intl.DateTimeFormat(uiLocale, { month: "short", day: "numeric", numberingSystem: "latn" }),
    [uiLocale],
  );
  const recent = data.slice(-30);
  const points = recent.map((p) => {
    const parsed = new Date(`${p.date}T00:00:00`);
    const label = Number.isNaN(parsed.getTime()) ? p.date : dateFormatter.format(parsed);
    return { label, value: p.tokens };
  });
  return (
    <div className="provider-detail-chart">
      <div className="provider-detail-chart__title">
        {title}
        {incomplete && (
          <span className="provider-detail-chart__refreshing">
            {t("DetailChartRefreshing")}
          </span>
        )}
      </div>
      <BarChart
        data={points}
        color={providerCostColor(providerId)}
        ariaLabel={ariaLabel}
        valueFormatter={(v) => Intl.NumberFormat().format(v)}
        animations={animations}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
