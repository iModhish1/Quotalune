import type {LocaleKey} from "../i18n/keys";
import blueOrbit from "../assets/space/blue-orbit.png";
import saturnRings from "../assets/space/saturn-rings.png";
import galaxyRise from "../assets/space/galaxy-rise.png";
import nebulaGates from "../assets/space/nebula-gates.png";
export interface WorkspaceBackground {id:string; title:LocaleKey; kind:"static"|"animated"; batch:number; art?:string; image?:string; motion?:"drift"|"tide"|"breathe"}
const scenes=[blueOrbit,saturnRings,galaxyRise,nebulaGates];
export const BACKGROUND_CATALOG: readonly WorkspaceBackground[] = [
 {id:"cosmic",title:"WorkspaceBackgroundCosmic",kind:"static",batch:0},
 ...scenes.flatMap((image,index):WorkspaceBackground[]=>{
  const number=String(index+1).padStart(2,"0"),title=`WorkspaceScene${number}` as LocaleKey;
  return [{id:`atmosphere-${number}`,title,kind:"static",batch:1,image,art:`url("${image}") center/cover`},
   {id:`motion-${number}`,title,kind:"animated",batch:1,image,art:`url("${image}") center/cover`,motion:"drift"}];
 }),
 {id:"none",title:"WorkspaceBackgroundPlain",kind:"static",batch:0},
];
/** Legacy palette IDs retain a valid selection but no longer fill the gallery. */
export function backgroundById(id:string|undefined):WorkspaceBackground|undefined {
 const direct=BACKGROUND_CATALOG.find(item=>item.id===id);if(direct)return direct;
 if(id==="aurora")return {...BACKGROUND_CATALOG[1],id};
 if(id==="starfield")return {...BACKGROUND_CATALOG[5],id};
 const legacy=/^(atmosphere|motion)-(0[5-9]|1[0-2])$/.exec(id??"");
 if(legacy){const next=1+(Number(legacy[2])-1)%4;return {...BACKGROUND_CATALOG.find(item=>item.id===`${legacy[1]}-0${next}`)!,id:id!};}
 return undefined;
}
export function customBackgroundId(value:string|undefined):string|null {
 return value&&/^custom:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)?value.slice(7):null;
}
