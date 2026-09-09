import type {ChartOption} from "./chartSpec";
export interface ChartHandle {setOption:(option:ChartOption,settings:{notMerge:boolean;lazyUpdate:boolean})=>void;resize:()=>void;dispose:()=>void;}
/** Bounded observer; coalesced resize; lifecycle testable without a browser GPU. */
export function mountChart(host:HTMLElement,chart:ChartHandle,observe:(run:()=>void)=>()=>void,request:(run:()=>void)=>number,cancel:(id:number)=>void) {
 let disposed=false,pending:number|null=null,width=-1,height=-1;
 const disconnect=observe(()=>{
  const rect=host.getBoundingClientRect();
  if(rect.width===width && rect.height===height)return;
  width=rect.width;height=rect.height;
  if(pending===null && !disposed)pending=request(()=>{pending=null;if(!disposed)chart.resize();});
 });
 return {update(option:ChartOption){if(!disposed)chart.setOption(option,{notMerge:true,lazyUpdate:false});},dispose(){if(disposed)return;disposed=true;disconnect();if(pending!==null)cancel(pending);chart.dispose();}};
}
