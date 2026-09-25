import type {GameState} from './game-data.ts';

export type CastawayLeaderboardRow={castawayId:string;name:string;status:'active'|'voted-out';byEpisode:Record<number,number>;total:number};
export type CastawayLeaderboard={episodes:number[];active:CastawayLeaderboardRow[];eliminated:CastawayLeaderboardRow[]};

const byScore=(left:CastawayLeaderboardRow,right:CastawayLeaderboardRow)=>right.total-left.total||left.name.localeCompare(right.name);

export function castawayLeaderboard(game:Pick<GameState,'castaways'|'scoreEvents'|'season'>):CastawayLeaderboard {
  const episodes=Array.from({length:Math.max(1,game.season.currentEpisode)},(_,index)=>index+1);
  const rows=game.castaways.map(castaway=>({castawayId:castaway.id,name:castaway.name,status:castaway.status,byEpisode:{},total:0} as CastawayLeaderboardRow));
  const byId=new Map(rows.map(row=>[row.castawayId,row]));
  for(const event of game.scoreEvents){
    if(!event.castawayId)continue;
    const row=byId.get(event.castawayId);
    if(!row)continue;
    row.total+=event.points;
    if(event.episode!==undefined&&Number.isInteger(event.episode)&&event.episode>0)row.byEpisode[event.episode]=(row.byEpisode[event.episode]??0)+event.points;
  }
  return {episodes,active:rows.filter(row=>row.status==='active').sort(byScore),eliminated:rows.filter(row=>row.status==='voted-out').sort(byScore)};
}
