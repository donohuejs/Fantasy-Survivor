import type {Category,GameState,Tribe,Castaway,EpisodeStatus,Possession,PossessionCategory,PossessionStatus,RecipientMode,TribalCouncilRecord,TribalAttendanceRecord} from './game-data.ts';

export type ScoringInput={categoryId:string;recipientId?:string;recipientIds?:string[];recipientMode?:RecipientMode;episode:number;note:string;expectedRecipientIds:string[];batchId:string;historical?:boolean;tribalCouncilId?:string};
export type CustomActionInput={label:string;points:number;target:Category['target']};
export type EpisodeWideAwardInput={episode:number;note:string;expectedActiveCastawayIds:string[];historical?:boolean};
export type EpisodeStartInput={episode:number;note?:string;expectedActiveCastawayIds:string[]};
export type EpisodeFinishInput={episode:number};
export type CastawayBonusInput={castawayId:string;episode:number;points:number;note:string;batchId:string;historical?:boolean};
export type FirstTribalCouncilInput={tribeId:string;episode:number;note:string;expectedCastawayIds:string[];historical?:boolean;tribalCouncilId?:string;attendeeIds?:string[]};
export type TribalCouncilSurvivalInput={tribeId:string;episode:number;note:string;expectedActiveCastawayIds:string[];historical?:boolean;tribalCouncilId?:string;attendeeIds?:string[];attendeeMode?:RecipientMode};
export type PossessionInput={id?:string;castawayId:string;itemName:string;category:PossessionCategory;acquiredEpisode?:number;notes?:string};
export type PossessionStatusInput={possessionId:string;status:PossessionStatus;episode:number;notes:string};
export type PossessionTransferInput={possessionId:string;targetCastawayId:string;episode:number;notes:string;newPossessionId:string};
export type TribalCouncilItemPlayInput={possessionId:string;playedByCastawayId:string;playedForCastawayId?:string;successful:boolean};
export type ShotInTheDarkInput={castawayId:string;result:'safe'|'unsafe'};
export type TribalCouncilResolutionInput={tribeId?:string;tribalCouncilId?:string;councilNumber?:number;attendeeMode?:RecipientMode;attendeeIds?:string[];eliminatedCastawayId?:string;episode:number;note:string;expectedAttendeeIds:string[];expectedFirstTimeAttendeeIds?:string[];expectedPreMerge?:boolean;expectedTribeName?:string;itemPlays?:TribalCouncilItemPlayInput[];shotsInTheDark?:ShotInTheDarkInput[]};
export type TribalCouncilPlayedItem={input:TribalCouncilItemPlayInput;possession:Possession;playedBy:Castaway;playedFor?:Castaway};
export type TribalCouncilShot={input:ShotInTheDarkInput;castaway:Castaway};
export type TribalCouncilPreview={resolutionKey:string;tribalCouncilId:string;number:number;tribe:Tribe;episode:number;attendees:Castaway[];firstTimeAttendees:Castaway[];eliminated:Castaway;survivingAttendees:Castaway[];preMerge:boolean;playedItems:TribalCouncilPlayedItem[];shots:TribalCouncilShot[];pocketPossessions:Possession[];attendeeMode:RecipientMode};

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

function eligibleCastaways(game:GameState,category:Category){
  // Preserve the legacy individual-action behavior: actions without an explicit
  // recipient status may be used for a historical/eliminated castaway. The UI
  // still defaults its picker to active castaways for normal weekly scoring.
  return game.castaways.filter(castaway=>category.recipientStatus?castaway.status===category.recipientStatus:true);
}

export function resolveRecipients(game:GameState,category:Category,mode:RecipientMode,recipientId?:string,recipientIds:string[]=[]):Castaway[]{
  if(!allowedRecipientModes(game,category).includes(mode))throw new Error('That scoring action does not support this recipient mode.');
  if(mode==='all-active')return game.castaways.filter(castaway=>castaway.status==='active');
  if(mode==='tribe'){
    if(!recipientId||!game.tribes.some(t=>t.id===recipientId))throw new Error('Choose a valid tribe.');
    return game.castaways.filter(castaway=>castaway.tribeId===recipientId&&castaway.status==='active');
  }
  const ids=mode==='individual'?(recipientId?[recipientId]:[]):recipientIds;
  if(!ids.length)throw new Error('Choose at least one castaway.');
  const unique=[...new Set(ids)];
  if(unique.length!==ids.length)throw new Error('A castaway can only be selected once for a scoring event.');
  const found=unique.map(id=>game.castaways.find(castaway=>castaway.id===id));
  if(found.some(castaway=>!castaway))throw new Error('Choose valid castaways from this season.');
  const selected=found as Castaway[];
  const eligible=eligibleCastaways(game,category);
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
  return {...game,season:{...game.season,currentEpisode:input.episode,episodeStarted:true,episodeStatus:'in-progress'},scoreEvents:[...game.scoreEvents,...events]};
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
  const selected=resolveRecipients(game,action,mode,input.recipientId,input.recipientIds);
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
  return {resolutionKey:councilId,tribalCouncilId:councilId,number,tribe:tribe as Tribe,episode:input.episode,attendees,firstTimeAttendees,eliminated:eliminated as Castaway,survivingAttendees:attendees.filter(castaway=>!eliminated||castaway.id!==eliminated.id),preMerge,playedItems,shots,pocketPossessions,attendeeMode:mode};
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
  const eliminationEvents=preview.preMerge&&preview.eliminated?[{id:`${resolutionKey}:elimination:${preview.eliminated.id}`,batchId:resolutionKey,awardKey:resolutionKey,castawayId:preview.eliminated.id,recipientName:preview.eliminated.name,categoryId:'voted-premerge',actionLabel:'Voted out before merge',points:-1,episode:preview.episode,note,createdAt,...tribeFields,source:'tribal-council' as const,tribalCouncilId:preview.tribalCouncilId,resolved:true}]:[];
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
  const resolutionRecord={resolutionKey,tribeId:preview.tribe?.id??'',episode:preview.episode,eliminatedCastawayId:preview.eliminated?.id??'',resolvedAt:createdAt,tribalCouncilId:preview.tribalCouncilId,number:preview.number,attendeeIds:preview.attendees.map(castaway=>castaway.id),attendeeMode:preview.attendeeMode,status:'resolved' as const};
  const councilRecord:TribalCouncilRecord={id:preview.tribalCouncilId,episode:preview.episode,number:preview.number,attendeeMode:preview.attendeeMode,attendeeIds:preview.attendees.map(castaway=>castaway.id),...(preview.tribe?{tribeId:preview.tribe.id,tribeName:preview.tribe.name}:{}),status:'resolved',resolutionKey,eliminatedCastawayId:preview.eliminated?.id,resolvedAt:createdAt};
  const councils=(game.tribalCouncils??[]).some(council=>council.id===councilRecord.id)?(game.tribalCouncils??[]).map(council=>council.id===councilRecord.id?councilRecord:council):[...(game.tribalCouncils??[]),councilRecord];
  const existingAttendance=new Set((game.tribalAttendance??[]).map(record=>record.id));
  const attendance=preview.attendees.map(castaway=>({id:`${preview.tribalCouncilId}:${castaway.id}`,castawayId:castaway.id,episode:preview.episode,tribalCouncilId:preview.tribalCouncilId,tribalCouncilNumber:preview.number,tribeId:preview.tribe?.id,attendedAt:createdAt} satisfies TribalAttendanceRecord)).filter(record=>!existingAttendance.has(record.id));
  return {...game,castaways:game.castaways.map(castaway=>preview.eliminated&&castaway.id===preview.eliminated.id?{...castaway,status:'voted-out' as const}:castaway),possessions,tribalCouncilResolutions:[...(game.tribalCouncilResolutions??[]),resolutionRecord],tribalCouncils:councils,tribalAttendance:[...(game.tribalAttendance??[]),...attendance],scoreEvents:[...game.scoreEvents,...itemEvents,...shotEvents,...pocketEvents,...firstEvents,...eliminationEvents,...survivalEvents]};
}

export function saveMergeEpisode(game:GameState,mergeEpisode:number|undefined):GameState {
  if(mergeEpisode!==undefined&&(!Number.isInteger(mergeEpisode)||mergeEpisode<1))throw new Error('Merge episode must be a positive whole number, or leave it blank.');
  if(mergeEpisode===undefined){const season={...game.season};delete season.mergeEpisode;delete season.mergeState;delete season.mergeOccurred;return {...game,season};}
  return {...game,season:{...game.season,mergeEpisode,mergeState:'merged',mergeOccurred:true}};
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
