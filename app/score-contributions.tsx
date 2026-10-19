import type {GameState} from '@/lib/game-data';
import {playerPointContributions} from '@/lib/player-points';
export function ScoreContributions({game,playerId,total,inJury}:{game:GameState;playerId:string;total:number;inJury:boolean}){
  const points=playerPointContributions(game,playerId,total);
  if(!inJury)return null;
  return <dl className="score-contributions" aria-label="Score breakdown"><div><dt>Castaway Total</dt><dd>{points.fantasy.toFixed(1)}</dd></div><div><dt>Jury Points</dt><dd>{points.jury>=0?'+':''}{points.jury.toFixed(1)}</dd></div></dl>;
}
