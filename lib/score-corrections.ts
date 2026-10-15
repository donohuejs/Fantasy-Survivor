import type {GameState,ScoreEvent} from './game-data.ts';
import {seasonStandings} from './league.ts';
import {canonicalJson,castawayScoreTotals,effectiveScorePoints,scoreActionKey,scoringVersion} from './score-ledger.ts';

export type ScoringActor={uid:string;email:string;verified:boolean};
export type ScoreCorrectionCommand={id:string;season:number;kind:'edit'|'undo';scope:'action'|'entry';eventId:string;recipientIds:string[];points:number;reason:string;expectedVersion:string};
export type ScoreImpact={id:string;name:string;before:number;after:number;delta:number};
export type ScoreCorrection={id:string;season:number;kind:'edit'|'undo';scope:'action'|'entry';eventId:string;actionId:string;episode?:number;reason:string;at:string;actorUid:string;command:ScoreCorrectionCommand;before:ScoreEvent[];after:ScoreEvent[];castaways:ScoreImpact[];standings:ScoreImpact[]};
export type ScoreCorrectionPreview={correction:ScoreCorrection;expectedVersion:string;recap?:{id:string;exists:boolean;status?:string;scoringDiffersAfterSave?:boolean}};
export class ScoreCorrectionError extends Error{
  readonly status:number;
  constructor(message:string,status=409){super(message);this.name='ScoreCorrectionError';this.status=status;}
}
export function assertScoringCommissioner(actor:ScoringActor){
  if(!actor.uid||!actor.verified||actor.email.toLowerCase()!=='donohue.js@gmail.com')throw new ScoreCorrectionError('Only the game master can correct scoring.',403);
}
export function parseScoreCorrection(input:unknown):ScoreCorrectionCommand{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ScoreCorrectionError('Invalid correction.',400);
  const value=input as Record<string,unknown>;
  if(typeof value.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(value.id))throw new ScoreCorrectionError('Invalid correction ID.',400);
  if(!Number.isSafeInteger(value.season)||Number(value.season)<1)throw new ScoreCorrectionError('Invalid season.',400);
  if(value.kind!=='edit'&&value.kind!=='undo'||value.scope!=='action'&&value.scope!=='entry')throw new ScoreCorrectionError('Invalid correction type.',400);
  if(typeof value.eventId!=='string'||!value.eventId||value.eventId.length>500)throw new ScoreCorrectionError('Choose a scoring entry.',400);
  if(typeof value.expectedVersion!=='string'||! /^[a-f0-9]{64}$/.test(value.expectedVersion))throw new ScoreCorrectionError('Reload and review the scoring first.',400);
  if(!Array.isArray(value.recipientIds)||value.recipientIds.length>100||value.recipientIds.some(id=>typeof id!=='string'||!id||id.length>200)||new Set(value.recipientIds).size!==value.recipientIds.length)throw new ScoreCorrectionError('Choose each recipient once.',400);
  if(typeof value.points!=='number'||!Number.isFinite(value.points)||Math.abs(value.points)>100000)throw new ScoreCorrectionError('Enter finite points between -100000 and 100000.',400);
  if(typeof value.reason!=='string'||!value.reason.trim()||value.reason.trim().length>500)throw new ScoreCorrectionError('Enter a reason of 1–500 characters.',400);
  return {id:value.id,season:Number(value.season),kind:value.kind,scope:value.scope,eventId:value.eventId,recipientIds:value.recipientIds as string[],points:value.points,reason:value.reason.trim(),expectedVersion:value.expectedVersion};
}
export function sameCorrection(left:ScoreCorrectionCommand,right:ScoreCorrectionCommand){return canonicalJson(left)===canonicalJson(right);}

/** No normalization or gameplay reconciliation: only the selected scoring action changes. */
export async function planScoreCorrection(game:GameState,actor:ScoringActor,raw:ScoreCorrectionCommand,at:string):Promise<{game:GameState;preview:ScoreCorrectionPreview}>{
  assertScoringCommissioner(actor);
  const command=parseScoreCorrection(raw);
  if(game.season.number!==command.season)throw new ScoreCorrectionError('The active season changed. Reload before saving.');
  if(game.season.finalized)throw new ScoreCorrectionError('Final results are locked.');
  const expectedVersion=await scoringVersion(game);
  if(expectedVersion!==command.expectedVersion)throw new ScoreCorrectionError('Scores or rosters changed during your review. Close this editor and review again.');
  const event=game.scoreEvents.find(e=>e.id===command.eventId);
  if(!event)throw new ScoreCorrectionError('This scoring entry no longer exists.');
  if(game.scoreEvents.filter(e=>e.id===event.id).length!==1)throw new ScoreCorrectionError('Duplicate entry IDs need review before correction.');
  const before=game.scoreEvents.filter(e=>scoreActionKey(e)===scoreActionKey(event));
  const target=command.scope==='entry'?[event]:before;
  const active=target.filter(e=>e.scoringStatus!=='reversed');
  if(!active.length)throw new ScoreCorrectionError('This scoring action has already been reversed.');
  const playerTarget=Boolean(event.playerId);
  if(before.some(e=>Boolean(e.playerId)!==playerTarget||Boolean(e.castawayId)===playerTarget))throw new ScoreCorrectionError('This action has an ambiguous recipient type.');
  const recipient=(e:ScoreEvent)=>(playerTarget?e.playerId:e.castawayId)!;
  const activeAction=before.filter(e=>e.scoringStatus!=='reversed');
  if(command.scope==='action'&&new Set(activeAction.map(recipient)).size!==activeAction.length)throw new ScoreCorrectionError('This action has duplicate recipients. Reverse individual duplicate entries in Activity log first.');
  const selected=command.kind==='undo'?[]:command.recipientIds;
  if(command.kind==='edit'){
    if(!selected.length)throw new ScoreCorrectionError('Select at least one recipient, or use Undo.');
    if(command.scope==='entry'&&selected.length!==1)throw new ScoreCorrectionError('Choose one recipient for an individual entry.');
    const roster=playerTarget?game.players:game.castaways;
    if(selected.some(id=>!roster.some(item=>item.id===id)))throw new ScoreCorrectionError('Choose recipients from this season.');
    if(command.scope==='entry'&&before.some(e=>e.id!==event.id&&e.scoringStatus!=='reversed'&&recipient(e)!==recipient(event)&&selected.includes(recipient(e))))throw new ScoreCorrectionError('That recipient already has an award in this action.');
    if(active.length===selected.length&&active.every(e=>selected.includes(recipient(e))&&e.points===command.points))throw new ScoreCorrectionError('No scoring changes to save.');
  }
  const targetIds=new Set(target.map(e=>e.id)),actionId=event.scoringActionId??before[0].id;
  const chosen=new Map<string,string>();
  for(const e of [...activeAction,...before])if(!chosen.has(recipient(e)))chosen.set(recipient(e),e.id);
  if(command.scope==='entry'&&selected.includes(recipient(event)))chosen.set(recipient(event),event.id);
  let after=before.map(e=>{
    if(!targetIds.has(e.id))return {...e};
    if(selected.includes(recipient(e))&&chosen.get(recipient(e))===e.id)return {...e,points:command.points,scoringStatus:'corrected' as const};
    return e.scoringStatus==='reversed'?{...e}:{...e,scoringStatus:'reversed' as const};
  });
  for(const id of selected){
    const existing=after.find(e=>e.id===chosen.get(id));
    if(existing){
      // Re-adding a removed recipient reuses its tombstone; never creates a duplicate.
      if(!targetIds.has(existing.id)&&existing.scoringStatus==='reversed')Object.assign(existing,{points:command.points,scoringStatus:'corrected'});
      continue;
    }
    const {castawayId:_castaway,playerId:_player,...template}=event;
    void _castaway;void _player;
    const name=(playerTarget?game.players:game.castaways).find(item=>item.id===id)!.name;
    const addedId=`correction:${command.id}:${id}`;
    if(game.scoreEvents.some(e=>e.id===addedId))throw new ScoreCorrectionError('Correction entry ID already exists.');
    after.push({...template,id:addedId,...(playerTarget?{playerId:id}:{castawayId:id}),recipientName:name,points:command.points,createdAt:at,scoringStatus:'corrected'});
  }
  const recipientIds=[...new Set(after.filter(e=>e.scoringStatus!=='reversed').map(recipient))];
  after=after.map(e=>({...e,recipientIds,scoringActionId:actionId,correctionId:command.id,correctedAt:at,...(e.scoringStatus!=='reversed'?{scoringStatus:'corrected' as const}:{})}));
  const byId=new Map(after.map(e=>[e.id,e])),beforeIds=new Set(before.map(e=>e.id));
  const next={...game,scoreEvents:game.scoreEvents.map(e=>byId.get(e.id)??e).concat(after.filter(e=>!beforeIds.has(e.id))),scoringRevision:(game.scoringRevision??0)+1};
  const previousTotals=castawayScoreTotals(game),nextTotals=castawayScoreTotals(next);
  const castaways=game.castaways.map(c=>({id:c.id,name:c.name,before:previousTotals[c.id],after:nextTotals[c.id],delta:nextTotals[c.id]-previousTotals[c.id]})).filter(row=>row.delta!==0);
  const priorStandings=new Map(seasonStandings(game).map(row=>[row.profileId,row]));
  const standings=seasonStandings(next).map(row=>({id:row.profileId,name:row.name,before:priorStandings.get(row.profileId)!.score,after:row.score,delta:row.score-priorStandings.get(row.profileId)!.score})).filter(row=>row.delta!==0);
  const correction:ScoreCorrection={id:command.id,season:command.season,kind:command.kind,scope:command.scope,eventId:event.id,actionId,...(event.episode!==undefined?{episode:event.episode}:{}),reason:command.reason,at,actorUid:actor.uid,command,before,after,castaways,standings};
  return {game:next,preview:{correction,expectedVersion}};
}

export function correctionEntrySummary(events:ScoreEvent[]){return events.map(e=>`${e.recipientName||e.castawayId||e.playerId}: ${effectiveScorePoints(e)}${e.scoringStatus==='reversed'?' (reversed)':''}`).join('; ');}
