import type {LocaleKey} from "../i18n/keys";

export interface WorkspaceBackground {id:string; title:LocaleKey; kind:"static"|"animated"; batch:number; art?:string; motion?:"drift"|"tide"|"breathe"}
const palettes = [
  ["#244d86","#7254a5"],["#1f665c","#457791"],["#814235","#b78d57"],["#535587","#26717f"],
  ["#294d70","#556879"],["#725278","#355585"],["#58614c","#9c7953"],["#3c716d","#577397"],
  ["#7b4861","#716082"],["#345a72","#4c706a"],["#64697d","#3e5476"],["#66574c","#82664f"],
];
export const BACKGROUND_CATALOG: readonly WorkspaceBackground[] = [
  {id:"cosmic",title:"WorkspaceBackgroundCosmic",kind:"static",batch:0},
  {id:"aurora",title:"WorkspaceBackgroundAurora",kind:"static",batch:0},
  {id:"starfield",title:"WorkspaceBackgroundStars",kind:"static",batch:0},
  {id:"none",title:"WorkspaceBackgroundPlain",kind:"static",batch:0},
  ...palettes.flatMap(([a,b],index): WorkspaceBackground[] => {
    const number = String(index+1).padStart(2,"0");
    const art = index%3 === 0
      ? `radial-gradient(ellipse at 85% 15%,${a}a0,transparent 62%),radial-gradient(ellipse at 10% 90%,${b}90,transparent 60%)`
      : index%3 === 1
        ? `repeating-linear-gradient(${110+index*5}deg,transparent 0 90px,${a}25 110px,transparent 180px),radial-gradient(ellipse at 60% 0%,${b}b0,transparent 65%)`
        : `radial-gradient(circle at 70% 20%,transparent 8%,${a}65 8.2%,transparent 8.6%),radial-gradient(ellipse at 90% 50%,${b}a0,transparent 65%),radial-gradient(ellipse at 0% 90%,${a}90,transparent 55%)`;
    return [
      {id:`atmosphere-${number}`, title:`WorkspaceScene${number}` as LocaleKey,kind:"static",batch:1+Math.floor(index/4),art},
      {id:`motion-${number}`,title:`WorkspaceScene${number}` as LocaleKey,kind:"animated",batch:1+Math.floor(index/4),art,motion:(["drift","tide","breathe"] as const)[index%3]},
    ];
  }),
];
export function backgroundById(id:string|undefined) {return BACKGROUND_CATALOG.find(item=>item.id===id);}
export function customBackgroundId(value:string|undefined):string|null {
  return value && /^custom:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value) ? value.slice(7) : null;
}
