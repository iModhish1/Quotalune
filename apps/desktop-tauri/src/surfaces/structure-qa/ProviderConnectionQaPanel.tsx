import { useState } from "react";
import { useLocale } from "../../hooks/useLocale";
import { CONNECTION_QA_SCENARIOS, setProviderConnectionQaFixture, type ConnectionQaScenario } from "../../lib/providerConnection";

/** Dev-only: forces one provider's connection state in memory so the real
 * Providers page and connect flow render every scenario deterministically. */
export function ProviderConnectionQaPanel({ providerIds }: { providerIds: readonly string[] }) {
  const { t } = useLocale();
  const [providerId, setProviderId] = useState(providerIds[0] ?? "claude");
  const [scenario, setScenario] = useState<ConnectionQaScenario>("connected");
  const [error, setError] = useState<string>();
  const run = (fixture: { providerId: string; scenario: ConnectionQaScenario } | null) => {
    setError(undefined);
    setProviderConnectionQaFixture(fixture).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };
  return (
    <fieldset>
      <legend>{t("ProviderQaTitle")}</legend>
      <small>{t("ProviderQaHelp")}</small>
      <label>
        {t("TrayQaProvider")}
        <select aria-label={`${t("ProviderQaTitle")} ${t("TrayQaProvider")}`} value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          {(providerIds.length ? providerIds : [providerId]).map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <label>
        {t("ProviderQaScenario")}
        <select aria-label={t("ProviderQaScenario")} value={scenario} onChange={(e) => setScenario(e.target.value as ConnectionQaScenario)}>
          {CONNECTION_QA_SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => run({ providerId, scenario })}>{t("ProviderQaApply")}</button>
      <button type="button" onClick={() => run(null)}>{t("ProviderQaClear")}</button>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
