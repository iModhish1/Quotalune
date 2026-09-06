import footprints from "./footprints.json";
export type NotchForm = keyof typeof footprints;
export const NOTCH_FORMS = Object.keys(footprints) as NotchForm[];
export const isNotchForm = (form: string): form is NotchForm => Object.prototype.hasOwnProperty.call(footprints,form);
export interface Rect { x:number; y:number; width:number; height:number }
export function rotateNotchNode(node:{x:number;y:number;size:number},core:Rect,anchor:string){
  const clockwise=anchor==="bottom" || anchor.includes("right");
  return {...node,x:clockwise?core.width-node.y:node.y,
    y:Math.max(node.size/2,Math.min(core.height-node.size/2-23,clockwise?node.x:core.height-node.x))};
}
export function notchRotates(form:NotchForm,anchor:string,state:string,count:number){
  if(!count || state==="hidden" || state==="peek" || (form==="satellite" && state==="compact"))return false;
  const horizontal=anchor==="top" || anchor==="bottom";
  return ((form==="seam" || form==="satellite" || form==="crescent") && horizontal) || (form==="ribbon" && !horizontal && anchor!=="free");
}
export function notchLayout(form:NotchForm,state:string,anchor:string,count:number) {
  const hidden = state === "hidden" || state === "peek";
  const horizontal = anchor === "top" || anchor === "bottom";
  let base = {...footprints[form]};
  if (count === 0) base = {width:64,height:64};
  else if (form === "satellite" && state === "compact") base = {width:64,height:84};
  else if (form === "seam") base.height = 52 + Math.min(3,count)*64;
  else if (form === "ribbon") base.width = 52 + Math.min(3,count)*64;
  else if (form === "crescent") base.height = 16 + Math.min(3,count)*56;
  if(notchRotates(form,anchor,state,count))base={width:base.height,height:base.width};
  if (hidden) base = horizontal ? {width:48,height:24} : {width:24,height:48};
  const core:Rect = {x:0,y:0,...base};
  let detail:Rect | undefined;
  let width=base.width, height=base.height;
  if (!hidden && count > 0 && (state === "expanded" || state === "pinned")) {
    detail={x:0,y:0,width:248,height:148};
    if (horizontal) {
      width=Math.max(base.width,detail.width); height=base.height+12+detail.height;
      core.x=(width-base.width)/2; detail.x=(width-detail.width)/2;
      if(anchor === "bottom") core.y=detail.height+12; else detail.y=base.height+12;
    } else {
      width=base.width+12+detail.width; height=Math.max(base.height,detail.height);
      core.y=anchor.startsWith("top") ? 0 : anchor.startsWith("bottom") ? height-base.height : (height-base.height)/2;
      detail.y=(height-detail.height)/2;
      if(anchor.includes("left")) detail.x=base.width+12; else core.x=detail.width+12;
    }
  }
  return {width,height,core,detail};
}
export function notchNodes(form:NotchForm,count:number) {
  const n=Math.min(3,Math.max(0,count));
  if(form === 'crescent') return Array.from({length:n},(_,i)=>({x:n===3?(i===1?28:60):48,y:30+i*56,size:32}));
  if(form === "seam") return Array.from({length:n},(_,i)=>({x:30,y:46+i*64,size:36}));
  if(form === "ribbon") return Array.from({length:n},(_,i)=>({x:46+i*64,y:27,size:34}));
  if(form === "cradle") return [{x:108,y:38,size:36},{x:72,y:78,size:36},{x:30,y:108,size:32}].slice(0,n);
  if(form === "deck") return n ? [{x:34,y:36,size:40}] : [];
  if(form === "pebble") return [{x:72,y:35,size:36},{x:34,y:102,size:36},{x:110,y:102,size:36}].slice(0,n);
  if(form === "fan") return [{x:36,y:58,size:32},{x:90,y:34,size:36},{x:144,y:58,size:32}].slice(0,n);
  return [{x:36,y:82,size:44},{x:75,y:29,size:26},{x:75,y:135,size:26}].slice(0,n);
}
export function providerAccent(id:string) {
  const colors:Record<string,string>={claude:"#ff681c",codex:"#00e7a0",openai:"#00e7a0",gemini:"#88a7ff",cursor:"#d9f629",deepseek:"#53baff",perplexity:"#55d9d0"};
  return colors[id.toLowerCase()] ?? "#ced5df";
}
