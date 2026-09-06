import type { FlowSurfaceAnchor } from "./flowSurface";
export const SURFACE_POSITIONS: readonly FlowSurfaceAnchor[] = ["left","right","top","bottom","top-left","top-right","bottom-left","bottom-right","free"];
export function placeSurface(anchor: FlowSurfaceAnchor, width: number, height: number, areaWidth: number, areaHeight: number) {
  const maxX=Math.max(0,areaWidth-width), maxY=Math.max(0,areaHeight-height);
  return {x:anchor.includes("left")?0:anchor.includes("right")?maxX:maxX/2,
    y:anchor.includes("top")?0:anchor.includes("bottom")?maxY:maxY/2};
}
export function snapSurface(x:number,y:number,width:number,height:number,areaWidth:number,areaHeight:number): FlowSurfaceAnchor {
  const nearLeft=x<=24, nearRight=x+width>=areaWidth-24;
  const nearTop=y<=24, nearBottom=y+height>=areaHeight-24;
  // Pick the closer boundary when a small work area makes both eligible.
  const horizontal=nearLeft && (!nearRight || x<areaWidth-x-width)?"left":nearRight?"right":"";
  const vertical=nearTop && (!nearBottom || y<areaHeight-y-height)?"top":nearBottom?"bottom":"";
  return (horizontal && vertical?`${vertical}-${horizontal}`:horizontal || vertical || "free") as FlowSurfaceAnchor;
}
