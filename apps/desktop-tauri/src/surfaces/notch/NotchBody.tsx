import type { NotchForm } from "./notchGeometry";

/** Continuous filled contours, not a rounded rectangle with decorations on top. */
export function NotchBody({form,width:w,height:h,mirror,flip=false,empty=false}:{form:NotchForm;width:number;height:number;mirror:boolean;flip?:boolean;empty?:boolean}) {
  if(empty) return <svg className="notch-body" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="22" fill="#030303"/></svg>;
  let path = `M24 0H${w-24}Q${w} 0 ${w} 24V${h-24}Q${w} ${h} ${w-24} ${h}H24Q0 ${h} 0 ${h-24}V24Q0 0 24 0Z`;
  if(form === "seam") path=`M${w} 0C${w} 18 50 20 32 20C12 20 0 32 0 52V${h-52}C0 ${h-32} 12 ${h-20} 32 ${h-20}C50 ${h-20} ${w} ${h-18} ${w} ${h}Z`;
  if(form === "ribbon") path=`M0 0H${w}C${w-18} 0 ${w-20} 16 ${w-20} 30V40Q${w-20} 64 ${w-44} 64H44Q20 64 20 40V30C20 16 18 0 0 0Z`;
  if(form === "cradle") path="M144 0V144H0C0 96 28 84 42 74C68 56 72 18 84 8C100 0 122 0 144 0Z";
  if(form === "satellite") path="M108 0C76 0 50 2 50 22C50 42 0 48 0 76V91C0 122 10 134 40 134C52 134 50 151 56 160Q62 172 108 172Z";
  return <svg className="notch-body" viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{transform:`scale(${mirror?-1:1},${flip?-1:1})`}}>
    {form === "deck" && <><rect x="18" y="0" width="148" height="70" rx="22" fill="#313336"/><rect x="9" y="7" width="148" height="70" rx="22" fill="#18191b"/></>}
    {form === "deck" ? <rect x="0" y="14" width="148" height="74" rx="22" fill="#030303"/> : <path d={path} fill="#030303"/>}
  </svg>;
}
