'use client';
import Link from 'next/link';
import {AuthControls} from './auth-controls';
import {useGame} from './game-provider';
import {useCurrentSeasonOpenPolls} from './community-polls';
import {useDiscussions} from './discussion-provider';
export function SiteHeader({active,subtitle}:{active:string;subtitle:string}){
  const {game}=useGame();
  const {unreadCount}=useDiscussions();
  const {rows:openPolls}=useCurrentSeasonOpenPolls();
  const draftLive=game.draft.status==='live';
  const links=[
    {href:'/',label:'Standings'},
    {href:'/draft',label:'Draft'},
    {href:'/episodes',label:'Episodes'},
    {href:'/chatter',label:'Chatter'},
    {href:'/castaways',label:'Castaways'},
    {href:'/history',label:'All-time'},
    {href:'/rules',label:'Rules'},
    {href:'/admin',label:'Game master'},
  ];
  return <header className="site-header"><Link className="brand" href="/"><span><strong>Fantasy Survivor 51</strong><small>{subtitle}</small></span></Link><nav aria-label="Main navigation">{links.map(({href,label})=><Link key={href} href={href} className={`nav-link ${href===active?'active ':''}${href==='/admin'?'admin-link':''}`} aria-current={href===active?'page':undefined}>{href==='/draft'&&draftLive&&<span className="nav-live-dot" aria-hidden="true"/>}<span>{label}</span>{href==='/draft'&&draftLive&&<span className="nav-status-live">LIVE</span>}{href==='/chatter'&&unreadCount>0&&<span className="nav-poll-count" aria-label={unreadCount+' unread comments'}>{unreadCount>99?'99+':unreadCount}</span>}{href==='/episodes'&&openPolls.length>0&&<span className="nav-poll-count" aria-label={`${openPolls.length} open poll${openPolls.length===1?'':'s'}`}>{openPolls.length>9?'9+':openPolls.length}</span>}</Link>)}</nav><AuthControls compact/></header>;
}
