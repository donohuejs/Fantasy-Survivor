import {tribeForCastaway,type Castaway,type DraftPick,type GameState,type Tribe} from './game-data.ts';

export type LeaderRosterEntry={pick:DraftPick;castaway:Castaway;tribe?:Tribe};
export type PointsLead={kind:'lead';points:number}|{kind:'tied'};

export function liveDraftTurn(game:GameState){
  return game.draft.status==='live'?game.draft.turns[game.draft.currentPick]:undefined;
}

export function leaderRoster(game:GameState,playerId:string):LeaderRosterEntry[]{
  return game.draftPicks
    .filter(pick=>pick.playerId===playerId&&Boolean(pick.castawayId))
    .flatMap(pick=>{
      const castaway=game.castaways.find(item=>item.id===pick.castawayId);
      return castaway?[{pick,castaway,tribe:tribeForCastaway(game,castaway.id)}]:[];
    });
}

export function activeLeaderRosterCount(game:GameState,playerId:string){
  return leaderRoster(game,playerId).filter(entry=>entry.castaway.status==='active').length;
}

export function pointsLead(standings:Array<{score:number}>):PointsLead|null{
  if(standings.length<2)return null;
  const difference=standings[0].score-standings[1].score;
  return difference===0?{kind:'tied'}:{kind:'lead',points:difference};
}

export function pollElementId(pollId:string){return `poll-${pollId}`;}
