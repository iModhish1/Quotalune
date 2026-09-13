/**
 * The one place a user turns Demo Mode on and configures it (owner Phase
 * 5.2 sections 3-7) -- a real Settings > Dashboard Studio section, never
 * gated behind `import.meta.env.DEV` or any dev flag (owner section 31).
 *
 * Uses `useOptionalLocale()` rather than `useLocale()`: `DashboardStudioTab`
 * (this section's one call site) has never used the locale system --
 * every existing string in it is a plain English literal, and its own
 * test suite renders it without a `<LocaleProvider>`. Falling back to an
 * inline English literal when no provider is present keeps those
 * existing tests working unmodified while still translating for real
 * (Arabic included -- owner section 47) inside the actual app, which
 * always has one.
 */
import { useMemo, useState } from "react";
import { Select } from "../components/FormControls";
import { useOptionalLocale } from "../i18n/LocaleProvider";
import type { LocaleKey } from "../i18n/keys";
import type {
  DemoProviderMode,
  DemoScenario,
  ProviderCatalogEntry,
  SettingsSnapshot,
  SettingsUpdate,
} from "../types/bridge";
import { DEFAULT_DEMO_PROVIDER_COUNT, MAX_DEMO_PROVIDER_COUNT, MIN_DEMO_PROVIDER_COUNT } from "./constants";
import "./DemoSettingsSection.css";

const SCENARIOS: { id: DemoScenario; labelKey: LocaleKey; fallback: string }[] = [
  { id: "connectedShowcase", labelKey: "DemoScenarioConnectedShowcase", fallback: "Connected Showcase" },
  { id: "balancedActivity", labelKey: "DemoScenarioBalancedActivity", fallback: "Balanced Activity" },
  { id: "highUsage", labelKey: "DemoScenarioHighUsage", fallback: "High Usage" },
  { id: "resetSoon", labelKey: "DemoScenarioResetSoon", fallback: "Reset Soon" },
  { id: "mixedStatus", labelKey: "DemoScenarioMixedStatus", fallback: "Mixed Status" },
  { id: "monetarySemantics", labelKey: "DemoScenarioMonetarySemantics", fallback: "Monetary Semantics" },
];

export interface DemoSettingsSectionProps {
  settings: SettingsSnapshot;
  catalog: ProviderCatalogEntry[];
  update: (patch: SettingsUpdate) => void | Promise<void>;
}

export default function DemoSettingsSection({ settings, catalog, update }: DemoSettingsSectionProps) {
  const locale = useOptionalLocale();
  const t = (key: LocaleKey, fallback: string) => locale?.t(key) ?? fallback;
  const [pickerFilter, setPickerFilter] = useState("");

  const enabled = settings.demoModeEnabled ?? false;
  const providerMode: DemoProviderMode = settings.demoProviderMode ?? "curated";
  const catalogIds = useMemo(() => new Set(catalog.map((provider) => provider.id)), [catalog]);
  const maxProviderCount = Math.min(MAX_DEMO_PROVIDER_COUNT, catalogIds.size);
  const providerCount = Math.min(maxProviderCount, Math.max(MIN_DEMO_PROVIDER_COUNT,
    settings.demoProviderCount ?? DEFAULT_DEMO_PROVIDER_COUNT));
  const scenario: DemoScenario = settings.demoScenario ?? "connectedShowcase";
  const historyDays = settings.demoHistoryDays ?? 7;
  const customIds = useMemo(() => new Set(settings.demoProviderIds ?? []), [settings.demoProviderIds]);
  const seed = settings.demoSeed ?? 1;

  const scenarioLabel = SCENARIOS.find((s) => s.id === scenario);

  const setCount = (next: number) => {
    if (!maxProviderCount) return;
    const clamped = Math.min(maxProviderCount, Math.max(MIN_DEMO_PROVIDER_COUNT, next));
    void update({ demoProviderCount: clamped });
  };

  const toggleCustomProvider = (id: string) => {
    const next = new Set(customIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    void update({ demoProviderIds: [...next] });
  };

  const filteredCatalog = pickerFilter.trim()
    ? catalog.filter((p) => p.displayName.toLowerCase().includes(pickerFilter.trim().toLowerCase()))
    : catalog;

  return (
    <section aria-label={t("DashboardStudioDemoSectionTitle", "Demo & Preview")} className="demo-settings">
      <h3>{t("DashboardStudioDemoSectionTitle", "Demo & Preview")}</h3>
      <p className="demo-settings__description">
        {t(
          "DashboardStudioDemoSectionDescription",
          "Preview Quotalis with simulated provider data without connecting accounts.",
        )}
      </p>

      <label className="demo-settings__toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => void update({ demoModeEnabled: e.target.checked })}
        />
        {t("DemoModeEnableLabel", "Enable Demo Mode")}
      </label>

      {enabled && (
        <div className="demo-settings__controls">
          <div className="demo-settings__field">
            <span className="demo-settings__field-label">{t("DemoProviderSetLabel", "Provider Set")}</span>
            <div
              className="demo-settings__segmented"
              role="radiogroup"
              aria-label={t("DemoProviderSetLabel", "Provider Set")}
            >
              <button
                type="button"
                role="radio"
                aria-checked={providerMode === "curated"}
                className={providerMode === "curated" ? "demo-settings__segment demo-settings__segment--selected" : "demo-settings__segment"}
                onClick={() => void update({ demoProviderMode: "curated" })}
              >
                {t("DemoProviderSetCurated", "Curated")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={providerMode === "custom"}
                className={providerMode === "custom" ? "demo-settings__segment demo-settings__segment--selected" : "demo-settings__segment"}
                onClick={() => void update({ demoProviderMode: "custom" })}
              >
                {t("DemoProviderSetCustom", "Custom")}
              </button>
            </div>
          </div>

          {providerMode === "curated" && (
            <div className="demo-settings__field">
              <label htmlFor="demo-provider-count" className="demo-settings__field-label">
                {t("DemoProviderCountLabel", "Simulated providers")}
              </label>
              <div className="demo-settings__stepper">
                <button
                  type="button"
                  aria-label="Decrease simulated provider count"
                  disabled={providerCount <= MIN_DEMO_PROVIDER_COUNT}
                  onClick={() => setCount(providerCount - 1)}
                >
                  −
                </button>
                <output id="demo-provider-count" className="demo-settings__stepper-value">
                  {providerCount}
                </output>
                <button
                  type="button"
                  aria-label="Increase simulated provider count"
                  disabled={providerCount >= maxProviderCount}
                  onClick={() => setCount(providerCount + 1)}
                >
                  +
                </button>
              </div>
            </div>
          )}

          {providerMode === "custom" && (
            <div className="demo-settings__field">
              <label htmlFor="demo-provider-picker" className="demo-settings__field-label">
                {t("DemoCustomProviderPickerLabel", "Choose providers")}
              </label>
              <input
                id="demo-provider-picker"
                type="search"
                className="demo-settings__picker-search"
                placeholder="Search…"
                value={pickerFilter}
                onChange={(e) => setPickerFilter(e.target.value)}
              />
              <ul className="demo-settings__picker-list" role="group" aria-label={t("DemoCustomProviderPickerLabel", "Choose providers")}>
                {filteredCatalog.map((p) => (
                  <li key={p.id}>
                    <label className="demo-settings__picker-item">
                      <input
                        type="checkbox"
                        checked={customIds.has(p.id)}
                        onChange={() => toggleCustomProvider(p.id)}
                      />
                      <bdi>{p.displayName}</bdi>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="demo-settings__field">
            <label htmlFor="demo-scenario" className="demo-settings__field-label">
              {t("DemoScenarioLabel", "Scenario")}
            </label>
            <Select
              ariaLabel={t("DemoScenarioLabel", "Scenario")}
              value={scenario}
              options={SCENARIOS.map((opt) => ({ value: opt.id, label: t(opt.labelKey, opt.fallback) }))}
              onChange={(value) => void update({ demoScenario: value as DemoScenario })}
            />
          </div>

          <div className="demo-settings__field">
            <span className="demo-settings__field-label">{t("DemoHistoryLabel", "History")}</span>
            <div className="demo-settings__segmented" role="radiogroup" aria-label={t("DemoHistoryLabel", "History")}>
              <button
                type="button"
                role="radio"
                aria-checked={historyDays === 7}
                className={historyDays === 7 ? "demo-settings__segment demo-settings__segment--selected" : "demo-settings__segment"}
                onClick={() => void update({ demoHistoryDays: 7 })}
              >
                {t("DemoHistory7Days", "7 Days")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={historyDays === 30}
                className={historyDays === 30 ? "demo-settings__segment demo-settings__segment--selected" : "demo-settings__segment"}
                onClick={() => void update({ demoHistoryDays: 30 })}
              >
                {t("DemoHistory30Days", "30 Days")}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="demo-settings__regenerate"
            onClick={() => void update({ demoSeed: seed + 1 })}
          >
            {t("DemoRegenerateButton", "Regenerate Demo Data")}
          </button>

          <div className="demo-settings__summary">
            <h4>{t("DemoCurrentConfigTitle", "Current configuration")}</h4>
            <dl>
              <div>
                <dt>{t("DemoModeEnableLabel", "Enable Demo Mode")}</dt>
                <dd>{enabled ? t("DemoStatusOn", "On") : t("DemoStatusOff", "Off")}</dd>
              </div>
              <div>
                <dt>{t("DemoProviderCountLabel", "Simulated providers")}</dt>
                <dd>{t("DemoSummaryProviders", "{} providers").replace("{}", String(providerCount))}</dd>
              </div>
              <div>
                <dt>{t("DemoScenarioLabel", "Scenario")}</dt>
                <dd>{scenarioLabel ? t(scenarioLabel.labelKey, scenarioLabel.fallback) : scenario}</dd>
              </div>
              <div>
                <dt>{t("DemoHistoryLabel", "History")}</dt>
                <dd>{t("DemoSummaryHistoryDays", "{} days").replace("{}", String(historyDays))}</dd>
              </div>
            </dl>
          </div>

          <details className="demo-settings__about">
            <summary>{t("DemoAboutButton", "About Demo Data")}</summary>
            <p>
              {t(
                "DemoAboutBody",
                "Demo data is generated locally on this device and simulated -- it is never sent to any provider and never written into your real provider history. You can regenerate it at any time, and disabling Demo Mode returns you to your live data immediately.",
              )}
            </p>
          </details>
        </div>
      )}
    </section>
  );
}
