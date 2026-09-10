export function railWindow(count:number, focus:number, capacity:number) {
  const size=Math.max(1,Math.min(count,capacity));
  const start=Math.max(0,Math.min(count-size,focus-Math.floor(size/2)));
  return {start,end:Math.min(count,start+size)};
}
export function railDestination(count:number, current:number, delta:number) {
  return Math.max(0,Math.min(Math.max(0,count-1),current+delta));
}
