import type {GameState} from './game-data.ts';
import {seasonStandings} from './league.ts';
import {effectiveScorePoints} from './score-ledger.ts';

/** Split the authoritative standings total; all bonuses, deductions and pick multipliers stay intact. */
export function playerPointContributions(game:GameState,playerId:string,total=seasonStandings(game).find(row=>row.profileId===playerId)?.score??0){
  const jury=game.scoreEvents.filter(event=>event.source==='jury'&&event.playerId===playerId).reduce((sum,event)=>sum+effectiveScorePoints(event),0);
  return {fantasy:total-jury,jury,total};
}
