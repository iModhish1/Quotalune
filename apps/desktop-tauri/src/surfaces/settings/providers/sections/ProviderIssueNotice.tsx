import type { ProviderDetail } from "../../../../types/bridge";
import type { LocaleKey } from "../../../../i18n/keys";
import { describeProviderState } from "../../../../lib/providerState";

interface Props {
  detail: ProviderDetail;
  t: (key: LocaleKey) => string;
}

export function ProviderIssueNotice({ detail, t }: Props) {
  const state = describeProviderState(detail.errorState ?? "unknown");
  const title = `${detail.displayName}: ${t(state.labelKey)}`;
  // Wave 1F §12: `errorState` (describeProviderState's input) has no
  // distinct "timeout" kind -- that module's own doc comment is explicit
  // it only maps the classified kind, never raw error text, so this
  // check stays here rather than inside it. `lastError === "Timeout"` is
  // the same real, backend-confirmed signal (commands/providers.rs's
  // per-fetch timeout wrapper) already reused for Structures/Dashboard;
  // reuses the same shared locale key instead of inventing a Settings-
  // specific one.
  const detailText = detail.lastError === "Timeout" ? t("QuotalisLoadingTimeout") : t("ProviderIssuePrivacySafeDetail");

  return (
    <div className="provider-detail-error" role="status">
      <div className="provider-detail-error__header">
        <strong>{title}</strong>
      </div>
      <p>{detailText}</p>
    </div>
  );
}
