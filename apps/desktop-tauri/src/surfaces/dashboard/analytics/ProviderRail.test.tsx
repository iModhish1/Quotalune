import {render,screen,fireEvent,within,act} from '@testing-library/react';
import {useState} from 'react';
import {describe,it,expect,vi} from 'vitest';
import ProviderRail from './ProviderRail';
import {railWindow} from './railModel';
import type {ProviderUsageSnapshot,SettingsSnapshot} from '../../../types/bridge';
vi.mock('../../../hooks/useLocale',()=>({useLocale:()=>({t:(key:string)=>key,language:'english'}),useOptionalLocale:()=>null}));
vi.mock('../../../lib/tauri',()=>({refreshProviders:vi.fn(),codexAccountFetch:vi.fn().mockResolvedValue({})}));
const settings={showAsUsed:true,providerMetrics:{},providerAccentColors:{}} as SettingsSnapshot;
it('permits physical reordering across the circle seam and respects disabled animations',()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const save=vi.fn().mockResolvedValue(undefined);
 render(<ProviderRail providers={['codex','claude','gemini','cursor'].map(provider)} settings={{...settings,enableAnimations:false}} isDemo onOpenProviders={()=>{}} onAnalytics={()=>{}} onPresentationChange={save}/>);
 const toolbar=screen.getByRole('toolbar');
 expect(toolbar.closest('.provider-rail')).toHaveAttribute('data-motion','off');
 fireEvent.click(within(toolbar).getByRole('button',{name:/codex,/}));
 const left=screen.getByRole('button',{name:'InstanceMoveLeft'});
 expect(left).toBeEnabled();fireEvent.click(left);
 expect(save).toHaveBeenLastCalledWith({order:['cursor','claude','gemini','codex'],anchorId:'cursor'});
});
const provider=(id:string):ProviderUsageSnapshot=>({providerId:id,displayName:id,planName:id==='codex'?'ChatGPT Pro':null,primary:{usedPercent:62,remainingPercent:38,resetsAt:null,resetDescription:null,windowMinutes:null,isExhausted:false,reservePercent:null,reserveDescription:null},secondary:null,tertiary:null,modelSpecific:null,selectedMetric:{usedPercent:62,remainingPercent:38,resetsAt:null,resetDescription:null,windowMinutes:null,isExhausted:false,reservePercent:null,reserveDescription:null},extraRateWindows:[],cost:null,errorState:'ready',error:null,accountEmail:null,accountOrganization:null,pace:null,trayStatusLabel:null,updatedAt:'2026-09-10T00:00:00Z',sourceLabel:'test'});
it('offers directly accessible three/four choices without losing the circular anchor',()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const save=vi.fn();
 function Harness(){
  const [visibleCount,setVisibleCount]=useState<3|4>(4);
  return <ProviderRail providers={Array.from({length:6},(_,i)=>provider(`provider-${i}`))} settings={settings} isDemo
   onOpenProviders={()=>{}} onAnalytics={()=>{}}
   presentation={{order:[],badgePosition:'top-right',showAccountNumbers:true,visibleCount,anchorId:'provider-5'}}
   onPresentationChange={async patch=>{save(patch);if(patch.visibleCount)setVisibleCount(patch.visibleCount);}}/>;
 }
 render(<Harness/>);
 fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button',{name:/provider-5,/}));
 const choices=screen.getByRole('group',{name:'InstanceVisibleCount'});
 expect(within(choices).getAllByRole('button')).toHaveLength(2);
 expect(within(choices).getByRole('button',{name:'4'})).toHaveAttribute('aria-pressed','true');
 fireEvent.click(within(choices).getByRole('button',{name:'3'}));
 expect(save).toHaveBeenLastCalledWith({visibleCount:3});
 expect(within(choices).getByRole('button',{name:'3'})).toHaveAttribute('aria-pressed','true');
 expect(within(screen.getByRole('toolbar')).getAllByRole('button').map(b=>b.dataset.index)).toEqual(['5','0','1']);
 fireEvent.click(within(choices).getByRole('button',{name:'4'}));
 expect(save).toHaveBeenLastCalledWith({visibleCount:4});
 expect(within(screen.getByRole('toolbar')).getAllByRole('button').map(b=>b.dataset.index)).toEqual(['5','0','1','2']);
});
it.each([1,6,12,24,40,70])('bounds mounted controls while all %i providers remain keyboard reachable',count=>{
 const view=render(<ProviderRail providers={Array.from({length:count},(_,i)=>provider(`provider-${i}`))} settings={settings} isDemo onOpenProviders={()=>{}} onAnalytics={()=>{}}/>);
 expect(within(screen.getByRole('toolbar')).getAllByRole('button').length).toBeLessThanOrEqual(4);
 const first=within(screen.getByRole('toolbar')).getAllByRole('button')[0];fireEvent.keyDown(first,{key:'End'});
 expect(within(screen.getByRole('toolbar')).getByRole('button',{name:new RegExp(`provider-${count-1},`)})).toHaveAttribute('aria-current','true');
 fireEvent.keyDown(screen.getByRole('toolbar'),{key:'Home'});expect(within(screen.getByRole('toolbar')).getAllByRole('button')[0]).toHaveAttribute('aria-current','true');
 expect(view.container.querySelectorAll('.provider-planet').length).toBeLessThanOrEqual(4);
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
 const event=new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true});view.container.querySelector('.provider-rail__viewport')!.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
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


it('selects the second account by identity and never shows ambient history or quota',async()=>{
 const {codexAccountFetch}=await import('../../../lib/tauri');
 const ambient=provider('codex');
 const second={instanceId:'codex:two',providerId:'codex',accountId:'two',accountOrdinal:2,accountLabel:'Work',snapshot:{...provider('codex'),primary:{...ambient.primary,usedPercent:17,remainingPercent:83},selectedMetric:{...ambient.primary,usedPercent:17,remainingPercent:83}}};
 const save=vi.fn().mockResolvedValue(undefined);
 render(<ProviderRail providers={[ambient]} instances={[{...second,instanceId:'codex',accountId:null,accountOrdinal:1,snapshot:ambient},second]} settings={settings} isDemo={false} onOpenProviders={()=>{}} onAnalytics={()=>{}} onPresentationChange={save}/>);
 fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button',{name:/codex · 2,/}));
 const panel=screen.getByRole('dialog');
 expect(within(panel).getByText('17%')).toBeInTheDocument();
 expect(within(panel).queryByText('62%')).toBeNull();
 expect(within(panel).queryByRole('button',{name:'V3ViewAnalytics'})).toBeNull();
 fireEvent.click(within(panel).getByRole('button',{name:'InstanceMoveLeft'}));
 expect(save).toHaveBeenCalledWith(expect.objectContaining({order:['codex:two','codex']}));
 await act(async()=>fireEvent.click(within(panel).getByRole('button',{name:'ActionRefresh'})));
 expect(codexAccountFetch).toHaveBeenCalledWith('two');
});

it('a missing account keeps a distinct selectable card with no ambient fallback',()=>{
 render(<ProviderRail providers={[provider('codex')]} instances={[{instanceId:'codex:two',providerId:'codex',accountId:'two',accountOrdinal:2,accountLabel:null,snapshot:null}]} settings={settings} isDemo={false} onOpenProviders={()=>{}} onAnalytics={()=>{}}/>);
 fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button'));
 expect(within(screen.getByRole('dialog')).getByText('CodexAccountsUsageUnavailable')).toBeInTheDocument();
 expect(within(screen.getByRole('dialog')).queryByText('62%')).toBeNull();
});


it('restores the saved circular foreground and persists the next wheel anchor',()=>{
 const save=vi.fn().mockResolvedValue(undefined);
 const providers=Array.from({length:70},(_,i)=>provider(`provider-${i}`));
 const view=render(<ProviderRail providers={providers} settings={settings} isDemo={false} onOpenProviders={()=>{}} onAnalytics={()=>{}} presentation={{order:[],badgePosition:'bottom-left',showAccountNumbers:true,visibleCount:4,anchorId:'provider-68'}} onPresentationChange={save}/>);
 const toolbar=screen.getByRole('toolbar');
 expect(within(toolbar).getAllByRole('button').map(b=>b.dataset.index)).toEqual(['68','69','0','1']);
 fireEvent.wheel(view.container.querySelector('.provider-rail__viewport')!,{deltaY:120});
 expect(save).toHaveBeenCalledWith({anchorId:'provider-69'});
 expect(within(toolbar).getAllByRole('button').map(b=>b.dataset.index)).toEqual(['69','0','1','2']);
});
it('offers eight physical positions and reverses left/right reorder indices in RTL',()=>{
 document.documentElement.dir='rtl';
 try {
 const save=vi.fn().mockResolvedValue(undefined);
 render(<ProviderRail providers={[provider('codex'),provider('claude')]} settings={settings} isDemo={false} onOpenProviders={()=>{}} onAnalytics={()=>{}} onPresentationChange={save}/>);
 fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button',{name:/codex,/}));
 fireEvent.click(screen.getByRole('button',{name:'InstanceMoveLeft'}));
 expect(save).toHaveBeenCalledWith(expect.objectContaining({order:['claude','codex']}));
 const account=screen.getByRole('group',{name:'InstanceBadgePosition'});
 const resets=screen.getByRole('group',{name:'ResetBadgePosition'});
 expect(within(account).getAllByRole('button')).toHaveLength(8);
 expect(within(resets).getAllByRole('button')).toHaveLength(8);
 expect(account.querySelector('[dir=ltr]')).not.toBeNull();
 fireEvent.click(within(account).getByRole('button',{name:'InstanceBadgePosition: BadgeBottomLeft'}));
 expect(save).toHaveBeenCalledWith({badgePosition:'bottom-left'});
 fireEvent.click(within(resets).getByRole('button',{name:'ResetBadgePosition: BadgeMiddleRight'}));
 expect(save).toHaveBeenCalledWith({resetPosition:'middle-right'});
 }finally{document.documentElement.dir='';}
});

it('maps legacy start/end positions to the same physical badge and picker location',()=>{
 document.documentElement.dir='rtl';
 try {
 const view=render(<ProviderRail providers={[provider('codex')]} settings={settings} isDemo onOpenProviders={()=>{}} onAnalytics={()=>{}}
  presentation={{order:[],badgePosition:'end',resetPosition:'start',showAccountNumbers:true}} onPresentationChange={vi.fn().mockResolvedValue(undefined)}/>);
 expect(view.container.querySelector('.provider-instance-mark')).toHaveAttribute('data-badge-position','top-left');
 expect(view.container.querySelector('.provider-reset-position')).toHaveAttribute('data-position','top-right');
 fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button'));
 expect(screen.getByRole('button',{name:'InstanceBadgePosition: BadgeTopLeft'})).toHaveAttribute('aria-pressed','true');
 expect(screen.getByRole('button',{name:'ResetBadgePosition: BadgeTopRight'})).toHaveAttribute('aria-pressed','true');
 } finally {document.documentElement.dir='';}
});
