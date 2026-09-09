import type {GameState} from './game-data.ts';
import {availableCastaways} from './draft.ts';

export type CastawayBoardStatus='available'|'drafted'|'private'|'unavailable';
export type CastawayBoardItem={castawayId:string;status:CastawayBoardStatus;draftedBy?:string};
export type CastawayBoard={round:number;items:CastawayBoardItem[]};

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
    status:drafted.has(castaway.id)?'drafted':available.has(castaway.id)?'available':privateRound?'private':'unavailable',
    ...(drafted.get(castaway.id)?{draftedBy:drafted.get(castaway.id)}:{}),
  }))};
}
