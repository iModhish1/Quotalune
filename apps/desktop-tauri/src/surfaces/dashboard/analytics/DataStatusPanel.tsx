import { useLocale } from "../../../hooks/useLocale";
import { resolveIntlLocale } from "../../../i18n/resolveIntlLocale";
import { resolveDataStatus } from "./dashboardSelectors";
import type { DashboardSnapshot } from "../../../types/bridge";

/**
 * Pricing/Data Status shell (owner section 26, revised Phase 4A section
 * 16): honest state only. Cost state distinguishes real
 * provider-reported figures from legacy (pre-Phase-4A) rows whose
 * semantics can't be proven from unavailable data -- never a blanket
 * "estimated". Pricing state reads "not required" for provider-reported
 * cost (Quotalis's own pricing catalog never touches it) rather than
 * implying a provider-reported number came from Quotalis pricing;
 * "unverified" is reserved for a future locally-estimated figure, not
 * produced anywhere today.
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
  const status = resolveDataStatus(snapshot);
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
    status.costState === "providerReported"
      ? "DashboardDataStatusCostProviderReported"
      : status.costState === "legacyAmbiguous"
        ? "DashboardDataStatusCostLegacyAmbiguous"
        : "DashboardDataStatusCostUnavailable",
  );
  const pricingText = t(
    status.pricingState === "unverified"
      ? "DashboardDataStatusPricingNotVerified"
      : "DashboardDataStatusPricingNotRequired",
  );

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
