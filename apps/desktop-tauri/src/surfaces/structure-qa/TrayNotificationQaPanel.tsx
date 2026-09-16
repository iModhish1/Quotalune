import { useState } from "react";
import { useLocale } from "../../hooks/useLocale";
import type { LocaleKey } from "../../i18n/keys";
import {
  NOTIFICATION_QA_KINDS,
  sendNotificationQaFixture,
  setTrayQaFixture,
  type NotificationQaKind,
  type TrayQaFixture,
} from "../../lib/trayQa";

export const DEFAULT_TRAY_QA_FIXTURE: TrayQaFixture = {
  providerId: "claude",
  dataState: "available",
  usedPercent: 62,
  secondaryUsedPercent: 18,
  plan: "Max",
  resetMinutes: 95,
  tokens: 1_234_567,
};

const KIND_LABELS: Record<NotificationQaKind, LocaleKey> = {
  info: "NotificationQaInfo",
  warning: "NotificationQaWarning",
  critical: "NotificationQaCritical",
  reset: "NotificationQaReset",
  providerUnavailable: "NotificationQaUnavailable",
  authRequired: "NotificationQaAuth",
};

const optionalNumber = (value: string): number | null => (value.trim() === "" ? null : Number(value));

/** Dev-only controls for the tray and notification fixtures. Every action is
 * refused by the backend outside the Dev channel; nothing here writes settings
 * or history. Tray style, Used/Remaining and tooltip rows stay configured in
 * the real Tray Studio so the fixture exercises the production configuration. */
export function TrayNotificationQaPanel({ providerIds }: { providerIds: readonly string[] }) {
  const { t } = useLocale();
  const [tray, setTray] = useState<TrayQaFixture>(DEFAULT_TRAY_QA_FIXTURE);
  const [kind, setKind] = useState<NotificationQaKind>("warning");
  const [notificationProvider, setNotificationProvider] = useState("claude");
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const run = async (action: () => Promise<void>, success?: string) => {
    setError(undefined);
    setStatus(undefined);
    try {
      await action();
      setStatus(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  const providerOptions = providerIds.map((id) => <option key={id} value={id}>{id}</option>);

  return (
    <>
      <fieldset>
        <legend>{t("TrayQaTitle")}</legend>
        <small>{t("TrayQaHelp")}</small>
        <label>
          {t("TrayQaProvider")}
          <select aria-label={t("TrayQaProvider")} value={tray.providerId} onChange={(e) => setTray({ ...tray, providerId: e.target.value })}>
            {providerOptions}
          </select>
        </label>
        <label>
          {t("TrayQaDataState")}
          <select aria-label={t("TrayQaDataState")} value={tray.dataState} onChange={(e) => setTray({ ...tray, dataState: e.target.value as TrayQaFixture["dataState"] })}>
            <option value="available">{t("TrayQaAvailable")}</option>
            <option value="unavailable">{t("TrayQaUnavailable")}</option>
            <option value="error">{t("TrayQaError")}</option>
          </select>
        </label>
        <label>
          {t("TrayQaUsed")}
          <input aria-label={t("TrayQaUsed")} type="number" min={0} max={100} step={0.5} value={tray.usedPercent} onChange={(e) => setTray({ ...tray, usedPercent: Number(e.target.value) })} />
        </label>
        <label>
          {t("TrayQaWeekly")}
          <input aria-label={t("TrayQaWeekly")} type="number" min={0} max={100} value={tray.secondaryUsedPercent ?? ""} onChange={(e) => setTray({ ...tray, secondaryUsedPercent: optionalNumber(e.target.value) })} />
        </label>
        <label>
          {t("TrayQaPlan")}
          <input aria-label={t("TrayQaPlan")} maxLength={40} value={tray.plan ?? ""} onChange={(e) => setTray({ ...tray, plan: e.target.value || null })} />
        </label>
        <label>
          {t("TrayQaReset")}
          <input aria-label={t("TrayQaReset")} type="number" min={0} value={tray.resetMinutes ?? ""} onChange={(e) => setTray({ ...tray, resetMinutes: optionalNumber(e.target.value) })} />
        </label>
        <label>
          {t("TrayQaTokens")}
          <input aria-label={t("TrayQaTokens")} type="number" min={0} value={tray.tokens ?? ""} onChange={(e) => setTray({ ...tray, tokens: optionalNumber(e.target.value) })} />
        </label>
        <button type="button" onClick={() => void run(() => setTrayQaFixture(tray))}>{t("TrayQaApply")}</button>
        <button type="button" onClick={() => void run(() => setTrayQaFixture(null))}>{t("TrayQaClear")}</button>
      </fieldset>

      <fieldset>
        <legend>{t("NotificationQaTitle")}</legend>
        <small>{t("NotificationQaHelp")}</small>
        <label>
          {t("NotificationQaKind")}
          <select aria-label={t("NotificationQaKind")} value={kind} onChange={(e) => setKind(e.target.value as NotificationQaKind)}>
            {NOTIFICATION_QA_KINDS.map((value) => <option key={value} value={value}>{t(KIND_LABELS[value])}</option>)}
          </select>
        </label>
        <label>
          {t("TrayQaProvider")}
          <select aria-label={`${t("NotificationQaTitle")} ${t("TrayQaProvider")}`} value={notificationProvider} onChange={(e) => setNotificationProvider(e.target.value)}>
            {providerOptions}
          </select>
        </label>
        <button type="button" onClick={() => void run(() => sendNotificationQaFixture(kind, notificationProvider), t("NotificationQaSent"))}>
          {t("NotificationQaSend")}
        </button>
      </fieldset>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
