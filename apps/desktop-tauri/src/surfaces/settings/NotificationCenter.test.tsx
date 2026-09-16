import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import NotificationCenter from './NotificationCenter';
import {demoNotificationEvents,unreadBadge} from '../../lib/notificationHistory';
import type {NotificationHistoryState} from '../../hooks/useNotificationHistory';
vi.mock('../../hooks/useLocale',()=>({useLocale:()=>({t:(key:string)=>key,language:'english'}),useOptionalLocale:()=>null}));
function history():NotificationHistoryState {return {page:{items:demoNotificationEvents(1700000000),unreadCount:3,throughId:3,hasMore:false},query:{},loading:false,failed:false,setQuery:vi.fn(),reload:vi.fn(),loadMore:vi.fn(),markRead:vi.fn()};}
it('shows unknown occurrence times separately and never renders opaque account keys',()=>{
 const h=history();h.page.items[0].accountRef='private-opaque-reference';
 render(<NotificationCenter history={h} demo={false} catalog={[]}/>);
 expect(screen.getAllByText('HistoryUnknownTime')).toHaveLength(3);
 expect(screen.getAllByText('HistoryReceived')).toHaveLength(3);
 expect(screen.getAllByText('HistoryDetected')).toHaveLength(3);
 expect(screen.queryByText('private-opaque-reference')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'HistoryMarkAll'}));expect(h.markRead).toHaveBeenCalledWith();
 fireEvent.click(screen.getByRole('button',{name:'HistoryMarkRead: codex fiveHour'}));expect(h.markRead).toHaveBeenCalledWith(3);
});
it('clearly identifies Demo and submits search only when requested',()=>{
 const h=history();render(<NotificationCenter history={h} demo catalog={[]}/>);
 expect(screen.getByRole('status')).toHaveTextContent('DemoIndicatorBadge');
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'spark'}});
 expect(h.setQuery).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'HistorySearch'}));expect(h.setQuery).toHaveBeenCalledWith({search:'spark'});
});
it.each([[0,'0'],[1,'1'],[99,'99'],[100,'+99'],[5000,'+99']] as const)('formats unread %i as %s',(count,label)=>expect(unreadBadge(count)).toBe(label));
it('labels alert severity and explains alert evidence without reusing the reset interval copy',()=>{
 const h=history();
 h.page.items=[{...h.page.items[0],id:9,kind:'usageCriticalReached',severity:'critical',previousValue:90,currentValue:94,occurredAt:1700000000,observedFrom:1700000000,observedTo:1700000000}];
 const {container}=render(<NotificationCenter history={h} demo={false} catalog={[]}/>);
 expect(screen.getByText('HistoryUsageCriticalReached')).toBeInTheDocument();
 expect(screen.getByText('HistorySeverityCritical')).toBeInTheDocument();
 expect(screen.getByText('HistoryAlertEvidence')).toBeInTheDocument();
 expect(screen.queryByText('HistoryObservationInterval')).toBeNull();
 expect(container.querySelector('[data-severity="critical"]')).not.toBeNull();
 expect(screen.getByText('90% → 94%')).toBeInTheDocument();
});
it('shows the shared loading skeleton on first load instead of an empty message',()=>{
 const h=history();h.loading=true;h.page={items:[],unreadCount:0,throughId:0,hasMore:false};
 render(<NotificationCenter history={h} demo={false} catalog={[]}/>);
 expect(screen.getByRole('status',{name:'HistoryLoading'})).toBeInTheDocument();
 expect(screen.queryByText('HistoryEmpty')).toBeNull();
});
