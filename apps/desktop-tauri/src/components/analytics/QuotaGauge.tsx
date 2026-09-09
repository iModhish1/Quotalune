import type {AnalyticsPreferences} from "../../types/bridge";
export function QuotaGauge({used, remaining, template, usedLabel, remainingLabel, format, emphasis = "used"}: {
  used: number; remaining: number; template: AnalyticsPreferences["quotaTemplate"]; usedLabel: string; remainingLabel: string; format: (value: number) => string; emphasis?: "used" | "remaining" | "hybrid";
}) {
  const left = emphasis === "remaining" ? {value: remaining,label: remainingLabel} : {value: used,label: usedLabel};
  const right = emphasis === "remaining" ? {value: used,label: usedLabel} : {value: remaining,label: remainingLabel};
  return <div className={`quota-gauge quota-gauge--${template}`}>
    {template === "precision" && <svg viewBox="0 0 100 64" aria-hidden="true"><path d="M10 54 A40 40 0 0 1 90 54" pathLength="100" className="quota-gauge__track"/><path d="M10 54 A40 40 0 0 1 90 54" pathLength="100" className="quota-gauge__fill" strokeDasharray={`${left.value} 100`}/></svg>}
    <div className="quota-gauge__values"><div><strong><bdi>{format(left.value)}</bdi></strong><span>{left.label}</span></div><div><strong><bdi>{format(right.value)}</bdi></strong><span>{right.label}</span></div></div>
    {template !== "precision" && <div className="quota-gauge__bar" aria-hidden="true"><span style={{width:`${left.value}%`}}/></div>}
  </div>;
}
