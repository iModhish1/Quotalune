import {useId, useState, type ReactNode} from "react";
import {useLocale} from "../../hooks/useLocale";
export {Field as SettingsRow, Select as SettingsSelect, Toggle as SettingsToggle} from "../../components/FormControls";

export function SettingsSection({title, description, children}: {title: string; description?: string; children: ReactNode}) {
  const id = useId();
  return <section className="settings-section" aria-labelledby={id}><h3 id={id}>{title}</h3>{description && <p className="settings-section__description">{description}</p>}{children}</section>;
}
export function SettingsPreview({label, children}: {label: string; children: ReactNode}) {
  return <figure className="settings-preview"><figcaption>{label}</figcaption>{children}</figure>;
}
/** Confirmation is local to the affected section; no provider/account mutations. */
export function SettingsResetAction({label, onReset}: {label: string; onReset: () => Promise<unknown>}) {
  const {t} = useLocale();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  return <div className="settings-reset-action">
    <button type="button" onClick={() => setConfirm(true)}>{label}</button>
    {confirm && <div role="alertdialog" aria-labelledby={id} className="settings-reset-action__confirmation">
      <p id={id}>{t("V2ResetConfirm")}</p>
      <button type="button" disabled={busy} onClick={async () => {setBusy(true); setError(null); try {await onReset(); setConfirm(false);} catch (cause) {setError(String(cause));} finally {setBusy(false);}}}>{label}</button>
      <button type="button" disabled={busy} onClick={() => setConfirm(false)}>{t("V2Cancel")}</button>
      {error && <p role="alert">{error}</p>}
    </div>}
  </div>;
}
