import {eliminationReasonLabels,eliminationReasons,type Category,type Castaway,type EliminationReason,type EpisodeStatus,type GameState,type MergeSnapshot,type FinalFiveSnapshot,type Possession,type PossessionCategory,type PossessionStatus,type RecipientMode,type TribalAttendanceRecord,type TribalCouncilRecord,type TribalVoteRecord,type Tribe} from './game-data.ts';

export type ScoringInput={categoryId:string;recipientId?:string;recipientIds?:string[];recipientMode?:RecipientMode;episode:number;note:string;expectedRecipientIds:string[];batchId:string;historical?:boolean;tribalCouncilId?:string};
export type CustomActionInput={label:string;points:number;target:Category['target']};
export type EpisodeWideAwardInput={episode:number;note:string;expectedActiveCastawayIds:string[];historical?:boolean};
export type EpisodeStartInput={episode:number;note?:string;expectedActiveCastawayIds:string[]};
export type EpisodeFinishInput={episode:number};
export type CastawayBonusInput={castawayId:string;episode:number;points:number;note:string;batchId:string;historical?:boolean};
export type CastawayEliminationInput={castawayId:string;reason:EliminationReason;episode:number;note?:string;expectedActiveCastawayIds?:string[]};
export type EliminationReasonUpdateInput={castawayId:string;reason:EliminationReason};
export type FirstTribalCouncilInput={tribeId:string;episode:number;note:string;expectedCastawayIds:string[];historical?:boolean;tribalCouncilId?:string;attendeeIds?:string[]};
export type TribalCouncilSurvivalInput={tribeId:string;episode:number;note:string;expectedActiveCastawayIds:string[];historical?:boolean;tribalCouncilId?:string;attendeeIds?:string[];attendeeMode?:RecipientMode};
export type PossessionInput={id?:string;castawayId:string;itemName:string;category:PossessionCategory;acquiredEpisode?:number;notes?:string};
export type PossessionStatusInput={possessionId:string;status:PossessionStatus;episode:number;notes:string};
export type PossessionTransferInput={possessionId:string;targetCastawayId:string;episode:number;notes:string;newPossessionId:string};
export type TribalCouncilItemPlayInput={possessionId:string;playedByCastawayId:string;playedForCastawayId?:string;successful:boolean};
export type ShotInTheDarkInput={castawayId:string;result:'safe'|'unsafe'};
export type TribalVoteInput={castawayId:string;countedVotes:number;nullifiedVotes?:number;extraVotes?:number;revote?:boolean;round?:number};
export type NormalizedTribalVote={castawayId:string;countedVotes:number;nullifiedVotes:number;extraVotes:number;revote:boolean;round:number};
export type TribalCouncilResolutionInput={tribeId?:string;tribalCouncilId?:string;councilNumber?:number;attendeeMode?:RecipientMode;attendeeIds?:string[];eliminatedCastawayId?:string;eliminationReason?:EliminationReason;episode:number;note:string;expectedAttendeeIds:string[];expectedFirstTimeAttendeeIds?:string[];expectedPreMerge?:boolean;expectedTribeName?:string;itemPlays?:TribalCouncilItemPlayInput[];shotsInTheDark?:ShotInTheDarkInput[];postMergeVotes?:TribalVoteInput[]};
export type TribalCouncilPlayedItem={input:TribalCouncilItemPlayInput;possession:Possession;playedBy:Castaway;playedFor?:Castaway};
export type TribalCouncilShot={input:ShotInTheDarkInput;castaway:Castaway};
export type TribalCouncilPreview={resolutionKey:string;tribalCouncilId:string;number:number;tribe:Tribe;episode:number;attendees:Castaway[];firstTimeAttendees:Castaway[];eliminated:Castaway;eliminationReason:EliminationReason;eliminationPenalty:number;eliminationScoringActive:boolean;survivingAttendees:Castaway[];preMerge:boolean;playedItems:TribalCouncilPlayedItem[];shots:TribalCouncilShot[];pocketPossessions:Possession[];attendeeMode:RecipientMode;postMergeVotes:NormalizedTribalVote[]};

const sameIds=(left:string[],right:string[])=>[...left].sort().join('|')===[...right].sort().join('|');

function validateEpisode(episode:number){
  if(!Number.isInteger(episode)||episode<1)throw new Error('Episode must be a positive whole number.');
}

export function currentEpisodeStatus(game:Pick<GameState,'season'>):EpisodeStatus {
  if(game.season.episodeStatus==='in-progress'||game.season.episodeStatus==='complete'||game.season.episodeStatus==='not-started')return game.season.episodeStatus;
  return game.season.episodeStarted?'in-progress':'not-started';
}

export function episodeToStart(game:Pick<GameState,'season'>){
  return currentEpisodeStatus(game)==='complete'?game.season.currentEpisode+1:game.season.currentEpisode;
}

/** Season 51 had already reached Episode 3 when elimination-reason scoring was introduced. */
export const season51EliminationScoringEffectiveEpisode=4;

/**
 * Elimination scoring was introduced while a season was already in progress.
 * The boundary is stored in the season document so later deployments cannot
 * move it. Season 51 has a fixed Episode 4 boundary because Episode 3 was
 * already active when this workflow was introduced; other legacy seasons
 * derive their boundary once from their existing episode state.
 */
export function effectiveEliminationScoringEpisode(game:Pick<GameState,'season'>){
  if(game.season.id==='season-51'&&game.season.number===51)return season51EliminationScoringEffectiveEpisode;
  const saved=game.season.eliminationScoringEffectiveEpisode;
  if(Number.isSafeInteger(saved)&&saved!>0)return saved!;
  return currentEpisodeStatus(game)==='not-started'?game.season.currentEpisode:game.season.currentEpisode+1;
}

export function ensureEliminationScoringBoundary(game:GameState):GameState{
  const effective=effectiveEliminationScoringEpisode(game);
  if(game.season.eliminationScoringEffectiveEpisode===effective)return game;
  return {...game,season:{...game.season,eliminationScoringEffectiveEpisode:effective}};
}

export function eliminationScoringActive(game:Pick<GameState,'season'>,episode:number){
  return episode>=effectiveEliminationScoringEpisode(game);
}

export function eliminationPenalty(reason:EliminationReason,preMerge:boolean){
  if(reason==='voted-out')return preMerge?-1:0;
  if(reason==='voluntary-quit')return -3;
  return 0;
}

export function eliminationPenaltyCategory(reason:EliminationReason){
  return reason==='voted-out'?'elimination-voted-out':reason==='voluntary-quit'?'elimination-voluntary-quit':reason==='medical-evacuation'?'elimination-medical-evacuation':'elimination-other-removal';
}

export function eliminationPenaltyLabel(reason:EliminationReason,preMerge:boolean){
  if(reason==='voted-out')return preMerge?'Voted out before merge':'Voted out';
  return eliminationReasonLabels[reason];
}

function validateEliminationReason(reason:EliminationReason){
  if(!eliminationReasons.includes(reason))throw new Error('Choose a valid elimination reason.');
}

function validateCurrentEpisode(game:GameState,episode:number,historical=false){
  validateEpisode(episode);
  if(historical)return;
  if(currentEpisodeStatus(game)!=='in-progress')throw new Error(`Start Episode ${episodeToStart(game)} before recording scoring actions.`);
  if(episode!==game.season.currentEpisode)throw new Error(`Scoring must use the active Episode ${game.season.currentEpisode}.`);
}

function validatePhase(game:GameState,action:Category,episode:number){
  if(action.phase==='pre-merge'&&mergeIsActive(game,episode))throw new Error(`${action.label} is only available before the merge.`);
  if(action.phase==='merge-only'&&!mergeIsActive(game,episode))throw new Error('Set the merge episode before recording merge-only voting points.');
}

/** The merge is an explicit state transition. mergeEpisode remains a legacy fallback only. */
export function mergeIsActive(game:Pick<GameState,'season'>,episode=game.season.currentEpisode){
  if(game.season.mergeState!==undefined)return game.season.mergeState==='merged'&&(game.season.mergeEpisode===undefined||episode>=game.season.mergeEpisode);
  if(game.season.mergeOccurred!==undefined)return game.season.mergeOccurred&&(game.season.mergeEpisode===undefined||episode>=game.season.mergeEpisode);
  return game.season.mergeEpisode!==undefined&&episode>=game.season.mergeEpisode;
}

export function allowedRecipientModes(game:GameState,category:Category):RecipientMode[]{
  const configured:RecipientMode[]=category.recipientModes?.length?[...category.recipientModes]:(category.target==='tribe'?['tribe','custom']:['individual','custom']);
  const visible=configured.filter(mode=>mode!=='all-active'||mergeIsActive(game));
  return mergeIsActive(game)&&visible.includes('all-active')?['all-active',...visible.filter(mode=>mode!=='all-active')]:visible;
}

export function eligibleRecipientCastaways(game:GameState,category:Category,options:{historical?:boolean;includeLegacyInactive?:boolean}={}){
  // Current scoring only accepts active castaways unless a category explicitly
  // targets another status. Historical backfills retain the previous behavior
  // of allowing any current roster member when no status is configured.
  if(category.recipientStatus)return game.castaways.filter(castaway=>castaway.status===category.recipientStatus);
  return game.castaways.filter(castaway=>options.historical||options.includeLegacyInactive||castaway.status==='active');
}

export function resolveRecipients(game:GameState,category:Category,mode:RecipientMode,recipientId?:string,recipientIds:string[]=[],historical=false):Castaway[]{
  if(!allowedRecipientModes(game,category).includes(mode))throw new Error('That scoring action does not support this recipient mode.');
  if(mode==='all-active')return game.castaways.filter(castaway=>castaway.status==='active');
  if(mode==='tribe'){
    if(!recipientId||!game.tribes.some(t=>t.id===recipientId))throw new Error('Choose a valid tribe.');
    return game.castaways.filter(castaway=>castaway.tribeId===recipientId&&castaway.status==='active');
  }
  const ids=mode==='individual'?(recipientId?[recipientId]:recipientIds):recipientIds;
  if(mode==='individual'&&ids.length!==1)throw new Error('Choose exactly one castaway.');
  if(!ids.length)throw new Error('Choose at least one castaway.');
  const unique=[...new Set(ids)];
  if(unique.length!==ids.length)throw new Error('A castaway can only be selected once for a scoring event.');
  const found=unique.map(id=>game.castaways.find(castaway=>castaway.id===id));
  if(found.some(castaway=>!castaway))throw new Error('Choose valid castaways from this season.');
  const selected=found as Castaway[];
  const eligible=eligibleRecipientCastaways(game,category,{historical,includeLegacyInactive:category.custom});
  if(selected.some(castaway=>!eligible.some(item=>item.id===castaway.id)))throw new Error('One or more selected castaways are not eligible for this scoring action.');
  return selected;
}

export function recipients(game:GameState,category:Category,recipientId:string):Castaway[] {
  // Compatibility wrapper for the original individual/tribe API.
  return resolveRecipients(game,category,category.target==='tribe'?'tribe':'individual',recipientId);
}

export function activePossessions(game:GameState):Possession[]{
  return (game.possessions??[]).filter(possession=>possession.status==='active');
}

const wholeNonNegative=(value:number,label:string)=>{
  if(!Number.isSafeInteger(value)||value<0)throw new Error(`${label} must be a whole number of zero or more.`);
  return value;
};

export function postMergeVoteTotals(game:Pick<GameState,'tribalVotes'>):Record<string,number>{
  return (game.tribalVotes??[]).reduce<Record<string,number>>((totals,vote)=>{
    totals[vote.castawayId]=(totals[vote.castawayId]??0)+vote.countedVotes;
    return totals;
  },{});
}

function validatePostMergeVotes(game:GameState,attendees:Castaway[],preMerge:boolean,input:TribalVoteInput[]|undefined):NormalizedTribalVote[]{
  const votes=input??[];
  if(preMerge&&votes.length)throw new Error('Post-merge votes can only be recorded after the merge.');
  const attendeeIds=new Set(attendees.map(castaway=>castaway.id));
  const keys=new Set<string>();
  return votes.map((vote,index)=>{
    if(!attendeeIds.has(vote.castawayId))throw new Error('Every vote recipient must be an attending castaway.');
    const countedVotes=wholeNonNegative(vote.countedVotes,`Counted votes in row ${index+1}`);
    const nullifiedVotes=wholeNonNegative(vote.nullifiedVotes??0,`Nullified votes in row ${index+1}`);
    const extraVotes=wholeNonNegative(vote.extraVotes??0,`Extra votes in row ${index+1}`);
    if(extraVotes>countedVotes)throw new Error('Extra votes cannot exceed counted votes.');
    const round=vote.round??(vote.revote?2:1);
    if(!Number.isSafeInteger(round)||round<1)throw new Error('Vote round must be a positive whole number.');
    const revote=Boolean(vote.revote||round>1);
    const key=`${vote.castawayId}:${round}`;
    if(keys.has(key))throw new Error('Record each castaway once per vote round.');
    keys.add(key);
    return {castawayId:vote.castawayId,countedVotes,nullifiedVotes,extraVotes,revote,round};
  });
}

function possessionCastaway(game:GameState,castawayId:string){
  const castaway=game.castaways.find(item=>item.id===castawayId);
  if(!castaway)throw new Error('Choose a valid castaway.');
  return castaway;
}

function validatePossessionInput(game:GameState,input:PossessionInput){
  const itemName=input.itemName.trim();
  if(!itemName||itemName.length>120)throw new Error('Enter an item name between 1 and 120 characters.');
  if(input.category!=='idol'&&input.category!=='advantage')throw new Error('Choose Idol or Advantage.');
  possessionCastaway(game,input.castawayId);
  if(input.acquiredEpisode!==undefined&&(!Number.isInteger(input.acquiredEpisode)||input.acquiredEpisode<1))throw new Error('Acquired episode must be a positive whole number.');
  const notes=(input.notes??'').trim();
  if(notes.length>500)throw new Error('Possession notes must be no more than 500 characters.');
  return {itemName,notes};
}

export function createPossessionRecord(game:GameState,input:PossessionInput):GameState{
  const {itemName,notes}=validatePossessionInput(game,input);
  const castaway=possessionCastaway(game,input.castawayId);
  const id=input.id?.trim();
  if(!id)throw new Error('A possession id is required.');
  if((game.possessions??[]).some(possession=>possession.id===id))return game;
  const now=new Date().toISOString();
  const possession:Possession={id,seasonId:game.season.id,lineageId:id,castawayId:castaway.id,originalCastawayId:castaway.id,itemName,category:input.category,status:'active',...(input.acquiredEpisode!==undefined?{acquiredEpisode:input.acquiredEpisode}:{}),acquiredAt:now,notes,updatedAt:now,history:[{action:'acquired',at:now,episode:input.acquiredEpisode,notes}]};
  return {...game,possessions:[...(game.possessions??[]),possession]};
}

export function updatePossessionRecord(game:GameState,input:PossessionInput&{id:string}):GameState{
  const existing=(game.possessions??[]).find(possession=>possession.id===input.id);
  if(!existing)throw new Error('That possession no longer exists. Reload before editing it.');
  if(input.castawayId!==existing.castawayId)throw new Error('Use Transfer possession to change the current owner so the history remains intact.');
  const {itemName,notes}=validatePossessionInput(game,input);
  const changed=itemName!==existing.itemName||input.category!==existing.category||input.acquiredEpisode!==existing.acquiredEpisode||notes!==existing.notes||input.castawayId!==existing.castawayId;
  if(!changed)return game;
  const now=new Date().toISOString();
  return {...game,possessions:(game.possessions??[]).map(possession=>possession.id===existing.id?{...possession,itemName,category:input.category,castawayId:input.castawayId,acquiredEpisode:input.acquiredEpisode,notes,updatedAt:now,history:[...possession.history,{action:'updated',at:now,episode:input.acquiredEpisode,notes}]}:possession)};
}

export function transferPossessionRecord(game:GameState,input:PossessionTransferInput):GameState{
  if((game.possessions??[]).some(possession=>possession.id===input.newPossessionId))return game;
  validateEpisode(input.episode);
  const possessions=game.possessions??[];
  const current=possessions.find(possession=>possession.id===input.possessionId);
  if(!current)throw new Error('That possession no longer exists. Reload before transferring it.');
  if(current.status!=='active')throw new Error('Only an active possession can be transferred.');
  const target=possessionCastaway(game,input.targetCastawayId);
  if(target.status!=='active')throw new Error('Transfer the item to an active castaway.');
  if(target.id===current.castawayId)throw new Error('Choose a different castaway for the transfer.');
  const notes=input.notes.trim();
  if(notes.length>500)throw new Error('Possession notes must be no more than 500 characters.');
  const now=new Date().toISOString();
  const transferred:Possession={...current,id:input.newPossessionId,castawayId:target.id,status:'active',transferredFromPossessionId:current.id,transferredToPossessionId:undefined,updatedAt:now,history:[{action:'transferred-in',at:now,episode:input.episode,fromCastawayId:current.castawayId,toCastawayId:target.id,notes}]};
  const previous={...current,status:'transferred' as const,transferredToPossessionId:transferred.id,updatedAt:now,history:[...current.history,{action:'transferred' as const,at:now,episode:input.episode,fromCastawayId:current.castawayId,toCastawayId:target.id,notes}]};
  return {...game,possessions:possessions.map(possession=>possession.id===current.id?previous:possession).concat(transferred)};
}

export function changePossessionStatus(game:GameState,input:PossessionStatusInput):GameState{
  validateEpisode(input.episode);
  if(input.status==='transferred')throw new Error('Use Transfer possession to record a transfer.');
  const existing=(game.possessions??[]).find(possession=>possession.id===input.possessionId);
  if(!existing)throw new Error('That possession no longer exists. Reload before changing it.');
  const notes=input.notes.trim();
  if(notes.length>500)throw new Error('Possession notes must be no more than 500 characters.');
  if(existing.status===input.status)return game;
  const now=new Date().toISOString();
  const action=input.status==='active'?'updated':input.status;
  return {...game,possessions:(game.possessions??[]).map(possession=>possession.id===existing.id?{...possession,status:input.status,updatedAt:now,history:[...possession.history,{action,at:now,episode:input.episode,notes}]}:possession)};
}

export function episodeStartAwardKey(game:GameState,episode:number){return `${game.season.id}:episode-start:${episode}`;}

export function startEpisode(game:GameState,input:EpisodeStartInput):GameState {
  validateEpisode(input.episode);
  const status=currentEpisodeStatus(game);
  const awardKey=episodeStartAwardKey(game,input.episode);
  const active=game.castaways.filter(castaway=>castaway.status==='active');
  const existing=game.scoreEvents.filter(event=>event.awardKey===awardKey||event.batchId===awardKey);
  if(existing.length){
    if(status!=='in-progress'||game.season.currentEpisode!==input.episode)throw new Error('That episode is no longer available to start. Reload before continuing.');
    if(!sameIds(active.map(castaway=>castaway.id),input.expectedActiveCastawayIds))throw new Error('The active roster changed. Review the episode-start preview and try again.');
    return game;
  }
  if(status==='in-progress')throw new Error(`Finish Episode ${game.season.currentEpisode} before starting the next episode.`);
  const expected=episodeToStart(game);
  if(input.episode!==expected)throw new Error(`The next episode to start is Episode ${expected}. Reload before trying again.`);
  const legacy=game.scoreEvents.filter(event=>(event.categoryId==='still-on-island'||event.categoryId==='alive')&&event.episode===input.episode&&event.castawayId);
  const legacyIds=new Set(legacy.map(event=>event.castawayId as string));
  const missing=active.filter(castaway=>!legacyIds.has(castaway.id));
  if(!sameIds(active.map(castaway=>castaway.id),input.expectedActiveCastawayIds))throw new Error('The active roster changed. Review the episode-start preview and try again.');
  const note=(input.note??'').trim();
  if(note.length>500)throw new Error('Notes must be no more than 500 characters.');
  const createdAt=new Date().toISOString();
  const recipientIds=active.map(castaway=>castaway.id);
  const events=missing.map(castaway=>({id:`${awardKey}:${castaway.id}`,batchId:awardKey,awardKey,castawayId:castaway.id,recipientName:castaway.name,recipientIds,categoryId:'still-on-island',actionLabel:'Still on the island',points:1,episode:input.episode,note,createdAt,source:'episode-wide' as const,resolved:true}));
  return {...game,season:{...game.season,currentEpisode:input.episode,episodeStarted:true,episodeStatus:'in-progress',eliminationScoringEffectiveEpisode:effectiveEliminationScoringEpisode(game)},scoreEvents:[...game.scoreEvents,...events]};
}

export function finishEpisode(game:GameState,input:EpisodeFinishInput):GameState {
  validateEpisode(input.episode);
  if(input.episode!==game.season.currentEpisode)throw new Error(`Episode ${input.episode} is not the current episode.`);
  const status=currentEpisodeStatus(game);
  if(status==='complete')return game;
  if(status!=='in-progress')throw new Error(`Start Episode ${input.episode} before finishing it.`);
  return {...game,season:{...game.season,episodeStarted:false,episodeStatus:'complete'}};
}

export function recordScoring(game:GameState,input:ScoringInput):GameState {
  validateCurrentEpisode(game,input.episode,Boolean(input.historical));
  const action=game.categories.find(c=>c.id===input.categoryId);
  if(!action||action.retired||action.bulkOnly)throw new Error('Choose an active single-recipient scoring action.');
  if(!Number.isFinite(action.points))throw new Error('Points must be a finite number.');
  validatePhase(game,action,input.episode);
  if(game.scoreEvents.some(e=>e.batchId===input.batchId))return game;
  const mode=input.recipientMode??(action.target==='tribe'?'tribe':'individual');
  const selected=resolveRecipients(game,action,mode,input.recipientId,input.recipientIds,Boolean(input.historical));
  if(!selected.length)throw new Error('This tribe has no active members. Assign members before scoring.');
  if(action.recipientStatus&&selected.some(castaway=>castaway.status!==action.recipientStatus))throw new Error(`${action.label} requires a ${action.recipientStatus==='active'?'current active':'voted-out'} castaway.`);
  if(!sameIds(selected.map(c=>c.id),input.expectedRecipientIds))throw new Error('Tribe membership changed. Review the updated recipients and try again.');
  const tribe=input.recipientId?game.tribes.find(t=>t.id===input.recipientId):null;
  const recipientIds=selected.map(c=>c.id);
  const createdAt=new Date().toISOString();
  const events=selected.map(c=>({id:`${input.batchId}:${c.id}`,batchId:input.batchId,castawayId:c.id,recipientName:c.name,categoryId:action.id,actionLabel:action.label,points:action.points,episode:input.episode,note:input.note.trim(),createdAt,recipientMode:mode,recipientIds,resolved:true,...(input.tribalCouncilId?{tribalCouncilId:input.tribalCouncilId}:{}),...(tribe?{tribeId:tribe.id,tribeName:tribe.name}:{})}));
  return {...game,scoreEvents:[...game.scoreEvents,...events]};
}

export function stillOnIslandAwardKey(game:GameState,episode:number){return `${game.season.id}:still-on-island:${episode}`;}
export function firstTribalCouncilAwardKey(game:GameState,tribeId:string,episode:number){return `${game.season.id}:first-tribal-council:${episode}:${tribeId}`;}
export function tribalCouncilSurvivalAwardKey(game:GameState,tribeId:string,episode:number){return `${game.season.id}:survive-tribal:${episode}:${tribeId}`;}
export function tribalCouncilResolutionKey(game:GameState,tribeId:string,episode:number){return `${game.season.id}:tribal-council:${episode}:${tribeId}`;}
export function tribalCouncilId(game:GameState,episode:number,number:number){return `${game.season.id}:tribal-council:${episode}:${number}`;}
export function tribalCouncilResolutionEventKey(game:GameState,episode:number,number:number){return tribalCouncilId(game,episode,number);}

export function episodeTribalCouncils(game:GameState,episode=game.season.currentEpisode):TribalCouncilRecord[]{
  const saved=(game.tribalCouncils??[]).filter(council=>council.episode===episode).sort((a,b)=>a.number-b.number||a.id.localeCompare(b.id));
  if(saved.some(council=>council.number===1))return saved;
  const first:TribalCouncilRecord={id:tribalCouncilId(game,episode,1),episode,number:1,attendeeMode:mergeIsActive(game,episode)?'all-active':'tribe',attendeeIds:[],status:'awaiting-resolution'};
  return [first,...saved];
}

export function addTribalCouncil(game:GameState,input:{episode:number;number?:number}):GameState{
  validateCurrentEpisode(game,input.episode);
  const existing=(game.tribalCouncils??[]).filter(council=>council.episode===input.episode);
  const number=input.number??(existing.length?Math.max(...existing.map(council=>council.number))+1:2);
  if(!Number.isInteger(number)||number<1)throw new Error('Tribal Council number must be a positive whole number.');
  if(existing.some(council=>council.number===number))return game;
  const record:TribalCouncilRecord={id:tribalCouncilId(game,input.episode,number),episode:input.episode,number,attendeeMode:mergeIsActive(game,input.episode)?'all-active':'tribe',attendeeIds:[],status:'awaiting-resolution',createdAt:new Date().toISOString()};
  return {...game,tribalCouncils:[...(game.tribalCouncils??[]),record]};
}

export function recordTribalCouncilSurvival(game:GameState,input:TribalCouncilSurvivalInput):GameState {
  validateCurrentEpisode(game,input.episode,Boolean(input.historical));
  const action=game.categories.find(category=>category.id==='survive-tribal');
  if(action)validatePhase(game,action,input.episode);
  const note=input.note.trim();
  if(note.length>500)throw new Error('Notes must be no more than 500 characters.');
  const tribe=game.tribes.find(item=>item.id===input.tribeId);
  if(!tribe)throw new Error('Choose a valid tribe.');
  const awardKey=input.tribalCouncilId??tribalCouncilSurvivalAwardKey(game,input.tribeId,input.episode);
  if(game.scoreEvents.some(event=>event.awardKey===awardKey||event.batchId===awardKey))return game;
  const selected=input.attendeeIds
    ? resolveRecipients(game,{id:'survive-tribal',label:'Survive Tribal Council',points:1,group:'Tribal council',target:'individual'},'custom',undefined,input.attendeeIds)
    : game.castaways.filter(castaway=>castaway.tribeId===input.tribeId&&castaway.status==='active');
  if(!selected.length)throw new Error('This tribe has no active members to receive survival points.');
  if(!sameIds(selected.map(castaway=>castaway.id),input.expectedActiveCastawayIds))throw new Error('The active tribe roster changed. Review the remaining castaways and try again.');
  const createdAt=new Date().toISOString();
  const recipientIds=selected.map(castaway=>castaway.id);
  const events=selected.map(castaway=>({id:`${awardKey}:${castaway.id}`,batchId:awardKey,awardKey,castawayId:castaway.id,recipientName:castaway.name,categoryId:'survive-tribal',actionLabel:'Survive pre-merge Tribal Council',points:1,episode:input.episode,note,createdAt,tribeId:tribe.id,tribeName:tribe.name,source:'tribe-wide' as const,recipientMode:input.attendeeMode??(input.attendeeIds?'custom':'tribe'),recipientIds,...(input.tribalCouncilId?{tribalCouncilId:input.tribalCouncilId,resolved:true}:{})}));
  return {...game,scoreEvents:[...game.scoreEvents,...events]};
}

export function recordFirstTribalCouncil(game:GameState,input:FirstTribalCouncilInput):GameState {
  validateCurrentEpisode(game,input.episode,Boolean(input.historical));
  const note=input.note.trim();
  if(note.length>500)throw new Error('Notes must be no more than 500 characters.');
  const tribe=game.tribes.find(item=>item.id===input.tribeId);
  if(!tribe)throw new Error('Choose a valid tribe.');
  const selected=input.attendeeIds?resolveRecipients(game,{id:'first-tribal-council',label:'First Tribal Council attendance',points:1,group:'Tribal council',target:'individual'},'custom',undefined,input.attendeeIds):game.castaways.filter(castaway=>castaway.tribeId===input.tribeId);
  if(!selected.length)throw new Error('This tribe has no assigned castaways. Assign members before recording attendance.');
  if(!sameIds(selected.map(castaway=>castaway.id),input.expectedCastawayIds))throw new Error('Tribe roster changed. Review the full roster and try again.');
  const awardKey=firstTribalCouncilAwardKey(game,input.tribeId,input.episode);
  const alreadyRecorded=new Set(game.scoreEvents.filter(event=>event.categoryId==='first-tribal-council'&&event.castawayId).map(event=>event.castawayId as string));
  const councilId=input.tribalCouncilId??awardKey;
  const recordedAttendance=new Set((game.tribalAttendance??[]).map(record=>record.castawayId));
  const pending=selected.filter(castaway=>!alreadyRecorded.has(castaway.id));
  const newAttendance=selected.filter(castaway=>!recordedAttendance.has(castaway.id));
  if(!pending.length&&!newAttendance.length)return game;
  const createdAt=new Date().toISOString();
  const recipientIds=selected.map(castaway=>castaway.id);
  const events=pending.map(castaway=>({id:`${awardKey}:${castaway.id}`,batchId:awardKey,awardKey,castawayId:castaway.id,recipientName:castaway.name,categoryId:'first-tribal-council',actionLabel:'First Tribal Council attendance',points:input.episode,episode:input.episode,note,createdAt,tribeId:tribe.id,tribeName:tribe.name,source:'first-tribal-council' as const,recipientMode:(input.attendeeIds?'custom':'tribe') as RecipientMode,recipientIds,tribalCouncilId:councilId,resolved:true}));
  const attendance=newAttendance.map(castaway=>({id:`${councilId}:${castaway.id}`,castawayId:castaway.id,episode:input.episode,tribalCouncilId:councilId,tribalCouncilNumber:1,tribeId:tribe.id,attendedAt:createdAt}));
  return {...game,scoreEvents:[...game.scoreEvents,...events],tribalAttendance:[...(game.tribalAttendance??[]),...attendance]};
}

export function recordStillOnIsland(game:GameState,input:EpisodeWideAwardInput):GameState {
  validateCurrentEpisode(game,input.episode,Boolean(input.historical));
  const note=input.note.trim();
  if(note.length>500)throw new Error('Notes must be no more than 500 characters.');
  const awardKey=stillOnIslandAwardKey(game,input.episode);
  const existing=game.scoreEvents.find(event=>(event.awardKey===awardKey||event.batchId===awardKey||((event.categoryId==='still-on-island'||event.categoryId==='alive')&&event.episode===input.episode)));
  if(existing){
    if(existing.awardKey===awardKey||existing.batchId===awardKey)return game;
    throw new Error(`The Still on the island award is already recorded for Episode ${input.episode}.`);
  }
  const selected=game.castaways.filter(castaway=>castaway.status==='active');
  if(!selected.length)throw new Error('There are no active castaways to receive this award.');
  if(!sameIds(selected.map(castaway=>castaway.id),input.expectedActiveCastawayIds))throw new Error('The active roster changed. Review the roster and try again before changing elimination status.');
  const createdAt=new Date().toISOString();
  const recipientIds=selected.map(castaway=>castaway.id);
  const events=selected.map(castaway=>({id:`${awardKey}:${castaway.id}`,batchId:awardKey,awardKey,castawayId:castaway.id,recipientName:castaway.name,recipientIds,categoryId:'still-on-island',actionLabel:'Still on the island',points:1,episode:input.episode,note,createdAt,source:'episode-wide' as const,resolved:true}));
  return {...game,scoreEvents:[...game.scoreEvents,...events]};
}

export function recordCastawayBonus(game:GameState,input:CastawayBonusInput):GameState {
  validateCurrentEpisode(game,input.episode,Boolean(input.historical));
  if(!Number.isFinite(input.points)||input.points===0)throw new Error('Enter a non-zero finite point value.');
  const note=input.note.trim();
  if(!note||note.length>500)throw new Error('A reason is required and must be no more than 500 characters.');
  if(game.scoreEvents.some(event=>event.batchId===input.batchId))return game;
  const castaway=game.castaways.find(item=>item.id===input.castawayId);
  if(!castaway)throw new Error('Choose a valid castaway.');
  const event={id:input.batchId,batchId:input.batchId,castawayId:castaway.id,recipientName:castaway.name,points:input.points,episode:input.episode,note,actionLabel:'One-time castaway bonus',createdAt:new Date().toISOString(),source:'one-time-bonus' as const};
  return {...game,scoreEvents:[...game.scoreEvents,event]};
}

export function eliminationPenaltyEventKey(game:GameState,castawayId:string,episode:number){
  return `${game.season.id}:elimination:${castawayId}:${episode}`;
}

type EliminationEventContext={note?:string;tribalCouncilId?:string;tribeId?:string;tribeName?:string};

function updateEliminationReferences(game:GameState,castawayId:string,episode:number,reason:EliminationReason):GameState{
  return {
    ...game,
    ...(game.tribalCouncilResolutions?{tribalCouncilResolutions:game.tribalCouncilResolutions.map(record=>record.eliminatedCastawayId===castawayId&&record.episode===episode?{...record,eliminationReason:reason}:record)}:{}),
    ...(game.tribalCouncils?{tribalCouncils:game.tribalCouncils.map(record=>record.eliminatedCastawayId===castawayId&&record.episode===episode?{...record,eliminationReason:reason}:record)}:{}),
  };
}

/**
 * Replace only the automatic elimination event for an eligible future
 * episode. Historical events, including legacy pre-merge vote-out events and
 * one-time manual corrections, are deliberately never touched here.
 */
function reconcileEliminationPenalty(game:GameState,castawayId:string,reason:EliminationReason,episode:number,context:EliminationEventContext={}):GameState{
  validateEliminationReason(reason);
  const withReferences=updateEliminationReferences(game,castawayId,episode,reason);
  if(!eliminationScoringActive(withReferences,episode))return withReferences;
  // A legacy pre-merge event can exist for an eligible future episode if a
  // council was recorded by an older build. It is an automatic elimination
  // outcome too, so remove it only inside this future-episode reconciliation;
  // historical events remain untouched.
  const oldEvents=withReferences.scoreEvents.filter(event=>(event.source==='elimination'||event.categoryId==='elimination-voted-out'||event.categoryId==='voted-premerge')&&event.castawayId===castawayId&&event.episode===episode);
  const existing=oldEvents[0];
  const preMerge=!mergeIsActive(withReferences,episode);
  const points=eliminationPenalty(reason,preMerge);
  const key=eliminationPenaltyEventKey(withReferences,castawayId,episode);
  const castaway=withReferences.castaways.find(item=>item.id===castawayId);
  if(!castaway)throw new Error('Choose a valid castaway.');
  const note=context.note??existing?.note??'';
  const event={
    id:key,
    batchId:existing?.batchId??key,
    awardKey:existing?.awardKey??key,
    castawayId,
    recipientName:castaway.name,
    recipientIds:[castawayId],
    categoryId:eliminationPenaltyCategory(reason),
    actionLabel:eliminationPenaltyLabel(reason,preMerge),
    points,
    episode,
    note,
    createdAt:new Date().toISOString(),
    source:'elimination' as const,
    eliminationReason:reason,
    ...(context.tribalCouncilId??existing?.tribalCouncilId?{tribalCouncilId:context.tribalCouncilId??existing?.tribalCouncilId}:{}),
    ...(context.tribeId||existing?.tribeId?{tribeId:context.tribeId??existing?.tribeId}:{}),
    ...(context.tribeName||existing?.tribeName?{tribeName:context.tribeName??existing?.tribeName}:{}),
    resolved:true,
  };
  const removed=new Set(oldEvents.map(item=>item.id));
  return {...withReferences,scoreEvents:[...withReferences.scoreEvents.filter(item=>!removed.has(item.id)),event]};
}

function withEliminationMetadata(game:GameState,castawayId:string,reason:EliminationReason,episode:number):GameState{
  validateEliminationReason(reason);
  return {...game,castaways:game.castaways.map(castaway=>castaway.id===castawayId?{...castaway,status:'voted-out' as const,eliminationReason:reason,eliminationEpisode:episode}:castaway)};
}

export function recordCastawayElimination(game:GameState,input:CastawayEliminationInput):GameState{
  validateCurrentEpisode(game,input.episode);
  validateEliminationReason(input.reason);
  validateEpisode(input.episode);
  const note=(input.note??'').trim();
  if(note.length>500)throw new Error('Notes must be no more than 500 characters.');
  const castaway=game.castaways.find(item=>item.id===input.castawayId);
  if(!castaway)throw new Error('Choose a valid castaway.');
  if(input.expectedActiveCastawayIds&&!sameIds(game.castaways.filter(item=>item.status==='active').map(item=>item.id),input.expectedActiveCastawayIds))throw new Error('The active roster changed. Review the elimination preview and try again.');
  if(castaway.status==='voted-out'){
    if(castaway.eliminationEpisode===input.episode&&castaway.eliminationReason===input.reason)return game;
    throw new Error('That castaway is already eliminated. Update the recorded reason instead.');
  }
  const next=withEliminationMetadata(game,input.castawayId,input.reason,input.episode);
  return reconcileEliminationPenalty(next,input.castawayId,input.reason,input.episode,{note});
}

export function updateEliminationReason(game:GameState,input:EliminationReasonUpdateInput):GameState{
  validateEliminationReason(input.reason);
  const castaway=game.castaways.find(item=>item.id===input.castawayId);
  if(!castaway||castaway.status!=='voted-out')throw new Error('Choose an eliminated castaway.');
  if(castaway.eliminationReason===input.reason)return game;
  const next={...game,castaways:game.castaways.map(item=>item.id===input.castawayId?{...item,eliminationReason:input.reason}:item)};
  if(castaway.eliminationEpisode===undefined)return next;
  const event=game.scoreEvents.find(item=>item.source==='elimination'&&item.castawayId===input.castawayId&&item.episode===castaway.eliminationEpisode);
  return reconcileEliminationPenalty(next,input.castawayId,input.reason,castaway.eliminationEpisode,{note:event?.note,tribalCouncilId:event?.tribalCouncilId,tribeId:event?.tribeId,tribeName:event?.tribeName});
}

export function previewTribalCouncil(game:GameState,input:TribalCouncilResolutionInput):TribalCouncilPreview {
  validateCurrentEpisode(game,input.episode);
  const saved=input.tribalCouncilId?(game.tribalCouncils??[]).find(council=>council.id===input.tribalCouncilId):undefined;
  const number=saved?.number??input.councilNumber??1;
  const councilId=saved?.id??input.tribalCouncilId??(input.tribeId&&number===1?tribalCouncilResolutionKey(game,input.tribeId,input.episode):tribalCouncilId(game,input.episode,number));
  const mode=input.attendeeMode??saved?.attendeeMode??(input.attendeeIds?'custom':input.tribeId?'tribe':mergeIsActive(game,input.episode)?'all-active':'tribe');
  const tribeId=input.tribeId??saved?.tribeId;
  const tribe=tribeId?game.tribes.find(item=>item.id===tribeId):undefined;
  if(mode==='tribe'&&!tribe)throw new Error('Choose a valid tribe.');
  const savedAttendeeIds=saved?.attendeeIds?.length?saved.attendeeIds:undefined;
  const requestedIds=input.attendeeIds??savedAttendeeIds;
  let attendees:Castaway[];
  if(mode==='all-active')attendees=game.castaways.filter(castaway=>castaway.status==='active');
  else if(mode==='tribe')attendees=game.castaways.filter(castaway=>castaway.tribeId===tribe!.id&&castaway.status==='active');
  else attendees=resolveRecipients(game,{id:'tribal-attendees',label:'Tribal attendees',points:0,group:'Tribal council',target:'individual'},mode,undefined,requestedIds??[]).filter(castaway=>castaway.status==='active');
  if(!attendees.length)throw new Error('Choose at least one active castaway for Tribal Council.');
  if(!sameIds(attendees.map(castaway=>castaway.id),input.expectedAttendeeIds))throw new Error('The Tribal attendee roster changed. Review the Tribal Council preview and try again.');
  const eliminated=input.eliminatedCastawayId?attendees.find(castaway=>castaway.id===input.eliminatedCastawayId):undefined;
  if(input.eliminatedCastawayId&&!eliminated)throw new Error('Choose an active castaway from the Tribal attendees to eliminate.');
  const alreadyRecorded=new Set([
    ...(game.tribalAttendance??[]).map(record=>record.castawayId),
    ...game.scoreEvents.filter(event=>event.categoryId==='first-tribal-council'&&event.castawayId).map(event=>event.castawayId as string),
  ]);
  const firstTimeAttendees=attendees.filter(castaway=>!alreadyRecorded.has(castaway.id));
  const preMerge=!mergeIsActive(game,input.episode);
  const eliminationReason=input.eliminationReason??saved?.eliminationReason??'voted-out';
  validateEliminationReason(eliminationReason);
  if(input.expectedFirstTimeAttendeeIds&&!sameIds(firstTimeAttendees.map(castaway=>castaway.id),input.expectedFirstTimeAttendeeIds))throw new Error('Tribal Council scoring changed while you were reviewing it. Refresh the preview and try again.');
  if(input.expectedPreMerge!==undefined&&input.expectedPreMerge!==preMerge)throw new Error('The scoring phase changed while you were reviewing Tribal Council. Refresh the preview and try again.');
  if(input.expectedTribeName!==undefined&&input.expectedTribeName!==tribe?.name)throw new Error('The tribe name changed while you were reviewing Tribal Council. Refresh the preview and try again.');
  const attendeeIds=new Set(attendees.map(castaway=>castaway.id));
  const plays=input.itemPlays??[];
  if(new Set(plays.map(play=>play.possessionId)).size!==plays.length)throw new Error('An idol or advantage can only be selected once for this Tribal Council.');
  const playedItems=plays.map(play=>{
    if(typeof play.successful!=='boolean')throw new Error('Mark every selected idol or advantage successful or unsuccessful.');
    const possession=activePossessions(game).find(item=>item.id===play.possessionId);
    if(!possession)throw new Error('Every selected idol or advantage must still be active. Refresh the Tribal Council preview.');
    if(!attendeeIds.has(possession.castawayId))throw new Error('Only active possessions held by attending castaways can be played.');
    const playedBy=attendees.find(castaway=>castaway.id===play.playedByCastawayId);
    if(!playedBy)throw new Error('The castaway who played an item must be attending Tribal Council.');
    const playedFor=play.playedForCastawayId?attendees.find(castaway=>castaway.id===play.playedForCastawayId):undefined;
    if(play.playedForCastawayId&&!playedFor)throw new Error('An item can only be played for an attending castaway.');
    return {input:play,possession,playedBy,playedFor};
  });
  const shotsInput=input.shotsInTheDark??[];
  if(new Set(shotsInput.map(shot=>shot.castawayId)).size!==shotsInput.length)throw new Error('Each attending castaway can record only one Shot in the Dark result at this Tribal Council.');
  const shots=shotsInput.map(shot=>{
    if(shot.result!=='safe'&&shot.result!=='unsafe')throw new Error('Choose Safe or Unsafe for every Shot in the Dark result.');
    const castaway=attendees.find(item=>item.id===shot.castawayId);
    if(!castaway)throw new Error('Only attending castaways can use Shot in the Dark.');
    return {input:shot,castaway};
  });
  const playedIds=new Set(playedItems.map(item=>item.possession.id));
  const pocketPossessions=eliminated?activePossessions(game).filter(possession=>possession.castawayId===eliminated.id&&!playedIds.has(possession.id)):[];
  const postMergeVotes=validatePostMergeVotes(game,attendees,preMerge,input.postMergeVotes);
  return {resolutionKey:councilId,tribalCouncilId:councilId,number,tribe:tribe as Tribe,episode:input.episode,attendees,firstTimeAttendees,eliminated:eliminated as Castaway,eliminationReason,eliminationPenalty:eliminationPenalty(eliminationReason,preMerge),eliminationScoringActive:eliminationScoringActive(game,input.episode),survivingAttendees:attendees.filter(castaway=>!eliminated||castaway.id!==eliminated.id),preMerge,playedItems,shots,pocketPossessions,attendeeMode:mode,postMergeVotes};
}

export function recordTribalCouncilResolution(game:GameState,input:TribalCouncilResolutionInput):GameState {
  const legacyResolutionKey=input.tribeId&&(!input.councilNumber||input.councilNumber===1)?tribalCouncilResolutionKey(game,input.tribeId,input.episode):tribalCouncilId(game,input.episode,input.councilNumber??1);
  const resolutionKey=input.tribalCouncilId??legacyResolutionKey;
  if((game.tribalCouncilResolutions??[]).some(record=>record.resolutionKey===resolutionKey)||game.scoreEvents.some(event=>event.awardKey===resolutionKey||event.batchId===resolutionKey))return game;
  const preview=previewTribalCouncil(game,input);
  const note=input.note.trim();
  if(note.length>500)throw new Error('Notes must be no more than 500 characters.');
  const createdAt=new Date().toISOString();
  const tribeFields=preview.tribe?{tribeId:preview.tribe.id,tribeName:preview.tribe.name}:{};
  const itemEvents=preview.playedItems.map(item=>{
    const points=item.input.successful?(item.possession.category==='idol'?5:2):0;
    const label=item.input.successful?`Successfully used ${item.possession.itemName}`:`Played ${item.possession.itemName} unsuccessfully`;
    const playedFor=item.playedFor?`Played for ${item.playedFor.name}. `:'';
    return {id:`${resolutionKey}:item:${item.possession.id}`,batchId:resolutionKey,awardKey:resolutionKey,castawayId:item.playedBy.id,recipientName:item.playedBy.name,categoryId:item.possession.category==='idol'?'use-idol':'use-advantage',actionLabel:label,points,episode:preview.episode,note:`${playedFor}${note}`.trim(),createdAt,...tribeFields,source:'tribal-council' as const,tribalCouncilId:preview.tribalCouncilId,resolved:true};
  });
  const shotEvents=preview.shots.map(shot=>{
    const safe=shot.input.result==='safe';
    return {id:`${resolutionKey}:shot:${shot.castaway.id}`,batchId:resolutionKey,awardKey:resolutionKey,castawayId:shot.castaway.id,recipientName:shot.castaway.name,categoryId:safe?'shot-safe':'shot-unsafe',actionLabel:`Shot in the Dark: ${safe?'SAFE':'UNSAFE'}`,points:safe?5:-1,episode:preview.episode,note,createdAt,...tribeFields,source:'tribal-council' as const,tribalCouncilId:preview.tribalCouncilId,resolved:true};
  });
  const pocketEvents=preview.pocketPossessions.map(possession=>{
    const idol=possession.category==='idol';
    return {id:`${resolutionKey}:pocket:${possession.id}`,batchId:resolutionKey,awardKey:resolutionKey,castawayId:preview.eliminated!.id,recipientName:preview.eliminated!.name,categoryId:idol?'idol-pocket':'advantage-pocket',actionLabel:`Eliminated holding ${possession.itemName}`,points:idol?-10:-4,episode:preview.episode,note,createdAt,...tribeFields,source:'tribal-council' as const,tribalCouncilId:preview.tribalCouncilId,resolved:true};
  });
  const firstEvents=preview.firstTimeAttendees.map(castaway=>({id:`${resolutionKey}:first:${castaway.id}`,batchId:resolutionKey,awardKey:resolutionKey,castawayId:castaway.id,recipientName:castaway.name,categoryId:'first-tribal-council',actionLabel:'First Tribal Council attendance',points:preview.episode,episode:preview.episode,note,createdAt,...tribeFields,source:'first-tribal-council' as const,recipientMode:preview.attendeeMode,recipientIds:preview.attendees.map(item=>item.id),tribalCouncilId:preview.tribalCouncilId,resolved:true}));
  const eliminationEvents=!preview.eliminationScoringActive&&preview.preMerge&&preview.eliminated&&preview.eliminationReason==='voted-out'?[{id:`${resolutionKey}:elimination:${preview.eliminated.id}`,batchId:resolutionKey,awardKey:resolutionKey,castawayId:preview.eliminated.id,recipientName:preview.eliminated.name,categoryId:'voted-premerge',actionLabel:'Voted out before merge',points:-1,episode:preview.episode,note,createdAt,...tribeFields,source:'tribal-council' as const,tribalCouncilId:preview.tribalCouncilId,resolved:true}]:[];
  const survivalEvents=preview.preMerge?preview.survivingAttendees.map(castaway=>({id:`${resolutionKey}:survival:${castaway.id}`,batchId:resolutionKey,awardKey:resolutionKey,castawayId:castaway.id,recipientName:castaway.name,categoryId:'survive-tribal',actionLabel:'Survive pre-merge Tribal Council',points:1,episode:preview.episode,note,createdAt,...tribeFields,source:'tribe-wide' as const,recipientMode:preview.attendeeMode,recipientIds:preview.survivingAttendees.map(item=>item.id),tribalCouncilId:preview.tribalCouncilId,resolved:true})):[];
  const playedIds=new Set(preview.playedItems.map(item=>item.possession.id));
  const pocketIds=new Set(preview.pocketPossessions.map(possession=>possession.id));
  const possessions=(game.possessions??[]).map(possession=>{
    if(playedIds.has(possession.id)){
      const played=preview.playedItems.find(item=>item.possession.id===possession.id)!;
      return {...possession,status:'played' as const,playedEpisode:preview.episode,playedAt:createdAt,playedByCastawayId:played.playedBy.id,playedForCastawayId:played.playedFor?.id,successful:played.input.successful,updatedAt:createdAt,history:[...possession.history,{action:'played' as const,at:createdAt,episode:preview.episode,toCastawayId:played.playedFor?.id,notes:note}]};
    }
    if(pocketIds.has(possession.id))return {...possession,status:'lost' as const,updatedAt:createdAt,history:[...possession.history,{action:'lost' as const,at:createdAt,episode:preview.episode,notes:`Lost when ${preview.eliminated!.name} was eliminated.${note?' '+note:''}`}]};
    return possession;
  });
  const resolutionRecord={resolutionKey,tribeId:preview.tribe?.id??'',episode:preview.episode,eliminatedCastawayId:preview.eliminated?.id??'',...(preview.eliminated?{eliminationReason:preview.eliminationReason}:{}),resolvedAt:createdAt,tribalCouncilId:preview.tribalCouncilId,number:preview.number,attendeeIds:preview.attendees.map(castaway=>castaway.id),attendeeMode:preview.attendeeMode,status:'resolved' as const};
  const councilRecord:TribalCouncilRecord={id:preview.tribalCouncilId,episode:preview.episode,number:preview.number,attendeeMode:preview.attendeeMode,attendeeIds:preview.attendees.map(castaway=>castaway.id),...(preview.tribe?{tribeId:preview.tribe.id,tribeName:preview.tribe.name}:{}),status:'resolved',resolutionKey,eliminatedCastawayId:preview.eliminated?.id,...(preview.eliminated?{eliminationReason:preview.eliminationReason}:{}),resolvedAt:createdAt};
  const councils=(game.tribalCouncils??[]).some(council=>council.id===councilRecord.id)?(game.tribalCouncils??[]).map(council=>council.id===councilRecord.id?councilRecord:council):[...(game.tribalCouncils??[]),councilRecord];
  const existingAttendance=new Set((game.tribalAttendance??[]).map(record=>record.id));
  const attendance=preview.attendees.map(castaway=>({id:`${preview.tribalCouncilId}:${castaway.id}`,castawayId:castaway.id,episode:preview.episode,tribalCouncilId:preview.tribalCouncilId,tribalCouncilNumber:preview.number,tribeId:preview.tribe?.id,attendedAt:createdAt} satisfies TribalAttendanceRecord)).filter(record=>!existingAttendance.has(record.id));
  const voteRecords:TribalVoteRecord[]=preview.postMergeVotes.map(vote=>({id:`${preview.tribalCouncilId}:votes:${vote.castawayId}:${vote.round}`,tribalCouncilId:preview.tribalCouncilId,episode:preview.episode,castawayId:vote.castawayId,countedVotes:vote.countedVotes,nullifiedVotes:vote.nullifiedVotes,extraVotes:vote.extraVotes,revote:vote.revote,round:vote.round,recordedAt:createdAt}));
  const next={...game,castaways:game.castaways.map(castaway=>preview.eliminated&&castaway.id===preview.eliminated.id?{...castaway,status:'voted-out' as const,eliminationReason:preview.eliminationReason,eliminationEpisode:preview.episode}:castaway),possessions,tribalCouncilResolutions:[...(game.tribalCouncilResolutions??[]),resolutionRecord],tribalCouncils:councils,tribalAttendance:[...(game.tribalAttendance??[]),...attendance],tribalVotes:[...(game.tribalVotes??[]),...voteRecords],scoreEvents:[...game.scoreEvents,...itemEvents,...shotEvents,...pocketEvents,...firstEvents,...eliminationEvents,...survivalEvents]};
  const reconciled=preview.eliminated?reconcileEliminationPenalty(next,preview.eliminated.id,preview.eliminationReason,preview.episode,{note,tribalCouncilId:preview.tribalCouncilId,...tribeFields}):next;
  return processFinalMilestoneTransition(game,reconciled,preview.episode,createdAt);
}

function mergeAwardKey(game:GameState,episode:number,kind:string,id:string){return `${game.season.id}:merge:${episode}:${kind}:${id}`;}

function mergeRosterSnapshot(game:GameState){
  const fantasyRosters:Record<string,string[]>={};
  const intactFantasyPlayerIds:string[]=[];
  for(const player of game.players.filter(item=>item.active!==false)){
    const picks=[...new Set(game.draftPicks.filter(pick=>pick.playerId===player.id&&pick.castawayId).map(pick=>pick.castawayId))];
    fantasyRosters[player.id]=picks;
    if(picks.length===3&&picks.every(id=>game.castaways.some(castaway=>castaway.id===id&&castaway.status==='active')))intactFantasyPlayerIds.push(player.id);
  }
  return {fantasyRosters,intactFantasyPlayerIds};
}

function createMergeTransition(game:GameState,episode:number,createdAt:string){
  const idols=activePossessions(game).filter(possession=>possession.category==='idol'&&game.castaways.some(castaway=>castaway.id===possession.castawayId&&castaway.status==='active'));
  const roster=mergeRosterSnapshot(game);
  const snapshot:MergeSnapshot={episode,activeCastawayIds:game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id),idolPossessionIds:idols.map(possession=>possession.id),fantasyRosters:roster.fantasyRosters,intactFantasyPlayerIds:roster.intactFantasyPlayerIds,createdAt};
  const idolEvents=idols.map(possession=>{
    const castaway=game.castaways.find(item=>item.id===possession.castawayId)!;
    const awardKey=mergeAwardKey(game,episode,'idol',possession.id);
    return {id:awardKey,batchId:awardKey,awardKey,castawayId:castaway.id,recipientName:castaway.name,categoryId:'merge-surviving-idol',actionLabel:'Surviving pre-merge idol reached the merge',points:2,episode,note:`${possession.itemName} was still held when the merge began.`,createdAt,source:'milestone' as const,resolved:true};
  });
  const playerEvents=roster.intactFantasyPlayerIds.map(playerId=>{
    const player=game.players.find(item=>item.id===playerId)!;
    const awardKey=mergeAwardKey(game,episode,'roster',playerId);
    return {id:awardKey,batchId:awardKey,awardKey,playerId,recipientName:player.name,categoryId:'merge-intact-roster',actionLabel:'All 3 drafted castaways reached the merge',points:5,episode,note:'All three drafted castaways were active when the merge began.',createdAt,source:'milestone' as const,resolved:true};
  });
  return {snapshot,events:[...idolEvents,...playerEvents]};
}

export function processFinalMilestoneTransition(previous:GameState,next:GameState,episode:number,createdAt=new Date().toISOString()):GameState {
  const active=next.castaways.filter(castaway=>castaway.status==='active');
  let state=next;
  if(active.length===5&&!state.season.finalFiveSnapshot){
    const totals=postMergeVoteTotals(state);
    const hasPostMergeVotes=(state.tribalVotes??[]).length>0;
    if(hasPostMergeVotes){
      const values=active.map(castaway=>totals[castaway.id]??0);
      const highest=Math.max(...values),lowest=Math.min(...values);
      const mostCastawayIds=active.filter(castaway=>(totals[castaway.id]??0)===highest).map(castaway=>castaway.id);
      const leastCastawayIds=active.filter(castaway=>(totals[castaway.id]??0)===lowest).map(castaway=>castaway.id);
      const snapshot:FinalFiveSnapshot={episode,activeCastawayIds:active.map(castaway=>castaway.id),voteTotals:Object.fromEntries(active.map(castaway=>[castaway.id,totals[castaway.id]??0])),mostCastawayIds,leastCastawayIds,createdAt};
      const events=[
        ...(mostCastawayIds.length===1?(()=>{const id=mostCastawayIds[0],castaway=active.find(item=>item.id===id)!;const awardKey=`${state.season.id}:final-five:most:${id}`;return [{id:awardKey,batchId:awardKey,awardKey,castawayId:id,recipientName:castaway.name,categoryId:'final-five-most-votes',actionLabel:'Most post-merge votes at Final 5',points:10,episode,note:`${highest} counted post-merge vote${highest===1?'':'s'} at Final 5.`,createdAt,source:'milestone' as const,resolved:true}];})():[]),
        ...(leastCastawayIds.length===1?(()=>{const id=leastCastawayIds[0],castaway=active.find(item=>item.id===id)!;const awardKey=`${state.season.id}:final-five:least:${id}`;return [{id:awardKey,batchId:awardKey,awardKey,castawayId:id,recipientName:castaway.name,categoryId:'final-five-least-votes',actionLabel:'Least post-merge votes at Final 5',points:5,episode,note:`${lowest} counted post-merge vote${lowest===1?'':'s'} at Final 5.`,createdAt,source:'milestone' as const,resolved:true}];})():[]),
      ];
      state={...state,season:{...state.season,finalFiveSnapshot:snapshot},scoreEvents:[...state.scoreEvents,...events]};
    }
  }
  if(previous.castaways.filter(castaway=>castaway.status==='active').length!==3&&active.length===3&&state.season.finalFiveSnapshot?.mostCastawayIds.length===1){
    const leader=state.season.finalFiveSnapshot.mostCastawayIds[0];
    if(active.some(castaway=>castaway.id===leader)){
      const castaway=active.find(item=>item.id===leader)!;
      const awardKey=`${state.season.id}:final-three:vote-leader:${leader}`;
      if(!state.scoreEvents.some(event=>event.awardKey===awardKey||event.batchId===awardKey)){
        state={...state,scoreEvents:[...state.scoreEvents,{id:awardKey,batchId:awardKey,awardKey,castawayId:leader,recipientName:castaway.name,categoryId:'final-three-vote-leader',actionLabel:'Final 5 vote leader reached Final 3',points:5,episode,note:'The Final 5 vote leader remained active at Final 3.',createdAt,source:'milestone',resolved:true}]};
      }
    }
  }
  return state;
}

export function saveMergeEpisode(game:GameState,mergeEpisode:number|undefined):GameState {
  if(mergeEpisode!==undefined&&(!Number.isInteger(mergeEpisode)||mergeEpisode<1))throw new Error('Merge episode must be a positive whole number, or leave it blank.');
  if(mergeEpisode===undefined){const season={...game.season};delete season.mergeEpisode;delete season.mergeState;delete season.mergeOccurred;return {...game,season};}
  const alreadyMerged=game.season.mergeState==='merged'||game.season.mergeOccurred===true||game.season.mergeEpisode!==undefined;
  if(alreadyMerged||game.season.mergeSnapshot)return {...game,season:{...game.season,mergeEpisode,mergeState:'merged',mergeOccurred:true}};
  const createdAt=new Date().toISOString();
  const transition=createMergeTransition(game,mergeEpisode,createdAt);
  return {...game,season:{...game.season,mergeEpisode,mergeState:'merged',mergeOccurred:true,mergeSnapshot:transition.snapshot},scoreEvents:[...game.scoreEvents,...transition.events]};
}

export function saveCustomAction(game:GameState,input:CustomActionInput,id:string):GameState {
  const label=input.label.trim();
  if(!label||label.length>100)throw new Error('Enter an action name between 1 and 100 characters.');
  if(!Number.isFinite(input.points)||input.points===0)throw new Error('Enter positive or negative points, not zero.');
  if(input.target!=='tribe'&&input.target!=='individual')throw new Error('Choose tribe or individual.');
  if(game.categories.some(c=>c.label.trim().toLowerCase()===label.toLowerCase()))throw new Error('An action with that name already exists. Select it from the scoring list.');
  return {...game,categories:[...game.categories,{id,label,points:input.points,target:input.target,group:'Custom actions',recipientModes:input.target==='tribe'?['tribe','custom','all-active']:['individual','custom'],custom:true}]};
}

export function saveTribe(game:GameState,tribe:Tribe):GameState {
  const name=tribe.name.trim();
  if(!name||name.length>60)throw new Error('Enter a tribe name between 1 and 60 characters.');
  if(!/^#[0-9a-f]{6}$/i.test(tribe.color))throw new Error('Choose a valid tribe color.');
  if(game.tribes.some(t=>t.id!==tribe.id&&t.name.toLowerCase()===name.toLowerCase()))throw new Error('That tribe name already exists.');
  const next={...tribe,name};
  return {...game,tribes:game.tribes.some(t=>t.id===tribe.id)?game.tribes.map(t=>t.id===tribe.id?next:t):[...game.tribes,next]};
}

export function assignCastaway(game:GameState,id:string,tribeId:string,status:Castaway['status']):GameState {
  if(!game.castaways.some(c=>c.id===id))throw new Error('Unknown castaway.');
  if(tribeId&&!game.tribes.some(t=>t.id===tribeId))throw new Error('Unknown tribe.');
  if(status!=='active'&&status!=='voted-out')throw new Error('Invalid castaway status.');
  return {...game,castaways:game.castaways.map(c=>c.id===id?{...c,tribeId,status}:c)};
}
