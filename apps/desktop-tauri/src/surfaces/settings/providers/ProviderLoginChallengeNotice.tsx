import type { ProviderLoginChallenge } from "../../../lib/tauri";
import { useLocale } from "../../../hooks/useLocale";

/** Public device verification code only; no token or polling secret belongs here. */
export function ProviderLoginChallengeNotice({ challenge }: { challenge: ProviderLoginChallenge | null }) {
  const { t } = useLocale();
  if (!challenge) return null;
  return <aside className="settings-status" role="status">
    <p>{t("ProviderDeviceCodeHelp")}</p>
    <strong><bdi dir="ltr">{challenge.userCode}</bdi></strong>
    <p><bdi dir="ltr">{challenge.verificationUri}</bdi></p>
  </aside>;
}
