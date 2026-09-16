import {invoke} from '@tauri-apps/api/core';

export type JournalEventKind = 'scheduledResetObserved'|'unexpectedQuotaChange'|'bankedResetsIncreased'|'bankedResetsDecreased'|'usageHighReached'|'usageCriticalReached'|'usageExhausted';
/** Derived by the backend from what was observed; provider accent never changes it. */
export type NotificationSeverity = 'info'|'warning'|'critical';
export const isAlertKind=(kind:JournalEventKind)=>kind.startsWith('usage');
/** All timestamps are Unix seconds. Account references are opaque, never emails. */
export interface NotificationEvent {
  id:number; providerId:string; accountRef:string|null; windowKey:string; kind:JournalEventKind;
  occurredAt:number|null; detectedAt:number; receivedAt:number; observedFrom:number; observedTo:number;
  previousValue:number; currentValue:number; isRead:boolean; severity:NotificationSeverity;
}
export interface NotificationQuery {beforeId?:number;limit?:number;providerId?:string;unreadOnly?:boolean;search?:string}
export interface NotificationPage {items:NotificationEvent[];unreadCount:number;throughId:number;hasMore:boolean}
export const emptyNotificationPage=():NotificationPage=>({items:[],unreadCount:0,throughId:0,hasMore:false});
export const getNotificationHistory=(query:NotificationQuery)=>invoke<NotificationPage>('get_notification_history',{query});
export const markNotificationRead=(id:number)=>invoke<boolean>('mark_notification_read',{id});
export const markAllNotificationsRead=(throughId:number)=>invoke<number>('mark_all_notifications_read',{throughId});
export function unreadBadge(count:number):string {return count>99?'+99':String(Math.max(0,count));}

/** Local-only scenario: never inserted in the real journal or sent as a toast. */
export function demoNotificationEvents(now:number):NotificationEvent[] {
  return [
    {providerId:'codex',windowKey:'fiveHour',kind:'scheduledResetObserved',previousValue:94,currentValue:0,severity:'info'},
    {providerId:'claude',windowKey:'reset-credits',kind:'bankedResetsIncreased',previousValue:0,currentValue:2,severity:'info'},
    {providerId:'codex',windowKey:'codex-spark-five-hour',kind:'unexpectedQuotaChange',previousValue:75,currentValue:5,severity:'warning'},
  ].map((event,index)=>({...event,kind:event.kind as JournalEventKind,severity:event.severity as NotificationSeverity,id:3-index,accountRef:null,occurredAt:null,
    detectedAt:now-index*3600,receivedAt:now-index*3600,observedFrom:now-index*3600-300,observedTo:now-index*3600,isRead:false}));
}
