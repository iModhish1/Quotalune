export function railWindow(count:number, focus:number, capacity:number) {
  const size=Math.max(1,Math.min(count,capacity));
  const start=Math.max(0,Math.min(count-size,focus-Math.floor(size/2)));
  return {start,end:Math.min(count,start+size)};
}
export function railDestination(count:number, current:number, delta:number) {
  return count > 0 ? ((current + delta) % count + count) % count : 0;
}

/** Only foreground cards are mounted, even for hundreds of instances. */
export function circularRailIndices(count:number, anchor:number, capacity:number):number[] {
  return Array.from({length:Math.max(0,Math.min(count,capacity))},(_,offset)=>railDestination(count,anchor,offset));
}
