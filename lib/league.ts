import type {GameState,Player,SeasonResult} from './game-data';

export type PlayerSignup={uid:string;name:string;email:string;createdAt:string;assignedPlayerId?:string};
export function seasonStandings(game:GameState):SeasonResult[]{
  const points:Record<string,number>={};
  for(const event of game.scoreEvents)if(event.castawayId)points[event.castawayId]=(points[event.castawayId]??0)+event.points;
  return game.players.map(player=>({profileId:player.id,name:player.name,score:player.entryBonus+game.draftPicks.filter(p=>p.playerId===player.id).reduce((total,p)=>total+(points[p.castawayId]??0)*p.multiplier,0)+game.scoreEvents.filter(e=>e.playerId===player.id).reduce((total,e)=>total+e.points,0),finish:0})).sort((a,b)=>b.score-a.score||a.profileId.localeCompare(b.profileId)).map((row,index)=>({...row,finish:index+1}));
}
export function bindProfile(game:GameState,signup:PlayerSignup,playerId:string):GameState{
  if(game.season.finalized||game.draft.status!=='setup')throw new Error('Assign profiles before starting the draft.');
  if(!signup.uid||!signup.email||!signup.name.trim())throw new Error('This signup is incomplete.');
  if(signup.assignedPlayerId&&signup.assignedPlayerId!==playerId)throw new Error('This account is already locked to another league profile.');
  const player=game.players.find(p=>p.id===playerId);
  if(!player)throw new Error('Choose an existing league profile.');
  if(player.uid&&player.uid!==signup.uid)throw new Error('That profile already belongs to another account.');
  if(player.email&&player.email.toLowerCase()!==signup.email.toLowerCase())throw new Error('That profile has a different email assigned.');
  if(game.players.some(p=>p.id!==playerId&&(p.uid===signup.uid||p.email.toLowerCase()===signup.email.toLowerCase())))throw new Error('This account already has a league profile.');
  // Keep the permanent profile ID: imported history is keyed to it, not the display name or slot.
  return {...game,players:game.players.map(p=>p.id===playerId?{...p,name:signup.name.trim(),uid:signup.uid,email:''}:p)};
}
export function lockSeason(game:GameState,orderedProfileIds:string[],finalizedAt:string):GameState{
  if(game.season.finalized)return game;
  if(game.draft.status!=='complete'||!game.scoreEvents.length)throw new Error('Complete the draft and record season scores before locking results.');
  const standings=seasonStandings(game);
  if(orderedProfileIds.length!==standings.length||new Set(orderedProfileIds).size!==standings.length)throw new Error('Every player must appear exactly once in the final order.');
  const results=orderedProfileIds.map((id,index)=>{const result=standings.find(r=>r.profileId===id);if(!result)throw new Error('Unknown profile in final order.');return {...result,finish:index+1};});
  if(results.some((result,index)=>!Number.isFinite(result.score)||(index>0&&result.score>results[index-1].score)))throw new Error('Only tied scores may change places in the final order.');
  if((game.history??[]).some(s=>s.season===game.season.number))throw new Error('Results for this season are already archived.');
  return {...game,season:{...game.season,finalized:true},history:[...(game.history??[]),{season:game.season.number,finalizedAt,results}]};
}
export function nextSeasonRoster(game:GameState):Player[]{
  const archive=game.history?.find(s=>s.season===game.season.number);
  if(!game.season.finalized||!archive)throw new Error('Lock the current season’s final results first.');
  return [...archive.results].sort((a,b)=>a.finish-b.finish).map(result=>{
    const player=game.players.find(p=>p.id===result.profileId);if(!player)throw new Error('A finalized profile is missing.');
    return {...player,priorFinish:result.finish,draftSlot:archive.results.length-result.finish+1,paid:false,entryBonus:0};
  });
}
export function prepareNextSeason(game:GameState):GameState{
  const players=nextSeasonRoster(game),number=game.season.number+1;
  return {...game,season:{id:`season-${number}`,name:`Survivor ${number}`,number,currentEpisode:1,entryFee:game.season.entryFee,finalized:false},players,castaways:[],tribes:[],draftPicks:[],scoreEvents:[],draft:{status:'setup',currentPick:0,turns:[]}};
}
