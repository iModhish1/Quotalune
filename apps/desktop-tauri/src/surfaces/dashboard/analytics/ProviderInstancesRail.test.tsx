import {render,screen,within,fireEvent} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import ProviderInstancesRail from './ProviderInstancesRail';
import type {ProviderUsageSnapshot,SettingsSnapshot} from '../../../types/bridge';
vi.mock('../../../hooks/useLocale',()=>({useLocale:()=>({t:(key:string)=>key,language:'english'}),useOptionalLocale:()=>null}));
vi.mock('../../../hooks/useSettings',()=>({useSettings:(settings:SettingsSnapshot)=>({settings,update:vi.fn().mockResolvedValue(undefined),saving:false,error:null})}));
vi.mock('../../../hooks/useProviderInstances',()=>({useProviderInstances:()=>({instances:[],error:null})}));
it('restores the exact ordered foreground and badge locations after a Demo remount',()=>{
 const key='quotalis.demo.providerRail.v1';
 const previous=localStorage.getItem(key);
 const ids=['codex','claude','gemini','cursor','copilot','deepseek'];
 const providers=ids.map(providerId=>({providerId,displayName:providerId,errorState:'ready',primary:{usedPercent:20,remainingPercent:80,resetsAt:null},extraRateWindows:[],updatedAt:'2026-09-13T00:00:00Z'})) as unknown as ProviderUsageSnapshot[];
 const saved={order:['gemini','codex','deepseek','claude','cursor','copilot'],badgePosition:'bottom-left',resetPosition:'middle-right',showAccountNumbers:true,visibleCount:4,anchorId:'cursor'};
 const props={providers,settings:{enabledProviders:ids} as SettingsSnapshot,isDemo:true,onOpenProviders:()=>{},onAnalytics:()=>{}};
 try {
  localStorage.setItem(key,JSON.stringify(saved));
  const first=render(<ProviderInstancesRail {...props}/>);
  const visible=()=>within(screen.getByRole('toolbar')).getAllByRole('button').map(node=>node.dataset.instanceId);
  expect(visible()).toEqual(['cursor','copilot','gemini','codex']);
  fireEvent.click(screen.getByRole('button',{name:'V3Next'}));
  expect(visible()).toEqual(['copilot','gemini','codex','deepseek']);
  first.unmount();
  const restored=render(<ProviderInstancesRail {...props}/>);
  expect(visible()).toEqual(['copilot','gemini','codex','deepseek']);
  expect(restored.container.querySelector('.provider-instance-mark')).toHaveAttribute('data-badge-position','bottom-left');
  expect(restored.container.querySelector('.provider-reset-position')).toHaveAttribute('data-position','middle-right');
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual({...saved,showResetBadge:true,anchorId:'copilot'});
 } finally {if(previous===null)localStorage.removeItem(key);else localStorage.setItem(key,previous);}
});
it('restores independent anchors when switching Demo and real in both directions',()=>{
 localStorage.removeItem('quotalis.demo.providerRail.v1');
 const providers=['codex','claude','gemini'].map(providerId=>({providerId,displayName:providerId,errorState:'ready',primary:{usedPercent:20,remainingPercent:80,resetsAt:null},extraRateWindows:[],updatedAt:'2026-09-13T00:00:00Z'})) as unknown as ProviderUsageSnapshot[];
 const settings={enabledProviders:['codex','claude','gemini'],providerInstancePresentation:{order:[],badgePosition:'end',showAccountNumbers:true,anchorId:'gemini'}} as unknown as SettingsSnapshot;
 const props={providers,settings,onOpenProviders:()=>{},onAnalytics:()=>{}};
 const active=()=>within(screen.getByRole('toolbar')).getAllByRole('button').find(b=>b.getAttribute('aria-current')==='true')!;
 const {rerender}=render(<ProviderInstancesRail {...props} isDemo={false}/>);
 expect(active()).toHaveAttribute('data-instance-id','gemini');
 rerender(<ProviderInstancesRail {...props} isDemo/>);
 expect(active()).toHaveAttribute('data-instance-id','codex');
 fireEvent.click(screen.getByRole('button',{name:'V3Next'}));
 expect(active()).toHaveAttribute('data-instance-id','claude');
 rerender(<ProviderInstancesRail {...props} isDemo={false}/>);
 expect(active()).toHaveAttribute('data-instance-id','gemini');
 rerender(<ProviderInstancesRail {...props} isDemo/>);
 expect(active()).toHaveAttribute('data-instance-id','claude');
 localStorage.removeItem('quotalis.demo.providerRail.v1');
});
