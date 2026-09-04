'use client';
import {useRef,useState,type FormEvent} from 'react';
import {useGame} from '../game-provider';
import {usePolls,useRecaps,communityRequest} from '../episodes/community-client';
import {PollCard,ScoringSummary} from '../episodes/episode-content';
import {episodeActions,type EpisodeRecap} from '@/lib/community';
import Link from 'next/link';

function RecapEditor({episode,existing}:{episode:number;existing?:EpisodeRecap}){
  const {game,cloud}=useGame();
  const [title,setTitle]=useState(existing?.title??'Episode '+episode),[body,setBody]=useState(existing?.body??'');
  const [version,setVersion]=useState(existing?.updatedAt??''),[status,setStatus]=useState(existing?.status??'draft'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const preview:EpisodeRecap={id:game.season.number+'-'+episode,season:game.season.number,episode,title,body,status,actions:episodeActions(game,episode),createdAt:'',updatedAt:'',publishedAt:''};
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const target=(event.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='draft'?'draft':'published';
    if(status==='published'&&target==='draft'&&!confirm('Unpublish this recap? It and its comments will be hidden from players until you publish again.'))return;
    setBusy(true);setMessage('');
    try{const result=await communityRequest({action:'save-recap',season:game.season.number,episode,title,body,status:target,expectedUpdatedAt:version});setVersion(result.updatedAt!);setStatus(target);setMessage(target==='published'?'Recap published with a refreshed scoring snapshot.':'Draft saved privately.');}
    catch(error){setMessage(error instanceof Error?error.message:'Unable to save recap.');}finally{setBusy(false);}
  }
  return <article className="admin-panel recap-editor"><h3>Episode {episode} · {status==='published'?'Published':'Private draft'}</h3>
    <form onSubmit={save} className="community-form"><fieldset disabled={busy||!cloud}><label>Recap title<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={150}/></label><label>Your color commentary<textarea value={body} onChange={e=>setBody(e.target.value)} rows={7} maxLength={12000} placeholder="The big moments, questionable decisions, and your take on this week…"/></label><p className="community-note">Plain text with paragraph breaks. Saving captures the current episode’s scoring actions below. Drafts are visible only to you.</p><div className="community-actions"><button name="status" value="published">{status==='published'?'Update recap & scoring':'Publish recap'}</button><button name="status" value="draft">{status==='published'?'Unpublish & save draft':'Save private draft'}</button></div></fieldset></form>
    {message&&<p role="status">{message}</p>}
    <details><summary>Preview scoring summary · {preview.actions.length} actions</summary><ScoringSummary recap={preview}/></details>
    <p className="community-note">Only actions tagged Episode {episode} appear here. General player adjustments without an episode number are not included. Publishing does not award points again.</p>
  </article>;
}
export function RecapManager(){
  const {game,cloud,user}=useGame(),recaps=useRecaps(true),polls=usePolls();
  const [episode,setEpisode]=useState(game.season.currentEpisode),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [episodeInput,setEpisodeInput]=useState(String(game.season.currentEpisode));
  const pollAttempt=useRef<{id:string;fingerprint:string}|null>(null);
  const current=recaps.rows.filter(r=>r.season===game.season.number).sort((a,b)=>a.episode-b.episode);
  function chooseEpisode(n:number){
    if(!Number.isInteger(n)||n<1||n>9999)return;
    if(n===episode||confirm('Switch episodes? Save any unfinished recap changes first.')){setEpisode(n);setEpisodeInput(String(n));}
  }
  async function poll(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;const form=event.currentTarget,data=new FormData(form);
    const values={season:game.season.number,episode:Number(data.get('episode')),question:String(data.get('question')),options:String(data.get('options')).split('\n').map(s=>s.trim()).filter(Boolean)};
    const fingerprint=JSON.stringify(values);if(pollAttempt.current?.fingerprint!==fingerprint)pollAttempt.current={id:crypto.randomUUID(),fingerprint};
    if(!confirm('Open this poll for league players? The question and choices cannot be edited after opening.'))return;
    setBusy(true);setMessage('');
    try{await communityRequest({action:'create-poll',id:pollAttempt.current!.id,...values});pollAttempt.current=null;form.reset();setMessage('Poll opened. Players can vote on the Episodes page.');}
    catch(error){setMessage(error instanceof Error?error.message:'Unable to open poll.');}finally{setBusy(false);}
  }
  return <section className="recap-manager"><h2>Episode recaps & league polls</h2><p>Publish an episode’s scoring story, invite comments, and put decisions to a vote. <Link href="/episodes">View the public Episodes page →</Link></p>
    {recaps.error&&<p role="alert" className="setup-notice">{recaps.error}</p>}{polls.error&&<p role="alert" className="setup-notice">{polls.error}</p>}
    <form className="recap-editor-picker" onSubmit={e=>{e.preventDefault();chooseEpisode(Number(episodeInput));}}><label>Episode<input type="number" min={1} max={9999} step={1} value={episodeInput} onChange={e=>setEpisodeInput(e.target.value)} required/></label><button>Load episode</button><button type="button" onClick={()=>{if(confirm('Reload the saved recap and discard any unfinished edits?'))setReload(reload+1);}}>Reload saved version</button></form>
    {current.length>0&&<nav className="episode-picker" aria-label="Saved recaps">{current.map(r=><button aria-pressed={r.episode===episode} key={r.id} onClick={()=>chooseEpisode(r.episode)}>Episode {r.episode} · {r.status}</button>)}</nav>}
    {recaps.loading?<p role="status">Loading saved recaps…</p>:!recaps.error&&<RecapEditor key={game.season.number+'-'+episode+'-'+reload} episode={episode} existing={current.find(r=>r.episode===episode)}/>}
    <article className="admin-panel poll-creator"><h3>Open a league poll</h3><p>Players may change their one vote until you close voting. Choices are locked once opened. Apply any resulting scoring changes separately in Scoring.</p>
      <form className="community-form" onSubmit={poll}><fieldset disabled={busy||!cloud}><label>Attach to<select name="episode"><option value="0">League-wide vote</option>{current.filter(r=>r.status==='published').map(r=><option value={r.episode} key={r.id}>Episode {r.episode}: {r.title}</option>)}</select></label><label>Question<input name="question" required maxLength={300}/></label><label>Choices · one per line, 2–6 choices<textarea name="options" rows={4} required maxLength={606} placeholder={'Yes\nNo'}/></label><button>Open voting</button></fieldset></form>
      {message&&<p role="status">{message}</p>}
    </article>
    <h3>Manage polls</h3>{polls.loading&&<p role="status">Loading polls…</p>}<div className="community-polls">{polls.rows.filter(p=>p.season===game.season.number).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(p=><PollCard poll={p} manage key={p.id+':'+user?.uid}/>)}</div>
    {!polls.loading&&!polls.error&&!polls.rows.some(p=>p.season===game.season.number)&&<p>No polls this season yet.</p>}
    <p className="community-note">To moderate comments, open the public recap while signed in as Game Master and use “Remove comment.” Recaps, comments, and polls are kept separately from the active season’s scores, so opening a new season does not erase them.</p>
  </section>;
}
