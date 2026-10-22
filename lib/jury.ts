import type {GameState,ScoreEvent} from './game-data.ts';
import {canonicalJson} from './score-ledger.ts';

export const JURY_RULES_VERSION='jury-a-1';
export const questionIds=['q1','q2','q3','q4','q5'] as const;
export type QuestionId=typeof questionIds[number];
export type Reconciliation={castawayId:string;episode:number;provenance:string;source:string};
export type JuryConfig={season:number;enabled:boolean;activationEpisode:number;activatedAt?:string;revision:number;approvedAt:string;approvedBy:string;approval:string;reconciliations:Reconciliation[]};
export type JurySnapshot={season:number;episode:number;version:number;rulesVersion:typeof JURY_RULES_VERSION;airtime:string;timeZone:string;mergeEpisode:number|null;mergeVerified:true;format:'pre-merge'|'post-merge';castaways:Array<{id:string;name:string;tribeId:string}>;tribes:Array<{id:string;name:string}>;provenance:string};
export type PlayerJurySnapshot=Omit<JurySnapshot,'provenance'>;
export type JuryAnswer={id:QuestionId;value:string;revision:number;savedAt:string;requestId:string;late:false;state:'saved';snapshotVersion:number};
export type JuryPrediction={season:number;episode:number;playerId:string;ownerUid:string;snapshotVersion:number;answers:Partial<Record<QuestionId,JuryAnswer>>;revision:number;eligibility:{fromEpisode:number;slots:string[]};grade?:JuryGrade;gradingEligible?:boolean;gradedAt?:string;futureResolution?:{watched?:boolean;skipped?:boolean;forfeited?:QuestionId[]}};
export type JuryVote={castawayId:string;countedVotes:number;nullifiedVotes:number;extraVotes:number};
export type JuryCouncil={id:string;tribeId:string;rounds:Array<{id:string;votes:JuryVote[]}>;votedOutIds:string[]};
export type JuryFacts={mergeOccurred:boolean|null;immunityComplete:boolean;immunityWinnerIds:string[];councilsComplete:boolean;votesComplete:boolean;councils:JuryCouncil[];itemsComplete:boolean;items:Array<{id:string;councilId:string;kind:'idol'|'advantage'|'shot-in-the-dark';successful:boolean}>;provenance:string};
export type JuryKey={q1:string[];q2:string[];q3:string[];q4:string[];q5:string[]};
export type JuryGrade={points:Record<QuestionId,number>;correct:Record<QuestionId,boolean>;cleanSweep:number;total:number;keyRevision:number};
export type JuryEpisode={snapshot:JurySnapshot;facts:JuryFacts;revision:number;key:JuryKey|null;keyRevision:number;confirmedAt:string|null;confirmedBy:string|null;gradedAt:string|null;confirmedEvidenceRevision?:number;accuracy?:{keyRevision:number;gradedAt:string;questions:Record<QuestionId,{correct:number;answered:number}>}};
export class JuryError extends Error {readonly status:number;constructor(message:string,status=409){super(message);this.name='JuryError';this.status=status;}}
export const eliminationSource=(cast:GameState['castaways'][number])=>canonicalJson({status:cast.status,episode:cast.eliminationEpisode??null,reason:cast.eliminationReason??null});
const unique=(values:string[])=>[...new Set(values)].sort();
function assert(condition:unknown,message:string):asserts condition {if(!condition)throw new JuryError(message,400);}
function positive(value:unknown){return Number.isSafeInteger(value)&&Number(value)>0;}

export function juryEligibility(game:GameState,playerId:string,reconciliations:Reconciliation[]=[]){
  const picks=game.draftPicks.filter(p=>p.playerId===playerId).sort((a,b)=>a.round-b.round);
  const slots=picks.map(p=>p.castawayId),issues:string[]=[];
  if(picks.length!==3||picks.some((p,i)=>p.round!==i+1)||slots.some(id=>!id))issues.push('Three original draft slots must be verified.');
  let last=0,alive=false;
  for(const id of slots){
    const cast=game.castaways.find(c=>c.id===id);
    if(!cast){issues.push('Missing castaway '+id);continue;}
    if(cast.status==='active'){alive=true;continue;}
    const reviewed=reconciliations.find(r=>r.castawayId===id&&r.source===eliminationSource(cast));
    const episode=cast.eliminationEpisode??reviewed?.episode;
    if(!positive(episode)||Number(episode)>game.season.currentEpisode)issues.push(cast.name+': elimination episode needs commissioner review.');
    else last=Math.max(last,Number(episode));
  }
  return {playerId,slots,issues:unique(issues),fromEpisode:!alive&&!issues.length&&last?last+1:null};
}
export function eligibleForEpisode(game:GameState,config:JuryConfig|null,playerId:string,episode:number){
  const result=juryEligibility(game,playerId,config?.reconciliations);
  return Boolean(config?.enabled&&game.players.some(p=>p.id===playerId&&p.active!==false)&&episode>=config.activationEpisode&&result.fromEpisode!==null&&episode>=result.fromEpisode);
}
export function activationPreview(game:GameState,episode:number|null,config:JuryConfig|null=null){
  return {season:game.season.number,currentEpisode:game.season.currentEpisode,activePlayers:game.players.filter(p=>p.active!==false).length,draftPicks:game.draftPicks.length,selectedActivationEpisode:episode,activationApproved:false,
    players:game.players.filter(p=>p.active!==false).map(p=>({id:p.id,name:p.name,...juryEligibility(game,p.id,config?.reconciliations),eliminations:game.draftPicks.filter(d=>d.playerId===p.id).map(d=>{const c=game.castaways.find(c=>c.id===d.castawayId);return {round:d.round,castawayId:d.castawayId,name:c?.name??null,status:c?.status??null,reason:c?.eliminationReason??null,episode:c?.eliminationEpisode??null};})})),
    proposedSnapshots:episode===game.season.currentEpisode+1?[{verification:'Commissioner must verify this future candidate before saving an immutable snapshot; it is never used as historical prediction state.',season:game.season.number,episode,version:1,rulesVersion:JURY_RULES_VERSION,airtime:null,timeZone:'America/New_York',mergeEpisode:game.season.mergeOccurred===true?game.season.mergeEpisode??null:null,format:game.season.mergeOccurred===true?'post-merge':'pre-merge',castaways:game.castaways.filter(c=>c.status==='active').map(c=>({id:c.id,name:c.name,tribeId:c.tribeId??null})),tribes:game.tribes.map(t=>({id:t.id,name:t.name}))}]:[],expectedNewRecords:episode?['juryConfig/'+game.season.number,'juryEpisodes/'+game.season.number+'-'+episode,'juryPredictions: only when an eligible player saves','juryAudit: explicit commissioner actions and answer saves']:[],
    blockers:['Commissioner must approve the first activation episode and canonical airtime.','Verified immutable pre-episode roster and tribes required.','Unresolved historical eliminations must be reconciled with provenance.'],preservation:{scoreEvents:game.scoreEvents.length,standardScoringWrites:0,historicalPredictionCreation:0}};
}
export function validateSnapshot(value:JurySnapshot,game:GameState,now:string):JurySnapshot {
  assert(value&&value.season===game.season.number&&positive(value.episode),'Choose an episode in the active season.');
  assert(value.episode>=game.season.currentEpisode,'Historical prediction activation requires separate commissioner authorization.');
  assert(value.version===1&&value.rulesVersion===JURY_RULES_VERSION,'Unsupported snapshot version.');
  assert(typeof value.airtime==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.airtime)&&Number.isFinite(Date.parse(value.airtime))&&Date.parse(value.airtime)>Date.parse(now),'Airtime must be a future ISO timestamp with an explicit UTC offset.');
  const [year,month,day]=value.airtime.slice(0,10).split('-').map(Number);
  assert(month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(year,month,0)).getUTCDate(),'Airtime must contain a valid calendar date.');
  assert(typeof value.timeZone==='string'&&value.timeZone.trim().length>0,'Choose an explicit IANA time zone.');
  try{new Intl.DateTimeFormat('en-US',{timeZone:value.timeZone}).format();}catch{throw new JuryError('Choose a valid IANA time zone.',400);}
  assert(typeof value.provenance==='string'&&value.provenance.trim().length>=10,'Record the source used to verify this roster, tribes, and airtime.');
  assert(value.mergeVerified===true,'Explicitly verify the pre-episode merge history; missing merge metadata is not confirmation.');
  assert(game.season.mergeOccurred!==true||positive(game.season.mergeEpisode),'The recorded merge episode needs commissioner review.');
  assert(value.mergeEpisode===null||positive(value.mergeEpisode)&&value.mergeEpisode<=game.season.currentEpisode,'Record only a verified merge episode.');
  const recordedMerge=game.season.mergeOccurred===true?game.season.mergeEpisode:null;
  assert((value.mergeEpisode??null)===(recordedMerge??null),'Snapshot merge status must match the authoritative recorded merge.');
  assert(value.format===(value.mergeEpisode!==null&&value.episode>value.mergeEpisode?'post-merge':'pre-merge'),'Question format must follow the recorded merge episode.');
  assert(Array.isArray(value.castaways)&&value.castaways.length>0&&Array.isArray(value.tribes)&&value.tribes.length>0,'Verify a nonempty pre-episode roster and tribe configuration.');
  assert(new Set(value.castaways.map(c=>c.id)).size===value.castaways.length&&new Set(value.tribes.map(t=>t.id)).size===value.tribes.length,'Snapshot identities must be unique.');
  assert(value.tribes.every(t=>typeof t.id==='string'&&/^[a-zA-Z0-9_-]+$/.test(t.id)&&typeof t.name==='string'&&t.name.trim()),'Invalid snapshot tribe.');
  for(const c of value.castaways)assert(game.castaways.some(known=>known.id===c.id)&&typeof c.name==='string'&&c.name.trim()&&value.tribes.some(t=>t.id===c.tribeId),'Verify every castaway and historical tribe.');
  // Deliberately copy allowed fields; never embed arbitrary client data in a snapshot.
  return {season:value.season,episode:value.episode,version:1,rulesVersion:JURY_RULES_VERSION,airtime:new Date(value.airtime).toISOString(),timeZone:value.timeZone,mergeEpisode:value.mergeEpisode,mergeVerified:true,format:value.format,castaways:value.castaways.map(c=>({id:c.id,name:c.name,tribeId:c.tribeId})),tribes:value.tribes.map(t=>({id:t.id,name:t.name})),provenance:value.provenance.trim()};
}
/** Corrections may change the applicable question/point format; never silently reuse that snapshot. */
export function assertSnapshotMergeHistory(snapshot:JurySnapshot,game:GameState){
  assert(game.season.mergeOccurred!==true||positive(game.season.mergeEpisode),'Merge history needs review before using this snapshot.');
  const format=game.season.mergeOccurred===true&&snapshot.episode>game.season.mergeEpisode!?'post-merge':'pre-merge';
  assert(snapshot.format===format,'Snapshot conflicts with corrected merge history. Commissioner review is required.');
}
export function playerSnapshot(snapshot:JurySnapshot):PlayerJurySnapshot {
  return {season:snapshot.season,episode:snapshot.episode,version:snapshot.version,rulesVersion:snapshot.rulesVersion,airtime:snapshot.airtime,timeZone:snapshot.timeZone,mergeEpisode:snapshot.mergeEpisode,mergeVerified:snapshot.mergeVerified,format:snapshot.format,castaways:snapshot.castaways,tribes:snapshot.tribes};
}
export function answerOptions(snapshot:PlayerJurySnapshot,question:QuestionId,q1?:string):Array<{value:string;label:string}> {
  const casts=snapshot.castaways.map(c=>({value:c.id,label:c.name}));
  if(question==='q1')return snapshot.format==='post-merge'?[...casts,{value:'no-immunity',label:'No immunity winner'}]:[...snapshot.tribes.map(t=>({value:t.id,label:t.name})),{value:'merge',label:'Merge'},{value:'no-council',label:'No Tribal Council'}];
  if(question==='q2')return [{value:'nothing',label:'Nothing'},{value:'idol',label:'An immunity idol'},{value:'advantage',label:'Shot in the Dark or another advantage'},{value:'multiple',label:'Multiple items'}];
  if(question==='q3')return ['0','1','2','3+'].map(value=>({value,label:value}));
  const selected=snapshot.format==='post-merge'||q1==='merge'?casts:q1==='no-council'?[]:casts.filter(c=>snapshot.castaways.find(item=>item.id===c.value)?.tribeId===q1);
  return [...selected,{value:'nobody',label:question==='q4'?'Nobody else':'Nobody'}];
}
export function saveJuryAnswer(snapshot:JurySnapshot,prediction:JuryPrediction,question:QuestionId,value:string,expectedRevision:number,requestId:string,now:string):JuryPrediction {
  assert(questionIds.includes(question)&&typeof value==='string','Choose a valid question and answer.');
  assert(typeof requestId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(requestId),'Invalid save request ID.');
  const existing=prediction.answers[question];
  if(existing?.requestId===requestId){assert(existing.value===value,'This save ID already belongs to another answer.');return prediction;}
  if(Date.parse(now)>=Date.parse(snapshot.airtime))throw new JuryError('Airtime has passed. Saved answers are locked; unanswered questions remain unanswered.');
  if(prediction.revision!==expectedRevision)throw new JuryError('Answers changed in another session. Reload before saving again.');
  assert(answerOptions(snapshot,question,prediction.answers.q1?.value).some(o=>o.value===value),'That option is not available in this episode snapshot.');
  // Changing Q1 must not silently delete already saved Q4/Q5 answers.
  if(question==='q1')for(const q of ['q4','q5'] as const)if(prediction.answers[q]&&!answerOptions(snapshot,q,value).some(o=>o.value===prediction.answers[q]!.value))throw new JuryError('Change the saved castaway answers to Nobody first, then change the tribe prediction.');
  return {...prediction,revision:prediction.revision+1,answers:{...prediction.answers,[question]:{id:question,value,revision:(existing?.revision??0)+1,savedAt:now,requestId,late:false,state:'saved',snapshotVersion:snapshot.version}}};
}
export const emptyFacts=():JuryFacts=>({mergeOccurred:null,immunityComplete:false,immunityWinnerIds:[],councilsComplete:false,votesComplete:false,councils:[],itemsComplete:false,items:[],provenance:''});
export function suggestedFacts(game:GameState,snapshot:JurySnapshot):JuryFacts {
  const councils=(game.tribalCouncils??[]).filter(c=>c.episode===snapshot.episode);
  return {...emptyFacts(),mergeOccurred:game.season.mergeOccurred===true&&game.season.mergeEpisode===snapshot.episode?true:null,
    immunityWinnerIds:unique(game.scoreEvents.filter(e=>e.episode===snapshot.episode&&e.categoryId==='individual-immunity'&&e.scoringStatus!=='reversed').flatMap(e=>e.castawayId?[e.castawayId]:[])),
    councils:councils.map(c=>({id:c.id,tribeId:c.tribeId??'',votedOutIds:c.eliminatedCastawayId&&c.eliminationReason==='voted-out'?[c.eliminatedCastawayId]:[],rounds:snapshot.format==='post-merge'?standardRounds(game,snapshot.episode,c.id):[]})),
    items:(game.possessions??[]).filter(p=>p.status==='played'&&p.playedEpisode===snapshot.episode).map(p=>({id:p.id,councilId:councils.length===1?councils[0].id:'',kind:p.category,successful:p.successful===true}))};
}
function standardRounds(game:GameState,episode:number,councilId:string):JuryCouncil['rounds'] {
  const votes=(game.tribalVotes??[]).filter(v=>v.episode===episode&&v.tribalCouncilId===councilId);
  return unique(votes.map(v=>String(v.round))).map(round=>({id:round,votes:votes.filter(v=>String(v.round)===round).map(v=>({castawayId:v.castawayId,countedVotes:v.countedVotes,nullifiedVotes:v.nullifiedVotes,extraVotes:v.extraVotes}))}));
}
export function confirmedFacts(facts:JuryFacts,snapshot:JurySnapshot,game:GameState):JuryFacts {
  assertSnapshotMergeHistory(snapshot,game);
  assert(facts&&facts.councilsComplete===true&&facts.votesComplete===true&&facts.itemsComplete===true,'Confirm council, counted-vote, and item-play evidence, including explicit empty outcomes.');
  assert(typeof facts.provenance==='string'&&facts.provenance.trim().length>=10,'Describe the verified evidence and correction reason.');
  assert(typeof facts.mergeOccurred==='boolean','Confirm whether the merge occurred in this episode.');
  assert(facts.mergeOccurred===(game.season.mergeOccurred===true&&game.season.mergeEpisode===snapshot.episode),'Confirm the merge in standard season scoring before confirming Jury evidence.');
  if(snapshot.format==='post-merge')assert(facts.immunityComplete===true,'Confirm individual immunity evidence, including no winner.');
  assert(Array.isArray(facts.councils)&&Array.isArray(facts.items)&&Array.isArray(facts.immunityWinnerIds),'Invalid episode evidence.');
  const allowed=(id:string)=>snapshot.castaways.some(c=>c.id===id);
  assert(facts.immunityWinnerIds.every(allowed),'Immunity winners must belong to the pre-episode roster.');
  assert(new Set(facts.councils.map(c=>c.id)).size===facts.councils.length,'Council IDs must be unique.');
  const councils=facts.councils.map(c=>{
    assert(typeof c.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(c.id),'Invalid council identity.');
    assert(snapshot.format==='post-merge'||facts.mergeOccurred||snapshot.tribes.some(t=>t.id===c.tribeId),'Verify each council tribe.');
    assert(Array.isArray(c.votedOutIds)&&c.votedOutIds.every(allowed)&&Array.isArray(c.rounds),'Verify council eliminations and voting rounds.');
    let rounds=c.rounds;
    if(snapshot.format==='post-merge'||facts.mergeOccurred){
      const standard=(game.tribalCouncils??[]).find(row=>row.id===c.id&&row.episode===snapshot.episode&&row.status==='resolved');
      assert(standard,'Resolve post-merge councils in standard scoring first.');
      const standardOut=standard.eliminationReason==='voted-out'&&standard.eliminatedCastawayId?[standard.eliminatedCastawayId]:[];
      assert(canonicalJson(unique(c.votedOutIds))===canonicalJson(standardOut),'Post-merge eliminations must match standard council outcomes.');
      rounds=standardRounds(game,snapshot.episode,c.id);
      if(!rounds.length&&c.rounds.length>0&&c.rounds.every(r=>r.votes.length===0))rounds=c.rounds;
    }
    assert(rounds.length>0,'Record at least one voting round per council; an empty votes list explicitly means no votes.');
    assert(new Set(rounds.map(r=>r.id)).size===rounds.length,'Voting-round IDs must be unique.');
    for(const r of rounds){
      assert(typeof r.id==='string'&&r.id.length>0&&Array.isArray(r.votes),'Invalid voting round.');
      assert(new Set(r.votes.map(v=>v.castawayId)).size===r.votes.length,'One recipient row per voting round is required.');
      for(const v of r.votes)assert(allowed(v.castawayId)&&[v.countedVotes,v.nullifiedVotes,v.extraVotes].every(n=>Number.isSafeInteger(n)&&n>=0)&&v.extraVotes<=v.countedVotes,'Verify counted votes, nullified votes, and additional votes. Additional votes are included in counted votes.');
    }
    return {id:c.id,tribeId:c.tribeId,rounds:rounds.map(r=>({id:r.id,votes:r.votes.map(v=>({castawayId:v.castawayId,countedVotes:v.countedVotes,nullifiedVotes:v.nullifiedVotes,extraVotes:v.extraVotes}))})),votedOutIds:unique(c.votedOutIds)};
  });
  if(snapshot.format==='post-merge'||facts.mergeOccurred)assert((game.tribalCouncils??[]).filter(c=>c.episode===snapshot.episode).every(c=>councils.some(row=>row.id===c.id)),'Include all recorded merge / post-merge councils.');
  assert(new Set(facts.items.map(i=>i.id)).size===facts.items.length,'Item plays need distinct stable IDs.');
  for(const item of facts.items)assert(typeof item.id==='string'&&item.id.length>0&&councils.some(c=>c.id===item.councilId)&&['idol','advantage','shot-in-the-dark'].includes(item.kind)&&typeof item.successful==='boolean','Verify every qualifying item play and council.');
  return {mergeOccurred:facts.mergeOccurred,immunityComplete:facts.immunityComplete===true,immunityWinnerIds:unique(facts.immunityWinnerIds),councilsComplete:true,votesComplete:true,councils,itemsComplete:true,items:facts.items.map(i=>({id:i.id,councilId:i.councilId,kind:i.kind,successful:i.successful})),provenance:facts.provenance.trim()};
}
export function answerKey(snapshot:JurySnapshot,facts:JuryFacts):JuryKey {
  const outs=unique(facts.councils.flatMap(c=>c.votedOutIds));
  const recipients=facts.councils.map(c=>unique(c.rounds.flatMap(r=>r.votes.filter(v=>v.countedVotes>0).map(v=>v.castawayId))));
  const secondary=recipients.flatMap((ids,i)=>{const others=ids.filter(id=>!facts.councils[i].votedOutIds.includes(id));return others.length?others:['nobody'];});
  return {q1:snapshot.format==='post-merge'?(facts.immunityWinnerIds.length?facts.immunityWinnerIds:['no-immunity']):facts.mergeOccurred?['merge']:facts.councils.length?unique(facts.councils.map(c=>c.tribeId)):['no-council'],q2:[facts.items.length>=2?'multiple':facts.items.length===1?facts.items[0].kind==='idol'?'idol':'advantage':'nothing'],q3:unique(recipients.length?recipients.map(ids=>ids.length>=3?'3+':String(ids.length)):['0']),q4:unique(secondary.length?secondary:['nobody']),q5:outs.length?outs:['nobody']};
}
export function gradePrediction(snapshot:JurySnapshot,prediction:JuryPrediction,key:JuryKey,keyRevision:number):JuryGrade {
  const weights={q1:snapshot.format==='post-merge'?3:1,q2:1,q3:1,q4:1,q5:5};
  const correct=Object.fromEntries(questionIds.map(q=>[q,Boolean(prediction.answers[q]&&key[q].includes(prediction.answers[q]!.value))])) as Record<QuestionId,boolean>;
  const points=Object.fromEntries(questionIds.map(q=>[q,correct[q]?weights[q]:0])) as Record<QuestionId,number>;
  const cleanSweep=questionIds.every(q=>correct[q])?2:0;
  return {points,correct,cleanSweep,total:Object.values(points).reduce((a,b)=>a+b,0)+cleanSweep,keyRevision};
}
export function applyJuryAwards(game:GameState,snapshot:JurySnapshot,predictions:JuryPrediction[],key:JuryKey,keyRevision:number,config:JuryConfig,at:string){
  const prefix=`jury:${snapshot.season}:${snapshot.episode}:`;
  const awards:ScoreEvent[]=predictions.map(p=>{
    const total=eligibleForEpisode(game,config,p.playerId,snapshot.episode)?gradePrediction(snapshot,p,key,keyRevision).total:0;
    // Only the aggregate award enters shared state. Answer-level results remain private.
    return {id:prefix+p.playerId+':total',awardKey:prefix+p.playerId+':total',playerId:p.playerId,points:total,episode:snapshot.episode,createdAt:at,source:'jury',actionLabel:'Jury Mode',note:'Confirmed Jury key revision '+keyRevision};
  });
  // Replace awards in place by stable identity. Never touch castaway scoring or other adjustments.
  const replaced=new Map(awards.map(e=>[e.id,e]));
  const scoreEvents=game.scoreEvents.map(e=>{const next=replaced.get(e.id);if(next){replaced.delete(e.id);return {...next,createdAt:e.createdAt};}return e;});
  return {...game,scoreEvents:[...scoreEvents,...replaced.values()]};
}
