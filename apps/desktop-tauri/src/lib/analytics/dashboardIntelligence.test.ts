import {describe,it,expect} from "vitest";
import {resetMarkerLanes,summarizeCoverage,EXHAUSTION_PROJECTION} from "./dashboardIntelligence";
import {buildQuotaAnalytics} from "./quotaAnalytics";
import {formatMetric,METRIC_REGISTRY} from "./metricRegistry";
import {observedAccountLabel} from "./metricLabels";
import type {QuotaHistoryPoint} from "../../types/bridge";

const samples:QuotaHistoryPoint[]=Array.from({length:8},(_,i)=>({provider:"codex",accountId:"fixture",accountScope:"observed",windowKey:"primary",windowLabel:"Weekly",windowMinutes:10080,bucketStart:i*3600,observedAt:i*3600,usedPercent:i*5,remainingPercent:100-i*5,resetsAt:40000,sampleCount:1}));
describe("Dashboard intelligence invariants",()=>{
  it("weights one closing observation per bucket even across an intra-bucket reset",()=>{
    const first={...samples[4],usedPercent:90,remainingPercent:10,resetsAt:15000};
    const reset={...first,observedAt:15000,usedPercent:0,remainingPercent:100,resetsAt:40000};
    const next={...samples[5],usedPercent:90,remainingPercent:10};
    const row=buildQuotaAnalytics([first,reset,next],{since:14400,until:21600,grainSeconds:3600})[0];
    expect(row.mean.value).toBe(45);
    expect(row.minimum.value).toBe(0);
    expect(row.velocity.value).toBeNull();
  });
  it("rejects conflicting duplicate counts independently of order",()=>{
    const duplicate={...samples[4],sampleCount:5};
    for(const data of [[...samples,duplicate],[duplicate,...samples]]) {
      const row=buildQuotaAnalytics(data,{since:14400,until:28800,grainSeconds:3600})[0];
      expect(row.invalid).toBe(true);
      expect(row.mean.value).toBeNull();
      expect(row.sampleCount).toBe(0);
    }
  });
  it("labels unknown identities honestly and distinguishes observed accounts without exposing identifiers",()=>{
    const first=samples[0],second={...first,accountId:"another-private-id"};
    const t=(key:string)=>key;
    expect(observedAccountLabel({...first,accountScope:"legacy"},[first],t)).toBe("V2IdentityUnknown");
    expect(observedAccountLabel(first,[first,second],t)).not.toBe(observedAccountLabel(second,[first,second],t));
    expect(observedAccountLabel(second,[first,second],t)).not.toContain("another-private-id");
  });
  it("computes real range facts and never projects unproven workload",()=>{
    const model=buildQuotaAnalytics(samples,{since:4*3600,until:8*3600,grainSeconds:3600})[0];
    expect([model.start.value,model.end.value,model.change.value,model.minimum.value,model.maximum.value]).toEqual([20,35,15,20,35]);
    expect(EXHAUSTION_PROJECTION.value).toBeNull();
    expect(summarizeCoverage([model])).toEqual({samples:4,first:14400,last:25200,missingBuckets:0});
  });
  it("does not create buckets when range expands or mutate filtered source",()=>{
    const frozen=Object.freeze(samples.map(point=>Object.freeze({...point})));
    expect(buildQuotaAnalytics(frozen,{since:0,until:30*86400,grainSeconds:3600})[0].sampleCount).toBe(8);
    expect(buildQuotaAnalytics(frozen,{since:0,until:30*86400,grainSeconds:3600},"claude")).toEqual([]);
    expect(frozen).toEqual(samples);
  });
  it("preserves decrease evidence carried on an identical duplicate",()=>{
    const model=buildQuotaAnalytics([...samples,{...samples[6],counterDecreased:true}],{since:14400,until:28800,grainSeconds:3600})[0];
    expect(model.velocity.reason).toBe("counterDecrease");
  });
  it("preserves monetary distinctions through formatting",()=>{
    expect(formatMetric("credits",12,"en-US","USD")).toBe("12");
    expect(formatMetric("reportedSpend",12,"en-US",null)).toBeNull();
    expect(formatMetric("quotaUsed",12,"en-US","USD")).toBe("12%");
    expect(METRIC_REGISTRY.balance.aggregation).toBe("latest");
    expect(formatMetric("reportedSpend",NaN,"en-US","USD")).toBeNull();
  });
  it("keeps clustered reset identities in distinct calibrated lanes",()=>{
    const result=resetMarkerLanes([10,10,11,500],0,1000);
    expect(result.map(item=>item.fraction)).toEqual([.01,.01,.011,.5]);
    expect(result.slice(0,3).map(item=>item.lane)).toEqual([0,1,2]);
    expect(result[3].lane).toBe(0);
  });
});
