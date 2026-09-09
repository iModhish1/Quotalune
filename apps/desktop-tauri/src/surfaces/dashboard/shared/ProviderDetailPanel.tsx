/**
 * The selected-provider detail panel -- shared between every Dashboard
 * spatial surface (Phase 5's 3D Provider Universe, Phase S1's Spatial
 * Observatory) rather than duplicated per surface (owner Phase S1
 * section 31/15: "Reuse/refine the provider detail panel," "business
 * meaning does not [differ], rendering representation does"). Originally
 * `SelectedProviderPanel` inside `providers3d/ProvidersUniverseScene.tsx`;
 * pulled out here verbatim (no behavior change) when the Spatial surface
 * needed the exact same panel.
 *
 * Phase 4 monetary truth is absolute here: Spend/Balance/Credits/
 * Unavailable render exactly as `sceneModel.ts` classified them, never a
 * derived/estimated value.
 */
import { useLocale } from "../../../hooks/useLocale";
import { useFormattedResetTime } from "../../../hooks/useFormattedResetTime";
import { formatPercentage } from "../../../design-system/percent";
import type { ProviderSceneNode } from "../providers3d/sceneModel";
import type { LocaleKey } from "../../../i18n/keys";
import "./ProviderDetailPanel.css";

function monetaryText(node: ProviderSceneNode, t: (key: LocaleKey) => string): string {
  if (node.monetary.amount == null) {
    return node.monetary.kind === "balance"
      ? t("Providers3DMonetaryBalanceUnavailable")
      : node.monetary.kind === "credits"
        ? t("Providers3DMonetaryCreditsUnavailable")
        : t("DashboardValueUnavailable");
  }
  const amount = node.monetary.amount.toFixed(2);
  const currency = node.monetary.currencyCode ?? "";
  if (node.monetary.kind === "spend") return `${t("Providers3DMonetarySpend")}: ${currency} ${amount}`;
  if (node.monetary.kind === "balance") return `${t("Providers3DMonetaryBalance")}: ${currency} ${amount}`;
  return `${t("Providers3DMonetaryCredits")}: ${amount}`;
}

export interface ProviderDetailPanelProps {
  node: ProviderSceneNode;
  isDemo: boolean;
  /** Extra class(es) for grid/layout placement -- kept separate from the
   *  panel's own visual styling so each surface's grid stays in its own
   *  CSS file rather than this shared one hardcoding a layout that only
   *  fits one caller. */
  className?: string;
}

export default function ProviderDetailPanel({ node, isDemo, className }: ProviderDetailPanelProps) {
  const { t } = useLocale();
  const resetText = useFormattedResetTime(node.resetsAt, null, true, "reset");
  return (
    <section
      className={`provider-detail-panel${className ? ` ${className}` : ""}`}
      aria-label={t("Providers3DSelectedProviderDetail")}
      data-testid="provider-detail-panel"
    >
      <h3>
        <bdi>{node.displayName}</bdi>
        {isDemo && <span className="provider-detail-panel__demo-chip">{t("DemoIndicatorBadge")}</span>}
      </h3>
      <dl>
        <div>
          <dt>{t("Providers3DUsage")}</dt>
          <dd>
            {node.usedPercent == null ? t("DashboardValueUnavailable") : formatPercentage(node.usedPercent)}
          </dd>
        </div>
        <div>
          <dt>{t("DashboardKpiNextReset")}</dt>
          <dd>{resetText ?? t("DashboardValueUnavailable")}</dd>
        </div>
        <div>
          <dt>{t("Providers3DAuthStatus")}</dt>
          <dd>
            {node.authState === "ready"
              ? isDemo
                ? t("Providers3DAuthReadyDemo")
                : t("Providers3DAuthReady")
              : isDemo
                ? t("Providers3DDemoStateButton")
                : node.authState === "needsAuth"
                  ? t("DashboardAlertAuthRequired").replace("{}", node.displayName)
                  : t("DashboardAlertUnavailable").replace("{}", node.displayName)}
          </dd>
        </div>
        <div>
          <dt>{t("Providers3DMonetaryState")}</dt>
          <dd>{monetaryText(node, t)}</dd>
        </div>
      </dl>
    </section>
  );
}
