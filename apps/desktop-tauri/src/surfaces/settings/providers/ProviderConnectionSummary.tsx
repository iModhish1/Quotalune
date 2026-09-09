import {useLocale} from "../../../hooks/useLocale";
import type {ProviderAuthCapability} from "../../../types/bridge";
import type {LocaleKey} from "../../../i18n/keys";
const CAPABILITY_COPY: Record<ProviderAuthCapability, LocaleKey> = {
  noAuthRequired:"V2AuthNone",credentialInput:"V2AuthCredentials",deviceFlow:"V2AuthDevice",
  supervisedCli:"V2AuthCli",externalDashboard:"V2AuthExternal",detectionOnly:"V2AuthDetection",unsupported:"V2AuthUnsupported",
};
/** Backend capability describes supported actions, not whether credentials work. */
export function ProviderConnectionSummary({capability}: {capability?: ProviderAuthCapability}) {
  const {t} = useLocale();
  if (!capability) return null;
  return <div className="provider-connection-summary"><span>{t("V2ConnectionMethod")}</span><strong>{t(CAPABILITY_COPY[capability])}</strong></div>;
}
