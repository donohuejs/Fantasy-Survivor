import {prepareJuryDraft,validateJuryDraftApproval,planJuryApprovalNotice,
  type JuryPreparedDraft,type JuryPreparationSource,type JuryNoticeIntent} from './jury-preparation.ts';
import type {JuryReviewSubmission} from './jury-review.ts';

/**
 * Phase D contract only. The production Firestore adapter, authenticated route,
 * source mapper, mail provider and scheduler are intentionally absent.
 * Every read/write in runAtomic must share one real database transaction.
 */
export type JuryOpenedEpisode={
  id:string;season:number;episode:number;draftId:string;gameRevision:number;
  approvedAt:string;approvedBy:string;reason:string;
  proposal:JuryPreparedDraft['proposal'];
};
export type JuryApprovalAudit={
  id:string;season:number;episode:number;action:'open-prepared-jury-episode';
  actorUid:string;draftId:string;gameRevision:number;at:string;reason:string;
};
export type JuryApprovalOutbox={
  key:string;intent:JuryNoticeIntent;createdAt:string;
  channels:{
    'in-app':{state:'pending';deliveryKey:string};
    email:{state:'pending';deliveryKey:string};
  };
};
export type JuryApprovalTransaction={
  isAuthorizedGameMaster(uid:string):Promise<boolean>;
  readPreparationSource(season:number):Promise<JuryPreparationSource>;
  readOpenedEpisode(season:number,episode:number):Promise<JuryOpenedEpisode|null>;
  createOpenedEpisode(record:JuryOpenedEpisode):Promise<void>;
  createAudit(record:JuryApprovalAudit):Promise<void>;
  readOutbox(key:string):Promise<JuryApprovalOutbox|null>;
  createOutbox(record:JuryApprovalOutbox):Promise<void>;
};
export type JuryApprovalStore={
  runAtomic<T>(callback:(tx:JuryApprovalTransaction)=>Promise<T>):Promise<T>;
};

export class JuryApprovalConflict extends Error{
  readonly code:'unauthorized'|'invalid'|'stale'|'already-open'|'expired';
  constructor(message:string,code:JuryApprovalConflict['code']){
    super(message);this.name='JuryApprovalConflict';this.code=code;
  }
}
function validTime(value:string){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value))){
    throw new JuryApprovalConflict('A trusted server timestamp is required.','invalid');
  }
}
function validIdentity(value:string){
  if(typeof value!=='string'||!value.trim()||value.length>128)throw new JuryApprovalConflict('An authenticated identity is required.','unauthorized');
}
function validRequest(request:JuryReviewSubmission){
  if(!request||!Number.isSafeInteger(request.season)||request.season<1||
    !Number.isSafeInteger(request.episode)||request.episode<1||
    !Number.isSafeInteger(request.expectedGameRevision)||request.expectedGameRevision<0||
    !/^[a-f0-9]{64}$/.test(request.expectedDraftId)||
    request.confirmedBroadcast!==true||request.confirmedRoster!==true||request.confirmedMerge!==true||
    typeof request.reason!=='string'||request.reason.trim().length<10||request.reason.length>1000){
    throw new JuryApprovalConflict('Review the current proposal and acknowledge every required detail.','invalid');
  }
}
function currentDraft(source:JuryPreparationSource,at:string){
  return prepareJuryDraft({...source,now:at});
}
function sameApprovedDraft(existing:JuryOpenedEpisode,request:JuryReviewSubmission){
  return existing.draftId===request.expectedDraftId&&
    existing.gameRevision===request.expectedGameRevision&&
    existing.season===request.season&&existing.episode===request.episode;
}

/** Only a trusted, authenticated server adapter supplies actorUid and at. */
export async function approvePreparedJuryEpisode(
  store:JuryApprovalStore,
  context:{actorUid:string;at:string},
  request:JuryReviewSubmission,
):Promise<{result:'opened'|'already-open';snapshot:JuryOpenedEpisode}>{
  validIdentity(context.actorUid);validTime(context.at);validRequest(request);
  return store.runAtomic(async tx=>{
    if(!await tx.isAuthorizedGameMaster(context.actorUid)){
      throw new JuryApprovalConflict('Only the verified Game Master may approve Jury Mode.','unauthorized');
    }
    const existing=await tx.readOpenedEpisode(request.season,request.episode);
    if(existing){
      if(sameApprovedDraft(existing,request))return {result:'already-open' as const,snapshot:existing};
      throw new JuryApprovalConflict('An immutable snapshot already exists for this episode.','already-open');
    }
    const source=await tx.readPreparationSource(request.season);
    if(source.season!==request.season||source.episode!==request.episode){
      throw new JuryApprovalConflict('The active season or episode changed. Refresh before approving.','stale');
    }
    if(source.broadcast&&Number.isFinite(Date.parse(source.broadcast.airtime))&&
      Date.parse(source.broadcast.airtime)<=Date.parse(context.at)){
      throw new JuryApprovalConflict('The episode deadline has passed. Approval is closed.','expired');
    }
    const draft=currentDraft(source,context.at);
    if(draft.id!==request.expectedDraftId||draft.gameRevision!==request.expectedGameRevision){
      throw new JuryApprovalConflict('The proposed episode changed. Review the latest information.','stale');
    }
    try{
      validateJuryDraftApproval(draft,{
        actorAuthorized:true,expectedDraftId:request.expectedDraftId,
        currentGameRevision:source.gameRevision,confirmedAt:context.at,
        confirmedBroadcast:request.confirmedBroadcast,
        confirmedRoster:request.confirmedRoster,confirmedMerge:request.confirmedMerge,
        reason:request.reason,
      });
    }catch(error){
      throw new JuryApprovalConflict(error instanceof Error?error.message:'Episode cannot be approved.','expired');
    }
    const snapshot:JuryOpenedEpisode={
      id:`${request.season}-${request.episode}`,season:request.season,episode:request.episode,
      draftId:draft.id,gameRevision:draft.gameRevision,approvedAt:context.at,
      approvedBy:context.actorUid,reason:request.reason.trim(),
      proposal:structuredClone(draft.proposal),
    };
    const audit:JuryApprovalAudit={
      id:`open:${request.season}:${request.episode}:${draft.id}`,
      season:request.season,episode:request.episode,action:'open-prepared-jury-episode',
      actorUid:context.actorUid,draftId:draft.id,gameRevision:draft.gameRevision,
      at:context.at,reason:request.reason.trim(),
    };
    await tx.createOpenedEpisode(snapshot);
    await tx.createAudit(audit);
    return {result:'opened' as const,snapshot};
  });
}

/**
 * Durable two-channel approval notice intent; it does not send or resolve
 * recipients. The scheduler must be independently authenticated server-side.
 */
export async function queueJuryApprovalNotice(
  store:JuryApprovalStore,
  context:{at:string;authenticatedScheduler:true},
  season:number,
  options:{reminderHours?:readonly number[]},
):Promise<{result:'queued'|'nothing-due';outbox:JuryApprovalOutbox|null}>{
  validTime(context.at);
  if(context.authenticatedScheduler!==true||!Number.isSafeInteger(season)||season<1){
    throw new JuryApprovalConflict('Trusted scheduling authorization is required.','unauthorized');
  }
  return store.runAtomic(async tx=>{
    const source=await tx.readPreparationSource(season);
    if(source.season!==season)throw new JuryApprovalConflict('The season changed.','stale');
    const draft=currentDraft(source,context.at);
    if(await tx.readOpenedEpisode(season,draft.episode))return {result:'nothing-due',outbox:null};
    const purposes:JuryNoticeIntent['purpose'][]=['approval-ready','approval-reminder-24h','approval-reminder-6h'];
    const recorded=new Set<string>();
    for(const purpose of purposes){
      const key=`jury:${draft.season}:${draft.episode}:${draft.id}:${purpose}`;
      if(await tx.readOutbox(key))recorded.add(key);
    }
    const intent=planJuryApprovalNotice(draft,{
      now:context.at,alreadyOpen:false,recordedKeys:recorded,reminderHours:options.reminderHours,
    });
    if(!intent)return {result:'nothing-due',outbox:null};
    const outbox:JuryApprovalOutbox={
      key:intent.key,intent,createdAt:context.at,
      channels:{
        'in-app':{state:'pending',deliveryKey:`${intent.key}:in-app`},
        email:{state:'pending',deliveryKey:`${intent.key}:email`},
      },
    };
    await tx.createOutbox(outbox);
    return {result:'queued',outbox};
  });
}
