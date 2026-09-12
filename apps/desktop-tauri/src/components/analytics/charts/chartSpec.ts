import {supportsVisualization} from "../../../lib/analytics/metricRegistry";
import type {ComposeOption} from "echarts/core";
import type {LineSeriesOption,HeatmapSeriesOption,BarSeriesOption} from "echarts/charts";
import type {GridComponentOption,TooltipComponentOption,LegendComponentOption,DataZoomComponentOption,VisualMapComponentOption,MarkLineComponentOption,MarkPointComponentOption,AriaComponentOption,CalendarComponentOption} from "echarts/components";
import type {QuotaSeries,AnalyticsRange} from "../../../lib/analytics/quotaAnalytics";
import type {QuotalisChartTheme} from "./chartTheme";
import {visualSegments} from "./visualSeries";
export type ChartOption=ComposeOption<BarSeriesOption|LineSeriesOption|HeatmapSeriesOption|GridComponentOption|TooltipComponentOption|LegendComponentOption|DataZoomComponentOption|VisualMapComponentOption|MarkLineComponentOption|MarkPointComponentOption|AriaComponentOption|CalendarComponentOption>;
export interface ChartSpec {option:ChartOption; label:string; height:number; points:number; empty:boolean; readings?:{key:string;scope:string;time:string;value:string}[];}
export interface ChartLabels {current:string; previous:string; used:string; samples:string; missing:string; zoom:string; source:string;}
export interface ChartContext {theme:QuotalisChartTheme; range:AnalyticsRange; date:(time:number)=>string; number:(n:number)=>string; labels:ChartLabels; style:"precision"|"minimal"|"detailed"; lowCpu:boolean; highFidelity?:boolean; rtl?:boolean;}
const escape=(s:string)=>s.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
function base(ctx:ChartContext,label:string):ChartOption {
 const {theme}=ctx;
 // `aria:{enabled:false}` is deliberate (owner Phase 3N accessibility
 // closure): a native CDP audit found ECharts' own AriaComponent
 // narration engine overwrites the surface's real `role="img"
 // aria-label={spec.label}` (set in EChartsSurface.tsx) with a verbose,
 // per-data-point narration ("This is a chart with type Bar chart...
 // the data for 2026-08-14 is 0, 2155839271, ...") -- the exact
 // point-by-point narration the spec explicitly rules out, and it wins
 // over the clean, already-composed `label` this file builds. Disabling
 // ECharts' own generator leaves that one clean label as the chart's
 // sole accessible description.
 return {animation:false,backgroundColor:"transparent",textStyle:{fontFamily:theme.font,color:theme.text,fontSize:11},aria:{enabled:false},
 grid:{left:48,right:22,top:22,bottom:42,containLabel:false},
 tooltip:{trigger:"axis",confine:true,backgroundColor:theme.background,borderColor:theme.edge,borderWidth:1,padding:12,textStyle:{color:theme.text,fontFamily:theme.font,fontSize:12},axisPointer:{type:"cross",lineStyle:{color:theme.muted,width:1},crossStyle:{color:theme.muted}},extraCssText:`box-shadow:0 8px 24px #0003;border-radius:4px;max-width:360px;direction:${ctx.rtl?"rtl":"ltr"};text-align:start;`},
 xAxis:{type:"time",min:ctx.range.since*1000,max:ctx.range.until*1000,splitNumber:4,axisLabel:{color:theme.muted,fontSize:10,hideOverlap:true,formatter:(value:number)=>ctx.date(value)},axisLine:{lineStyle:{color:theme.edge}},axisTick:{show:true},splitLine:{show:false}},
 yAxis:{type:"value",min:0,max:100,interval:ctx.style==="detailed"?20:50,axisLabel:{color:theme.muted,fontSize:10,formatter:(value:number)=>ctx.number(value)+"%"},splitLine:{show:ctx.style!=="minimal",lineStyle:{color:theme.grid,type:"dashed"}},axisLine:{show:false},axisTick:{show:false}}};
}
export function createTrendChartSpec(rows:readonly QuotaSeries[],title:(r:QuotaSeries)=>string,ctx:ChartContext,comparison=false,compact=false):ChartSpec {
 if(!supportsVisualization(comparison?"quotaComparison":"quotaUsed",comparison?"comparativeTimeSeries":"precisionTimeSeries")) throw new Error("Incompatible visualization");
 const lines:LineSeriesOption[]=[];let points=0;
 for(const row of rows) {
  if(row.invalid)continue;
  for(const previous of comparison && row.comparison.value!==null ? [false,true] : [false]) {
   const offset=previous?ctx.range.until-ctx.range.since:0;
   const segments=visualSegments(previous?row.previous:row.current,ctx.range.grainSeconds,ctx.lowCpu?240:600,offset);
   const name=title(row)+(comparison?` · ${previous?ctx.labels.previous:ctx.labels.current}`:"");
   // Owner-reported regression: the high-fidelity peak `markPoint` and this
   // series' own regular per-point label could both render the same
   // formatted value stacked at the same coordinate (a real, if cosmetic,
   // duplicate -- not two different numbers). Establish one explicit
   // hierarchy instead of offsetting two identical labels: the peak point
   // carries the `markPoint` annotation ALONE, other points keep their
   // regular label. Computed once with the exact same reduce the markPoint
   // itself uses below, so "is this the peak point" can never disagree
   // between the two.
   const peak=!previous && !compact && ctx.highFidelity && row.current.length
     ? row.current.reduce((a,b)=>a.usedPercent>b.usedPercent?a:b)
     : null;
   segments.forEach((segment,index)=>{
    points+=segment.length;
    lines.push({id:`${row.key}:${previous}:${index}`,name,type:"line",connectNulls:false,smooth:false,clip:true,
      data:segment.map(p=>[p.time,p.value,p.sourceTime]),
      symbol:"circle",symbolSize:compact?3:5,showSymbol:segment.length===1 || (segment.length<30 && !ctx.lowCpu),
      // Data items stay plain [time,value,sourceTime] tuples -- axis-bounds
      // (below) and the accessible-table `readings` builder both index into
      // `line.data` assuming that exact shape; per-item object overrides
      // broke both silently (empty y-axis, no visible line at all) the
      // first time this was tried. The peak/markPoint duplicate is instead
      // suppressed here, in the formatter, by returning "" for the one
      // point whose x-coordinate matches the peak -- same data shape
      // everywhere, only the rendered text differs.
      label:{show:!previous&&!compact&&!ctx.lowCpu&&ctx.style!=="minimal"&&segment.length<=10,position:"top",fontSize:9,color:ctx.theme.text,formatter:params=>{
        const point=params.value as number[];
        if(peak && point[0]===peak.observedAt*1000) return "";
        return ctx.number(point[1])+"%";
      }},
      lineStyle:{color:ctx.theme.series(row.provider),width:previous?1.5:2,type:previous?"dashed":"solid",opacity:1},itemStyle:{color:ctx.theme.series(row.provider)},
      emphasis:{disabled:ctx.lowCpu,focus:"series"},
      ...(index===0 && peak ? {markPoint:{symbol:"circle",symbolSize:6,itemStyle:{color:ctx.theme.series(row.provider)},label:{color:ctx.theme.text,fontSize:10,position:"top",formatter:params=>ctx.number(params.value as number)+"%"},data:[{name:ctx.labels.used,coord:[peak.observedAt*1000,peak.usedPercent],value:peak.usedPercent}]}}:{}),
      ...(!previous && index===0 && !compact && ctx.style!=="minimal" && row.mean.value!==null ? {markLine:{silent:true,symbol:["none","none"],lineStyle:{color:ctx.theme.muted,width:1,type:"dashed"},label:{show:!ctx.lowCpu,formatter:ctx.number(row.mean.value)+"%",position:"insideEndTop",color:ctx.theme.muted},data:[{yAxis:row.mean.value}]}}:{})});
   });
  }
 }
 const label=rows.map(title).join(" · ")+" · "+ctx.labels.used;
 const option=base(ctx,label);option.series=lines;
 // Fit the observed range without altering any sample or concealing the scale.
 // Include both periods when comparing; labels retain absolute percentages.
 const values=lines.flatMap(line=>(line.data as number[][]).map(point=>point[1]));
 if(values.length) {
  const low=values.reduce((a,b)=>Math.min(a,b),100),high=values.reduce((a,b)=>Math.max(a,b),0);
  const padding=Math.max(3,(high-low)*.2);
  const min=Math.max(0,Math.floor((low-padding)/5)*5),max=Math.min(100,Math.ceil((high+padding)/5)*5);
  option.yAxis={...option.yAxis as object,min,max,interval:undefined,splitNumber:3};
 }
 option.tooltip={...option.tooltip as TooltipComponentOption,formatter:(params:unknown)=>{
  const values=(Array.isArray(params)?params:[params]) as {seriesName?:string;value?:number[]}[];
  return values.filter(p=>Array.isArray(p.value)).slice(0,8).map(p=>`<div><strong>${escape(p.seriesName??"")}</strong><br/>${escape(ctx.date(p.value![2]))}<br/>${escape(ctx.labels.used)}: <b>${escape(ctx.number(p.value![1]))}%</b><br/>${escape(ctx.labels.source)}</div>`).join("<hr/>");
 }};
 if(comparison || rows.length>1)option.legend={bottom:0,textStyle:{color:ctx.theme.muted,fontSize:10},type:"scroll",icon:"roundRect",itemWidth:16,itemHeight:3,
  // Scope remains in the heading, tooltip and HTML readings; avoid repeating it in a two-item legend.
  ...(comparison && rows.length===1?{formatter:(name:string)=>name.endsWith(` · ${ctx.labels.previous}`)?ctx.labels.previous:ctx.labels.current}:{})};
 if(!compact && ctx.range.until-ctx.range.since>7*86400) {
  option.dataZoom=[{type:"inside",filterMode:"none",zoomOnMouseWheel:"ctrl"},{type:"slider",height:16,bottom:8,brushSelect:false,showDetail:false,borderColor:ctx.theme.edge,fillerColor:ctx.theme.grid,handleStyle:{color:ctx.theme.accent},dataBackground:{lineStyle:{color:ctx.theme.muted},areaStyle:{color:"transparent"}}}];
  option.grid={left:48,right:22,top:22,bottom:comparison || rows.length>1 ? 92 : 64};
  if(comparison || rows.length>1) option.legend={...option.legend as LegendComponentOption,bottom:28};
 }
 const readings=lines.flatMap((line,index)=>(line.data as number[][]).map((point,i)=>({key:`${index}:${i}`,scope:String(line.name),time:ctx.date(point[2]),value:ctx.number(point[1])+"%"})));
 return {option,label,height:compact?136:170,points,empty:points===0,readings};
}
export function createCoverageHeatmapSpec(rows:readonly QuotaSeries[],title:(r:QuotaSeries)=>string,ctx:ChartContext):ChartSpec {
 const valid=rows.filter(row=>!row.invalid && row.current.length).slice(0,70);
 const step=Math.max(86400,ctx.range.grainSeconds),first=Math.floor(ctx.range.since/step)*step;
 const count=Math.min(366,Math.ceil((ctx.range.until-first)/step));
 const data:number[][]=[];let max=1;
 valid.forEach((row,y)=>{const cells=new Map<number,number>();for(const point of row.current){const x=Math.floor((point.observedAt-first)/step);if(x>=0&&x<count)cells.set(x,(cells.get(x)??0)+point.sampleCount);}for(const [x,n]of cells){data.push([x,y,n]);max=Math.max(max,n);}});
 const label=ctx.labels.samples;
 // See the `base()` helper above for why `aria.enabled` stays false --
 // the container's own `role="img"` aria-label already carries this
 // heatmap's clean description; ECharts' own narration would overwrite
 // it with an unusable per-cell data dump.
 const option:ChartOption={animation:false,aria:{enabled:false},textStyle:{fontFamily:ctx.theme.font,color:ctx.theme.text},
 grid:{left:10,right:10,top:10,bottom:60,containLabel:true},
 xAxis:{type:"category",data:Array.from({length:count},(_,i)=>ctx.date((first+i*step)*1000)),axisLabel:{color:ctx.theme.muted,fontSize:10,hideOverlap:true},axisLine:{show:false},axisTick:{show:false},splitArea:{show:true,areaStyle:{color:[ctx.theme.background]}}},
 yAxis:{type:"category",data:valid.map(title),axisLabel:{color:ctx.theme.text,fontSize:10,width:170,overflow:"truncate"},axisLine:{show:false},axisTick:{show:false}},
 visualMap:{show:true,min:0,max,orient:"horizontal",left:"center",bottom:0,itemWidth:8,itemHeight:90,text:[ctx.number(max),ctx.number(0)],textStyle:{color:ctx.theme.muted,fontSize:10},inRange:{color:[ctx.theme.edge,ctx.theme.accent]}},
 tooltip:{...base(ctx,label).tooltip as TooltipComponentOption,trigger:"item",formatter:(param:unknown)=>{const p=param as {value:number[]};return `${escape(title(valid[p.value[1]]))}<br/>${escape(ctx.date((first+p.value[0]*step)*1000))}<br/>${escape(ctx.labels.samples)}: ${ctx.number(p.value[2])}`;}},
 series:[{type:"heatmap",data,itemStyle:{borderColor:ctx.theme.background,borderWidth:3,borderRadius:2},emphasis:{disabled:ctx.lowCpu,itemStyle:{borderColor:ctx.theme.accent,borderWidth:1}},label:{show:false}}]};
 return {option,label,height:Math.max(170,Math.min(590,valid.length*28+84)),points:data.length,empty:!data.length,readings:data.map(([x,y,n])=>({key:`${x}:${y}`,scope:title(valid[y]),time:ctx.date((first+x*step)*1000),value:ctx.number(n)}))};
}
