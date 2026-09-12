export function selectPlacement(rect: {left:number;right:number;top:number;bottom:number;width:number}, panelHeight:number, viewport:{width:number;height:number}, rtl=false) {
 const margin=8,gap=5;
 const width=Math.min(Math.max(220,rect.width),Math.max(1,viewport.width-margin*2));
 const availableBelow=Math.max(0,viewport.height-rect.bottom-gap-margin);
 const availableAbove=Math.max(0,rect.top-gap-margin);
 const desired=Math.min(Math.max(1,panelHeight),320,Math.max(1,viewport.height-margin*2));
 const above=availableBelow<desired&&availableAbove>availableBelow;
 const maxHeight=Math.max(1,Math.min(320,above?availableAbove:availableBelow));
 const height=Math.min(desired,maxHeight);
 return {left:Math.max(margin,Math.min(rtl?rect.right-width:rect.left,viewport.width-width-margin)),top:above?Math.max(margin,rect.top-gap-height):rect.bottom+gap,width,maxHeight};
}
