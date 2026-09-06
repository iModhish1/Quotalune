import {render,screen,fireEvent} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import UsageWindowList from './UsageWindowList';
import type {StageUsageWindow} from './stageTypes';
import {PROVIDER_PRESENTATION_IDENTITIES} from '../../design-system/limitPresentation';
const windows:StageUsageWindow[]=['Session','5-hour','Weekly','Monthly'].map((label,index)=>({id:String(index),label,primaryValue:20+index,primaryLabel:'remaining',arcFraction:.2,reset:'2h',resetsAt:null}));
it('resets paging for a new provider or selected order, but not a usage refresh',()=>{
  const presentation={shape:'ring',content:'both',direction:'forward'} as const;
  const {rerender}=render(<UsageWindowList providerId="codex" windows={windows} presentation={presentation}/>);
  fireEvent.click(screen.getByRole('button',{name:'Next limits'}));
  rerender(<UsageWindowList providerId="codex" windows={windows.map(w=>({...w,primaryValue:40}))} presentation={presentation}/>);
  expect(screen.getByRole('meter',{name:'Weekly remaining'})).toBeInTheDocument();
  rerender(<UsageWindowList providerId="claude" windows={windows} presentation={presentation}/>);
  expect(screen.getByRole('meter',{name:'Session remaining'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Next limits'}));
  rerender(<UsageWindowList providerId="claude" windows={[windows[1],windows[0],...windows.slice(2)]} presentation={presentation}/>);
  expect(screen.getByRole('meter',{name:'5-hour remaining'})).toBeInTheDocument();
});
it('shows two rings and wheels only the limit page, never the parent provider',()=>{
  const outer=vi.fn();
  render(<div onWheel={outer}><UsageWindowList windows={windows} presentation={{shape:'ring',content:'both',direction:'forward'}}/></div>);
  expect(screen.getAllByRole('meter')).toHaveLength(2);
  fireEvent.wheel(screen.getByLabelText('Usage limits'),{deltaY:100});
  expect(screen.getByRole('meter',{name:'Weekly remaining'})).toBeInTheDocument();
  expect(screen.queryByRole('meter',{name:'Session remaining'})).not.toBeInTheDocument();
  expect(outer).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Previous limits'}));
  expect(screen.getByRole('meter',{name:'Session remaining'})).toBeInTheDocument();
});
it('supports percentage-only without bars and bar-only without visible percentages',()=>{
  const {rerender}=render(<UsageWindowList windows={windows.slice(0,1)} presentation={{shape:'horizontal',content:'value',direction:'reverse'}}/>);
  expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  expect(screen.getByText('20% remaining')).toBeInTheDocument();
  rerender(<UsageWindowList windows={windows.slice(0,1)} presentation={{shape:'ring',content:'value',direction:'reverse'}}/>);
  expect(screen.getByLabelText('Usage limits')).toHaveAttribute('data-shape','none');
  rerender(<UsageWindowList windows={windows.slice(0,1)} presentation={{shape:'vertical',content:'bar',direction:'reverse'}}/>);
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow','20');
  expect(screen.queryByText('20% remaining')).not.toBeInTheDocument();
});

it.each(PROVIDER_PRESENTATION_IDENTITIES)('applies %s identity without changing the reported value',identity=>{
  const {container}=render(<UsageWindowList windows={windows.slice(0,1)} presentation={{shape:'ring',content:'both',direction:'forward',identity}}/>);
  expect(container.querySelector('.quota-window-list')).toHaveAttribute('data-provider-identity',identity);
  expect(container.querySelector('[role=meter]')).toHaveAttribute('aria-valuenow',String(windows[0].primaryValue));
});
