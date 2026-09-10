import {expect,it} from 'vitest';
import {activityBuckets} from './LocalActivity';
const daily=[{day:'2026-09-07',totalTokens:4,cachedInputTokens:0,estimatedCostUsd:null},{day:'2026-09-09',totalTokens:6,cachedInputTokens:0,estimatedCostUsd:null}];
it('never zero fills missing days or turns polling into activity',()=>{expect(activityBuckets(daily,'daily').map(p=>p.tokens)).toEqual([4,6]);});
it('groups real additive tokens by UTC week and supports cumulative tokens',()=>{expect(activityBuckets(daily,'weekly')).toEqual([{day:'2026-09-07',tokens:10}]);expect(activityBuckets(daily,'cumulative').map(p=>p.tokens)).toEqual([4,10]);});
