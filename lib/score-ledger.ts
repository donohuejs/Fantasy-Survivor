import type {GameState,ScoreEvent} from './game-data.ts';

/** Reversed awards remain in the ledger as tombstones and duplicate-award guards. */
export function effectiveScorePoints(event:ScoreEvent){return event.scoringStatus==='reversed'?0:event.points;}
export function scoreActionKey(event:ScoreEvent){
  // Two same-named possessions can be played/lost by the same castaway at one council.
  // Each possession outcome is its own action; never merge their points into one award.
  const itemOutcome=event.source==='tribal-council'&&['use-idol','use-advantage','idol-pocket','advantage-pocket'].includes(event.categoryId??'');
  return event.scoringActionId??JSON.stringify([itemOutcome?event.id:event.batchId||event.id,event.episode??0,event.categoryId??'',event.actionLabel??'',event.tribeId||event.tribeName||'',event.note??'',event.source??'',event.playerId?'player':'castaway']);
}
export function scoringActions(game:GameState,episode?:number){
  const groups=new Map<string,ScoreEvent[]>();
  for(const event of game.scoreEvents){
    if(episode!==undefined&&event.episode!==episode)continue;
    const key=scoreActionKey(event),group=groups.get(key);
    if(group)group.push(event);else groups.set(key,[event]);
  }
  return [...groups.values()].map(events=>({id:events[0].id,events,active:events.filter(event=>event.scoringStatus!=='reversed')}));
}
export function castawayScoreTotals(game:Pick<GameState,'castaways'|'scoreEvents'>){
  const totals:Record<string,number>=Object.fromEntries(game.castaways.map(c=>[c.id,0]));
  for(const event of game.scoreEvents)if(event.castawayId)totals[event.castawayId]=(totals[event.castawayId]??0)+effectiveScorePoints(event);
  return totals;
}
export function canonicalJson(value:unknown):string{
  return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
}
/** Include all score inputs so a review cannot silently save with different standings. */
export async function scoringVersion(game:GameState){
  const data=canonicalJson({season:{id:game.season.id,number:game.season.number,finalized:Boolean(game.season.finalized)},scoreEvents:game.scoreEvents,draftPicks:game.draftPicks,players:game.players.map(p=>({id:p.id,name:p.name,entryBonus:p.entryBonus,active:p.active!==false})),castaways:game.castaways.map(c=>({id:c.id,name:c.name}))});
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
