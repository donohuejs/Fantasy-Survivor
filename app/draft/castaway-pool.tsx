'use client';
/* eslint-disable @next/next/no-img-element */

import {castawayBoard,type CastawayBoardStatus} from '@/lib/draft-board';
import {tribeForCastaway} from '@/lib/game-data';
import {useGame} from '../game-provider';

const statusLabels:Record<CastawayBoardStatus,string>={available:'Available',drafted:'Drafted',private:'Private card',unavailable:'Not available'};

export function CastawayPool(){
  const {game}=useGame();
  const board=castawayBoard(game);
  const liveBlind=board.round===3&&game.draft.status!=='complete';
  return <section className="castaway-pool-section" aria-labelledby="castaway-pool-heading">
    <div className="section-title"><div><p className="eyebrow dark">Round {board.round} castaway pool</p><h2 id="castaway-pool-heading">Available and drafted</h2><p className="castaway-pool-intro">The board is read-only. The dropdown above is where the player on the clock confirms a pick.</p></div>
      <div className="castaway-pool-legend" aria-label="Castaway status legend"><span><i className="pool-status-dot available"/>Available</span><span><i className="pool-status-dot drafted"/>Drafted</span>{liveBlind&&<span><i className="pool-status-dot private"/>Private card</span>}</div>
    </div>
    <div className="castaway-pool-grid">{board.items.map(item=>{const castaway=game.castaways.find(candidate=>candidate.id===item.castawayId);if(!castaway)return null;const tribe=tribeForCastaway(game,castaway.id);return <article className={`castaway-pool-card pool-${item.status}`} key={castaway.id}>
      <div className="castaway-pool-card-heading"><img src={castaway.imageUrl} alt="" loading="lazy"/><div className="castaway-pool-card-copy"><strong>{castaway.name}</strong><span className="pool-status">{statusLabels[item.status]}</span></div></div>
      <span className="castaway-pool-tribe"><i aria-hidden="true" style={tribe?{backgroundColor:tribe.color}:undefined}/>{tribe?.name??'Tribe not assigned'}</span><small>{castaway.occupation}</small>
      {item.draftedBy&&<em>Picked by {item.draftedBy}</em>}
    </article>})}</div>
    {liveBlind&&<p className="castaway-pool-note">Round-three dealt cards are intentionally not identified here. Only face-up discards and revealed picks can appear by name.</p>}
  </section>;
}
