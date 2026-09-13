import {useCallback,useEffect,useRef,useState} from 'react';
import {listen} from '@tauri-apps/api/event';
import {demoNotificationEvents,emptyNotificationPage,getNotificationHistory,markAllNotificationsRead,markNotificationRead,type NotificationPage,type NotificationQuery} from '../lib/notificationHistory';

/** One owner per Settings surface shares unread state with the page and sidebar. */
export function useNotificationHistory(demo:boolean) {
  const [query,setQuery]=useState<NotificationQuery>({});
  const [page,setPage]=useState<NotificationPage>(emptyNotificationPage);
  const [loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
  const [demoItems,setDemoItems]=useState(()=>demoNotificationEvents(Math.floor(Date.now()/1000)));
  const generation=useRef(0), mounted=useRef(true), mode=useRef(demo);mode.current=demo;
  const visibleMode=useRef(demo);
  const load=useCallback(async(beforeId?:number)=>{
    const request=++generation.current;
    setLoading(true);setFailed(false);
    try {
      let next:NotificationPage;
      if(demo){
        const filtered=demoItems.filter(item=>(!query.providerId||item.providerId===query.providerId)&&(!query.unreadOnly||!item.isRead)&&`${item.providerId} ${item.windowKey} ${item.kind}`.toLowerCase().includes((query.search??'').toLowerCase()));
        next={items:filtered,unreadCount:demoItems.filter(item=>!item.isRead).length,throughId:3,hasMore:false};
      } else next=await getNotificationHistory({...query,beforeId,limit:40});
      if(!mounted.current||request!==generation.current||mode.current!==demo)return;
      visibleMode.current=demo;
      setPage(previous=>beforeId?{...next,items:[...previous.items,...next.items.filter(item=>!previous.items.some(old=>old.id===item.id))]}:next);
    }catch{
      if(mounted.current&&request===generation.current){setFailed(true);setPage(emptyNotificationPage());}
    }finally{if(mounted.current&&request===generation.current)setLoading(false);}
  },[demo,demoItems,query]);
  const latestLoad=useRef(load);latestLoad.current=load;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
  useEffect(()=>{void load();return()=>{generation.current++;};},[load]);
  useEffect(()=>{
    if(demo)return;
    let disposed=false;const stops:(()=>void)[]=[];
    for(const name of ['refresh-complete','notification-history-changed'])
      void Promise.resolve(listen(name,()=>void load())).then(stop=>{if(disposed)stop?.();else if(stop)stops.push(stop);}).catch(()=>{});
    const refresh=()=>{if(document.visibilityState==='visible')void load();};
    document.addEventListener('visibilitychange',refresh);
    return()=>{disposed=true;stops.forEach(stop=>stop());document.removeEventListener('visibilitychange',refresh);};
  },[demo,load]);
  const markRead=async(id?:number)=>{
    if(loading)return;
    const capturedMode=demo, throughId=page.throughId;
    setLoading(true);setFailed(false);
    try {
      if(demo)setDemoItems(items=>items.map(item=>(id===undefined?item.id<=throughId:item.id===id)?{...item,isRead:true}:item));
      else {
        if(id===undefined)await markAllNotificationsRead(throughId);else await markNotificationRead(id);
        if(mode.current===capturedMode&&mounted.current)await latestLoad.current();
      }
    }catch{if(mode.current===capturedMode&&mounted.current)setFailed(true);}
    finally{if(mode.current===capturedMode&&mounted.current)setLoading(false);}
  };
  // A mode switch must never briefly show real history underneath a Demo badge.
  return {page:visibleMode.current===demo?page:emptyNotificationPage(),loading,failed,query,setQuery,
    reload:()=>load(),loadMore:()=>load(page.items[page.items.length-1]?.id),markRead};
}
export type NotificationHistoryState=ReturnType<typeof useNotificationHistory>;
