'use client';
/* eslint-disable @next/next/no-img-element */

import {AuthControls} from '../auth-controls';
import {PlayerName} from '../player-name';
import {useGame} from '../game-provider';
import {DraftChoice} from './draft-choice';
import {CastawayPool} from './castaway-pool';
import {activePlayers,tribeForCastaway} from '@/lib/game-data';
import {draftHistoryEntries,draftRounds,type DraftHistoryEntry} from '@/lib/draft-board';

const roundDetails:Record<number,{order:string;description:string}>={
  1:{order:'Regular Order',description:'The displayed draft order.'},
  2:{order:'Reverse Order',description:'The Round 1 order, reversed.'},
  3:{order:'Random Order',description:'A separately randomized order.'},
};

function roundLabel(round:number,key:'order'|'description'){return roundDetails[round]?.[key]??'Draft order';}

export function DraftBoard(){
  const {game,user,signups,registrationStatus,signupError,signupLoading}=useGame();
  const entries=draftHistoryEntries(game);
  const rounds=draftRounds(game);
  const players=activePlayers(game.players).sort((a,b)=>a.draftSlot-b.draftSlot||a.name.localeCompare(b.name));
  const complete=game.draft.status==='complete';
  const currentTurn=game.draft.turns[game.draft.currentPick];
  const assigned=user?players.find(player=>player.uid?player.uid===user.uid:player.email&&player.email===user.email?.toLowerCase()):undefined;
  const mySignup=user?signups.find(signup=>signup.uid===user.uid):undefined;
  const isMyTurn=!game.season.finalized&&!complete&&game.draft.status==='live'&&Boolean(user&&currentTurn&&(currentTurn.uid?currentTurn.uid===user.uid:currentTurn.email===user.email?.toLowerCase()));

  const entryFor=(playerId:string,round:number)=>entries.find(entry=>entry.playerId===playerId&&entry.round===round);
  const roundEntries=(round:number)=>entries.filter(entry=>entry.round===round);

  return <section className="draft-board-section" aria-labelledby="draft-board-heading">
    <div className="section-title draft-board-title"><div><p className="eyebrow dark">{complete?'Historical draft':'Live draft board'}</p><h2 id="draft-board-heading">Draft Board</h2><p>Every selection stays with its player row while the overall pick number preserves the true draft sequence.</p></div></div>
    {!complete&&<>
      <section className="draft-live-panel">
        <div><p className="eyebrow dark">Live draft room</p><h2>{game.draft.status==='setup'?'Waiting for the game master':game.draft.status==='paused'?'Draft paused':`${currentTurn?.playerName??'Next player'} is on the clock`}</h2><p>{currentTurn?`Round ${currentTurn.round} · ${roundLabel(currentTurn.round,'order')} · Pick ${currentTurn.pickNumber} · Overall #${game.draft.currentPick+1} of ${game.draft.turns.length}`:'The game master will publish the turn order before draft night.'}</p></div>
        <AuthControls/>
        {signupError&&<p role="alert" className="scoring-error">{signupError}</p>}
        {signupLoading&&<p role="status">Checking your league profile.</p>}
        {assigned&&<p className="draft-waiting"><strong><PlayerName id={assigned.id} name={assigned.name} history={game.history}/> · Slot {assigned.draftSlot}</strong> · Your league profile stays linked to this Google account for future seasons.</p>}
        {user&&!assigned&&mySignup&&registrationStatus==='registered'&&<p className="draft-waiting">Registered as <strong>{mySignup.name}</strong>. Waiting for the game master to assign your draft slot.</p>}
        {isMyTurn&&<DraftChoice key={game.draft.runId+':'+game.draft.currentPick}/>}
        {assigned&&game.draft.status==='live'&&!isMyTurn&&<p className="draft-waiting">This screen will update automatically when it is your turn.</p>}
      </section>
      <CastawayPool/>
      {game.draft.blind&&<section className="discard-section"><div className="section-title"><div><p className="eyebrow dark">Face-up discard pile</p><h2>{game.draft.blind.discards.length} castaways available</h2><p>Swapping takes one of these at 1x and puts your dealt card here for later players.</p></div></div><div className="discard-grid">{game.draft.blind.discards.map(id=>{const castaway=game.castaways.find(candidate=>candidate.id===id);return castaway?<article className="discard-card" key={id}><img src={castaway.imageUrl} alt={castaway.name} loading="lazy"/><h3>{castaway.name}</h3><p>{castaway.occupation}</p></article>:null;})}</div>{!game.draft.blind.discards.length&&<p>No discards are available yet.</p>}</section>}
    </>}
    <div className="draft-board-desktop">
      <table className="draft-board-table"><caption className="sr-only">Draft selections by player and round</caption><thead><tr><th scope="col">Player</th>{rounds.map(round=><th scope="col" key={round}><span>Round {round}</span><strong>{roundLabel(round,'order')}</strong><small>{roundLabel(round,'description')}</small></th>)}</tr></thead><tbody>{players.map(player=><tr key={player.id}><th scope="row"><PlayerName id={player.id} name={player.name} history={game.history}/></th>{rounds.map(round=><td key={round}><DraftSelection entry={entryFor(player.id,round)} game={game}/></td>)}</tr>)}</tbody></table>
    </div>
    <div className="draft-board-mobile">{rounds.map(round=><section className="draft-mobile-round" key={round}><header><div><span>Round {round}</span><strong>{roundLabel(round,'order')}</strong></div><small>{roundLabel(round,'description')}</small></header>{roundEntries(round).length?<ol>{roundEntries(round).map(entry=><li key={`${entry.playerId}-${entry.round}`}><div className="draft-mobile-owner"><strong>#{entry.overallPickNumber}</strong><PlayerName id={entry.playerId} name={entry.playerName} history={game.history}/></div><DraftSelection entry={entry} game={game}/></li>)}</ol>:<p className="draft-empty">Order will appear when this round is prepared.</p>}</section>)}</div>
  </section>;
}

function DraftSelection({entry,game}:{entry:DraftHistoryEntry|undefined;game:ReturnType<typeof useGame>['game']}){
  if(!entry)return <div className="draft-selection draft-selection-empty"><span>—</span><small>Awaiting pick</small></div>;
  const castaway=entry.pick?.castawayId?game.castaways.find(item=>item.id===entry.pick?.castawayId):undefined;
  if(!castaway)return <div className="draft-selection draft-selection-empty"><strong>#{entry.overallPickNumber}</strong><span>{entry.pick?.decision==='keep'?'Blind pick locked':entry.pick?'Pick recorded':'Awaiting pick'}</span></div>;
  const tribe=tribeForCastaway(game,castaway.id);
  const eliminated=castaway.status==='voted-out';
  return <div className={`draft-selection ${eliminated?'draft-selection-eliminated':''}`}>
    <div className="draft-selection-castaway"><img src={castaway.imageUrl} alt="" loading="lazy"/><div><strong>{castaway.name}</strong><span className="draft-selection-tribe"><i aria-hidden="true" style={tribe?{backgroundColor:tribe.color}:undefined}/>{tribe?.name??'Tribe not assigned'}</span></div></div>
    <span className="draft-selection-pick">#{entry.overallPickNumber}</span>
    {entry.pick?.multiplier&&entry.pick.multiplier>1&&<small className="draft-selection-bonus">1.25x</small>}
  </div>;
}
