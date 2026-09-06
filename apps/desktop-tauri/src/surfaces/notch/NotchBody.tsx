import type { NotchForm } from "./notchGeometry";
import { useId } from "react";

/** Continuous filled contours, not a rounded rectangle with decorations on top. */
export function NotchBody({form,width:w,height:h,mirror,flip=false,empty=false}:{form:NotchForm;width:number;height:number;mirror:boolean;flip?:boolean;empty?:boolean}) {
  const materialId=useId();
  if(empty) return <svg className="notch-body" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="22" fill="#030303"/></svg>;
  let path = `M24 0H${w-24}Q${w} 0 ${w} 24V${h-24}Q${w} ${h} ${w-24} ${h}H24Q0 ${h} 0 ${h-24}V24Q0 0 24 0Z`;
  if(form === 'crescent') path=`M${w-6} 0Q${w} 0 ${w} 6V${h-6}Q${w} ${h} ${w-6} ${h}C-24 ${h} -24 0 ${w-6} 0Z`;
  if(form === "seam") path=`M${w} 0C${w} 18 50 20 32 20C12 20 0 32 0 52V${h-52}C0 ${h-32} 12 ${h-20} 32 ${h-20}C50 ${h-20} ${w} ${h-18} ${w} ${h}Z`;
  if(form === "ribbon") path=`M0 0H${w}C${w-18} 0 ${w-20} 16 ${w-20} 30V40Q${w-20} 64 ${w-44} 64H44Q20 64 20 40V30C20 16 18 0 0 0Z`;
  if(form === "cradle") path="M144 0V144H0C0 96 28 84 42 74C68 56 72 18 84 8C100 0 122 0 144 0Z";
  if(form === "satellite") path="M108 0C76 0 50 2 50 22C50 42 0 48 0 76V91C0 122 10 134 40 134C52 134 50 151 56 160Q62 172 108 172Z";
  if(form === "pebble") path="M72 0C48 0 38 16 38 36C38 58 28 62 16 73C0 86 0 105 0 119C0 143 18 152 35 152C52 152 59 143 72 143C85 143 92 152 109 152C126 152 144 143 144 119C144 105 144 86 128 73C116 62 106 58 106 36C106 16 96 0 72 0Z";
  if(form === "fan") path="M90 0C61 0 58 23 44 23C19 23 0 32 0 53C0 83 20 110 45 110H135C160 110 180 83 180 53C180 32 161 23 136 23C122 23 119 0 90 0Z";
  return <svg className="notch-body" viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{transform:`scale(${mirror?-1:1},${flip?-1:1})`}}>
    <defs><linearGradient id={materialId} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="var(--surface-raised)"/>
      <stop offset=".12" stopColor="var(--surface-edge)"/>
      <stop offset=".2" stopColor="var(--surface-raised)"/>
      <stop offset="1" stopColor="var(--surface-core)"/>
    </linearGradient></defs>
    {form === "deck" && <><rect x="18" y="0" width="148" height="70" rx="22" fill="#313336"/><rect x="9" y="7" width="148" height="70" rx="22" fill="#18191b"/></>}
    {form === "deck" ? <rect x="0" y="14" width="148" height="74" rx="22" style={{fill:`url(#${materialId})`,stroke:'var(--surface-edge)',strokeWidth:1.5}}/> : <>
      <defs><clipPath id={`${materialId}-contour`}><path d={path}/></clipPath></defs>
      <path d={path} style={{fill:`url(#${materialId})`}}/>
      <path className="notch-body__rim" d={path} fill="none" stroke="var(--surface-edge)" clipPath={`url(#${materialId}-contour)`}/>
    </>}
    {form === "fan" && <path d="M59 25C55 48 58 69 67 86M121 25C125 48 122 69 113 86" fill="none" stroke="var(--surface-edge)" strokeWidth="1" strokeLinecap="round"/>}
  </svg>;
}
