'use client';
import Link from 'next/link';
import {useState,type FormEvent} from 'react';
import {useGame} from '../game-provider';
import {AuthControls} from '../auth-controls';
import {SiteHeader} from '../site-header';
import {ScoringManager,TribeManagement} from './scoring-manager';
import {PlayerSignups} from './player-signups';
import {SeasonManager} from './season-manager';
import {DraftChoice} from '../draft/draft-choice';
import {AdminTabs} from './admin-tabs';
import {RecapManager} from './recap-manager';

export default function Admin(){
  const {game,standings,user,isAdmin,cloud,authLoading,addAdjustment,addPlayer,startDraft,toggleDraft,undoDraftPick,resetSeason}=useGame();
  const [saved,setSaved]=useState(''),[busy,setBusy]=useState(false);
  async function run(action:()=>Promise<void>,message:string){
    if(busy)return;
    setBusy(true);setSaved('');
    try{await action();setSaved(message);}catch(error){setSaved(error instanceof Error?error.message:'Unable to save.');}
    finally{setBusy(false);}
  }
  function adjust(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget,data=new FormData(form);
    void run(async()=>{await addAdjustment(String(data.get('playerId')),Number(data.get('points')),String(data.get('note')),data.get('episode')?Number(data.get('episode')):undefined);form.reset();},'Player adjustment saved.');
  }
  function player(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget,data=new FormData(form);
    void run(async()=>{await addPlayer(String(data.get('name')),'');form.reset();},'League profile added. Link its Google account in Player check-in.');
  }
  const locked=Boolean(game.season.finalized);
  const currentTurn=game.draft.turns[game.draft.currentPick];
  if((!cloud&&!isAdmin)||authLoading||(!user&&!isAdmin))return <main className="admin-shell"><SiteHeader active="/admin" subtitle="Game master"/><section className="admin-intro"><div><p className="eyebrow">Game master</p><h1>Sign in to run Survivor {game.season.number}.</h1><AuthControls/></div></section></main>;
  if(!isAdmin)return <main className="admin-shell"><SiteHeader active="/admin" subtitle="Game master"/><section className="admin-intro"><div><h1>This account is not the game master.</h1><p>Use the league owner account, donohue.js@gmail.com.</p><AuthControls/></div></section></main>;

  const scoring=<>
    {locked?<p className="setup-notice">Final results are locked. Open the next season in League setup before recording new scores.</p>:<ScoringManager key={game.season.number}/>}
    <div className="admin-grid"><article className="admin-panel"><div className="admin-panel-title"><span>+</span><div><p>Bonus desk</p><h2>Adjust a player score</h2></div></div>
      <form onSubmit={adjust} className="admin-form"><label>Player<select name="playerId">{game.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Points<input name="points" type="number" step=".01" defaultValue="1" required/></label><label>Episode (optional)<input name="episode" type="number" min="1" step="1" defaultValue={game.season.currentEpisode} placeholder="Blank for a general adjustment"/></label><label className="wide">Reason<input name="note" required/></label><button disabled={locked||busy} className="secondary-button wide">Apply adjustment</button></form>
    </article></div>
  </>;
  const setup=<>
    <section className="setup-section"><h2>League setup</h2><p>Add new profiles here, then link their Google accounts in <a href="#player-check-in">Player check-in</a>. Returning accounts remain linked to their permanent profiles.</p>
      <form onSubmit={player} className="mini-form"><h3>Add a new league profile</h3><label>Player name<input name="name" placeholder="New player name" maxLength={50} required/></label><button disabled={locked||busy||game.draft.status!=='setup'}>Add player</button>{game.draft.status!=='setup'&&<p>New profiles can be added before the draft starts.</p>}</form>
    </section>
    <SeasonManager/>
    <section className="setup-section admin-danger"><details><summary>Reset current season’s draft and scores</summary><p>This deletes current picks, scores, and entry bonuses. Profiles, payment checkmarks, castaways, and archived results remain. Do not use this to fix sign-in or deployment issues.</p><button disabled={locked||busy} type="button" onClick={()=>{if(confirm('Reset Season '+game.season.number+' picks and scores? Profiles and archived results will remain.'))void run(resetSeason,'Current-season picks and scores cleared.');}}>Reset clean season</button></details></section>
  </>;
  const draft=<>
    <section className="setup-section"><div><p className="eyebrow dark">Draft room</p><h2>{game.draft.status==='complete'?'Draft complete':game.draft.status==='setup'?'Prepare for draft night':game.draft.status==='paused'?'Draft paused':(currentTurn?.playerName??'Next player')+' is on the clock'}</h2><p>{game.players.filter(p=>p.uid||p.email).length} of {game.players.length} accounts linked · {game.draftPicks.length} picks recorded{currentTurn&&game.draft.status!=='setup'?' · Round '+currentTurn.round+', pick '+currentTurn.pickNumber:''}</p></div>
      <div className="draft-admin-actions">
        {game.draft.status==='setup'?<button disabled={locked||busy} onClick={()=>{if(confirm('Start the live draft and lock the player order?'))void run(startDraft,'Live draft started.');}}>Start live draft</button>:<><button disabled={locked||busy||game.draft.status==='complete'} onClick={()=>run(toggleDraft,'Draft status updated.')}>{game.draft.status==='live'?'Pause draft':'Resume draft'}</button><button disabled={locked||busy||Boolean(game.draft.blind)||!game.draftPicks.length} onClick={()=>run(undoDraftPick,'Last pick removed. The draft is paused for review.')}>Undo last pick</button></>}
        <Link href="/draft">View player draft board →</Link>
      </div><p>Undo pauses the draft and is available only before the round-three deal opens.</p>
    </section>
    <div className="admin-grid"><article className="admin-panel"><h2>Submit the current player’s decision</h2>{game.draft.status==='live'?<DraftChoice onBehalf key={game.draft.runId+':'+game.draft.currentPick}/>:<p>Start or resume the draft to submit a decision for an absent player. The same draft rules apply.</p>}</article></div>
  </>;
  const activity=<section className="setup-section"><p className="eyebrow dark">Activity log</p><h2>Recent scoring items</h2><p>Showing the latest {Math.min(50,game.scoreEvents.length)} of {game.scoreEvents.length} scoring entries.</p><article className="admin-panel"><div className="event-list">
    {game.scoreEvents.slice(-50).reverse().map(event=><div key={event.id}><span><strong>{event.recipientName??game.castaways.find(c=>c.id===event.castawayId)?.shortName??game.players.find(p=>p.id===event.playerId)?.name}</strong><small>{event.actionLabel||game.categories.find(c=>c.id===event.categoryId)?.label||'Adjustment'}{event.tribeName?' · '+event.tribeName:''}{event.episode?' · Episode '+event.episode:''}{event.note?' · '+event.note:''}</small></span><b className={event.points<0?'negative':''}>{event.points>0?'+':''}{event.points}</b></div>)}
    {!game.scoreEvents.length&&<p className="admin-empty">No Season {game.season.number} scoring items yet.</p>}
  </div></article></section>;

  return <main className="admin-shell">
    <header className="admin-header"><Link className="brand" href="/"><span className="brand-mark">{game.season.number}</span><span><strong>Game Master</strong><small>Fantasy Survivor</small></span></Link><div className="admin-header-actions"><Link href="/" className="back-to-game">View game</Link><AuthControls compact/></div></header>
    <section className="admin-overview"><div><p className="eyebrow dark">Season {game.season.number} control room</p><h1>Run your league.</h1><p>Choose a section below. Your unfinished entries stay in place when you switch tabs.</p></div><div className="admin-overview-stats"><span><strong>{standings.length}</strong> players</span><span><strong>{game.players.filter(p=>p.paid).length}</strong> paid</span><span><strong>{game.draftPicks.length}</strong> picks</span></div></section>
    {!cloud&&<p className="setup-notice">Local setup mode: connect Firebase before publishing so everyone sees the same data.</p>}
    {saved&&<p className="admin-feedback" role="status">{saved}</p>}
    <AdminTabs key={game.season.number} panels={{
      scoring,
      'recaps-polls':<RecapManager/>,
      'league-setup':setup,
      'tribe-membership':locked?<p className="setup-notice">This season is finalized. Tribe membership is locked.</p>:<TribeManagement/>,
      'player-check-in':<PlayerSignups/>,
      'draft-room':draft,
      'activity-log':activity,
    }}/>
  </main>;
}
