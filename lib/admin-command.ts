import {activePlayers,buildDraftTurns,insertPlayerAtDraftFront,type GameState,type Castaway,type Tribe,type PossessionStatus} from './game-data.ts';
import {addTribalCouncil,recordCastawayElimination,recordScoring,recordStillOnIsland,recordCastawayBonus,recordFirstTribalCouncil,recordTribalCouncilSurvival,startEpisode,finishEpisode,recordTribalCouncilResolution,saveCustomAction,saveMergeEpisode,saveTribe,assignCastaway,createPossessionRecord,updatePossessionRecord,transferPossessionRecord,changePossessionStatus,updateEliminationReason,type ScoringInput,type EpisodeWideAwardInput,type EpisodeStartInput,type EpisodeFinishInput,type CastawayBonusInput,type CastawayEliminationInput,type EliminationReasonUpdateInput,type FirstTribalCouncilInput,type TribalCouncilSurvivalInput,type TribalCouncilResolutionInput,type CustomActionInput,type PossessionInput} from './scoring.ts';
import {bindProfile as bindSignup,prepareNextSeason as nextSeason,lockSeason,seasonStandings,type PlayerSignup} from './league.ts';
import {combinedHistory,type HistoricalResult} from './history-data.ts';

type Inputs={
  startEpisode:EpisodeStartInput;finishEpisode:EpisodeFinishInput;addScore:ScoringInput;addStillOnIsland:EpisodeWideAwardInput;
  addFirstTribalCouncil:FirstTribalCouncilInput;addTribalCouncilSurvival:TribalCouncilSurvivalInput;addTribalCouncil:{episode:number;number?:number};
  resolveTribalCouncil:TribalCouncilResolutionInput;eliminateCastaway:CastawayEliminationInput;updateEliminationReason:EliminationReasonUpdateInput;addCastawayBonus:CastawayBonusInput;
  createPossession:Omit<PossessionInput,'id'>;updatePossession:PossessionInput&{id:string};transferPossession:{possessionId:string;targetCastawayId:string;episode:number;notes:string};
  setPossessionStatus:{possessionId:string;status:PossessionStatus;episode:number;notes:string};setMergeEpisode:{episode?:number};addCustomAction:CustomActionInput;
  updateTribe:Tribe;updateCastaway:{id:string;tribeId:string;status:Castaway['status']};addAdjustment:{playerId:string;points:number;note:string;episode?:number};
  addPlayer:{name:string;email:string};setPlayerEmail:{playerId:string;email:string};setPlayerActive:{playerId:string;active:boolean};setPlayerPaid:{playerId:string;paid:boolean};
  resetSeason:Record<string,never>;finalizeSeason:{order:string[];expectedStandings:ReturnType<typeof seasonStandings>};beginNextSeason:Record<string,never>;
  addCastaway:Omit<Castaway,'id'|'status'>;assignSignup:{uid:string;playerId:string};
};
export type AdminAction=keyof Inputs;
export type AdminCommand={[K in AdminAction]:{id:string;season:number;action:K;input:Inputs[K]}}[AdminAction];
export type AdminInput<K extends AdminAction>=Inputs[K];

/** Existing domain operations, shared with local setup; cloud callers execute only on the server. */
export function applyAdminCommand(current:GameState,command:AdminCommand,at:string,historySeed:HistoricalResult[]=[],signup?:PlayerSignup):GameState {
  if(current.season.number!==command.season)throw new Error('The active season changed. Reload before saving.');
  if(current.season.finalized&&!['setPlayerPaid','finalizeSeason','beginNextSeason'].includes(command.action))throw new Error('This season’s results are locked. Start the next season to make changes.');
  switch(command.action){
    case 'startEpisode':return startEpisode(current,command.input);
    case 'finishEpisode':return finishEpisode(current,command.input);
    case 'addScore':return recordScoring(current,command.input);
    case 'addStillOnIsland':return recordStillOnIsland(current,command.input);
    case 'addFirstTribalCouncil':return recordFirstTribalCouncil(current,command.input);
    case 'addTribalCouncilSurvival':return recordTribalCouncilSurvival(current,command.input);
    case 'addTribalCouncil':return addTribalCouncil(current,command.input);
    case 'resolveTribalCouncil':return recordTribalCouncilResolution(current,command.input);
    case 'eliminateCastaway':return recordCastawayElimination(current,command.input);
    case 'updateEliminationReason':return updateEliminationReason(current,command.input);
    case 'addCastawayBonus':return recordCastawayBonus(current,command.input);
    case 'createPossession':return createPossessionRecord(current,{...command.input,id:command.id});
    case 'updatePossession':return updatePossessionRecord(current,command.input);
    case 'transferPossession':return transferPossessionRecord(current,{...command.input,newPossessionId:command.id});
    case 'setPossessionStatus':return changePossessionStatus(current,command.input);
    case 'setMergeEpisode':return saveMergeEpisode(current,command.input.episode);
    case 'addCustomAction':return saveCustomAction(current,command.input,command.id);
    case 'updateTribe':return saveTribe(current,command.input);
    case 'updateCastaway':return assignCastaway(current,command.input.id,command.input.tribeId,command.input.status);
    case 'addAdjustment':{
      const {playerId,points,note,episode}=command.input;
      if(!current.players.some(p=>p.id===playerId&&p.active!==false)||!Number.isFinite(points)||typeof note!=='string')throw new Error('Choose an active player and valid points.');
      if(episode!==undefined&&(!Number.isInteger(episode)||episode<1))throw new Error('Episode must be a positive whole number, or leave it blank.');
      return {...current,scoreEvents:[...current.scoreEvents,{id:'admin:'+command.id,playerId,points,note,...(episode!==undefined?{episode}:{}),createdAt:at}]};
    }
    case 'addPlayer':{
      if(current.draft.status!=='setup')throw new Error('Add profiles before starting the draft.');
      const clean=command.input.name?.trim();if(!clean||clean.length>50||typeof command.input.email!=='string')throw new Error('Enter a name between 1 and 50 characters.');
      if(current.players.some(p=>p.name.toLowerCase()===clean.toLowerCase()))throw new Error('That name already has a profile in this season.');
      const rows=new Map(historySeed.map(r=>[r.season+':'+r.profileId,r]));for(const row of combinedHistory(current.history))rows.set(row.season+':'+row.profileId,row);
      const historical=[...rows.values()].find(r=>r.name.toLowerCase()===clean.toLowerCase());
      if(historical&&current.players.some(p=>p.id===historical.profileId))throw new Error('That historical profile is already in this season.');
      const player={id:historical?.profileId??command.id,name:clean,email:command.input.email.trim().toLowerCase(),entryBonus:0,priorFinish:0,draftSlot:1};
      const players=insertPlayerAtDraftFront(current.players,player);return {...current,players,draft:{...current.draft,turns:buildDraftTurns(players)}};
    }
    case 'setPlayerEmail':{
      const {playerId,email}=command.input,player=current.players.find(p=>p.id===playerId);if(!player)throw new Error('Choose a current player profile.');
      if(player.uid)throw new Error('This permanent profile is locked to its Google account.');if(current.draft.status!=='setup')throw new Error('Change player access before starting the draft.');
      const clean=email?.trim().toLowerCase();if(!clean||!/^\S+@\S+\.\S+$/.test(clean))throw new Error('Enter a valid email address.');
      if(current.players.some(other=>other.id!==playerId&&other.email.trim().toLowerCase()===clean))throw new Error('That email is already assigned to another player.');
      return {...current,players:current.players.map(p=>p.id===playerId?{...p,email:clean}:p)};
    }
    case 'setPlayerActive':{
      const {playerId,active}=command.input;if(typeof active!=='boolean')throw new Error('Choose an active state.');
      if(current.draft.status!=='setup'||current.draftPicks.length)throw new Error('Season roster changes are available only before the draft starts.');
      const player=current.players.find(p=>p.id===playerId);if(!player)throw new Error('Choose a league profile.');if((player.active!==false)===active)return current;
      if(!active&&(player.entryBonus!==0||current.scoreEvents.some(e=>e.playerId===playerId)))throw new Error('This player already has Season '+current.season.number+' scoring. Review those entries before removing the player.');
      let players=current.players.map(p=>p.id===playerId?{...p,active}:p);
      if(active){const lastSlot=Math.max(0,...activePlayers(players.filter(p=>p.id!==playerId)).map(p=>p.draftSlot));players=players.map(p=>p.id===playerId?{...p,draftSlot:lastSlot+1}:p);}
      else{const ordered=activePlayers(players).sort((a,b)=>a.draftSlot-b.draftSlot),slots=new Map(ordered.map((p,i)=>[p.id,i+1]));players=players.map(p=>slots.has(p.id)?{...p,draftSlot:slots.get(p.id)!}:p);}
      return {...current,players,draft:{...current.draft,turns:buildDraftTurns(players)}};
    }
    case 'setPlayerPaid':{
      const {playerId,paid}=command.input;if(typeof paid!=='boolean'||!current.players.some(p=>p.id===playerId))throw new Error('Choose a current player and paid state.');
      return {...current,players:current.players.map(p=>p.id===playerId?{...p,paid}:p)};
    }
    case 'resetSeason':{
      const season={...current.season,currentEpisode:1,episodeStarted:false,episodeStatus:'not-started' as const};delete season.eliminationScoringEffectiveEpisode;delete season.mergeEpisode;delete season.mergeState;delete season.mergeOccurred;delete season.mergeSnapshot;delete season.finalFiveSnapshot;
      return {...current,season,scoreEvents:[],localScoreCorrections:[],draftPicks:[],tribalVotes:[],tribalCouncilResolutions:[],tribalCouncils:[],tribalAttendance:[],players:current.players.map(p=>({...p,entryBonus:0})),draft:{status:'setup',currentPick:0,turns:buildDraftTurns(current.players)}};
    }
    case 'finalizeSeason':{
      if(JSON.stringify(seasonStandings(current))!==JSON.stringify(command.input.expectedStandings))throw new Error('Scores changed during your review. Review the updated standings before locking.');
      return lockSeason(current,command.input.order,at);
    }
    case 'addCastaway':{
      const input=command.input;if(current.draft.status!=='setup')throw new Error('Add castaways before the draft.');
      if(!input.name?.trim()||!Number.isInteger(input.age)||input.age<18)throw new Error('Enter a name and an adult age.');
      if(input.imageUrl&&!/^https:\/\//i.test(input.imageUrl))throw new Error('Use an HTTPS photo URL.');
      return {...current,castaways:[...current.castaways,{...input,id:command.id,status:'active'}]};
    }
    case 'assignSignup':{
      if(!signup)throw new Error('That registration no longer exists.');
      return bindSignup(current,signup,command.input.playerId);
    }
    case 'beginNextSeason':return nextSeason(current);
    default:throw new Error('Unknown commissioner operation.');
  }
}
