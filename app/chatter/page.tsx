'use client';
import {Suspense,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {SiteHeader} from '../site-header';
import {useGame} from '../game-provider';
import {useDiscussions,useThreads} from '../discussion-provider';
import {CommentComposer,DiscussionAccess,FocusedThread,SpoilerSettings,ThreadCard,UnreadBadge} from '../discussion-content';

export default function Chatter(){return <Suspense fallback={<main className="loading-screen">Loading Chatter…</main>}><ChatterContent/></Suspense>;}
function ChatterContent(){
  const {game}=useGame(),{catalog,eligible,error,loading,refresh,mutate,unreadCount}=useDiscussions(),params=useSearchParams();
  const [filter,setFilter]=useState(params.get('episode')?'episode':'all'),[selected,setSelected]=useState(''),[sort,setSort]=useState('activity'),[focused,setFocused]=useState(params.get('thread')??''),[marking,setMarking]=useState(false),[message,setMessage]=useState('');
  const available=catalog?.episodes.filter(episode=>episode.available)??[],latest=available.find(episode=>episode.season===game.season.number),choice=selected||params.get('episode')||latest?.id||'',episode=available.find(episode=>episode.id===choice)??latest;
  const scoped=filter==='current'?latest?.id:filter==='episode'?episode?.id:undefined;
  const threads=useThreads({episodeId:scoped,unread:filter==='unread',sort});
  const targetEpisode=focused.split('__')[0];
  async function markAll(){
    if(marking||!catalog)return;setMarking(true);setMessage('');
    const open=new Set(available.map(episode=>episode.id)),snapshot=Object.entries(catalog.unread).filter(([,state])=>open.has(state.episodeId));
    try{for(const [threadId,state] of snapshot)if(state.sequence)await mutate({action:'read',threadId,through:state.sequence});setMessage('All captured discussion activity marked read.');}catch(error){setMessage(error instanceof Error?error.message:'Could not save read status.');}finally{setMarking(false);}
  }
  return <main className="inner-page"><SiteHeader active="/chatter" subtitle="Your league around the campfire"/><section className="community-heading"><p className="eyebrow dark">Around the campfire</p><h1>Chatter</h1><p>Talk episodes with your league, even while scoring is catching up.</p><UnreadBadge count={unreadCount}/><SpoilerSettings/></section><div className="community-shell">{!eligible?<DiscussionAccess/>:<>{loading&&<p role="status">Loading discussions…</p>}{error&&<p role="alert">{error} <button onClick={()=>void refresh()}>Retry</button></p>}
    <section className="episode-comments"><h2>Start a conversation</h2>{episode?<><label className="thread-sort">Choose an episode<select value={episode.id} onChange={event=>setSelected(event.target.value)}>{available.map(item=><option value={item.id} key={item.id}>Season {item.season} · Episode {item.episode}</option>)}</select></label><CommentComposer key={episode.id} episodeId={episode.id} onPosted={setFocused}/><Link className="text-link" href={`/episodes?episode=${episode.id}`}>Read this episode’s recap →</Link></>:<p>No discussions have opened yet. They’ll appear automatically at their confirmed broadcast times.</p>}</section>
    <div className="chatter-toolbar"><div className="chatter-filters" role="group" aria-label="Filter conversations">{[['all','All Episodes'],['current','Current Episode'],['unread','Unread'],['episode','Selected Episode']].map(([id,label])=><button type="button" aria-pressed={filter===id} key={id} onClick={()=>{setFilter(id);setFocused('');}}>{label}</button>)}</div><label className="thread-sort">Sort<select value={sort} onChange={event=>setSort(event.target.value)}><option value="activity">Most recently active</option><option value="newest">Newest conversations</option></select></label><button type="button" disabled={marking||!unreadCount} onClick={()=>void markAll()}>{marking?'Saving…':'Mark all read'}</button></div>
    {focused&&<FocusedThread key={focused} threadId={focused} episodeId={targetEpisode}/>}<div className="chatter-threads">{threads.rows.filter(thread=>thread.id!==focused).map(thread=><ThreadCard key={thread.id} thread={thread}/>)}</div>{threads.loading&&<p role="status">Loading conversations…</p>}{threads.error&&<p role="alert">{threads.error} <button onClick={()=>void refresh()}>Retry</button></p>}{!threads.loading&&!threads.error&&!threads.rows.length&&!focused&&<p className="chatter-empty">{filter==='unread'?'You’re caught up.':'No conversations here yet. Start one above.'}</p>}{threads.cursor&&<button type="button" disabled={threads.loading} onClick={()=>void threads.loadMore()}>Load older conversations</button>}{message&&<p role="status">{message}</p>}
  </>}</div></main>;
}
