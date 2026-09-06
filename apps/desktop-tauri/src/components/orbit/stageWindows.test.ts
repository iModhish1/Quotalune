import {expect,it} from "vitest";
import {toStageProviders,usageConfigFromSnapshot} from "./stageProviders";
import type {ProviderUsageSnapshot} from "../../types/bridge";
it('carries validated per-provider presentation from persisted snapshot to render data',()=>{
  const presentation={shape:'ring',content:'both',direction:'reverse'};
  const config=usageConfigFromSnapshot({providerLimitPresentation:{claude:presentation,codex:{shape:'unknown'}}});
  expect(config?.providerLimitPresentation).toEqual({claude:presentation});
  const provider={providerId:'claude',displayName:'Claude',primary:{usedPercent:0,remainingPercent:100},error:null} as ProviderUsageSnapshot;
  expect(toStageProviders([provider],config)[0].limitPresentation).toEqual(presentation);
});
it('inherits the global presentation and lets one provider override it',()=>{
  const globalPresentation={shape:'ring',content:'both',direction:'forward',identity:'pearl'} as const;
  const override={shape:'vertical',content:'value',direction:'reverse',identity:'signal'} as const;
  const config=usageConfigFromSnapshot({globalLimitPresentation:globalPresentation,providerLimitPresentation:{claude:override}})!;
  const base={displayName:'Provider',primary:{usedPercent:20,remainingPercent:80},error:null} as ProviderUsageSnapshot;
  const [codex,claude]=toStageProviders([{...base,providerId:'codex'},{...base,providerId:'claude'}],config);
  expect(codex.limitPresentation).toEqual(globalPresentation);
  expect(claude.limitPresentation).toEqual(override);
});
it('rejects a corrupt global presentation and falls back to the safe adaptive identity',()=>{
  const config=usageConfigFromSnapshot({globalLimitPresentation:{shape:'sharp',content:'both',direction:'forward'}});
  const provider={providerId:'codex',displayName:'Codex',primary:{usedPercent:20,remainingPercent:80},error:null} as ProviderUsageSnapshot;
  expect(toStageProviders([provider],config)[0].limitPresentation).toEqual({shape:'horizontal',content:'both',direction:'forward',identity:'adaptive'});
});
it('loads ordered limit selections alone and rejects malformed persisted entries',()=>{
  expect(usageConfigFromSnapshot({providerLimitOrder:{claude:['model','primary','model'],codex:[]}})?.providerLimitOrder)
    .toEqual({claude:['model','primary'],codex:[]});
  expect(usageConfigFromSnapshot({providerLimitOrder:{claude:'weekly',codex:[12]}})?.providerLimitOrder).toEqual({});
});
it('renders arbitrary selected limit IDs in saved order, preserving unavailable choices',()=>{
  const limit={usedPercent:12,remainingPercent:88};
  const provider={providerId:'claude',displayName:'Claude',primary:limit,secondary:limit,
    modelSpecific:limit,error:null} as ProviderUsageSnapshot;
  const selection=['model','temporarily-unavailable','primary','model'];
  const config={global:'used' as const,providerOverrides:{},
    providerDetailWindows:{claude:'none' as const},providerLimitOrder:{claude:selection}};
  const stage=toStageProviders([provider],config)[0];
  expect(stage.windows?.map(w=>w.id)).toEqual(['model','primary']);
  expect(stage.detailsHidden).toBe(false);
  expect(selection).toEqual(['model','temporarily-unavailable','primary','model']);
  expect(toStageProviders([provider],{...config,providerLimitOrder:{claude:[]}})[0].detailsHidden).toBe(true);
});
it('loads detail choices without requiring a usage-mode override and ignores corrupt choices',()=>{
  expect(usageConfigFromSnapshot({providerDetailWindows:{claude:'weekly',codex:'invalid'}})?.providerDetailWindows).toEqual({claude:'weekly'});
});
it('selects detail limits independently of the primary metric and usage mode',()=>{
  const session={usedPercent:73,remainingPercent:27,windowMinutes:300};
  const weekly={usedPercent:7,remainingPercent:93,windowMinutes:10080};
  const p={providerId:'claude',displayName:'Claude',primary:session,secondary:weekly,error:null} as ProviderUsageSnapshot;
  const config={global:'used' as const,providerOverrides:{},providerDetailWindows:{claude:'weekly' as const}};
  const stage=toStageProviders([p],config)[0];
  expect(stage.primaryValue).toBe(73);
  expect(stage.windows?.map(w=>w.primaryValue)).toEqual([7]);
  expect(toStageProviders([p],{...config,providerDetailWindows:{claude:'session'}})[0].windows?.map(w=>w.primaryValue)).toEqual([73]);
  expect(toStageProviders([p],{...config,providerDetailWindows:{claude:'both'}})[0].windows).toHaveLength(2);
  const hidden=toStageProviders([p],{...config,providerDetailWindows:{claude:'none'}})[0];
  expect(hidden.windows).toEqual([]);
  expect(hidden.detailsHidden).toBe(true);
  expect(hidden.primaryValue).toBe(73);
  expect(toStageProviders([{...p,secondary:null}],config)[0].windows).toEqual([]);
});
it("keeps session and weekly values and reset times separate",()=>{
  const primary={remainingPercent:27,usedPercent:73,windowMinutes:300,resetDescription:"Resets in 51 min"};
  const secondary={remainingPercent:93,usedPercent:7,windowMinutes:10080,resetDescription:"Resets in 4d"};
  const provider={providerId:"claude",displayName:"Claude",primary,secondary,selectedMetric:secondary,error:null} as ProviderUsageSnapshot;
  const stage=toStageProviders([provider],{global:"used",providerOverrides:{}})[0];
  expect(stage.windows?.map(w=>[w.label,w.primaryValue,w.reset])).toEqual([["5-hour session",73,"51 min"],["Weekly",7,"4d"]]);
  expect(stage.primaryValue).toBe(7);
});
it('preserves model, tertiary and extra limits with their own identities', () => {
  const limit={usedPercent:12,remainingPercent:88,resetDescription:'Resets in 2h'};
  const provider={providerId:'claude',displayName:'Claude',primary:limit,secondary:null,
    modelSpecific:limit,tertiary:limit,tertiaryLabel:'Monthly',
    extraRateWindows:[{id:'primary',title:'Extra requests',window:limit}],error:null} as ProviderUsageSnapshot;
  const windows=toStageProviders([provider],undefined)[0].windows!;
  expect(windows.map(w=>w.label)).toEqual(['Primary limit','Model-specific limit','Monthly','Extra requests']);
  expect(new Set(windows.map(w=>w.id)).size).toBe(4);
});
it('keeps a provider session and every named 5-hour source independently selectable',()=>{
  const limit={usedPercent:12,remainingPercent:88,windowMinutes:300,resetDescription:'Resets in 2h'};
  const provider={providerId:'codex',displayName:'Codex',primary:limit,primaryLabel:'Session',secondary:null,
    modelSpecific:null,tertiary:null,extraRateWindows:[
      {id:'codex-spark',title:'Codex Spark 5-hour',window:limit},
      {id:'another-5h',title:'Another 5-hour limit',window:limit},
    ],error:null} as ProviderUsageSnapshot;
  const all=toStageProviders([provider],undefined)[0].windows!;
  expect(all.map(window=>[window.id,window.label])).toEqual([
    ['primary','Session'],['extra:codex-spark','Codex Spark 5-hour'],['extra:another-5h','Another 5-hour limit'],
  ]);
  const selected=toStageProviders([provider],{global:'remaining',providerOverrides:{},
    providerLimitOrder:{codex:['extra:another-5h','primary']}})[0].windows!;
  expect(selected.map(window=>window.id)).toEqual(['extra:another-5h','primary']);
});
it.each([NaN,Infinity,-Infinity])('does not turn invalid percentages into a full or empty quota: %s', value => {
  const limit={usedPercent:value,remainingPercent:value};
  const provider={providerId:'claude',displayName:'Claude',primary:limit,secondary:null,error:null} as ProviderUsageSnapshot;
  const stage=toStageProviders([provider],undefined)[0];
  expect(stage.primaryValue).toBeNull();
  expect(stage.windows?.[0].primaryValue).toBeNull();
});
