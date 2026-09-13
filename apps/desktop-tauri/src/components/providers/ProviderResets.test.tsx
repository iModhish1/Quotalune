import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {ProviderResetDetails,ProviderResetBadge,resetCount} from './ProviderResets';
import type {ProviderResetFacts,ProviderUsageSnapshot} from '../../types/bridge';
vi.mock('../../hooks/useLocale',()=>({useLocale:()=>({t:(key:string)=>key,language:'english'})}));
const facts=(count:number):ProviderResetFacts=>({observedAt:'2026-09-13T00:00:00Z',providerIssuedResets:{state:'unavailable',reason:'notReported'},lastActualReset:{state:'unavailable',reason:'notObserved'},nextWeeklyReset:{state:'unavailable',reason:'notReported'},bankedResetCards:{state:'known',value:{reportedAvailableCount:count,cards:[],detailsComplete:false}}});
it.each([[0,'ResetNone'],[1,'+1 ResetSingular'],[3,'+3 ResetPlural']])('renders confirmed %s distinctly', (count,label)=>{
 render(<ProviderResetBadge facts={facts(count as number)}/>);expect(screen.getByText(label)).toBeInTheDocument();
});

it('never resurrects a rejected or past weekly timestamp',()=>{
 const provider={errorState:'ready',primary:{windowMinutes:10080,resetsAt:'2000-01-01T00:00:00Z'},extraRateWindows:[]} as unknown as ProviderUsageSnapshot;
 const {rerender}=render(<ProviderResetDetails provider={provider}/>);
 expect(screen.getByText('ResetNextWeekly').nextElementSibling).toHaveTextContent('DashboardValueUnavailable');
 provider.primary.resetsAt='2099-01-01T00:00:00Z';
 rerender(<ProviderResetDetails provider={provider} facts={facts(0)}/>);
 expect(screen.getByText('ResetNextWeekly').nextElementSibling).toHaveTextContent('DashboardValueUnavailable');
});
it('never invents zero from absence, failure, unsupported or invalid inventory',()=>{
 expect(resetCount(undefined)).toBeNull();
 for(const datum of [{state:'unavailable',reason:'fetchFailed'},{state:'unsupported'}] as const)
  expect(resetCount({...facts(0),bankedResetCards:datum})).toBeNull();
 expect(resetCount(facts(-1))).toBeNull();expect(resetCount(facts(NaN))).toBeNull();
 render(<ProviderResetBadge/>);expect(screen.queryByText('ResetNone')).toBeNull();
});
it('preserves every expiry and missing details without manufacturing a last reset',()=>{
 const value=facts(2);value.bankedResetCards={state:'known',value:{reportedAvailableCount:2,detailsComplete:false,cards:[
  {opaqueId:'one',status:'available',expiresAt:{state:'known',value:'2026-10-01T12:00:00Z'}},
  {opaqueId:'two',status:'available',expiresAt:{state:'unavailable',reason:'notReported'}},
  {opaqueId:'old',status:'expired',expiresAt:{state:'known',value:'2026-08-01T12:00:00Z'}},
 ]}};
 const {container}=render(<ProviderResetDetails facts={value}/>);
 expect(container.querySelectorAll('li')).toHaveLength(3);
 expect(screen.getByText('ResetCardExpired')).toBeInTheDocument();
 expect(screen.getByText('ResetIncompleteDetails')).toBeInTheDocument();
 expect(screen.getByText('ResetLastActual').nextElementSibling).toHaveTextContent('DashboardValueUnavailable');
});
