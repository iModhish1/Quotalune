import { useEffect, useState } from "react";
import type { LocaleKey } from "../../../../../i18n/keys";
import type { GeminiCliStatus } from "../../../../../types/bridge";
import {
  getGeminiCliSignedIn,
  openPath,
  openProviderDashboard,
} from "../../../../../lib/tauri";

interface Props {
  providerId: string;
  t: (key: LocaleKey) => string;
}

/**
 * Gemini CLI credentials row.
 *
 * Port of the `ProviderId::Gemini` branch in
 * `rust/src/native_ui/preferences.rs::render_provider_detail_panel` (~5570).
 * Shows OAuth-credential presence + a home-relative location and a button that opens the
 * credentials folder (when signed in) or a hint to install the CLI.
 */
export function GeminiCliCreds({ providerId, t }: Props) {
  const [status, setStatus] = useState<GeminiCliStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGeminiCliSignedIn()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return error ? <div role="alert" className="provider-detail-error">{t("CredsActionUnavailable")}</div> : null;

  const statusLabel = status.signedIn
    ? t("CredsStatusAuthenticated")
    : t("CredsStatusNotSignedIn");

  const handleOpenFolder = () => {
    if (!status.credentialsPath) return;
    setError(false);
    void openPath(status.credentialsPath).catch(() => setError(true));
  };

  const handleSetup = () => {
    // No CLI-install auto-flow; we open the upstream project page via the
    // provider's dashboard invariant (Gemini provider advertises it).
    setError(false);
    void openProviderDashboard(providerId).catch(() => setError(true));
  };

  return (
    <section className="provider-detail-section">
      <h4>{t("CredentialsSectionTitle")}</h4>
      <dl className="provider-detail-grid">
        <div style={{ display: "contents" }}>
          <dt>{t("CredsGeminiCliLabel")}</dt>
          <dd>{statusLabel}</dd>
        </div>
        {status.credentialsPath && (
          <div style={{ display: "contents" }}>
            <dt>{t("CredsGeminiCliHelperPrefix")}</dt>
            <dd className="provider-detail-grid__mono">
              <bdi dir="ltr">~/.gemini/oauth_creds.json</bdi>
            </dd>
          </div>
        )}
      </dl>
      {!status.signedIn && (
        <div className="provider-detail-helper">
          {t("CredsGeminiCliSetupHelp")}
        </div>
      )}
      <div className="provider-detail-actions">
        {status.signedIn && status.credentialsPath && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleOpenFolder}
          >
            {t("CredsOpenFolderAction")}
          </button>
        )}
        {!status.signedIn && (
          <button type="button" className="btn btn--ghost" onClick={handleSetup}>
            {t("CredsGeminiCliSetupAction")}
          </button>
        )}
      </div>
      {error && <div role="alert" className="provider-detail-error">{t("CredsActionUnavailable")}</div>}
    </section>
  );
}
