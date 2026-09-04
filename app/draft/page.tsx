'use client';
import {SiteHeader} from '../site-header';
import { FormEvent, useState } from 'react';
import { useGame } from '../game-provider';
import { AuthControls } from '../auth-controls';

export default function Draft() {
  const { game, standings, user, isAdmin, submitPlayerPick,signups,registerPlayer,signupError,signupLoading } = useGame();
  const [message,setMessage] = useState('');
  const [busy,setBusy]=useState(false);
  const currentTurn = game.draft.turns[game.draft.currentPick];
  const isMyTurn = !game.season.finalized&&game.draft.status === 'live' && Boolean(user&&currentTurn&&(currentTurn.uid?currentTurn.uid===user.uid:currentTurn.email===user.email?.toLowerCase()));
  async function choose(e:FormEvent<HTMLFormElement>) { e.preventDefault(); const form=e.currentTarget; const castawayId=String(new FormData(form).get('castawayId')??'');setBusy(true);try{await submitPlayerPick(castawayId);setMessage('Pick locked in. The draft has advanced.')}catch(error){setMessage(error instanceof Error?error.message:'Unable to save the pick.')}finally{setBusy(false);} }
  async function register(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);try{await registerPlayer(String(new FormData(e.currentTarget).get('name')??''));setMessage('You’re registered. The game master will link your permanent league profile.')}catch(error){setMessage(error instanceof Error?error.message:'Unable to register.')}finally{setBusy(false);}}
  const assigned=user?game.players.find(player=>player.uid?player.uid===user.uid:player.email&&player.email===user.email?.toLowerCase()):undefined;
  const mySignup=user?signups.find(signup=>signup.uid===user.uid):undefined;
  return <main className="inner-page">
    <SiteHeader active="/draft" subtitle="Draft board"/>
    <section className="inner-hero"><p className="eyebrow"><span/> Survivor {game.season.number}</p><h1>Three rounds. No safe picks.</h1><p>Round one runs in reverse Season {game.season.number-1} finish order, round two snakes back, and round three is a blind choice worth 1.25×.</p></section>
    <section className="draft-live-panel">
      <div><p className="eyebrow dark">Live draft room</p><h2>{game.draft.status==='setup'?'Waiting for the game master':game.draft.status==='complete'?'The draft is complete':game.draft.status==='paused'?'Draft paused':`${currentTurn?.playerName ?? 'Next player'} is on the clock`}</h2><p>{currentTurn?`Round ${currentTurn.round} · Pick ${currentTurn.pickNumber} · Overall ${game.draft.currentPick+1} of ${game.draft.turns.length}`:'The game master will publish the turn order before draft night.'}</p></div>
      <AuthControls/>
      {signupError&&<p role="alert" className="scoring-error">{signupError}</p>}
      {signupLoading&&<p role="status">Checking your league profile…</p>}
      {assigned&&<p className="draft-waiting"><strong>{assigned.name} · Slot {assigned.draftSlot}</strong> · Your league profile stays linked to this Google account for future seasons.</p>}
      {user&&!assigned&&!mySignup&&!signupLoading&&!signupError&&<form className="player-registration" onSubmit={register}><label>Your player name<input name="name" maxLength={50} required placeholder="Name shown in the league"/></label><button disabled={busy}>{busy?'Registering…':'Join the league'}</button></form>}
      {user&&!assigned&&mySignup&&<p className="draft-waiting">Registered as <strong>{mySignup.name}</strong>. Waiting for the game master to assign your draft slot.</p>}
      {isMyTurn&&<form className="live-pick-form" onSubmit={choose}><label>Choose your castaway<select name="castawayId" required disabled={busy}>{game.castaways.map((castaway)=><option key={castaway.id} value={castaway.id}>{castaway.name} · {castaway.occupation}</option>)}</select></label><button disabled={busy}>{busy?'Saving pick…':'Lock in pick'}</button></form>}
      {assigned&&game.draft.status==='live'&&!isMyTurn&&<p className="draft-waiting">This screen will update automatically when it’s your turn.</p>}
      {message&&<p className="draft-message" role="status">{message}</p>}
    </section>
    <section className="draft-order-section"><div className="section-title"><div><p className="eyebrow dark">Assigned slots</p><h2>Reverse Season {game.season.number-1} finish order</h2></div></div><div className="draft-slot-grid">{[...game.players].sort((a,b)=>a.draftSlot-b.draftSlot).map((player)=><article key={player.id}><strong>{player.draftSlot}</strong><span>{(player.uid||player.email)?player.name:'Awaiting assignment'}<small>{(player.uid||player.email)?`Season ${game.season.number-1} finish: ${player.priorFinish}`:'Player signup pending'}</small></span></article>)}</div></section>
    <section className="draft-rounds">{[1,2,3].map((round)=><article className="draft-round" key={round}><header><span>Round {round}</span><strong>{round===1?'Reverse finish order':round===2?'Snake draft':'Blind-pick round'}</strong></header><div>{game.draftPicks.filter((pick)=>pick.round===round).sort((a,b)=>a.pickNumber-b.pickNumber).map((pick)=><div className="draft-pick" key={pick.id}><span>{pick.pickNumber}</span><div><strong>{round===3&&game.draft.status!=='complete'&&!isAdmin?'Blind pick locked':game.castaways.find((castaway)=>castaway.id===pick.castawayId)?.shortName}</strong><small>{game.players.find((player)=>player.id===pick.playerId)?.name}</small></div>{pick.multiplier>1&&<b>1.25×</b>}</div>)}{!game.draftPicks.some((pick)=>pick.round===round)&&<p className="draft-empty">Waiting for Season {game.season.number} picks.</p>}</div></article>)}</section>
    <section className="team-board"><div className="section-title"><div><p className="eyebrow dark">Team check</p><h2>Every player’s three</h2></div></div><div className="team-grid">{standings.map((player)=><article key={player.id}><span>{player.score?player.rank:'—'}</span><div><strong>{player.name}</strong><p>{player.picks}</p></div><b>{player.score.toFixed(1)}</b></article>)}</div></section>
  </main>;
}
