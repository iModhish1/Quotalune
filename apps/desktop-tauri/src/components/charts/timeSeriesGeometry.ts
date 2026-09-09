export interface TimeSeriesPoint {time: number; value: number; cycle?: number | null;}
/** Positions use actual elapsed time. Missing/invalid observations and known
 * reset boundaries split the path rather than inventing intermediate data. */
export function timeSeriesGeometry(points: readonly TimeSeriesPoint[], start: number, end: number, expectedStep: number, width: number, height: number, domain: readonly [number, number]) {
  if (!(end > start) || !(domain[1] > domain[0]) || !(expectedStep > 0)) return {segments: [] as {x: number; y: number; point: TimeSeriesPoint}[][]};
  const segments: {x: number; y: number; point: TimeSeriesPoint}[][] = [];
  let segment: {x: number; y: number; point: TimeSeriesPoint}[] = [];
  for (const point of [...points].sort((a, b) => a.time - b.time)) {
    if (!Number.isFinite(point.time) || !Number.isFinite(point.value) || point.value < domain[0] || point.value > domain[1] || point.time < start || point.time > end) {
      if (segment.length) segments.push(segment);
      segment = []; continue;
    }
    const prior = segment[segment.length - 1]?.point;
    if (prior && (point.time - prior.time > expectedStep * 1.5 || point.time <= prior.time || (prior.cycle != null && point.cycle != null && prior.cycle !== point.cycle))) {
      segments.push(segment); segment = [];
    }
    segment.push({x: (point.time - start) / (end - start) * width, y: height - (point.value - domain[0]) / (domain[1] - domain[0]) * height, point});
  }
  if (segment.length) segments.push(segment);
  return {segments};
}
