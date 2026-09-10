import { useLocale } from "../../../../hooks/useLocale";
import { resolveIntlLocale } from "../../../../i18n/resolveIntlLocale";
import type { ProviderDetail } from "../../../../types/bridge";
import type { LocaleKey } from "../../../../i18n/keys";
import {ProviderPlanBadge} from "../../../../components/providers/ProviderPlanBadge";
import { ProviderIcon } from "../../../../components/providers/ProviderIcon";

interface Props {
  provider: ProviderDetail;
  subtitle: string;
  t: (key: LocaleKey) => string;
  onConnect?: () => void;
  busy?: boolean;
}

/**
 * Header block: provider icon + display name + identity rows
 * (account, plan, auth type, data source).
 *
 * Port of the identity portion of
 * `rust/src/native_ui/preferences.rs::render_provider_detail_panel` (~4301).
 */
export function IdentitySection({ provider, subtitle, t, onConnect, busy }: Props) {
  const { language } = useLocale();
  const observedAt = provider.lastUpdated ? new Date(provider.lastUpdated) : null;
  const observedLabel = observedAt && Number.isFinite(observedAt.getTime()) ? new Intl.DateTimeFormat(resolveIntlLocale(language), {dateStyle:"medium", timeStyle:"short", numberingSystem:"latn"}).format(observedAt) : t("NeverUpdated");
  const rows: { label: string; value: string | null }[] = [
    { label: t("Account"), value: provider.email ?? provider.organization },
    { label: t("Plan"), value: displayIdentityValue(provider.plan, t) },
    { label: t("AuthType"), value: provider.authType },
    { label: t("DataSource"), value: provider.sourceLabel },
    { label: t("LastUpdated"), value: observedLabel },
  ];
  const visible = rows.filter(
    (r): r is { label: string; value: string } =>
      !!r.value && r.value.length > 0,
  );

  return (
    <header className="provider-detail-header-block">
      <div className="provider-detail-header">
        <ProviderIcon providerId={provider.id} size={28} />
        <div className="provider-detail-title-group">
          <div className="provider-detail-title"><bdi>{provider.displayName}</bdi> <ProviderPlanBadge plan={displayIdentityValue(provider.plan,t)}/></div>
          <div className="provider-detail-subtitle">{subtitle}</div>
        </div>
        {provider.canConnect && onConnect && <button type="button" className="btn btn--primary provider-connect-primary" onClick={onConnect} disabled={busy}>
          {t(provider.errorState === "expiredSession" ? "DashboardReconnect" : provider.errorState === "ready" && !provider.lastError ? "ActionSwitchAccount" : "ActionSignIn")}
        </button>}
      </div>
      {visible.length > 0 && (
        <dl className="provider-detail-grid">
          {visible.map((r) => (
            <div key={r.label} style={{ display: "contents" }}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {(provider.canConnect || !provider.authCapability || provider.authCapability === "credentialInput") && <p className="provider-connection-help">{t(provider.canConnect ? "V2ManagedConnection" : "V2ConfiguredConnection")}</p>}
    </header>
  );
}

function displayIdentityValue(
  value: string | null,
  t: (key: LocaleKey) => string,
): string | null {
  if (!value) return null;
  if (value.trim().toLowerCase() === "default_claude_ai")
    return t("ProviderPlanClaudeAi");
  return value;
}
