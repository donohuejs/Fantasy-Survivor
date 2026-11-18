import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareJuryDraft,type JuryPreparationSource} from '../lib/jury-preparation.ts';
import {makeJuryReviewSubmission} from '../lib/jury-review.ts';
import {approvePreparedJuryEpisode,queueJuryApprovalNotice,JuryApprovalConflict,
  type JuryApprovalStore,type JuryApprovalTransaction,type JuryOpenedEpisode,
  type JuryApprovalAudit,type JuryApprovalOutbox} from '../lib/jury-approval-contract.ts';

const now='2026-11-18T12:00:00-05:00';
const later='2026-11-19T00:00:00-05:00';
const last='2026-11-19T20:00:00-05:00';
function source():JuryPreparationSource{
  return {
    season:77,episode:12,currentEpisode:11,gameRevision:18,now,
    activation:{enabled:true,fromEpisode:8},
    broadcast:{airtime:last,source:'Synthetic approved schedule'},
    tribes:[{id:'t1',name:'Tribe A'}],
    castaways:[{id:'c1',name:'Castaway A',tribeId:'t1'}],
    merge:{occurred:true,episode:10,verified:true},
    players:[{id:'p1',active:true,eligibleFrom:11,issues:[]}],
  };
}
type Memory={
  input:JuryPreparationSource;
  approved:Set<string>;
  episodes:Map<string,JuryOpenedEpisode>;
  audits:Map<string,JuryApprovalAudit>;
  outbox:Map<string,JuryApprovalOutbox>;
};
function mockStore(){
  const state:Memory={
    input:source(),approved:new Set(['verified-gm']),
    episodes:new Map(),audits:new Map(),outbox:new Map(),
  };
  let tail=Promise.resolve();
  let failAudit=false;
  const store:JuryApprovalStore={
    async runAtomic<T>(callback:(tx:JuryApprovalTransaction)=>Promise<T>):Promise<T>{
      const previous=tail;
      let unlock!:()=>void;
      tail=new Promise<void>(resolve=>{unlock=resolve;});
      await previous;
      // A test-only serializable transaction: writes are committed together,
      // and a thrown error rolls back the entire clone.
      const clone:Memory={
        input:structuredClone(state.input),approved:new Set(state.approved),
        episodes:new Map(structuredClone([...state.episodes])),
        audits:new Map(structuredClone([...state.audits])),
        outbox:new Map(structuredClone([...state.outbox])),
      };
      const tx:JuryApprovalTransaction={
        async isAuthorizedGameMaster(uid){return clone.approved.has(uid);},
        async readPreparationSource(){return structuredClone(clone.input);},
        async readOpenedEpisode(season,episode){
          return structuredClone(clone.episodes.get(`${season}-${episode}`)??null);
        },
        async createOpenedEpisode(record){
          if(clone.episodes.has(record.id))throw new Error('create-if-absent violation');
          clone.episodes.set(record.id,structuredClone(record));
        },
        async createAudit(record){
          if(failAudit)throw new Error('synthetic audit write failure');
          if(clone.audits.has(record.id))throw new Error('audit collision');
          clone.audits.set(record.id,structuredClone(record));
        },
        async readOutbox(key){return structuredClone(clone.outbox.get(key)??null);},
        async createOutbox(record){
          if(clone.outbox.has(record.key))throw new Error('outbox collision');
          clone.outbox.set(record.key,structuredClone(record));
        },
      };
      try{
        const result=await callback(tx);
        state.input=clone.input;state.approved=clone.approved;
        state.episodes=clone.episodes;state.audits=clone.audits;state.outbox=clone.outbox;
        return result;
      }finally{unlock();}
    },
  };
  return {state,store,failAudit:()=>{failAudit=true;}};
}
function request(){
  const draft=prepareJuryDraft(source());
  const review=makeJuryReviewSubmission(draft,{asOf:now,acknowledged:true,note:'Checked.'});
  assert.ok(review);
  return review;
}
const gm={actorUid:'verified-gm',at:now};
async function rejectsCode(action:()=>Promise<unknown>,code:JuryApprovalConflict['code']){
  await assert.rejects(action,error=>error instanceof JuryApprovalConflict&&error.code===code);
}

test('approved snapshot and audit are created together, with server identity and immutable proposal copy',async()=>{
  const {state,store}=mockStore(),approval=request();
  const result=await approvePreparedJuryEpisode(store,gm,approval);
  assert.equal(result.result,'opened');
  assert.equal(result.snapshot.id,'77-12');
  assert.equal(result.snapshot.approvedBy,'verified-gm');
  assert.equal(result.snapshot.gameRevision,18);
  assert.equal(result.snapshot.proposal.format,'post-merge');
  assert.equal(state.episodes.size,1);
  assert.equal(state.audits.size,1);
  assert.equal([...state.audits.values()][0].actorUid,'verified-gm');
  assert.equal(state.input.currentEpisode,11,'opening a jury snapshot does not advance the season');
  result.snapshot.proposal.tribes[0].name='tampered after return';
  assert.equal(state.episodes.get('77-12')!.proposal.tribes[0].name,'Tribe A');
});
test('rejects unverified actors and does not grant authorization via client request',async()=>{
  const {state,store}=mockStore(),approval=request();
  await rejectsCode(()=>approvePreparedJuryEpisode(store,{actorUid:'ordinary-player',at:now},approval),'unauthorized');
  assert.equal(state.episodes.size,0);
  assert.equal(state.audits.size,0);
});
test('a stale draft, revision change or episode drift fails without writes',async()=>{
  const {state,store}=mockStore(),approval=request();
  state.input.gameRevision++;
  await rejectsCode(()=>approvePreparedJuryEpisode(store,gm,approval),'stale');
  state.input=source();
  state.input.episode=13;
  await rejectsCode(()=>approvePreparedJuryEpisode(store,gm,approval),'stale');
  assert.equal(state.episodes.size,0);
});
test('rejects expired airings and incomplete acknowledgements',async()=>{
  const {state,store}=mockStore(),approval=request();
  await rejectsCode(()=>approvePreparedJuryEpisode(store,{...gm,at:'2026-11-20T00:00:00-05:00'},approval),'expired');
  await rejectsCode(()=>approvePreparedJuryEpisode(store,gm,{...approval,confirmedMerge:false as true}),'invalid');
  assert.equal(state.episodes.size,0);
});
test('repeated and concurrent approvals create exactly one snapshot and audit',async()=>{
  const {state,store}=mockStore(),approval=request();
  const results=await Promise.all(Array.from({length:8},()=>approvePreparedJuryEpisode(store,gm,approval)));
  assert.equal(results.filter(result=>result.result==='opened').length,1);
  assert.equal(results.filter(result=>result.result==='already-open').length,7);
  assert.equal(state.episodes.size,1);
  assert.equal(state.audits.size,1);
  await rejectsCode(()=>approvePreparedJuryEpisode(store,gm,{...approval,expectedDraftId:'a'.repeat(64)}),'already-open');
});
test('audit write failure rolls back the snapshot within a simulated transaction',async()=>{
  const {state,store,failAudit}=mockStore();
  failAudit();
  await assert.rejects(()=>approvePreparedJuryEpisode(store,gm,request()),/synthetic audit write failure/);
  assert.equal(state.episodes.size,0);
  assert.equal(state.audits.size,0);
});
test('approval notice outbox is one two-channel intent, duplicate-safe under concurrent reconciliation',async()=>{
  const {state,store}=mockStore();
  const results=await Promise.all(Array.from({length:7},()=>queueJuryApprovalNotice(store,{at:now,authenticatedScheduler:true},77,{})));
  assert.equal(results.filter(result=>result.result==='queued').length,1);
  assert.equal(state.outbox.size,1);
  const notice=[...state.outbox.values()][0];
  assert.equal(notice.intent.purpose,'approval-ready');
  assert.equal(notice.channels.email.deliveryKey,notice.key+':email');
  assert.equal(notice.channels['in-app'].deliveryKey,notice.key+':in-app');
  assert.equal(notice.channels.email.state,'pending');
});
test('opt-in reminders queue once per threshold; no further notices after opening',async()=>{
  const {state,store}=mockStore();
  await queueJuryApprovalNotice(store,{at:now,authenticatedScheduler:true},77,{reminderHours:[24,6]});
  await queueJuryApprovalNotice(store,{at:later,authenticatedScheduler:true},77,{reminderHours:[24,6]});
  const lastSix='2026-11-19T16:00:00-05:00';
  await queueJuryApprovalNotice(store,{at:lastSix,authenticatedScheduler:true},77,{reminderHours:[24,6]});
  assert.equal(state.outbox.size,3);
  const approvals=await approvePreparedJuryEpisode(store,gm,request());
  assert.equal(approvals.result,'opened');
  const stopped=await queueJuryApprovalNotice(store,{at:lastSix,authenticatedScheduler:true},77,{reminderHours:[24,6]});
  assert.equal(stopped.result,'nothing-due');
  assert.equal(state.outbox.size,3);
});
test('untrusted schedulers, expired suggestions and preexisting episodes cannot queue notices',async()=>{
  const {state,store}=mockStore();
  await rejectsCode(()=>queueJuryApprovalNotice(store,{at:now,authenticatedScheduler:false as true},77,{}),'unauthorized');
  const expired=await queueJuryApprovalNotice(store,{at:'2026-11-20T00:00:00-05:00',authenticatedScheduler:true},77,{});
  assert.equal(expired.result,'nothing-due');
  assert.equal(state.outbox.size,0);
  await approvePreparedJuryEpisode(store,gm,request());
  const opened=await queueJuryApprovalNotice(store,{at:now,authenticatedScheduler:true},77,{});
  assert.equal(opened.result,'nothing-due');
});
