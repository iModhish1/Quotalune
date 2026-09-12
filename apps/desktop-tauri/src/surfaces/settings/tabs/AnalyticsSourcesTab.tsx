import { useEffect, useRef, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { useAnalyticsSources } from "../../../hooks/useAnalyticsSources";
import type { AnalyticsAvailability, AnalyticsCapabilities, AnalyticsScope, AnalyticsSourceDescriptor, AnalyticsSourceFact } from "../../../types/bridge";
import type { LocaleKey } from "../../../i18n/keys";
import "./AnalyticsSourcesTab.css";

const STATUS_KEY: Record<AnalyticsAvailability, LocaleKey> = {
  available: "AnalyticsSourceStatusAvailable",
  noDataYet: "AnalyticsSourceStatusNoDataYet",
  unsupported: "AnalyticsSourceStatusUnsupported",
};
const SCOPE_KEY: Record<AnalyticsScope, LocaleKey> = {
  account: "AnalyticsScopeAccount",
  provider: "AnalyticsScopeProvider",
  device: "AnalyticsScopeDevice",
};
const CAPABILITY_ORDER: { key: keyof AnalyticsCapabilities; labelKey: LocaleKey }[] = [
  { key: "quota", labelKey: "AnalyticsCapabilityQuota" },
  { key: "resets", labelKey: "AnalyticsCapabilityResets" },
  { key: "monetary", labelKey: "AnalyticsCapabilityMonetary" },
  { key: "tokens", labelKey: "AnalyticsCapabilityTokens" },
  { key: "models", labelKey: "AnalyticsCapabilityModels" },
  { key: "sessionCount", labelKey: "AnalyticsCapabilitySessions" },
  { key: "dailyActivity", labelKey: "AnalyticsCapabilityDailyActivity" },
];

/** Backend-authoritative fact -> localized short phrase (owner Phase 3M:
 *  "do not duplicate backend truth in frontend code"). This is the ONLY
 *  place the frontend interprets an `AnalyticsSourceFact` identifier --
 *  it maps meaning to wording, it never decides which facts apply to
 *  which source (that stays in `rust/src/analytics_sources.rs`). Joined
 *  with "·" rather than a grammatical list ("A, B, and C") so this
 *  never needs per-locale list-conjunction logic. */
const SOURCE_FACT_KEY: Record<AnalyticsSourceFact, LocaleKey> = {
  providerLiveQuotaPlanStatus: "AnalyticsFactProviderLiveQuotaPlanStatus",
  persistedQuotaResetSamples: "AnalyticsFactPersistedQuotaResetSamples",
  providerReportedMonetaryFigures: "AnalyticsFactProviderReportedMonetaryFigures",
  timestamps: "AnalyticsFactTimestamps",
  tokenCounts: "AnalyticsFactTokenCounts",
  modelIdentifiers: "AnalyticsFactModelIdentifiers",
  promptOrResponseContent: "AnalyticsFactPromptOrResponseContent",
  localCliLogs: "AnalyticsFactLocalCliLogs",
  locallyEstimatedCost: "AnalyticsFactLocallyEstimatedCost",
  perSessionRecord: "AnalyticsFactPerSessionRecord",
  dollarCost: "AnalyticsFactDollarCost",
  sessionIdentity: "AnalyticsFactSessionIdentity",
};

/**
 * Settings -> Analytics -> Data Sources (owner section 3). Renders the
 * real analytics source registry (`get_analytics_source_registry`)
 * verbatim -- every label, scope, capability chip, and read/does-not-read
 * line comes straight from `rust/src/analytics_sources.rs`, not a
 * second, hand-maintained copy of the capability rules. Uninstalled
 * third-party tools (ccusage, OpenLIT, etc.) never appear here as rows --
 * the registry itself only has real Quotalis-native sources.
 */
function factList(facts: AnalyticsSourceFact[], t: (key: LocaleKey) => string): string {
  return facts.map((fact) => t(SOURCE_FACT_KEY[fact])).join(" · ");
}

/** Settings -> Data Sources -> per-source detail inspector (owner Phase
 *  3M: "finish the remaining Data Sources gap"). An inline expanding
 *  panel, not a floating modal -- reuses the same `cosmic-disclosure`
 *  interaction grammar `LocalActivity.tsx`'s "View as a table" and
 *  "Data quality" disclosures already establish elsewhere in Analytics,
 *  rather than a second visual language for "more detail." Every field
 *  is real data already present on `AnalyticsSourceDescriptor` -- no
 *  index/freshness/provenance field is fabricated where the descriptor
 *  doesn't have one. */
function SourceInspector({ source, triggerRef, onClose, t }: { source: AnalyticsSourceDescriptor; triggerRef: React.RefObject<HTMLButtonElement>; onClose: () => void; t: (key: LocaleKey) => string }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);
  return (
    <div
      ref={panelRef}
      role="region"
      aria-label={t("AnalyticsSourceInspectorHeading")}
      className="analytics-sources-tab__inspector"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
          triggerRef.current?.focus();
        }
      }}
    >
      <dl>
        <div><dt>{t("AnalyticsSourceInspectorIdentity")}</dt> <dd><bdi>{source.label}</bdi></dd></div>
        <div><dt>{t("AnalyticsSourceInspectorAvailability")}</dt> <dd>{t(STATUS_KEY[source.availability])}</dd></div>
        <div><dt>{t("AnalyticsSourceInspectorScope")}</dt> <dd>{t(SCOPE_KEY[source.scope])}</dd></div>
        <div>
          <dt>{t("AnalyticsSourceInspectorCapabilities")}</dt>
          <dd>
            {CAPABILITY_ORDER.filter((c) => source.capabilities[c.key]).length
              ? CAPABILITY_ORDER.filter((c) => source.capabilities[c.key]).map((c) => t(c.labelKey)).join(" · ")
              : t("AnalyticsSourceInspectorNoCapabilities")}
          </dd>
        </div>
        <div><dt>{t("AnalyticsSourceReadsLabel")}</dt> <dd>{factList(source.reads, t)}</dd></div>
        <div><dt>{t("AnalyticsSourceDoesNotReadLabel")}</dt> <dd>{factList(source.doesNotRead, t)}</dd></div>
      </dl>
      <p className="analytics-sources-tab__inspector-limitation">{t("AnalyticsSourceInspectorPathsNote")}</p>
      <button type="button" onClick={() => { onClose(); triggerRef.current?.focus(); }}>{t("AnalyticsSourceInspectorClose")}</button>
    </div>
  );
}

export default function AnalyticsSourcesTab() {
  const { t } = useLocale();
  const { sources, loading, error } = useAnalyticsSources();
  const [openId, setOpenId] = useState<AnalyticsSourceDescriptor["id"] | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  return (
    // No repeated <h3>/description here: the Settings shell's own page
    // header already renders this tab's title and help text verbatim
    // (both come from the same `TabAnalyticsSources`/`AnalyticsSourcesHelp`
    // keys via settingsCenterRegistry.ts) -- a native screenshot caught
    // the exact same heading and sentence rendered twice in a row.
    <section className="settings-section analytics-sources-tab" aria-label={t("TabAnalyticsSources")}>
      {error && <p role="alert" className="analytics-sources-tab__error">{error}</p>}
      {loading && !error && <p role="status">…</p>}

      {!loading && !error && (
        <ul className="analytics-sources-tab__list">
          {sources.map((source) => {
            const isOpen = openId === source.id;
            return (
              <li key={source.id} className="analytics-sources-tab__row" data-availability={source.availability}>
                <div className="analytics-sources-tab__row-header">
                  <strong><bdi>{source.label}</bdi></strong>
                  <span className={`analytics-sources-tab__status analytics-sources-tab__status--${source.availability}`}>
                    {t(STATUS_KEY[source.availability])}
                  </span>
                  <span className="analytics-sources-tab__scope">{t(SCOPE_KEY[source.scope])}</span>
                </div>
                <div className="analytics-sources-tab__chips">
                  {CAPABILITY_ORDER.filter((c) => source.capabilities[c.key]).map((c) => (
                    <span key={c.key} className="analytics-sources-tab__chip">
                      {t(c.labelKey)}
                    </span>
                  ))}
                </div>
                <dl className="analytics-sources-tab__privacy">
                  <div>
                    <dt>{t("AnalyticsSourceReadsLabel")}</dt>
                    <dd>{factList(source.reads, t)}</dd>
                  </div>
                  <div>
                    <dt>{t("AnalyticsSourceDoesNotReadLabel")}</dt>
                    <dd>{factList(source.doesNotRead, t)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  ref={(el) => { triggerRefs.current[source.id] = el; }}
                  aria-expanded={isOpen}
                  className="analytics-sources-tab__details-toggle"
                  onClick={() => setOpenId(isOpen ? null : source.id)}
                >
                  {isOpen ? t("AnalyticsSourceInspectorClose") : t("AnalyticsSourceInspectorOpen")}
                </button>
                {isOpen && (
                  <SourceInspector
                    source={source}
                    triggerRef={{ current: triggerRefs.current[source.id] } as React.RefObject<HTMLButtonElement>}
                    onClose={() => setOpenId(null)}
                    t={t}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
