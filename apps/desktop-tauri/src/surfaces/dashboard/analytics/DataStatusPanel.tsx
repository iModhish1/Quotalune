import { useLocale } from "../../../hooks/useLocale";
import { resolveIntlLocale } from "../../../i18n/resolveIntlLocale";
import { resolveDataStatus } from "./dashboardSelectors";
import type { DashboardSnapshot } from "../../../types/bridge";

/**
 * Pricing/Data Status shell (owner section 26): honest state only --
 * never "pricing verified" or "all up to date" until the Phase 4 pricing
 * audit actually proves it, so `pricingState` from `resolveDataStatus` is
 * always "not yet verified" today. This widget exists to communicate
 * that honestly, not to imply completeness the app hasn't earned yet.
 */
/**
 * Compact system/data-health strip (owner section 11 of the Phase 3.5
 * refinement): previously a large `<dl>` with one row per fact; now two
 * dense lines so it reads as a quiet footnote, not a fourth major panel.
 * Still never fakes "all systems healthy" -- every fact here is real.
 */
export default function DataStatusPanel({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  const { t, language } = useLocale();
  if (!snapshot) return null;
  const status = resolveDataStatus(snapshot.availability);
  const firstSample = snapshot.availability.firstSampleAt;
  const uiLocale = resolveIntlLocale(language);

  const historyText = t(
    status.historyState === "active"
      ? "DashboardDataStatusHistoryActive"
      : "DashboardDataStatusHistoryCollecting",
  );
  const sinceText = firstSample
    ? t("DashboardDataAvailableSince").replace(
        "{}",
        // numberingSystem: "latn" matches the app's established digit
        // policy (resetPresentation.ts hardcodes the same).
        new Date(firstSample * 1000).toLocaleDateString(uiLocale, { numberingSystem: "latn" }),
      )
    : null;
  const samplesText = t("DashboardDataSamples").replace(
    "{}",
    String(snapshot.availability.sampleCount),
  );
  const costText = t(
    status.costState === "estimated"
      ? "DashboardDataStatusCostEstimated"
      : "DashboardDataStatusCostUnavailable",
  );
  const pricingText = t("DashboardDataStatusPricingNotVerified");

  return (
    <section className="dashboard-analytics__data-status" aria-label={t("DashboardDataStatusTitle")}>
      <h2>{t("DashboardDataStatusTitle")}</h2>
      <p className="dashboard-analytics__data-status-line">
        {historyText}
        {sinceText ? <> · {sinceText}</> : null} · {samplesText}
      </p>
      <p className="dashboard-analytics__data-status-line dashboard-analytics__data-status-line--muted">
        {costText} · {pricingText}
      </p>
    </section>
  );
}
