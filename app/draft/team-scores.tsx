'use client';
/* eslint-disable @next/next/no-img-element */

import {PlayerName} from '../player-name';
import {useGame} from '../game-provider';
import {tribeForCastaway} from '@/lib/game-data';
import {draftHistoryEntries,draftRosterSize} from '@/lib/draft-board';

export function TeamScores(){
  const {game,standings}=useGame();
  const history=draftHistoryEntries(game);
  return <section className="team-scores-section" aria-labelledby="team-scores-heading">
    <div className="section-title"><div><p className="eyebrow dark">Post-draft scoreboard</p><h2 id="team-scores-heading">Teams &amp; Scores</h2><p>See every roster, who is still active, and the running score from the live leaderboard.</p></div></div>
    <div className="team-scores-grid">{standings.map(player=>{
      const playerEntries=history.filter(entry=>entry.playerId===player.id).sort((a,b)=>a.overallPickNumber-b.overallPickNumber);
      const rosterSize=draftRosterSize(game,player.id);
      const activeCount=playerEntries.filter(entry=>{const castawayId=entry.pick?.castawayId;const castaway=castawayId?game.castaways.find(item=>item.id===castawayId):undefined;return castaway?.status==='active';}).length;
      return <article className="team-score-card" key={player.id}>
        <header><div><p className="team-score-rank">{player.score?'Rank '+player.rank:'Team'}</p><h3><PlayerName id={player.id} name={player.name} history={game.history}/></h3></div><div className="team-score-summary"><strong>{player.score.toFixed(1)}<small> pts</small></strong><span>{activeCount} of {rosterSize} active</span></div></header>
        <div className="team-roster-grid">{Array.from({length:rosterSize},(_,index)=>{const entry=playerEntries[index];return <RosterCastaway key={entry?`${entry.playerId}-${entry.round}`:`${player.id}-empty-${index}`} entry={entry} game={game}/>;})}</div>
      </article>;
    })}</div>
  </section>;
}

function RosterCastaway({entry,game}:{entry:ReturnType<typeof draftHistoryEntries>[number]|undefined;game:ReturnType<typeof useGame>['game']}){
  const castaway=entry?.pick?.castawayId?game.castaways.find(item=>item.id===entry.pick?.castawayId):undefined;
  if(!castaway)return <article className="draft-roster-castaway draft-roster-empty"><div className="draft-roster-empty-mark">?</div><div><strong>{entry?.pick?.decision==='keep'?'Blind pick locked':entry?.pick?'Pick recorded':'Awaiting pick'}</strong><small>{entry?`Round ${entry.round} · #${entry.overallPickNumber}`:'Roster slot'}</small></div></article>;
  const tribe=tribeForCastaway(game,castaway.id);
  const eliminated=castaway.status==='voted-out';
  return <article className={`draft-roster-castaway ${eliminated?'draft-roster-eliminated':''}`}><img src={castaway.imageUrl} alt={castaway.name} loading="lazy"/><div><strong>{castaway.name}</strong><span className="draft-roster-tribe"><i aria-hidden="true" style={tribe?{backgroundColor:tribe.color}:undefined}/>{tribe?.name??'Tribe not assigned'}</span><small>#{entry?.overallPickNumber} · Round {entry?.round}</small></div></article>;
}
