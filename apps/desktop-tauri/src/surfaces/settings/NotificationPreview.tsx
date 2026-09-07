import QuotaArcMark from "../../components/QuotaArcMark";
import {QaProviderIcon} from "../../design-system";
import {formatPercentage} from "../../design-system/percent";
import {useLocale} from "../../hooks/useLocale";
import "./NotificationPreview.css";

export default function NotificationPreview({high,critical,enabled}:{high:number;critical:number;enabled:boolean}){
  const {t}=useLocale();
  const remaining=Math.max(0,100-high);
  const thresholdText=(value:number)=>`${formatPercentage(value)} ${t("DetailCostUsed")} · ${formatPercentage(Math.max(0,100-value))} ${t("DetailCostRemaining")}`;
  return <section className="notification-overview" aria-label={t("NotificationPreviewTitle")}>
    <header className="notification-overview__header">
      <span className="notification-overview__mark"><QuotaArcMark size={44} label="Quotalis"/></span>
      <div className="notification-overview__heading">
        <span>{t("NotificationCenterTitle")}</span>
        <h3>{t("NotificationPreviewTitle")}</h3>
      </div>
      <span className="notification-overview__state" data-enabled={enabled}>{enabled?t("NotificationCenterEnabled"):t("NotificationCenterPaused")}</span>
    </header>
    <div className="notification-overview__body">
      <article className="notification-overview__specimen">
        <div className="notification-overview__specimen-head">
          <span className="notification-overview__provider-icon"><QaProviderIcon providerId="codex" size={20}/></span>
          <div><strong>{t("ProviderNameCodex")}</strong><small>{t("ProviderWeekly")}</small></div>
          <span>{formatPercentage(remaining)} {t("DetailCostRemaining")}</span>
        </div>
        <strong className="notification-overview__alert-title">{t("HighUsageAlert")}</strong>
        <div className="notification-overview__meter" role="progressbar" aria-label={t("HighUsageAlert")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={high}>
          <span style={{width:`${Math.max(0,Math.min(100,high))}%`}}/>
        </div>
        <p>{t("NotificationPreviewHelper")}</p>
      </article>
      <div className="notification-overview__thresholds">
        {[[t("HighUsageAlert"),high,"warning"],[t("CriticalUsageAlert"),critical,"critical"]] .map(([label,value,tone])=><div key={String(label)} data-tone={tone}>
          <span>{label}</span><strong>{thresholdText(Number(value))}</strong>
        </div>)}
      </div>
    </div>
    <small className="notification-overview__disclaimer">{t("NotificationPreviewDisclaimer")}</small>
  </section>;
}
