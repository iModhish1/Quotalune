import {lazy,Suspense,Component,type ReactNode} from "react";
import {useLocale} from "../../../hooks/useLocale";
import {AnalyticsTable} from "../AnalyticsPrimitives";
import type {ChartSpec} from "./chartSpec";
const Surface=lazy(()=>import("./EChartsSurface"));
class ChartBoundary extends Component<{children:ReactNode;unavailable:string},{failed:boolean}> {
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<p role="status" className="analytics-empty">{this.props.unavailable}</p>:this.props.children;}
}
export function ProfessionalChart({spec,unavailable}:{spec:ChartSpec;unavailable:string}) {
 const {t}=useLocale();
 return spec.empty?<p className="analytics-empty" role="status">{unavailable}</p>:<><ChartBoundary unavailable={unavailable}><Suspense fallback={<div className="chart-loading" style={{height:spec.height}} aria-busy="true"/>}><Surface spec={spec} unavailable={unavailable}/></Suspense></ChartBoundary>{spec.readings && <details className="chart-reading-alternative"><summary>{t("V2HistoryValues")}</summary><AnalyticsTable rows={spec.readings} rowKey={row=>row.key} caption={spec.label} emptyLabel={unavailable} copy={{columns:t("V45TableColumns"),previousPage:t("V45TablePreviousPage"),nextPage:t("V45TableNextPage"),page:t("V45TablePage")}} columns={[
 {id:"scope",title:t("V2HistorySeries"),cell:row=><bdi>{row.scope}</bdi>},{id:"time",title:t("V2ObservedAt"),cell:row=><bdi>{row.time}</bdi>},{id:"value",title:spec.label,cell:row=><bdi>{row.value}</bdi>}
 ]}/></details>}</>;
}
