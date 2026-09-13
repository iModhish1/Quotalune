import {act,renderHook,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {useNotificationHistory} from './useNotificationHistory';
import {demoNotificationEvents,emptyNotificationPage,getNotificationHistory,markAllNotificationsRead,markNotificationRead,type NotificationPage} from '../lib/notificationHistory';
vi.mock('@tauri-apps/api/event',()=>({listen:vi.fn().mockResolvedValue(()=>{})}));
vi.mock('../lib/notificationHistory',async original=>({...await original<typeof import('../lib/notificationHistory')>(),getNotificationHistory:vi.fn(),markNotificationRead:vi.fn().mockResolvedValue(true),markAllNotificationsRead:vi.fn().mockResolvedValue(3)}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(getNotificationHistory).mockResolvedValue({...emptyNotificationPage(),items:demoNotificationEvents(1700000000),unreadCount:3,throughId:9});});
it('Demo reads and mark-all actions never call real IPC',async()=>{
 const {result}=renderHook(()=>useNotificationHistory(true));
 await waitFor(()=>expect(result.current.page.items).toHaveLength(3));
 await act(()=>result.current.markRead());
 await waitFor(()=>expect(result.current.page.unreadCount).toBe(0));
 expect(getNotificationHistory).not.toHaveBeenCalled();expect(markAllNotificationsRead).not.toHaveBeenCalled();expect(markNotificationRead).not.toHaveBeenCalled();
});
it('uses the captured global boundary for mark-all even with a provider filter',async()=>{
 const {result}=renderHook(()=>useNotificationHistory(false));
 await waitFor(()=>expect(result.current.page.throughId).toBe(9));
 act(()=>result.current.setQuery({providerId:'claude',unreadOnly:true}));
 await waitFor(()=>expect(getNotificationHistory).toHaveBeenLastCalledWith({providerId:'claude',unreadOnly:true,beforeId:undefined,limit:40}));
 await waitFor(()=>expect(result.current.loading).toBe(false));
 await act(()=>result.current.markRead());
 expect(markAllNotificationsRead).toHaveBeenCalledExactlyOnceWith(9);
});
it('discards an in-flight real reply when entering Demo',async()=>{
 let finish!:(page:NotificationPage)=>void;
 vi.mocked(getNotificationHistory).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const {result,rerender}=renderHook(({demo})=>useNotificationHistory(demo),{initialProps:{demo:false}});
 rerender({demo:true});
 await waitFor(()=>expect(result.current.page.items).toHaveLength(3));
 await act(async()=>finish({...emptyNotificationPage(),items:[{...demoNotificationEvents(1700000000)[0],id:999,providerId:'private-real-provider'}],unreadCount:1}));
 expect(result.current.page.items.every(item=>item.providerId!=='private-real-provider')).toBe(true);
});
it('loads older events using the last ID and retains the new unread count',async()=>{
 vi.mocked(getNotificationHistory).mockResolvedValueOnce({...emptyNotificationPage(),items:demoNotificationEvents(1700000000).slice(0,2),hasMore:true,throughId:3,unreadCount:3});
 const {result}=renderHook(()=>useNotificationHistory(false));
 await waitFor(()=>expect(result.current.page.items).toHaveLength(2));
 vi.mocked(getNotificationHistory).mockResolvedValueOnce({...emptyNotificationPage(),items:demoNotificationEvents(1700000000).slice(2),throughId:3,unreadCount:2});
 await act(()=>result.current.loadMore());
 expect(getNotificationHistory).toHaveBeenLastCalledWith({beforeId:2,limit:40});
 expect(result.current.page.items.map(item=>item.id)).toEqual([3,2,1]);expect(result.current.page.unreadCount).toBe(2);
});
it('fails visibly without rendering raw IPC errors',async()=>{
 vi.mocked(getNotificationHistory).mockRejectedValueOnce(new Error('private credential/path must not render'));
 const {result}=renderHook(()=>useNotificationHistory(false));
 await waitFor(()=>expect(result.current.failed).toBe(true));
 expect(result.current.page).toEqual(emptyNotificationPage());
});
it('keeps the latest provider filter when a pending read action completes',async()=>{
 let finish!:(changed:boolean)=>void;
 vi.mocked(markNotificationRead).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 vi.mocked(getNotificationHistory).mockImplementation(async query=>({...emptyNotificationPage(),items:demoNotificationEvents(1700000000).filter(item=>!query.providerId||item.providerId===query.providerId),unreadCount:3,throughId:3}));
 const {result}=renderHook(()=>useNotificationHistory(false));
 await waitFor(()=>expect(result.current.page.items).toHaveLength(3));
 let mutation!:Promise<void>;
 act(()=>{mutation=result.current.markRead(3);});
 act(()=>result.current.setQuery({providerId:'claude'}));
 await waitFor(()=>expect(result.current.page.items).toHaveLength(1));
 await act(async()=>{finish(true);await mutation;});
 expect(result.current.query.providerId).toBe('claude');
 expect(result.current.page.items.map(item=>item.providerId)).toEqual(['claude']);
});
