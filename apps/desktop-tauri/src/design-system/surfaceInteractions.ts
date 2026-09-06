export interface SurfaceInteractions {
  hoverDetails:boolean;
  wheelCycle:boolean;
  autoFold:boolean;
  foldDelayMs:number;
}
export const DEFAULT_SURFACE_INTERACTIONS:SurfaceInteractions={hoverDetails:true,wheelCycle:true,autoFold:true,foldDelayMs:500};
export function normalizeSurfaceInteractions(value?:Partial<SurfaceInteractions>):SurfaceInteractions {
  const defaults=DEFAULT_SURFACE_INTERACTIONS;
  return {
    hoverDetails:typeof value?.hoverDetails==="boolean"?value.hoverDetails:defaults.hoverDetails,
    wheelCycle:typeof value?.wheelCycle==="boolean"?value.wheelCycle:defaults.wheelCycle,
    autoFold:typeof value?.autoFold==="boolean"?value.autoFold:defaults.autoFold,
    foldDelayMs:typeof value?.foldDelayMs==="number" && Number.isFinite(value.foldDelayMs)?Math.max(100,Math.min(3000,Math.round(value.foldDelayMs))):defaults.foldDelayMs,
  };
}
