'use client';
import {useRef,useSyncExternalStore,type KeyboardEvent,type ReactNode} from 'react';
import {adminTabs,tabFromHash,tabForKey,type AdminTabId} from '@/lib/admin-navigation';

function subscribe(callback:()=>void){window.addEventListener('hashchange',callback);return ()=>window.removeEventListener('hashchange',callback);}
function snapshot(){return tabFromHash(window.location.hash);}
function serverSnapshot():AdminTabId{return 'scoring';}

export function AdminTabs({panels}:{panels:Record<AdminTabId,ReactNode>}){
  const active=useSyncExternalStore(subscribe,snapshot,serverSnapshot);
  const buttons=useRef<Partial<Record<AdminTabId,HTMLButtonElement|null>>>({});
  function select(id:AdminTabId){window.location.assign('#'+id);}
  function keyboard(event:KeyboardEvent<HTMLButtonElement>,id:AdminTabId){
    const next=tabForKey(id,event.key);
    if(next){event.preventDefault();select(next);buttons.current[next]?.focus();}
  }
  return <div className="admin-workspace">
    <div className="admin-tabs-bar" role="tablist" aria-label="Game master sections">
      {adminTabs.map(tab=><button key={tab.id} ref={node=>{buttons.current[tab.id]=node;}} id={'tab-'+tab.id} role="tab" type="button" aria-selected={active===tab.id} aria-controls={'panel-'+tab.id} tabIndex={active===tab.id?0:-1} onClick={()=>select(tab.id)} onKeyDown={e=>keyboard(e,tab.id)}>{tab.label}</button>)}
    </div>
    {/* Keep forms mounted while hidden, so switching sections doesn't discard unsaved inputs. */}
    {adminTabs.map(tab=><section key={tab.id} id={'panel-'+tab.id} role="tabpanel" aria-labelledby={'tab-'+tab.id} tabIndex={0} hidden={active!==tab.id} className="admin-tab-panel">{panels[tab.id]}</section>)}
  </div>;
}
