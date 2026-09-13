import {useState} from 'react';
import {useLocale} from '../../hooks/useLocale';
import type {NotificationHistoryState} from '../../hooks/useNotificationHistory';
import type {ProviderCatalogEntry} from '../../types/bridge';
import type {JournalEventKind} from '../../lib/notificationHistory';
import {unreadBadge} from '../../lib/notificationHistory';
import type {LocaleKey} from '../../i18n/keys';
import {ProviderIcon} from '../../components/providers/ProviderIcon';
import {Select} from '../../components/FormControls';
import './NotificationCenter.css';

const titles:Record<JournalEventKind,LocaleKey>={scheduledResetObserved:'HistoryScheduledReset',unexpectedQuotaChange:'HistoryQuotaChange',bankedResetsIncreased:'HistoryBankedIncreased',bankedResetsDecreased:'HistoryBankedDecreased'};
export default function NotificationCenter({history,demo,catalog}: {history:NotificationHistoryState;demo:boolean;catalog:ProviderCatalogEntry[]}) {
  const {t,language}=useLocale();
  const [search,setSearch]=useState('');
  const {page,loading,failed,query}=history;
  const format=(seconds:number|null)=>seconds===null?t('HistoryUnknownTime'):new Date(seconds*1000).toLocaleString(language==='arabic'?'ar-SA':'en-US');
  const names=new Map(catalog.map(provider=>[provider.id,provider.displayName]));
  return <section className="notification-center" aria-labelledby="notification-center-title" aria-busy={loading}>
    <header className="notification-center__header"><div><h2 id="notification-center-title">{t('HistoryTitle')}</h2><p>{t('HistoryCoverage')}</p></div>
      {page.unreadCount>0&&<span className="notification-unread" aria-label={`${t('HistoryUnread')}: ${page.unreadCount}`}><bdi>{unreadBadge(page.unreadCount)}</bdi></span>}
      <button type="button" disabled={loading} onClick={()=>void history.reload()}>{t('ActionRefresh')}</button>
      <button type="button" disabled={loading||!page.unreadCount} onClick={()=>void history.markRead()}>{t('HistoryMarkAll')}</button>
    </header>
    {demo&&<p className="demo-indicator__badge" role="status">{t('DemoIndicatorBadge')} · {t('HistoryDemo')}</p>}
    <form className="notification-center__filters" onSubmit={event=>{event.preventDefault();history.setQuery({...query,search:search.trim()});}}>
      <label><span>{t('HistorySearch')}</span><input type="search" maxLength={80} value={search} onChange={event=>setSearch(event.target.value)}/></label>
      <button type="submit">{t('HistorySearch')}</button>
      <Select ariaLabel={t('TabProviders')} value={query.providerId??''} options={[{value:'',label:t('HistoryAllProviders')},...catalog.map(provider=>({value:provider.id,label:provider.displayName}))]} onChange={providerId=>history.setQuery({...query,providerId:providerId||undefined})}/>
      <button type="button" role="switch" aria-checked={Boolean(query.unreadOnly)} onClick={()=>history.setQuery({...query,unreadOnly:!query.unreadOnly})}>{t('HistoryUnreadOnly')}</button>
    </form>
    {failed&&<p role="alert">{t('HistoryLoadFailed')}</p>}
    {!failed&&!loading&&!page.items.length&&<p role="status" className="notification-center__empty">{t('HistoryEmpty')}</p>}
    <ol className="notification-center__list">
      {page.items.map(item=><li key={item.id} className="notification-center__event" data-unread={!item.isRead}>
        <ProviderIcon providerId={item.providerId} size={32}/>
        <div className="notification-center__event-content"><header><strong>{t(titles[item.kind])}</strong><span><bdi>{names.get(item.providerId)??item.providerId} · {item.windowKey}</bdi></span></header>
          <p className="notification-center__values"><bdi>{item.previousValue}{item.kind.includes('banked')?'':'%'} → {item.currentValue}{item.kind.includes('banked')?'':'%'}</bdi></p>
          <dl><div><dt>{t('HistoryOccurred')}</dt><dd>{format(item.occurredAt)}</dd></div><div><dt>{t('HistoryDetected')}</dt><dd>{format(item.detectedAt)}</dd></div><div><dt>{t('HistoryReceived')}</dt><dd>{format(item.receivedAt)}</dd></div></dl>
          <details><summary>{t('HistoryEvidence')}</summary><p>{t('HistoryObservationInterval')}</p><p><bdi>{format(item.observedFrom)} — {format(item.observedTo)}</bdi></p><p>{t(item.accountRef?'HistoryAccountScoped':'HistoryAccountUnknown')}</p><code>{item.windowKey} · {item.kind} · #{item.id}</code></details>
        </div>
        {!item.isRead?<button type="button" disabled={loading} aria-label={`${t('HistoryMarkRead')}: ${names.get(item.providerId)??item.providerId} ${item.windowKey}`} onClick={()=>void history.markRead(item.id)}>{t('HistoryMarkRead')}</button>:<span className="notification-center__read">{t('HistoryRead')}</span>}
      </li>)}
    </ol>
    {page.hasMore&&<button type="button" disabled={loading} onClick={()=>void history.loadMore()}>{t('HistoryLoadMore')}</button>}
    <p className="notification-center__retention">{t('HistoryRetention')}</p>
  </section>;
}
