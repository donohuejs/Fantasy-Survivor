import assert from 'node:assert/strict';
import test from 'node:test';
import {planJuryApprovalNotice,prepareJuryDraft,validateJuryDraftApproval,type JuryPreparationSource} from '../lib/jury-preparation.ts';

const base: JuryPreparationSource={
  season:51,episode:8,currentEpisode:7,gameRevision:25,now:'2026-11-09T12:00:00Z',
  activation:{enabled:true,fromEpisode:7},
  broadcast:{airtime:'2026-11-11T20:00:00-05:00',source:'Verified season broadcast calendar'},
  tribes:[{id:'tovuto',name:'Tovuto'}],
  castaways:[{id:'b',name:'B',tribeId:'tovuto'},{id:'a',name:'A',tribeId:'tovuto'}],
  merge:{occurred:true,episode:7,verified:true},
  players:[{id:'jury-2',active:true,eligibleFrom:7,issues:[]},{id:'jury-1',active:true,eligibleFrom:8,issues:[]},{id:'playing',active:true,eligibleFrom:null,issues:[]}],
};
const approval=(id:string)=>({actorAuthorized:true,expectedDraftId:id,currentGameRevision:25,confirmedAt:'2026-11-10T12:00:00Z',confirmedBroadcast:true,confirmedRoster:true,confirmedMerge:true,reason:'Verified all proposed fields against broadcast and roster.'});

test('auto preparation is a deterministic proposed draft, not an opened snapshot',()=>{
  const draft=prepareJuryDraft(base);
  assert.equal(draft.state,'READY_FOR_REVIEW');
  assert.equal(draft.blockers.length,0);
  assert.equal(draft.proposal.format,'post-merge');
  assert.deepEqual(draft.proposal.eligiblePlayerIds,['jury-1','jury-2']);
  assert.equal(draft.proposal.timeZone,'America/New_York');
  assert.equal(draft.id,prepareJuryDraft({...base,castaways:[...base.castaways].reverse(),players:[...base.players].reverse()}).id);
  assert(!('openedAt' in draft));
});
test('merge episode itself still uses original pre-merge questions',()=>{
  assert.equal(prepareJuryDraft({...base,episode:7,currentEpisode:6,merge:{occurred:true,episode:6,verified:true}}).proposal.format,'post-merge');
  assert.equal(prepareJuryDraft({...base,episode:7,currentEpisode:7,merge:{occurred:true,episode:7,verified:true}}).proposal.format,'pre-merge');
});
test('invalid or missing calendar and wrong daylight-saving offset cannot become ready',()=>{
  for(const broadcast of [null,{airtime:'2026-11-11T20:00:00-04:00',source:'Calendar'},{airtime:'2026-02-30T20:00:00-05:00',source:'Calendar'},{airtime:'2026-11-11T20:00:00',source:'Calendar'},{airtime:'2026-11-11T20:00:00-05:00',source:''}]){
    const result=prepareJuryDraft({...base,broadcast});
    assert.equal(result.state,'BLOCKED');
  }
  assert.equal(prepareJuryDraft({...base,now:'2026-11-12T02:00:00Z'}).state,'BLOCKED');
});
test('unverified history and inconsistent roster block approval',()=>{
  assert.equal(prepareJuryDraft({...base,merge:{occurred:true,episode:7,verified:false}}).state,'BLOCKED');
  assert.equal(prepareJuryDraft({...base,castaways:[{id:'a',name:'A',tribeId:'unknown'}]}).state,'BLOCKED');
  assert.equal(prepareJuryDraft({...base,castaways:[base.castaways[0],base.castaways[0]]}).state,'BLOCKED');
  assert.equal(prepareJuryDraft({...base,players:[{id:'jury-1',active:true,eligibleFrom:null,issues:['Episode missing']}]}).state,'BLOCKED');
});
test('the draft ID changes when the authoritative game revision changes',()=>{
  assert.notEqual(prepareJuryDraft({...base,gameRevision:26}).id,prepareJuryDraft(base).id);
});
test('approval requires current revision, explicit checks, verified future airtime and Game Master authority',()=>{
  const draft=prepareJuryDraft(base),review=approval(draft.id);
  assert.equal(validateJuryDraftApproval(draft,review).draftId,draft.id);
  assert.throws(()=>validateJuryDraftApproval(draft,{...review,actorAuthorized:false}),/authorization/);
  assert.throws(()=>validateJuryDraftApproval(draft,{...review,expectedDraftId:'old'}),/stale/);
  assert.throws(()=>validateJuryDraftApproval(draft,{...review,currentGameRevision:26}),/stale/);
  assert.throws(()=>validateJuryDraftApproval(draft,{...review,confirmedMerge:false}),/Confirm broadcast/);
  assert.throws(()=>validateJuryDraftApproval(draft,{...review,confirmedAt:'2026-11-12T01:00:00Z'}),/passed/);
  const blocked=prepareJuryDraft({...base,broadcast:null});
  assert.throws(()=>validateJuryDraftApproval(blocked,approval(blocked.id)),/Resolve draft blockers/);
});
test('notification planner creates one dual-channel intent and deduplicates repeats',()=>{
  const draft=prepareJuryDraft(base),opts={now:'2026-11-09T12:00:00Z',alreadyOpen:false,recordedKeys:new Set<string>()};
  const first=planJuryApprovalNotice(draft,opts);
  assert(first);
  assert.equal(first.purpose,'approval-ready');
  assert.deepEqual(first.channels,['in-app','email']);
  assert.deepEqual(planJuryApprovalNotice(draft,{...opts,recordedKeys:new Set([first.key])}),null);
  assert.deepEqual(planJuryApprovalNotice(draft,{...opts,alreadyOpen:true}),null);
});
test('optional reminder windows remain deliberate, deduplicated and stop at airtime',()=>{
  const draft=prepareJuryDraft(base);
  const ready=`jury:51:8:${draft.id}:approval-ready`,keys=new Set([ready]);
  const reminder=planJuryApprovalNotice(draft,{now:'2026-11-11T03:00:00Z',alreadyOpen:false,recordedKeys:keys,reminderHours:[24,6]});
  assert.equal(reminder?.purpose,'approval-reminder-24h');
  keys.add(reminder!.key);
  const urgent=planJuryApprovalNotice(draft,{now:'2026-11-11T20:00:00Z',alreadyOpen:false,recordedKeys:keys,reminderHours:[24,6]});
  assert.equal(urgent?.purpose,'approval-reminder-6h');
  keys.add(urgent!.key);
  assert.equal(planJuryApprovalNotice(draft,{now:'2026-11-11T21:00:00Z',alreadyOpen:false,recordedKeys:keys,reminderHours:[24,6]}),null);
  assert.equal(planJuryApprovalNotice(draft,{now:'2026-11-12T01:00:00Z',alreadyOpen:false,recordedKeys:keys,reminderHours:[24,6]}),null);
});
