export type UsageTone='normal'|'warning'|'critical'|'exhausted';

/** Normalize used/remaining sources before assigning visual urgency. */
export function usageTone(primaryValue:number|null,primaryLabel:string):UsageTone {
  if(primaryValue==null||!Number.isFinite(primaryValue))return 'normal';
  const bounded=Math.max(0,Math.min(100,primaryValue));
  const remaining=primaryLabel.trim().toLowerCase()==='used'?100-bounded:bounded;
  if(remaining<=0)return 'exhausted';
  if(remaining<=10)return 'critical';
  if(remaining<=20)return 'warning';
  return 'normal';
}
