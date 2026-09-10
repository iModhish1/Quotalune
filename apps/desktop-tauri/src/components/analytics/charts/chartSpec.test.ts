import {describe,it,expect,vi} from "vitest";
import {buildQuotaAnalytics} from "../../../lib/analytics/quotaAnalytics";
import {supportsVisualization} from "../../../lib/analytics/metricRegistry";
import {visualSegments} from "./visualSeries";
import {createTrendChartSpec,createCoverageHeatmapSpec,type ChartContext} from "./chartSpec";
import {chartTheme,chartProviderColor} from "./chartTheme";
import {CANONICAL_THEME,catalogBySlug} from "../../../design-system/themeCatalog";
import {contrastRatio} from "../../../design-system/meterFill";
import {mountChart} from "./chartLifecycle";
import type {QuotaHistoryPoint} from "../../../types/bridge";
const data:QuotaHistoryPoint[]=Array.from({length:16},(_,i)=>({provider:"codex",accountId:"a",accountScope:"observed",windowKey:"primary",windowMinutes:10080,windowLabel:"Weekly",bucketStart:i*3600,observedAt:i*3600,usedPercent:i,remainingPercent:100-i,resetsAt:100000,sampleCount:1}));
const range={since:8*3600,until:16*3600,grainSeconds:3600};
const context:ChartContext={range,theme:chartTheme(CANONICAL_THEME,()=>"#123456"),date:String,number:String,style:"precision",lowCpu:false,labels:{current:"Current",previous:"Previous",used:"Used",samples:"Samples",missing:"Missing",zoom:"Zoom",source:"Provider observation"}};
describe("professional chart contracts",()=>{
 it("adaptive percentage axis encloses every original sample and remains bounded",()=>{
   const rows=buildQuotaAnalytics(data,range);
   const spec=createTrendChartSpec(rows,r=>r.provider,context);
   const axis=spec.option.yAxis as {min:number;max:number};
   expect(axis.min).toBeGreaterThanOrEqual(0);expect(axis.max).toBeLessThanOrEqual(100);
   expect(axis.max).toBeLessThan(100);
   for(const point of rows[0].current){expect(point.usedPercent).toBeGreaterThanOrEqual(axis.min);expect(point.usedPercent).toBeLessThanOrEqual(axis.max);}
 });
 it("light-theme series retain visible non-text contrast",()=>{const light=catalogBySlug("ceramic-pearl-material")!;const mapped=chartTheme(light,()=>"#e0ad88");expect(contrastRatio(mapped.series("claude"),light.core)).toBeGreaterThanOrEqual(3);});
 it("single missing bucket breaks the display line",()=>{expect(visualSegments([data[0],data[2]],3600).length).toBe(2);});
 it("catalog Codex alias preserves provider color",()=>{expect(chartProviderColor(CANONICAL_THEME,{} as never,"codex",document.documentElement)).toBe(CANONICAL_THEME.providerColors.openai);});
 it("comparison legend and visual zoom occupy separate bands",()=>{const spec=createTrendChartSpec(buildQuotaAnalytics(data,range),r=>r.provider,{...context,range:{...range,until:range.since+30*86400}},true);expect((spec.option.legend as {bottom:number}).bottom).toBe(28);});
 it("never exposes incompatible templates",()=>{expect(supportsVisualization("nextReset","distribution")).toBe(false);expect(supportsVisualization("historySamples","coverageHeatmap")).toBe(true);});
 it("splits reset boundaries and missing intervals before visual reduction",()=>{const changed=data.map(p=>({...p}));changed[5].resetsAt=99999;changed[10].observedAt+=9000;const segments=visualSegments(changed,3600);expect(segments.length).toBeGreaterThan(2);expect(segments.flat().every(p=>changed.some(raw=>raw.observedAt*1000===p.time && raw.usedPercent===p.value))).toBe(true);});
 it("preserves extrema and endpoints while bounding a long continuous series",()=>{const raw=Array.from({length:100000},(_,i)=>({...data[0],bucketStart:i,observedAt:i,usedPercent:i/1000,remainingPercent:100-i/1000,resetsAt:200000}));const points=visualSegments(raw,1,600).flat();expect(points.length).toBeLessThanOrEqual(602);expect(points[0].value).toBe(0);expect(points[points.length-1]?.value).toBe(99.999);});
 it("comparison offsets display time only and retains original tooltip timestamps",()=>{const rows=buildQuotaAnalytics(data,range);const spec=createTrendChartSpec(rows,r=>r.provider,context,true);const series=spec.option.series as {name:string;data:number[][]}[];expect(series.some(s=>s.name.includes("Previous"))).toBe(true);expect(series.find(s=>s.name.includes("Previous"))!.data[0]).toEqual([range.since*1000,0,0]);expect(rows[0].previous[0].observedAt).toBe(0);});
 it("does not draw comparison when the semantic guard fails",()=>{const rows=buildQuotaAnalytics(data.slice(8),range);expect(rows[0].comparison.value).toBeNull();const spec=createTrendChartSpec(rows,r=>r.provider,context,true);expect(JSON.stringify(spec.option)).not.toContain("Previous");});
 it("heatmap includes observed cells only, never fabricates zero coverage",()=>{const rows=buildQuotaAnalytics(data,range);const spec=createCoverageHeatmapSpec(rows,r=>r.provider,context);const series=spec.option.series as {data:number[][]}[];expect(series[0].data.every(cell=>cell[2]>0)).toBe(true);});
 it("high-fidelity peak marker formats through the shared rounding formatter, never a raw float (regression: overlapping '41.88331035648%'/'37.7%' labels found in native Analytics review)",()=>{
  const preciseData=data.map((p,i)=>({...p,usedPercent:i+0.883310356483,remainingPercent:100-(i+0.883310356483)}));
  const rows=buildQuotaAnalytics(preciseData,range);
  const rounding=new Intl.NumberFormat("en-US",{maximumFractionDigits:1});
  const spec=createTrendChartSpec(rows,r=>r.provider,{...context,highFidelity:true,number:n=>rounding.format(n)});
  const series=spec.option.series as {markPoint?:{label:{formatter:(p:{value:number})=>string}}}[];
  const withMarkPoint=series.find(s=>s.markPoint);
  expect(withMarkPoint).toBeDefined();
  const formatter=withMarkPoint!.markPoint!.label.formatter;
  expect(typeof formatter).toBe("function");
  const formatted=formatter({value:15.883310356483});
  expect(formatted).toBe("15.9%");
  expect(formatted).not.toContain("15.883310356483");
 });
 it("suppresses the regular per-point label exactly on the peak point, so the markPoint annotation is the only label rendered there (regression: owner-reported duplicate stacked labels)",()=>{
  const rows=buildQuotaAnalytics(data,range); // data.usedPercent is monotonically increasing -> peak is the last point
  const spec=createTrendChartSpec(rows,r=>r.provider,{...context,highFidelity:true});
  const series=spec.option.series as {markPoint?:{data:{coord:[number,number]}[]};data:number[][];label:{formatter:(p:{value:number[]})=>string}}[];
  const withMarkPoint=series.find(s=>s.markPoint)!;
  expect(withMarkPoint).toBeDefined();
  // Data stays plain tuples everywhere -- axis-bounds and the accessible
  // table both index into `line.data` assuming this exact shape.
  expect(withMarkPoint.data.every(d=>Array.isArray(d))).toBe(true);
  const peakTime=withMarkPoint.markPoint!.data[0].coord[0];
  const peakTuple=withMarkPoint.data.find(d=>d[0]===peakTime)!;
  const otherTuple=withMarkPoint.data.find(d=>d[0]!==peakTime)!;
  expect(peakTuple).toBeDefined();
  expect(otherTuple).toBeDefined();
  expect(withMarkPoint.label.formatter({value:peakTuple})).toBe("");
  expect(withMarkPoint.label.formatter({value:otherTuple})).not.toBe("");
 });
 it("theme/preset changes affect styling without changing values",()=>{const rows=buildQuotaAnalytics(data,range);const one=createTrendChartSpec(rows,r=>r.provider,context);const two=createTrendChartSpec(rows,r=>r.provider,{...context,lowCpu:true,theme:{...context.theme,text:"#000000",grid:"#cccccc"}});expect((one.option.series as {data:unknown}[])[0].data).toEqual((two.option.series as {data:unknown}[])[0].data);expect(two.option.animation).toBe(false);});
 it("structure tokens are sourced from the catalog",()=>{for(const theme of [CANONICAL_THEME]){const mapped=chartTheme(theme,()=>"#123456");expect(mapped.background).toBe(theme.core);expect(mapped.accent).toBe(theme.accent);expect(mapped.series("codex")).toBe("#123456");}});
 it("coalesces resize and disposes observer/frame/engine exactly once",()=>{
  let resize=()=>{};const disconnect=vi.fn(),cancel=vi.fn(),request=vi.fn(()=>7),chart={setOption:vi.fn(),resize:vi.fn(),dispose:vi.fn()};
  const host=document.createElement("div");const handle=mountChart(host,chart,run=>{resize=run;return disconnect;},request,cancel);
  handle.update({animation:false});resize();resize();expect(request).toHaveBeenCalledTimes(1);handle.dispose();handle.dispose();handle.update({});expect(chart.setOption).toHaveBeenCalledTimes(1);expect(disconnect).toHaveBeenCalledTimes(1);expect(cancel).toHaveBeenCalledWith(7);expect(chart.dispose).toHaveBeenCalledTimes(1);
 });
});
