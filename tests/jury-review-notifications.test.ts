import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {planJuryApprovalNotice,prepareJuryDraft,type JuryPreparationSource} from '../lib/jury-preparation.ts';
import {describeJuryDraft,makeJuryReviewSubmission,reviewCanBeSubmitted,reviewDeadline} from '../lib/jury-review.ts';
import {renderJuryApprovalNotice} from '../lib/jury-notifications.ts';

const source:JuryPreparationSource={
  season:51,episode:9,currentEpisode:8,gameRevision:101,now:'2026-11-12T10:00:00Z',
  activation:{enabled:true,fromEpisode:7},
  broadcast:{airtime:'2026-11-18T20:00:00-05:00',source:'Verified broadcast calendar'},
  tribes:[{id:'merge',name:'Merge tribe'}],
  castaways:[{id:'c1',name:'Castaway One',tribeId:'merge'}],
  merge:{occurred:true,episode:7,verified:true},
  players:[{id:'private-player-id',active:true,eligibleFrom:8,issues:[]},{id:'not-yet-jury',active:true,eligibleFrom:null,issues:[]}],
};
const asOf='2026-11-12T10:00:00Z';
const opts={leagueName:'Survivor League',reviewUrl:'https://league.example/admin#jury-mode',allowedOrigin:'https://league.example'};

test('review summary is useful and avoids exposing private player identities',()=>{
  const summary=describeJuryDraft(prepareJuryDraft(source));
  assert.equal(summary.status,'READY_FOR_REVIEW');
  assert.equal(summary.eligiblePlayers,1);
  assert.equal(summary.castaways,1);
  assert.equal(summary.tribes,1);
  assert.equal(summary.formatLabel,'After merge');
  assert.match(summary.deadline,/Nov 18/);
  assert.match(summary.deadline,/EST/);
  assert(!JSON.stringify(summary).includes('private-player-id'));
  assert.equal(reviewDeadline(null),'Unverified');
});

test('one explicit acknowledgement prepares a request, never client authorization',()=>{
  const draft=prepareJuryDraft(source);
  assert.equal(makeJuryReviewSubmission(draft,{asOf,acknowledged:false,note:''}),null);
  const result=makeJuryReviewSubmission(draft,{asOf,acknowledged:true,note:''});
  assert(result);
  assert.equal(result.expectedDraftId,draft.id);
  assert.equal(result.season,51);
  assert.equal(result.episode,9);
  assert.equal(result.expectedGameRevision,101);
  assert.deepEqual([result.confirmedBroadcast,result.confirmedRoster,result.confirmedMerge],[true,true,true]);
  assert.match(result.reason,/reviewed the proposed Episode 9/);
  assert(!('actorAuthorized' in result));
  assert(!('openedAt' in result));
});

test('review notes are optional but recorded in a meaningful audit reason',()=>{
  const draft=prepareJuryDraft(source);
  const result=makeJuryReviewSubmission(draft,{asOf,acknowledged:true,note:'  Schedule double-checked with the league.  '});
  assert.match(result?.reason??'',/Note: Schedule double-checked with the league\./);
  assert(!result?.reason.endsWith('  '));
});

test('blocked and expired proposals cannot become actionable in the review interface',()=>{
  const draft=prepareJuryDraft(source),blocked=prepareJuryDraft({...source,broadcast:null});
  assert.equal(reviewCanBeSubmitted(blocked,asOf,true),false);
  assert.equal(makeJuryReviewSubmission(blocked,{asOf,acknowledged:true,note:''}),null);
  assert.equal(reviewCanBeSubmitted(draft,'2026-11-19T01:00:00Z',true),false);
  assert.equal(reviewCanBeSubmitted(draft,'invalid',true),false);
  assert.equal(reviewCanBeSubmitted(draft,asOf,false),false);
});

test('one logical notice produces independently deduplicable in-app and email payloads',()=>{
  const draft=prepareJuryDraft(source);
  const intent=planJuryApprovalNotice(draft,{now:asOf,alreadyOpen:false,recordedKeys:new Set()});
  assert(intent);
  const rendered=renderJuryApprovalNotice(draft,intent,opts);
  assert.equal(rendered.inApp.deliveryKey,intent.key+':in-app');
  assert.equal(rendered.email.deliveryKey,intent.key+':email');
  assert.equal(rendered.inApp.actionUrl,opts.reviewUrl);
  assert.match(rendered.email.subject,/Episode 9 Jury Mode/);
  assert.match(rendered.email.text,/Game Master confirms/);
  assert.match(rendered.email.html,/Nov 18/);
  for(const content of [JSON.stringify(rendered.inApp),JSON.stringify(rendered.email)]){
    assert(!content.includes('private-player-id'));
    assert(!content.includes('Castaway One'));
  }
});

test('reminder message changes urgency but preserves the authenticated review destination',()=>{
  const draft=prepareJuryDraft(source);
  const ready=`jury:51:9:${draft.id}:approval-ready`;
  const reminder=planJuryApprovalNotice(draft,{
    now:'2026-11-18T22:00:00Z',alreadyOpen:false,
    recordedKeys:new Set([ready]),reminderHours:[6],
  });
  assert(reminder);
  assert.equal(reminder.purpose,'approval-reminder-6h');
  const result=renderJuryApprovalNotice(draft,reminder,opts);
  assert.match(result.inApp.title,/time-sensitive/);
  assert.equal(result.inApp.actionUrl,opts.reviewUrl);
});

test('notice rendering rejects stale proposals and untrusted or token-bearing URLs',()=>{
  const draft=prepareJuryDraft(source);
  const intent=planJuryApprovalNotice(draft,{now:asOf,alreadyOpen:false,recordedKeys:new Set()});
  assert(intent);
  assert.throws(()=>renderJuryApprovalNotice(draft,{...intent,draftId:'old'},opts),/current, ready/);
  assert.throws(()=>renderJuryApprovalNotice(draft,{...intent,purpose:'not-real' as typeof intent.purpose},opts),/Unknown Jury Mode/);
  assert.throws(()=>renderJuryApprovalNotice(prepareJuryDraft({...source,broadcast:null}),intent,opts),/current, ready/);
  for(const url of [
    'http://league.example/admin#jury-mode','https://phishing.example/admin#jury-mode',
    'https://league.example/admin?token=secret#jury-mode','https://league.example/admin#scoring',
    'https://user:pass@league.example/admin#jury-mode',
  ])assert.throws(()=>renderJuryApprovalNotice(draft,intent,{...opts,reviewUrl:url}),/trusted Game Master/);
});

test('HTML-escapes league labels and never puts them into an HTML attribute',()=>{
  const draft=prepareJuryDraft(source);
  const intent=planJuryApprovalNotice(draft,{now:asOf,alreadyOpen:false,recordedKeys:new Set()});
  assert(intent);
  const result=renderJuryApprovalNotice(draft,intent,{...opts,leagueName:'Survivor <Test> & "Friends"'});
  assert.match(result.email.html,/Survivor &lt;Test&gt; &amp; &quot;Friends&quot;/);
  assert(!result.email.html.includes('<Test>'));
  assert.throws(()=>renderJuryApprovalNotice(draft,intent,{...opts,leagueName:'  '}),/league name/);
  assert.throws(()=>renderJuryApprovalNotice(draft,intent,{...opts,leagueName:'League\r\nBcc:someone'}),/league name/);
});

test('isolated UI requires an adapter and is not mounted or granted authority by the client',async()=>{
  const [component,workspace]=await Promise.all([
    readFile('app/admin/jury-review-panel.tsx','utf8'),
    readFile('app/admin/jury-workspace.tsx','utf8'),
  ]);
  assert.match(component,/onConfirm\?\:/);
  assert.match(component,/Isolated interface preview/);
  assert.match(component,/server-side Game Master authorization/);
  assert.match(component,/disabled=\{!canSubmit\}/);
  assert.doesNotMatch(component,/actorAuthorized|juryRequest|fetch\(/);
  assert.doesNotMatch(workspace,/<JuryReviewPanel/);
});
