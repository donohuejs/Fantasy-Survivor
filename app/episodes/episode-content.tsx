'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {EpisodeRecap,LeaguePoll} from '@/lib/community';
import {activePossessions} from '@/lib/scoring';
import {useGame} from '../game-provider';
import {communityRequest,useComments} from './community-client';
import {PlayerName} from '../player-name';

export function WhoHasWhat(){
  const {game}=useGame();
  const owners=game.castaways.map(castaway=>({castaway,items:activePossessions(game).filter(possession=>possession.castawayId===castaway.id)})).filter(entry=>entry.items.length>0);
  return <section className="who-has-what" aria-labelledby="who-has-what-title"><div className="who-has-what-heading"><div><p className="eyebrow dark">Live game state</p><h2 id="who-has-what-title">Who Has What</h2></div><span>{owners.reduce((count,entry)=>count+entry.items.length,0)} active item{owners.reduce((count,entry)=>count+entry.items.length,0)===1?'':'s'}</span></div>{owners.length?<div className="who-has-what-grid">{owners.map(({castaway,items})=><article className="who-has-what-card" key={castaway.id}><h3>{castaway.name}</h3><ul>{items.map(item=><li key={item.id}><strong>{item.itemName}</strong><small>{item.category==='idol'?'Idol':'Advantage'}</small></li>)}</ul></article>)}</div>:<p className="who-has-what-empty">No active idols or advantages.</p>}</section>;
}

export function PreviousPolls({polls}:{polls:LeaguePoll[]}){
  const [expanded,setExpanded]=useState(false);
  if(!polls.length)return null;
  return <section className="poll-history" aria-labelledby="previous-polls-title">
    <h3 id="previous-polls-title" className="visually-hidden">Previous polls</h3><button type="button" className="poll-history-toggle" aria-expanded={expanded} aria-controls="previous-polls-list" onClick={()=>setExpanded(value=>!value)}>{expanded?'Hide previous polls':'Show previous polls'}</button>
    <div id="previous-polls-list" className="community-polls" hidden={!expanded}>{expanded&&polls.map(poll=><PollCard poll={poll} key={poll.id}/>)}</div>
  </section>;
}

export function ScoringSummary({recap,live=false,eliminatedRecipients}:{recap:Pick<EpisodeRecap,'actions'>;live?:boolean;eliminatedRecipients?:Set<string>}){
  return <section className="episode-scoring"><h3>{live?'Current episode activity':'Scoring actions'}</h3><p className="community-note">{live?'Current scoring activity is already reflected in the leaderboard. The written recap will be posted separately.':'Scoring snapshot saved with this recap. These points are already included in the leaderboard—not awarded again here.'}</p>
    {recap.actions.map(action=><article key={action.id}><strong className={action.points<0?'negative':''}>{action.points>0?'+':''}{action.points}{action.recipients.length>1?' each':''}</strong><div><h4>{action.tribeName? action.tribeName+' · ':''}{action.label}</h4><p>{action.recipients.map((recipient,index)=><span key={`${action.id}:${recipient}:${index}`}>{index>0&&', '}<span className={eliminatedRecipients?.has(recipient)?'membership-row-eliminated':''}>{recipient}</span></span>)}</p>{!live&&action.note&&<p className="community-prose">{action.note}</p>}</div></article>)}
    {!recap.actions.length&&<p>{live?'No episode-tagged scoring actions have been recorded yet.':'No episode-tagged scoring actions were included when this recap was saved.'}</p>}
  </section>;
}
export function CommentThread({recap}:{recap:EpisodeRecap}){
  const {game,user,isAdmin,login}=useGame();
  const [count,setCount]=useState(50),[text,setText]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const attempt=useRef<{id:string;text:string}|null>(null);
  const comments=useComments(recap.id,count);
  const player=game.players.find(p=>p.uid?p.uid===user?.uid:Boolean(p.email)&&p.email===user?.email?.toLowerCase());
  async function post(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    if(attempt.current?.text!==text)attempt.current={id:crypto.randomUUID(),text};
    setBusy(true);setMessage('');
    try{await communityRequest({action:'comment',episodeId:recap.id,id:attempt.current!.id,text});setText('');attempt.current=null;setMessage('Comment posted.');}
    catch(error){setMessage(error instanceof Error?error.message:'Unable to post comment.');}finally{setBusy(false);}
  }
  async function remove(id:string){if(!confirm('Permanently remove this comment?'))return;setBusy(true);try{await communityRequest({action:'delete-comment',episodeId:recap.id,id});setMessage('Comment removed.');}catch(error){setMessage(error instanceof Error?error.message:'Unable to remove comment.');}finally{setBusy(false);}}
  return <section className="episode-comments"><h3>Campfire comments</h3><p className="community-note">Comments are public. Your league name is shown, never your email.</p>
    {comments.loading&&<p role="status">Loading comments…</p>}{comments.error&&<p role="alert">{comments.error}</p>}
    {comments.rows.length===count&&<button type="button" onClick={()=>setCount(count+50)}>Load older comments</button>}
    {comments.rows.map(comment=>{const author=game.players.find(item=>item.id===comment.authorId);return <article className="episode-comment" key={comment.id}><header><strong>{author?<PlayerName id={author.id} name={author.name} history={game.history}/>:comment.authorName}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></header><p className="community-prose">{comment.text}</p>{(isAdmin||player?.id===comment.authorId)&&<button disabled={busy} className="comment-remove" onClick={()=>remove(comment.id)}>Remove comment</button>}</article>;})}
    {!comments.loading&&!comments.error&&!comments.rows.length&&<p>No comments yet. Start the conversation.</p>}
    {user&&(player||isAdmin)?<form onSubmit={post} className="community-form" lang="en"><label>Your comment<textarea value={text} onChange={e=>setText(e.target.value)} maxLength={2000} rows={3} required disabled={busy} spellCheck autoCorrect="on" autoCapitalize="sentences" lang="en"/></label><button disabled={busy||!text.trim()}>{busy?'Saving…':'Post comment'}</button></form>:user?<p>Your account must be linked to a league profile before commenting. Signing in registers you automatically; ask the game master to link your account in Player check-in.</p>:<button onClick={login}>Sign in with Google to comment</button>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
export function PollCard({poll,manage=false}:{poll:LeaguePoll;manage?:boolean}){
  const {game,user,login}=useGame();
  const player=game.players.find(p=>p.uid?p.uid===user?.uid:Boolean(p.email)&&p.email===user?.email?.toLowerCase());
  const [mine,setMine]=useState<{key:string;choice:number|null;error:string}>({key:'',choice:null,error:''});
  const [selected,setSelected]=useState<number|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const key=poll.id+':'+(user?.uid??'');
  useEffect(()=>{
    if(!user||!player)return;
    let active=true;
    communityRequest({},poll.id).then(result=>{if(active)setMine({key,choice:result.choice??null,error:''});}).catch(error=>{if(active)setMine({key,choice:null,error:error instanceof Error?error.message:'Could not read your vote.'});});
    return ()=>{active=false;};
  },[key,poll.id,poll.updatedAt,user,player]);
  const choice=selected??(mine.key===key?mine.choice:null),open=poll.status==='open'&&poll.season===game.season.number;
  const total=poll.counts.reduce((sum,n)=>sum+n,0);
  async function vote(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||choice===null)return;setBusy(true);setMessage('');
    try{await communityRequest({action:'vote',pollId:poll.id,choice});setMine({key,choice,error:''});setSelected(null);setMessage('Your vote is saved.');}
    catch(error){setMessage(error instanceof Error?error.message:'Unable to save vote.');}finally{setBusy(false);}
  }
  async function close(){if(!confirm('Close this poll? Voting will stop and the results will remain visible.'))return;setBusy(true);try{await communityRequest({action:'close-poll',pollId:poll.id});setMessage('Poll closed.');}catch(error){setMessage(error instanceof Error?error.message:'Unable to close poll.');}finally{setBusy(false);}}
  return <article id={`poll-${poll.id}`} tabIndex={-1} className="league-poll"><div className="poll-heading"><span>{open?'Voting open':'Voting closed'}</span><small>{poll.episode?'Episode '+poll.episode:'League-wide'} · {total} vote{total===1?'':'s'}</small></div><h3>{poll.question}</h3>
    <form onSubmit={vote}><fieldset disabled={!open||!player||busy}><legend className="visually-hidden">Choose one answer</legend>{poll.options.map((option,index)=><label className="poll-option" key={index}><input type="radio" name={'poll-'+poll.id} value={index} checked={choice===index} onChange={()=>setSelected(index)}/><span>{option}<progress max={Math.max(total,1)} value={poll.counts[index]} aria-label={option+' votes'}/></span><b>{poll.counts[index]} · {total?Math.round(poll.counts[index]/total*100):0}%</b></label>)}</fieldset>
      {open&&player&&<button disabled={busy||choice===null}>{mine.key===key&&mine.choice!==null?'Update my vote':'Submit vote'}</button>}
    </form>
    {open&&!user&&<button onClick={login}>Sign in with Google to vote</button>}{open&&user&&!player&&<p>Ask the game master to link your league profile before voting.</p>}
    <p className="community-note">One vote per league profile. You can change it while voting is open. Only totals are public. Poll results do not automatically change scores.</p>
    {mine.key===key&&mine.error&&<p role="alert">{mine.error}</p>}{message&&<p role="status">{message}</p>}
    {manage&&poll.status==='open'&&<button disabled={busy} onClick={close}>Close poll</button>}
  </article>;
}
