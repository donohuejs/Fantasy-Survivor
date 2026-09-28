import type {DraftPick,GameState} from './game-data.ts';
import {availableCastaways} from './draft.ts';

export type CastawayBoardStatus='available'|'drafted'|'private'|'unavailable';
export type CastawayBoardItem={castawayId:string;status:CastawayBoardStatus;draftedBy?:string};
export type CastawayBoard={round:number;items:CastawayBoardItem[]};
export type DraftHistoryEntry={
  playerId:string;
  playerName:string;
  round:number;
  pickNumber:number;
  overallPickNumber:number;
  pick?:DraftPick;
};

const pickKey=(playerId:string,round:number,pickNumber:number)=>`${playerId}:${round}:${pickNumber}`;

/** The order in draft.turns is the authoritative sequence, including Round 3's shuffle. */
export function draftOverallPickNumber(game:GameState,pick:Pick<DraftPick,'playerId'|'round'|'pickNumber'>):number|undefined {
  const index=game.draft.turns.findIndex(turn=>turn.playerId===pick.playerId&&turn.round===pick.round&&turn.pickNumber===pick.pickNumber);
  if(index>=0)return index+1;
  const previousRounds=[...new Set(game.draft.turns.map(turn=>turn.round))].filter(round=>round<pick.round);
  const previousCount=previousRounds.reduce((total,round)=>total+game.draft.turns.filter(turn=>turn.round===round).length,0);
  return previousCount+pick.pickNumber;
}

/** Pairs scheduled turns with the saved picks without creating a second draft state. */
export function draftHistoryEntries(game:GameState):DraftHistoryEntry[] {
  const picks=new Map(game.draftPicks.map(pick=>[pickKey(pick.playerId,pick.round,pick.pickNumber),pick]));
  const used=new Set<string>();
  const entries=game.draft.turns.map((turn,index)=>{
    const key=pickKey(turn.playerId,turn.round,turn.pickNumber);
    const pick=picks.get(key);
    if(pick)used.add(pick.id);
    return {playerId:turn.playerId,playerName:turn.playerName,round:turn.round,pickNumber:turn.pickNumber,overallPickNumber:index+1,pick};
  });
  // Legacy saved games can contain picks whose turn metadata was not persisted. Keep those picks visible.
  return [...entries,...game.draftPicks.filter(pick=>!used.has(pick.id)).map(pick=>({
    playerId:pick.playerId,
    playerName:game.players.find(player=>player.id===pick.playerId)?.name??'Unknown player',
    round:pick.round,
    pickNumber:pick.pickNumber,
    overallPickNumber:draftOverallPickNumber(game,pick)??pick.pickNumber,
    pick,
  }))].sort((a,b)=>a.overallPickNumber-b.overallPickNumber||a.round-b.round||a.pickNumber-b.pickNumber);
}

export function draftRounds(game:GameState):number[] {
  const rounds=new Set([...game.draft.turns.map(turn=>turn.round),...game.draftPicks.map(pick=>pick.round)]);
  if(game.draftOrderVersion===2||game.draft.version===2)rounds.add(3);
  return [...rounds].sort((a,b)=>a-b);
}

export function draftRosterSize(game:GameState,playerId:string):number {
  const scheduled=new Set(game.draft.turns.filter(turn=>turn.playerId===playerId).map(turn=>turn.round)).size;
  const picked=new Set(game.draftPicks.filter(pick=>pick.playerId===playerId).map(pick=>pick.round)).size;
  return Math.max(scheduled,picked,draftRounds(game).length,1);
}

function boardRound(game:GameState):number {
  const turn=game.draft.turns[game.draft.currentPick];
  if(turn)return turn.round;
  return game.draftPicks.reduce((latest,pick)=>Math.max(latest,pick.round),1);
}

/** Describes what the public castaway pool can show without exposing blind cards. */
export function castawayBoard(game:GameState):CastawayBoard {
  const round=boardRound(game);
  const currentTurn=game.draft.turns[game.draft.currentPick];
  const picks=game.draftPicks.filter(pick=>pick.round===round&&pick.castawayId);
  const drafted=new Map(picks.map(pick=>[pick.castawayId,game.players.find(player=>player.id===pick.playerId)?.name]));
  const available=round===3
    ? new Set(game.draft.blind?.discards??[])
    : currentTurn||game.draft.status==='setup'
      ? new Set(availableCastaways(game).map(castaway=>castaway.id))
      : new Set<string>();
  const privateRound=round===3&&game.draft.status!=='complete';
  return {round,items:game.castaways.map(castaway=>({
    castawayId:castaway.id,
    status:drafted.has(castaway.id)?'drafted':castaway.status==='voted-out'?'unavailable':available.has(castaway.id)?'available':privateRound?'private':'unavailable',
    ...(drafted.get(castaway.id)?{draftedBy:drafted.get(castaway.id)}:{}),
  }))};
}
