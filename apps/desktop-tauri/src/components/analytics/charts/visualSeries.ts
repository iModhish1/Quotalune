import type {QuotaHistoryPoint} from "../../../types/bridge";
export interface VisualPoint {time:number; value:number; sourceTime:number;}
/** Presentation only: split BEFORE sampling. Keep endpoints and local extrema.
 * Statistics always use the original validated model. Never join reset/gap segments. */
export function visualSegments(points:readonly QuotaHistoryPoint[],grain:number,budget=600,offset=0):VisualPoint[][] {
  const segments:QuotaHistoryPoint[][]=[];
  for(const point of points) {
    const segment=segments[segments.length-1]; const previous=segment?.[segment.length-1];
    if(!previous || point.resetsAt!==previous.resetsAt || point.bucketStart-previous.bucketStart>grain || point.observedAt-previous.observedAt>grain*2 || point.counterDecreased || point.usedPercent<previous.usedPercent) segments.push([point]);
    else segment.push(point);
  }
  // Excessive discontinuities cannot be hidden merely to fit a point budget.
  if(segments.length*2>budget) return [];
  const perSegment=Math.max(4,Math.floor(budget/Math.max(1,segments.length)));
  return segments.map(segment=>{
    const kept=new Set<number>([0,segment.length-1]);
    if(segment.length<=perSegment) segment.forEach((_,i)=>kept.add(i));
    else {
      const width=Math.ceil(segment.length/Math.max(1,Math.floor((perSegment-2)/2)));
      for(let start=0;start<segment.length;start+=width) {
        let min=start,max=start;
        for(let i=start;i<Math.min(segment.length,start+width);i++){if(segment[i].usedPercent<segment[min].usedPercent)min=i;if(segment[i].usedPercent>segment[max].usedPercent)max=i;}
        kept.add(min);kept.add(max);
      }
    }
    return [...kept].sort((a,b)=>a-b).map(i=>({time:(segment[i].observedAt+offset)*1000,sourceTime:segment[i].observedAt*1000,value:segment[i].usedPercent}));
  });
}
