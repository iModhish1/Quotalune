import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useLocale } from "../../../../hooks/useLocale";
import { METHOD_LABEL, connectionStatusKey, getProviderConnectionStatus, disconnectProviderConnection, type ProviderConnectionStatus } from "../../../../lib/providerConnection";

/** Source-derived connection line: state, "Connected via", last verification. */
export function ConnectionStatusLine({ providerId }: { providerId: string }) {
  const { t, language } = useLocale();
  const [status, setStatus] = useState<ProviderConnectionStatus | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    let request = 0;
    setStatus(null); setConfirm(false); setError(false);
    const load = () => { const sequence = ++request; return getProviderConnectionStatus().then((all) => { if (alive && sequence === request) setStatus(all.find((s) => s.providerId === providerId) ?? null); }).catch(() => {}); };
    void load();
    const stop = listen("provider-updated", () => void load()).catch(() => () => {});
    return () => { alive = false; void stop.then((f) => f()); };
  }, [providerId]);
  if (!status || status.providerId !== providerId) return null;
  const verified = status.lastVerified ? new Date(status.lastVerified).toLocaleString(language === "arabic" ? "ar-SA" : "en-US") : null;
  return (
    <div className="provider-connection-line" data-state={status.state} data-stale={status.stale}>
    <p role="status">
      <strong>{t(connectionStatusKey(status.state, status.issue, status.stale))}</strong>
      {status.method && <span> · {t("ConnectStatusVia")} {t(METHOD_LABEL[status.method])}</span>}
      {verified && <span> · {t("ConnectStatusLastVerified")} <bdi dir="ltr">{verified}</bdi></span>}
    </p>
    {status.enabled && status.method && <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setConfirm(true)}>{t("ConnectDisconnect")}</button>}
    {confirm && status.method && <div role="group" aria-label={t("ConnectDisconnect")}>
      <p>{t("ConnectDisconnectExplanation")}</p>
      <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setConfirm(false)}>{t("ConnectCancel")}</button>
      <button type="button" className="btn btn--primary" disabled={busy} onClick={async () => {
        setBusy(true); setError(false);
        try { await disconnectProviderConnection(providerId, status.method!); setConfirm(false); setStatus((s) => s?.providerId === providerId ? {...s, enabled: false, state: "idle", issue: null, method: null, lastVerified: null, stale: false} : s); }
        catch { setError(true); } finally { setBusy(false); }
      }}>{t("ConnectDisconnect")}</button>
    </div>}
    {error && <p role="alert">{t("ConnectIssueError")}</p>}
    </div>
  );
}
