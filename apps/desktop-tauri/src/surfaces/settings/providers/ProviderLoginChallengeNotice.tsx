import type { ProviderLoginChallenge } from "../../../lib/tauri";
import { useLocale } from "../../../hooks/useLocale";
import {useState} from "react";
import {openExternalUrl} from "../../../lib/tauri";

/** Public device verification code only; no token or polling secret belongs here. */
export function ProviderLoginChallengeNotice({ challenge }: { challenge: ProviderLoginChallenge | null }) {
  const { t } = useLocale();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!challenge) return null;
  const copy = async () => {
    setError(null);
    try { await navigator.clipboard.writeText(challenge.userCode); setCopiedCode(challenge.userCode); }
    catch (failure) { setError(String(failure)); }
  };
  const open = async () => {
    setError(null);
    try { await openExternalUrl(challenge.verificationUri); }
    catch (failure) { setError(String(failure)); }
  };
  return <aside className="settings-status" role="status">
    <p>{t("ProviderDeviceCodeHelp")}</p>
    <strong><bdi dir="ltr">{challenge.userCode}</bdi></strong>
    <p><bdi dir="ltr">{challenge.verificationUri}</bdi></p>
    <div className="provider-detail-actions"><button type="button" onClick={() => void copy()}>{t(copiedCode === challenge.userCode ? "V2Copied" : "V2CopyCode")}</button>
      <button type="button" onClick={() => void open()}>{t("V2OpenVerification")}</button></div>
    {error && <p role="alert">{error}</p>}
  </aside>;
}
