import {createHash} from 'node:crypto';

/**
 * Side-effect-free preparation and review core. It does not read/write Firestore,
 * open Jury episodes, or send notifications. Server adapters must authenticate
 * the Game Master and transact against the latest authoritative game revision.
 */
export type JuryPreparationSource={
  season:number;
  episode:number;
  currentEpisode:number;
  gameRevision:number;
  now:string;
  activation:{enabled:boolean;fromEpisode:number}|null;
  broadcast:{airtime:string;source:string}|null;
  tribes:Array<{id:string;name:string}>;
  castaways:Array<{id:string;name:string;tribeId:string}>;
  merge:{occurred:boolean;episode:number|null;verified:boolean};
  players:Array<{id:string;active:boolean;eligibleFrom:number|null;issues:string[]}>;
};

export type JuryPreparedDraft={
  schema:1;
  id:string;
  season:number;
  episode:number;
  gameRevision:number;
  state:'READY_FOR_REVIEW'|'BLOCKED';
  blockers:string[];
  proposal:{
    airtime:string|null;
    timeZone:'America/New_York';
    broadcastSource:string|null;
    format:'pre-merge'|'post-merge';
    mergeEpisode:number|null;
    tribes:Array<{id:string;name:string}>;
    castaways:Array<{id:string;name:string;tribeId:string}>;
    eligiblePlayerIds:string[];
  };
};

function validNumber(value:number){return Number.isSafeInteger(value)&&value>0;}
function uniqueRows(rows:Array<{id:string}>){return rows.every(row=>row.id&&typeof row.id==='string')&&new Set(rows.map(row=>row.id)).size===rows.length;}
function validAirtime(value:string,now:string){
  // Calendar suggestions must explicitly identify the offset. Eastern DST
  // transitions are validated against America/New_York, not the server locale.
  const format=/^(\d{4}-\d\d-\d\d)T(\d\d:\d\d):\d\d(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/;
  if(!format.test(value))return false;
  const airtime=Date.parse(value),current=Date.parse(now);
  if(!Number.isFinite(airtime)||!Number.isFinite(current)||airtime<=current)return false;
  try{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(airtime);
    const field=(kind:string)=>parts.find(part=>part.type===kind)?.value??'';
    return `${field('year')}-${field('month')}-${field('day')}T${field('hour')}:${field('minute')}`===value.slice(0,16);
  }catch{return false;}
}

export function prepareJuryDraft(input:JuryPreparationSource):JuryPreparedDraft{
  const blockers:string[]=[];
  if(!validNumber(input.season)||!validNumber(input.episode)||!Number.isSafeInteger(input.gameRevision)||input.gameRevision<0)blockers.push('Season, episode, or source revision is invalid.');
  if(input.episode!==input.currentEpisode+1)blockers.push('Prepare only the next unconfirmed episode.');
  if(!input.activation?.enabled||!validNumber(input.activation.fromEpisode)||input.episode<input.activation.fromEpisode)blockers.push('Jury activation needs Game Master review.');
  if(!input.broadcast)blockers.push('Airtime is missing from the broadcast calendar.');
  else if(!validAirtime(input.broadcast.airtime,input.now))blockers.push('Verify future Eastern airtime, date, and daylight saving offset.');
  if(input.broadcast&&!input.broadcast.source.trim())blockers.push('Broadcast calendar provenance is missing.');
  const invalidMergeEpisode=input.merge.occurred
    ?!validNumber(input.merge.episode??NaN)||Number(input.merge.episode)>input.currentEpisode
    :input.merge.episode!==null;
  if(!input.merge.verified||invalidMergeEpisode)blockers.push('Merge history needs explicit verification.');
  if(!input.castaways.length||!input.tribes.length||!uniqueRows(input.castaways)||!uniqueRows(input.tribes))blockers.push('Roster and tribes must be nonempty with unique identities.');
  if(input.castaways.some(c=>!c.name.trim()||!input.tribes.some(t=>t.id===c.tribeId))||input.tribes.some(t=>!t.name.trim()))blockers.push('Verify every castaway and tribe assignment.');
  if(!uniqueRows(input.players))blockers.push('Player identities must be unique.');
  if(input.players.some(p=>p.active&&p.issues.length))blockers.push('Unresolved draft-slot or elimination history affects jury eligibility.');

  const sorted=(rows:Array<{id:string;name:string}>)=>rows.map(r=>({...r})).sort((a,b)=>a.id.localeCompare(b.id));
  const tribes=sorted(input.tribes);
  const castaways=input.castaways.map(c=>({...c})).sort((a,b)=>a.id.localeCompare(b.id));
  const eligiblePlayerIds=input.players.filter(p=>p.active&&p.issues.length===0&&p.eligibleFrom!==null&&p.eligibleFrom<=input.episode).map(p=>p.id).sort();
  const proposed={airtime:input.broadcast?.airtime??null,timeZone:'America/New_York' as const,broadcastSource:input.broadcast?.source.trim()??null,format:input.merge.occurred&&input.merge.episode!==null&&input.episode>input.merge.episode?'post-merge' as const:'pre-merge' as const,mergeEpisode:input.merge.episode,tribes,castaways,eligiblePlayerIds};
  const fingerprint=JSON.stringify({schema:1,season:input.season,episode:input.episode,gameRevision:input.gameRevision,activation:input.activation,merge:input.merge,proposal:proposed,blockers});
  return {schema:1,id:createHash('sha256').update(fingerprint).digest('hex'),season:input.season,episode:input.episode,gameRevision:input.gameRevision,state:blockers.length?'BLOCKED':'READY_FOR_REVIEW',blockers,proposal:proposed};
}

export type JuryApprovalReview={
  actorAuthorized:boolean;
  expectedDraftId:string;
  currentGameRevision:number;
  confirmedAt:string;
  confirmedBroadcast:boolean;
  confirmedRoster:boolean;
  confirmedMerge:boolean;
  reason:string;
};

export function validateJuryDraftApproval(draft:JuryPreparedDraft,review:JuryApprovalReview){
  if(!review.actorAuthorized)throw new Error('Game Master authorization is required.');
  if(draft.state!=='READY_FOR_REVIEW'||draft.blockers.length)throw new Error('Resolve draft blockers before approving.');
  if(draft.id!==review.expectedDraftId||draft.gameRevision!==review.currentGameRevision)throw new Error('Episode preparation is stale; review the latest version.');
  if(!review.confirmedBroadcast||!review.confirmedRoster||!review.confirmedMerge||review.reason.trim().length<10)throw new Error('Confirm broadcast, roster, merge, and a meaningful reason.');
  if(!draft.proposal.airtime||!validAirtime(draft.proposal.airtime,review.confirmedAt))throw new Error('Episode airtime has passed or needs verification.');
  // This is a validated *intent*, not a persisted snapshot or a grant of authority.
  return {season:draft.season,episode:draft.episode,draftId:draft.id,gameRevision:draft.gameRevision,confirmedAt:review.confirmedAt,reason:review.reason.trim()};
}

export type JuryNoticeIntent={
  key:string;
  purpose:'approval-ready'|'approval-reminder-24h'|'approval-reminder-6h';
  channels:readonly ['in-app','email'];
  season:number;
  episode:number;
  draftId:string;
};

/** Generates durable outbox intent keys only; the approved provider sends later. */
export function planJuryApprovalNotice(draft:JuryPreparedDraft,opts:{now:string;alreadyOpen:boolean;recordedKeys:ReadonlySet<string>;reminderHours?:readonly number[]}):JuryNoticeIntent|null{
  if(draft.state!=='READY_FOR_REVIEW'||opts.alreadyOpen||!draft.proposal.airtime)return null;
  const remaining=Date.parse(draft.proposal.airtime)-Date.parse(opts.now);
  if(!Number.isFinite(remaining)||remaining<=0)return null;
  const keyFor=(purpose:JuryNoticeIntent['purpose'])=>`jury:${draft.season}:${draft.episode}:${draft.id}:${purpose}`;
  const ready=keyFor('approval-ready');
  let purpose:JuryNoticeIntent['purpose']|null=null;
  if(!opts.recordedKeys.has(ready))purpose='approval-ready';
  else{
    // Cadence remains configurable and requires product approval. One intent
    // at a time avoids stacking multiple reminders on a late-running job.
    const thresholds=opts.reminderHours??[];
    if(thresholds.includes(6)&&remaining<=6*60*60*1000&&!opts.recordedKeys.has(keyFor('approval-reminder-6h')))purpose='approval-reminder-6h';
    else if(thresholds.includes(24)&&remaining<=24*60*60*1000&&!opts.recordedKeys.has(keyFor('approval-reminder-24h')))purpose='approval-reminder-24h';
  }
  return purpose?{key:keyFor(purpose),purpose,channels:['in-app','email'],season:draft.season,episode:draft.episode,draftId:draft.id}:null;
}
