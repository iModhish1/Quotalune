/** Full-circle instrument: a neutral track and one resolved quota arc. */
export function NotchGauge({fraction,size,color,label}:{fraction:number|null;size:number;color:string;label:string}) {
  const radius=(size-4)/2, length=2*Math.PI*radius;
  const fill=fraction == null || !Number.isFinite(fraction) ? 0 : Math.max(0,Math.min(1,fraction));
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
    <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#303033" strokeWidth="3"/>
    {fill>0 && <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
      strokeDasharray={`${length} ${length}`} strokeDashoffset={length*(1-fill)} transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dashoffset 240ms ease"}}/>}
  </svg>;
}
