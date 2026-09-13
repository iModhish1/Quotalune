import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Field, Select } from "../../components/FormControls";
import { useLocale } from "../../hooks/useLocale";
import type { ProviderCatalogEntry } from "../../types/bridge";

export default function NotificationTestControl({ catalog }: { catalog: ProviderCatalogEntry[] }) {
  const { t } = useLocale();
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"requested" | "failed" | null>(null);
  async function send() {
    setBusy(true); setResult(null);
    try {
      await invoke("send_test_notification", { providerId: provider || null });
      setResult("requested");
    } catch { setResult("failed"); }
    finally { setBusy(false); }
  }
  return <section className="settings-section notification-test-control">
    <Field label={t("NotificationTestTitle")} description={t("NotificationTestHelp")}>
      <Select ariaLabel={t("NotificationTestSource")} value={provider} disabled={busy}
        options={[{ value: "", label: "Quotalis" }, ...catalog.map(p => ({ value: p.id, label: p.displayName }))]}
        onChange={value => { setProvider(value); setResult(null); }}/>
    </Field>
    <button type="button" disabled={busy} onClick={() => void send()}>{t("NotificationTestSend")}</button>
    {result && <p role={result === "failed" ? "alert" : "status"}>{t(result === "failed" ? "NotificationTestFailed" : "NotificationTestRequested")}</p>}
  </section>;
}
