/** Keeps provider artwork prominent without crossing the progress-ring stroke. */
export function providerGlyphSize(gaugeSize: number): number {
  const safeGauge = Number.isFinite(gaugeSize) ? Math.max(0, gaugeSize) : 0;
  const ratio = safeGauge <= 32 ? 0.58 : safeGauge <= 46 ? 0.56 : 0.54;
  return Math.max(10, Math.min(Math.round(safeGauge - 10), Math.round(safeGauge * ratio + 1e-6)));
}
