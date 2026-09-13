import {render,screen,fireEvent,within,act} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import ProviderRail from './ProviderRail';
import {railWindow} from './railModel';
import type {ProviderUsageSnapshot,SettingsSnapshot} from '../../../types/bridge';
vi.mock('../../../hooks/useLocale',()=>({useLocale:()=>({t:(key:string)=>key,language:'english'}),useOptionalLocale:()=>null}));
vi.mock('../../../lib/tauri',()=>({refreshProviders:vi.fn()}));
const settings={showAsUsed:true,providerMetrics:{},providerAccentColors:{}} as SettingsSnapshot;
const provider=(id:string):ProviderUsageSnapshot=>({providerId:id,displayName:id,planName:id==='codex'?'ChatGPT Pro':null,primary:{usedPercent:62,remainingPercent:38,resetsAt:null,resetDescription:null,windowMinutes:null,isExhausted:false,reservePercent:null,reserveDescription:null},secondary:null,tertiary:null,modelSpecific:null,selectedMetric:{usedPercent:62,remainingPercent:38,resetsAt:null,resetDescription:null,windowMinutes:null,isExhausted:false,reservePercent:null,reserveDescription:null},extraRateWindows:[],cost:null,errorState:'ready',error:null,accountEmail:null,accountOrganization:null,pace:null,trayStatusLabel:null,updatedAt:'2026-09-10T00:00:00Z',sourceLabel:'test'});
it.each([1,6,12,24,40,70])('bounds mounted controls while all %i providers remain keyboard reachable',count=>{
 const view=render(<ProviderRail providers={Array.from({length:count},(_,i)=>provider(`provider-${i}`))} settings={settings} isDemo onOpenProviders={()=>{}} onAnalytics={()=>{}}/>);
 expect(within(screen.getByRole('toolbar')).getAllByRole('button').length).toBeLessThanOrEqual(6);
 const first=within(screen.getByRole('toolbar')).getAllByRole('button')[0];fireEvent.keyDown(first,{key:'End'});
 expect(within(screen.getByRole('toolbar')).getByRole('button',{name:new RegExp(`provider-${count-1},`)})).toHaveAttribute('aria-current','true');
 fireEvent.keyDown(screen.getByRole('toolbar'),{key:'Home'});expect(within(screen.getByRole('toolbar')).getAllByRole('button')[0]).toHaveAttribute('aria-current','true');
 expect(view.container.querySelectorAll('.provider-planet').length).toBeLessThanOrEqual(6);
});
it('click exposes genuine plan and physical quotas, and analytics drills into the selected provider',()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const analytics=vi.fn();render(<ProviderRail providers={[provider('codex')]} settings={settings} isDemo onOpenProviders={()=>{}} onAnalytics={analytics}/>);
 fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button'));const panel=screen.getByRole('dialog');expect(within(panel).getAllByText('ChatGPT Pro').length).toBeGreaterThan(0);expect(within(panel).getByText('62%')).toBeInTheDocument();
 expect(within(panel).getByRole('button',{name:'ActionRefresh'})).toBeDisabled();fireEvent.click(within(panel).getByRole('button',{name:'V3ViewAnalytics'}));expect(analytics).toHaveBeenCalledWith('codex');
});
it('wheel changes selection only over the rail and stays bounded',()=>{
 const view=render(<ProviderRail providers={[provider('codex'),provider('claude')]} settings={settings} isDemo onOpenProviders={()=>{}} onAnalytics={()=>{}}/>);
 fireEvent.wheel(view.container.querySelector('.provider-rail__viewport')!,{deltaY:120});expect(within(screen.getByRole('toolbar')).getByRole('button',{name:/claude,/})).toHaveAttribute('aria-current','true');
 const event=new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true});view.container.querySelector('.provider-rail__viewport')!.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);
});
describe('rail window',()=>{it('keeps focused provider mounted at every boundary',()=>{for(let i=0;i<70;i++){const w=railWindow(70,i,7);expect(w.end-w.start).toBe(7);expect(i>=w.start&&i<w.end).toBe(true);}});});

it('a drag without a trailing click does not swallow the next deliberate click',()=>{
 vi.useFakeTimers();vi.stubGlobal('PointerEvent',MouseEvent);
 try {
  const view=render(<ProviderRail providers={[provider('codex'),provider('claude')]} settings={settings} isDemo onOpenProviders={()=>{}} onAnalytics={()=>{}}/>);
  const rail=view.container.querySelector('.provider-rail__viewport')!;
  fireEvent.pointerDown(rail,{clientX:150,button:0});fireEvent.pointerUp(rail,{clientX:50,button:0});
  expect(within(screen.getByRole('toolbar')).getByRole('button',{name:/claude,/})).toHaveAttribute('aria-current','true');
  expect(screen.queryByRole('dialog')).toBeNull();
  act(()=>vi.runOnlyPendingTimers());fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button',{name:/claude,/}));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
 }finally{vi.useRealTimers();vi.unstubAllGlobals();}
});
