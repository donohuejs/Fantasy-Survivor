import type {GameState} from './game-data.ts';
import {juryEligibility} from './jury.ts';

export function playerInJuryMode(game:GameState,playerId:string){
  if(!game.juryMode?.enabled)return false;
  const eligibility=juryEligibility(game,playerId,game.juryMode.reviewedEliminations.map(r=>({...r,provenance:''})));
  return eligibility.fromEpisode!==null&&game.season.currentEpisode>=Math.max(eligibility.fromEpisode,game.juryMode.activationEpisode);
}
/** Leaderboard appearance only; prediction access and score breakdowns keep their episode gate. */
export function leaderboardJuryPresentation(game:GameState,playerId:string){
  if(!game.juryMode?.enabled)return null;
  const eligibility=juryEligibility(game,playerId,game.juryMode.reviewedEliminations.map(r=>({...r,provenance:''})));
  if(eligibility.fromEpisode===null)return null;
  return {inJury:playerInJuryMode(game,playerId)};
}
export function juryEntryAvailable(game:GameState,playerId:string){
  const slots=game.draftPicks.filter(p=>p.playerId===playerId);
  return Boolean(game.juryMode?.enabled&&slots.length===3&&slots.every(p=>game.castaways.find(c=>c.id===p.castawayId)?.status==='voted-out'));
}
