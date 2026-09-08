import { useLocale } from "../../../hooks/useLocale";
import { resolveIntlLocale } from "../../../i18n/resolveIntlLocale";
import { resolveDataStatus, type DataStatus } from "./dashboardSelectors";
import type { DashboardSnapshot } from "../../../types/bridge";
import type { LocaleKey } from "../../../i18n/keys";

const COST_STATE_LOCALE_KEY: Record<DataStatus["costState"], LocaleKey> = {
  providerReportedSpend: "DashboardDataStatusCostProviderReported",
  providerReportedBalance: "DashboardDataStatusCostProviderReportedBalance",
  providerReportedCredits: "DashboardDataStatusCostProviderReportedCredits",
  monetarySemanticsUnknown: "DashboardDataStatusCostSemanticsUnknown",
  legacyAmbiguous: "DashboardDataStatusCostLegacyAmbiguous",
  unavailable: "DashboardDataStatusCostUnavailable",
};

/**
 * Pricing/Data Status shell (owner section 26, revised Phase 4A.1
 * section 5): honest state only. Cost state distinguishes real
 * provider-reported SPEND from a provider-reported BALANCE or CREDITS
 * figure (a balance is never called "Cost"/"Spend" -- see
 * `docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md` "Phase 4A.1"), from
 * legacy (pre-Phase-4A) rows whose semantics can't be proven, from real
 * cost data whose quantity kind is genuinely unknown. Pricing state
 * stays independent of quantity kind -- a provider-reported balance does
 * not imply verified pricing any more than provider-reported spend does;
 * it reads "not required" for any provider-reported figure (Quotalis's
 * own pricing catalog never touches it), "unverified" only for a future
 * locally-estimated figure (not produced anywhere today).
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
  const costText = t(COST_STATE_LOCALE_KEY[status.costState]);
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
