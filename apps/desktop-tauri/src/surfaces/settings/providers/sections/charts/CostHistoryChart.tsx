import { useMemo } from "react";
import { BarChart } from "../../../../../components/charts/BarChart";
import { providerCostColor } from "../../../../../components/charts/chartPalette";
import { useLocale } from "../../../../../hooks/useLocale";
import { resolveIntlLocale } from "../../../../../i18n/resolveIntlLocale";
import type { DailyCostPoint } from "../../../../../types/bridge";

interface Props {
  data: DailyCostPoint[];
  title: string;
  ariaLabel: string;
  providerId: string;
  animations: boolean;
  emptyMessage: string;
}

/**
 * Port target: the cost_history bar cluster in
 * `rust/src/native_ui/preferences.rs::render_provider_detail_panel`.
 * Phase 10 wires through per-provider palette tokens + animation flags.
 */
export function CostHistoryChart({
  data,
  title,
  ariaLabel,
  providerId,
  animations,
  emptyMessage,
}: Props) {
  const { language } = useLocale();
  const uiLocale = resolveIntlLocale(language);
  // `p.date` is a raw "YYYY-MM-DD" string from the Rust side. Previously
  // passed straight through and relied on BarChart's now-removed
  // `.slice(-5)` axis trim to compact it (which broke non-English labels,
  // the same bug fixed for LineChart/CreditsHistoryChart) -- format it into
  // a real, locale-aware short label here instead.
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
    return { label, value: p.value };
  });
  return (
    <div className="provider-detail-chart">
      <div className="provider-detail-chart__title">{title}</div>
      <BarChart
        data={points}
        color={providerCostColor(providerId)}
        ariaLabel={ariaLabel}
        valueFormatter={(v) => `$${v.toFixed(2)}`}
        animations={animations}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
