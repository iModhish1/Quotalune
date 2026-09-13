import {useEffect, useState, type ReactNode} from "react";
import {useLocale} from "../../hooks/useLocale";
import type {SettingsTabId} from "../../types/bridge";
import {PRIMARY_GROUPS, SETTINGS_CATEGORIES, primaryDestination} from "./settingsCenterRegistry";
import {TAB_META} from "./settingsTabs";
import {unreadBadge} from '../../lib/notificationHistory';
const labels = new Map(TAB_META.map(tab => [tab.id, tab.labelKey]));

/** Task workspaces with a compact, expandable general Settings hierarchy. */
export default function ProductNavigation({activeTab,onNavigate,icons,hidden=false,unreadCount=0}: {
  activeTab:SettingsTabId;onNavigate:(tab:SettingsTabId)=>void;
  icons:Partial<Record<SettingsTabId,ReactNode>>;hidden?:boolean;unreadCount?:number;
}) {
  const {t}=useLocale();const primary=primaryDestination(activeTab);
  const [expanded,setExpanded]=useState(primary==='settings');
  useEffect(()=>setExpanded(primary==='settings'),[primary]);
  return <nav id="product-navigation" hidden={hidden} className="settings-tabs product-nav" aria-label={t('V2PrimaryNavigation')}
    onKeyDown={event=>{
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')].filter(b=>!b.closest('[hidden]'));
      const index=buttons.indexOf(document.activeElement as HTMLButtonElement);if(index<0)return;
      event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
      buttons[next]?.focus();
    }}>
    {PRIMARY_GROUPS.map(group=><div className="settings-nav-group" key={group.labelKey}>
      <span className="settings-nav-group__label">{t(group.labelKey)}</span>
      {group.tabs.map(tab=><div className="product-nav__branch" key={tab.id}>
        <button type="button" id={`settings-tab-${tab.id}`} aria-controls={tab.id==='settings'?'product-nav-settings':'settings-active-panel'}
          aria-expanded={tab.id==='settings'?expanded:undefined} aria-current={primary===tab.id?'page':undefined}
          className={`settings-tab ${primary===tab.id?'settings-tab--active':''}`}
          onClick={()=>{if(tab.id==='settings'){setExpanded(primary==='settings'?!expanded:true);if(primary!=='settings')onNavigate(tab.target);}else{setExpanded(false);onNavigate(tab.target);}}}>
          <span className="settings-tab__icon" aria-hidden="true">{icons[tab.target]}</span><span className="settings-tab__label">{t(tab.labelKey)}</span>
          {tab.id==='notifications'&&unreadCount>0&&<span className="notification-unread" aria-label={`${t('HistoryUnread')}: ${unreadCount}`}><bdi>{unreadBadge(unreadCount)}</bdi></span>}
          {tab.id==='settings'&&<span className="product-nav__chevron" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 5 7 7-7 7"/></svg></span>}
        </button>
        {tab.id==='settings'&&<div id="product-nav-settings" className="product-nav__children" hidden={!expanded}>
          {SETTINGS_CATEGORIES.map(category=><div key={category.id} className="product-nav__category">
            {category.tabs.length>1&&<span className="product-nav__caption">{t(category.labelKey)}</span>}
            {category.tabs.map(id=><button key={id} type="button" className="product-nav__leaf" aria-current={activeTab===id?'page':undefined} onClick={()=>onNavigate(id)}>
              <span className="product-nav__leaf-icon" aria-hidden="true">{icons[id]}</span><span>{t(labels.get(id)!)}</span>
            </button>)}
          </div>)}
        </div>}
      </div>)}
    </div>)}
  </nav>;
}
