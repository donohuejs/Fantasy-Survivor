'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {DiscussionComment,EpisodeView,ThreadPreview} from '@/lib/discussions';
import {useGame} from './game-provider';
import {discussionRequest,useConversation,useDiscussions,useThreads} from './discussion-provider';
import {PlayerName} from './player-name';

const formatted=(value:string)=>new Date(value).toLocaleString();
const initial=(value:string)=>value.trim().charAt(0).toUpperCase()||'•';
export function threadHref(thread:Pick<ThreadPreview,'id'|'episodeId'>){return `/chatter?episode=${encodeURIComponent(thread.episodeId)}&thread=${encodeURIComponent(thread.id)}`;}
export function UnreadBadge({count,personal=0}:{count:number;personal?:number}){return <>{count>0&&<span className="chatter-unread">{count} unread</span>}{personal>0&&<span className="chatter-personal" aria-label={`${personal} unread replies to you`}>↳ {personal} to you</span>}</>;}
export function DiscussionAccess(){
  const {user,cloud,login}=useGame();
  return <p className="discussion-access">{!cloud?'Connect Firebase to use league discussions.':user?'Your Google account must be linked to a league profile in Player check-in to join discussions.':<button type="button" onClick={login}>Sign in with Google to join the conversation</button>}</p>;
}
export function SpoilerSettings(){
  const {catalog,eligible,mutate}=useDiscussions(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!eligible)return null;
  async function change(value:boolean){setBusy(true);setError('');try{await mutate({action:'preferences',hideSpoilers:value});}catch(error){setError(error instanceof Error?error.message:'Could not save preference.');}finally{setBusy(false);}}
  return <div className="spoiler-settings"><label><input type="checkbox" checked={catalog?.hideSpoilers??false} disabled={busy||!catalog} onChange={event=>void change(event.target.checked)}/> Hide spoilers for unwatched episodes</label>{busy&&<small role="status">Saving preference…</small>}{error&&<p role="alert">{error}</p>}</div>;
}
export function WatchedControl({episode}:{episode:EpisodeView}){
  const {mutate}=useDiscussions(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function change(){setBusy(true);setError('');try{await mutate({action:'watched',episodeId:episode.id,watched:!episode.watched});}catch(error){setError(error instanceof Error?error.message:'Could not save watched status.');}finally{setBusy(false);}}
  return <div className="watched-control"><button type="button" disabled={busy} onClick={()=>void change()}>{episode.watched?'✓ Watched · mark unwatched':'Mark episode watched'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
export function SpoilerWarning({episode}:{episode:EpisodeView}){
  const {reveal}=useDiscussions();
  return <section className="spoiler-warning" aria-label={`Spoiler warning for Episode ${episode.episode}`}><p className="eyebrow dark">Season {episode.season} · Episode {episode.episode}</p><h2>Haven’t watched this one yet?</h2><p>The recap and conversations may contain spoilers. Reveal this episode when you’re ready.</p><UnreadBadge count={episode.unreadCount}/><div className="community-actions"><button type="button" onClick={()=>reveal(episode.id)}>Reveal this episode</button><WatchedControl episode={episode}/></div></section>;
}

export function CommentComposer({episodeId,replyToCommentId='',replyName='',initialText='',edit,onPosted,onCancel}:{episodeId:string;replyToCommentId?:string;replyName?:string;initialText?:string;edit?:DiscussionComment;onPosted?:(threadId:string)=>void;onCancel?:()=>void}){
  const {eligible,refresh}=useDiscussions();
  const [text,setText]=useState(initialText),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const locked=useRef(false),attempt=useRef<{id:string;fingerprint:string}|null>(null),textarea=useRef<HTMLTextAreaElement>(null);
  async function submit(event:FormEvent){
    event.preventDefault();if(locked.current||!text.trim())return;locked.current=true;setBusy(true);setMessage('');setError('');
    const fingerprint=JSON.stringify([episodeId,replyToCommentId,text]);if(attempt.current?.fingerprint!==fingerprint)attempt.current={id:crypto.randomUUID(),fingerprint};
    try{
      const result=await discussionRequest<{threadId?:string}>({action:edit?'edit':'post',episodeId,id:edit?.id??attempt.current!.id,text,replyToCommentId,...(edit?{expectedUpdatedAt:edit.updatedAt??edit.createdAt}:{})});
      setText('');attempt.current=null;setMessage(edit?'Comment updated.':replyToCommentId?'Reply posted.':'Conversation started.');await refresh();onPosted?.(result.threadId??edit?.threadId??'');textarea.current?.focus();
    }catch(error){setError(error instanceof Error?error.message:'Could not save. Retry your message.');}finally{locked.current=false;setBusy(false);}
  }
  if(!eligible)return <DiscussionAccess/>;
  return <form className="community-form chatter-composer" onSubmit={submit} lang="en"><label>{edit?'Edit comment':replyToCommentId?`Reply${replyName?' to '+replyName:''}`:'Start a conversation'}<textarea ref={textarea} value={text} onChange={event=>setText(event.target.value)} maxLength={2000} rows={3} required disabled={busy} placeholder={replyToCommentId?'Add your reply…':'What did you think of the episode?'} spellCheck autoCorrect="on" autoCapitalize="sentences" lang="en"/></label><div className="community-actions"><button disabled={busy||!text.trim()}>{busy?'Saving…':edit?'Save changes':replyToCommentId?'Post reply':'Start conversation'}</button>{onCancel&&<button type="button" disabled={busy} onClick={onCancel}>Cancel</button>}<small>{text.length}/2,000</small></div>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error} Your text is kept; submit again to retry.</p>}</form>;
}

function Comment({comment,episodeId,onReply}:{comment:DiscussionComment;episodeId:string;onReply:(comment:DiscussionComment)=>void}){
  const {game,user,isAdmin}=useGame(),{mutate}=useDiscussions();
  const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const player=game.players.find(player=>player.uid?player.uid===user?.uid:Boolean(player.email)&&player.email.toLowerCase()===user?.email?.toLowerCase()),author=game.players.find(player=>player.id===comment.authorId);
  async function remove(){if(!window.confirm('Delete this comment? Replies will remain in the conversation.'))return;setBusy(true);setError('');try{await mutate({action:'delete',episodeId,id:comment.id});}catch(error){setError(error instanceof Error?error.message:'Could not delete comment.');}finally{setBusy(false);}}
  return <article className={`episode-comment ${comment.id===comment.rootId?'chatter-parent':'chatter-reply'}`} data-sequence={comment.sequence}><header><strong>{author?<PlayerName id={author.id} name={author.name} history={game.history}/>:comment.authorName}</strong><time dateTime={comment.createdAt}>{formatted(comment.createdAt)}{comment.updatedAt&&!comment.deletedAt?' · edited':''}</time></header>{comment.deletedAt?<p className="community-note">Comment deleted. Replies remain below.</p>:editing?<CommentComposer episodeId={episodeId} initialText={comment.text} edit={comment} onPosted={()=>setEditing(false)} onCancel={()=>setEditing(false)}/>:<>{comment.replyToName&&comment.id!==comment.rootId&&<small className="reply-context">Replying to {comment.replyToName}</small>}<p className="community-prose">{comment.text}</p><div className="comment-controls"><button type="button" onClick={()=>onReply(comment)}>Reply</button>{(isAdmin||player?.id===comment.authorId)&&<><button type="button" disabled={busy} onClick={()=>setEditing(true)}>Edit</button><button type="button" className="comment-remove" disabled={busy} onClick={()=>void remove()}>Delete</button></>}</div></>}{error&&<p role="alert">{error}</p>}</article>;
}

function ConversationContents({threadId,episodeId,reveal}:{threadId:string;episodeId:string;reveal:boolean}){
  const conversation=useConversation(threadId,reveal),{refresh,mutate}=useDiscussions();
  const [reply,setReply]=useState<DiscussionComment|null>(null),[readError,setReadError]=useState('');
  const container=useRef<HTMLDivElement>(null),seen=useRef(new Set<number>()),acknowledged=useRef(0),pending=useRef(false);
  const page=conversation.page;
  useEffect(()=>{
    if(!page||page.spoilerHidden||!container.current)return;
    let active=true;
    async function acknowledge(){
      if(pending.current||document.visibilityState!=='visible')return;
      let through=acknowledged.current;while(seen.current.has(through+1))through++;
      if(through===acknowledged.current)return;pending.current=true;
      try{await discussionRequest({action:'read',threadId,through});acknowledged.current=through;if(active){setReadError('');await refresh();}}
      catch(error){if(active)setReadError(error instanceof Error?error.message:'Read status could not save.');}finally{pending.current=false;}
    }
    const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting&&entry.intersectionRect.height>=Math.min(80,entry.boundingClientRect.height))seen.current.add(Number((entry.target as HTMLElement).dataset.sequence));void acknowledge();},{threshold:[0,.1,.5,1]});
    for(const element of container.current.querySelectorAll('[data-sequence]'))observer.observe(element);
    const visible=()=>void acknowledge();document.addEventListener('visibilitychange',visible);
    return()=>{active=false;observer.disconnect();document.removeEventListener('visibilitychange',visible);};
  },[page,threadId,refresh]);
  function chooseReply(comment:DiscussionComment){setReply(comment);window.requestAnimationFrame(()=>container.current?.querySelector<HTMLTextAreaElement>('.thread-reply-composer textarea')?.focus());}
  if(conversation.loading&&!page)return <p role="status">Loading conversation…</p>;
  if(conversation.error)return <p role="alert">{conversation.error} <button onClick={()=>void refresh()}>Retry</button></p>;
  if(!page)return null;
  if(page.spoilerHidden)return <p>Previews are hidden to avoid spoilers. Reveal this episode to read and reply.</p>;
  return <div className="thread-conversation" ref={container}>{page.comments.map(comment=><Comment key={comment.id} comment={comment} episodeId={episodeId} onReply={chooseReply}/>)}{page.hasMore&&<button type="button" disabled={conversation.loading} onClick={()=>void conversation.loadMore()}>{conversation.loading?'Loading…':'Load more replies'}</button>}<div className="thread-reply-composer"><CommentComposer key={reply?.id??'parent'} episodeId={episodeId} replyToCommentId={reply?.id??page.thread.rootId} replyName={reply?.authorName} onPosted={()=>setReply(null)} onCancel={reply?()=>setReply(null):undefined}/></div>{readError&&<p role="alert">{readError}</p>}<button type="button" className="mark-read-button" onClick={()=>{void mutate({action:'read',threadId,through:page.through}).then(()=>{acknowledged.current=page.through;setReadError('');}).catch(error=>setReadError(error instanceof Error?error.message:'Could not save read status.'));}}>Mark displayed comments read</button></div>;
}
export function ThreadCard({thread,focus=false}:{thread:ThreadPreview;focus?:boolean}){
  const {revealed,reveal,catalog}=useDiscussions();
  const [open,setOpen]=useState(focus),element=useRef<HTMLElement>(null),hidden=thread.spoilerHidden&&!revealed.has(thread.episodeId);
  useEffect(()=>{if(!focus||!element.current)return;const node=element.current;node.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});node.focus({preventScroll:true});},[focus]);
  const unread=catalog?.unread[thread.id];
  return <article ref={element} id={`thread-${thread.id}`} className={`chatter-thread ${focus?'chatter-thread-focused':''}`} tabIndex={-1}><header className="thread-heading"><Link href={`/episodes?episode=${encodeURIComponent(thread.episodeId)}&thread=${encodeURIComponent(thread.id)}`}>Season {thread.season} · Episode {thread.episode}</Link><UnreadBadge count={unread?.unreadCount??thread.unreadCount} personal={unread?.personalCount??thread.personalCount}/></header>{hidden?<div className="spoiler-preview"><p>Comment previews hidden to avoid spoilers.</p><button type="button" onClick={()=>{reveal(thread.episodeId);setOpen(true);}}>Reveal Episode {thread.episode}</button></div>:<><button type="button" className="thread-preview-toggle" aria-expanded={open} aria-controls={`conversation-${thread.id}`} onClick={()=>setOpen(value=>!value)}><span className="thread-preview-author"><span className="thread-avatar" aria-hidden="true">{initial(thread.authorName||'Conversation')}</span><strong>{thread.authorName||'Conversation'}</strong></span>{!open&&<p>{thread.text}</p>}<span className="thread-preview-meta">{thread.replyCount} repl{thread.replyCount===1?'y':'ies'} · Active {formatted(thread.lastActivityAt)} · {open?'Hide conversation':'Open conversation'}</span></button>{open&&<div id={`conversation-${thread.id}`}><ConversationContents threadId={thread.id} episodeId={thread.episodeId} reveal={revealed.has(thread.episodeId)}/></div>}</>}</article>;
}
export function FocusedThread({threadId,episodeId}:{threadId:string;episodeId:string}){
  const {revealed,refresh}=useDiscussions(),conversation=useConversation(threadId,revealed.has(episodeId));
  if(conversation.error)return <p role="alert">{conversation.error} <button onClick={()=>void refresh()}>Retry</button></p>;
  return conversation.page?<ThreadCard key={threadId+':'+conversation.page.thread.spoilerHidden} thread={conversation.page.thread} focus/>:<p role="status">Loading selected conversation…</p>;
}
export function EpisodeDiscussion({episode,initialThread=''}:{episode:EpisodeView;initialThread?:string}){
  const {refresh}=useDiscussions(),[focused,setFocused]=useState(initialThread),[sort,setSort]=useState('activity');
  const list=useThreads({episodeId:episode.id,sort});
  if(!episode.available)return <section className="episode-comments"><h3>Discussion scheduled</h3><p>{episode.opensAt?`Opens ${formatted(episode.opensAt)}.`:'The game master will confirm this episode’s broadcast opening.'} Scoring can proceed independently.</p></section>;
  return <section className="episode-comments"><div className="discussion-heading"><div><p className="eyebrow dark">Around the campfire</p><h3>Episode discussion</h3></div><UnreadBadge count={episode.unreadCount} personal={episode.personalCount}/></div><CommentComposer episodeId={episode.id} onPosted={setFocused}/><label className="thread-sort">Sort conversations<select value={sort} onChange={event=>setSort(event.target.value)}><option value="activity">Most recently active</option><option value="newest">Newest conversations</option></select></label>{focused&&<FocusedThread key={focused} threadId={focused} episodeId={episode.id}/>}<div className="chatter-threads">{list.rows.filter(thread=>thread.id!==focused).map(thread=><ThreadCard key={thread.id} thread={thread}/>)}</div>{list.loading&&<p role="status">Loading conversations…</p>}{list.error&&<p role="alert">{list.error} <button onClick={()=>void refresh()}>Retry</button></p>}{!list.loading&&!list.error&&!list.rows.length&&!focused&&<p className="chatter-empty">No conversations yet. Start one!</p>}{list.cursor&&<button type="button" disabled={list.loading} onClick={()=>void list.loadMore()}>Load older conversations</button>}</section>;
}
export function CampfireCommentary(){
  const {catalog,eligible,loading,error,refresh,unreadCount}=useDiscussions(),{game}=useGame(),threads=useThreads({season:game.season.number,pageSize:3});
  const latest=catalog?.episodes.find(episode=>episode.available&&episode.season===game.season.number);
  return <section className="campfire-commentary panel"><div className="campfire-header"><div className="campfire-title"><span className="campfire-icon" aria-hidden="true">🔥</span><div><p className="eyebrow dark">Around the campfire</p><h2>Campfire Commentary</h2></div>{unreadCount>0&&<UnreadBadge count={unreadCount}/>}</div><Link className="campfire-view-all" href="/chatter">View all <span aria-hidden="true">→</span></Link></div>{!eligible?<DiscussionAccess/>:<>{(loading||threads.loading)&&<p className="campfire-status" role="status">Loading Campfire Commentary…</p>}{(error||threads.error)&&<p className="campfire-status" role="alert">Discussions couldn’t load. <button type="button" onClick={()=>void refresh()}>Retry</button></p>}<div className="campfire-commentary-grid">{threads.rows.map(thread=><Link href={threadHref(thread)} key={thread.id} className="campfire-thread-preview">{thread.spoilerHidden?<><span className="campfire-thread-top"><span className="campfire-thread-episode">Episode {thread.episode}</span><UnreadBadge count={thread.unreadCount} personal={thread.personalCount}/></span><strong>Episode {thread.episode} · {thread.unreadCount} unread comments</strong><p>Comment previews hidden to avoid spoilers.</p></>:<><span className="campfire-thread-top"><span className="campfire-thread-episode">Episode {thread.episode}</span><UnreadBadge count={thread.unreadCount} personal={thread.personalCount}/></span><span className="campfire-thread-author"><span className="campfire-avatar" aria-hidden="true">{initial(thread.authorName)}</span><strong>{thread.authorName||'Conversation'}</strong></span><p>{thread.text}</p></>}<small>{thread.replyCount} repl{thread.replyCount===1?'y':'ies'} · Active {formatted(thread.lastActivityAt)}</small></Link>)}</div>{!loading&&!threads.loading&&!error&&!threads.error&&!threads.rows.length&&<div className="campfire-empty"><p>No conversations yet. Start one!</p><Link className="campfire-empty-action" href={latest?`/chatter?episode=${latest.id}&compose=true`:'/chatter'}>Start a conversation <span aria-hidden="true">→</span></Link></div>}</>}</section>;
}
