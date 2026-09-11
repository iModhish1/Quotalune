import {useEffect,useRef,useState} from "react";
import {init,use} from "echarts/core";
import {LineChart,HeatmapChart,BarChart} from "echarts/charts";
import {GridComponent,TooltipComponent,LegendComponent,DataZoomComponent,MarkPointComponent,MarkLineComponent,VisualMapComponent,AriaComponent,CalendarComponent} from "echarts/components";
import {SVGRenderer} from "echarts/renderers";
import type {ChartSpec} from "./chartSpec";
import {mountChart} from "./chartLifecycle";
use([LineChart,HeatmapChart,BarChart,GridComponent,TooltipComponent,LegendComponent,DataZoomComponent,MarkPointComponent,MarkLineComponent,VisualMapComponent,AriaComponent,CalendarComponent,SVGRenderer]);
/** Only this lazy module imports the chart runtime. No frame loop or timer. */
export default function EChartsSurface({spec,unavailable}:{spec:ChartSpec;unavailable:string}) {
 const host=useRef<HTMLDivElement>(null),controller=useRef<ReturnType<typeof mountChart>|null>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!host.current)return;
  let chart:ReturnType<typeof init>|undefined;
  try {
   chart=init(host.current,undefined,{renderer:"svg"});
   controller.current=mountChart(host.current,chart,run=>{
    if(typeof ResizeObserver==="undefined")return ()=>{};
    const observer=new ResizeObserver(run);observer.observe(host.current!);return ()=>observer.disconnect();
   },run=>requestAnimationFrame(run),id=>cancelAnimationFrame(id));
  }catch {chart?.dispose();setFailed(true);}
  return ()=>{controller.current?.dispose();controller.current=null;};
 },[]);
 useEffect(()=>{try{controller.current?.update(spec.option);}catch{controller.current?.dispose();setFailed(true);}},[spec]);
 return failed?<p role="status" className="analytics-empty">{unavailable}</p>:<div ref={host} className="quotalis-chart" role="img" aria-label={spec.label} style={{height:spec.height}} data-points={spec.points}/>;
}
