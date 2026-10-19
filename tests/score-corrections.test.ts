import assert from 'node:assert/strict';
import test from 'node:test';
import {assertScoringCommissioner} from '../lib/scoring-authority.ts';
import {readFileSync} from 'node:fs';
import {planScoreCorrection,parseScoreCorrection} from '../lib/score-corrections.ts';
import {castawayScoreTotals,scoringActions,effectiveScorePoints,scoringVersion} from '../lib/score-ledger.ts';
import {seasonStandings,lockSeason} from '../lib/league.ts';
import {castawayLeaderboard} from '../lib/castaway-leaderboard.ts';
import {episodeActions} from '../lib/community.ts';
import {recordScoring,updateEliminationReason} from '../lib/scoring.ts';
import {awardedIds,commissioner,correctionCommand,correctionFixture} from './helpers/scoring-fixture.ts';

const now='2026-10-15T03:00:00.000Z';
test('removing Ori reverses exactly his +2; preserves six awards, tribe, unrelated ledger and game fields',async()=>{
  const game=correctionFixture(),original=structuredClone(game),result=await planScoreCorrection(game,commissioner,await correctionCommand(game),now),next=result.game;
  assert.deepEqual(game,original);
  assert.deepEqual(next.castaways,game.castaways);
  assert.deepEqual({...next,scoreEvents:game.scoreEvents,scoringRevision:undefined},{...game,scoringRevision:undefined});
  assert.equal(next.scoreEvents.length,game.scoreEvents.length);
  assert.equal(next.scoreEvents.find(e=>e.castawayId==='cast-ori'&&e.episode===4)!.scoringStatus,'reversed');
  assert.equal(next.scoreEvents.find(e=>e.id==='unrelated'),game.scoreEvents.find(e=>e.id==='unrelated'));
  assert.equal(castawayScoreTotals(next)['cast-ori'],11);
  for(const id of awardedIds.filter(id=>id!=='cast-ori')){
    const award=next.scoreEvents.find(e=>e.castawayId===id)!;
    assert.equal(award.points,2);assert.equal(effectiveScorePoints(award),2);
    assert.deepEqual(award.recipientIds,awardedIds.filter(id=>id!=='cast-ori'));
  }
  assert.deepEqual(result.preview.correction.before,game.scoreEvents.slice(0,7));
  assert.equal(result.preview.correction.castaways.length,1);
  assert.deepEqual(result.preview.correction.standings.map(row=>row.delta).sort(),[-2.5,-2,-2].sort());
  assert.equal(episodeActions(next,4)[0].recipients.length,6);
  assert.equal(scoringActions(next,4)[0].active.length,6);
  assert.equal(castawayLeaderboard(next).active.find(row=>row.castawayId==='cast-ori')!.total,11);
  assert.equal(castawayLeaderboard(next).active.find(row=>row.castawayId==='cast-ori')!.byEpisode[4],0);
});
test('recipient addition adds only the selected castaway, even if eliminated today',async()=>{
  const game=correctionFixture();game.castaways.find(c=>c.id==='cast-aaliyah')!.status='voted-out';
  const {game:next}=await planScoreCorrection(game,commissioner,await correctionCommand(game,{recipientIds:[...awardedIds,'cast-aaliyah']}),now);
  assert.equal(castawayScoreTotals(next)['cast-aaliyah'],2);assert.equal(castawayScoreTotals(next)['cast-ori'],13);
  assert.equal(next.scoreEvents.length,game.scoreEvents.length+1);assert.equal(scoringActions(next,4).length,1);
});
test('re-adding a removed recipient reuses the original tombstone',async()=>{
  const first=await planScoreCorrection(correctionFixture(),commissioner,await correctionCommand(correctionFixture()),now);
  const second=await planScoreCorrection(first.game,commissioner,await correctionCommand(first.game,{id:'re-add',recipientIds:awardedIds}),now);
  assert.equal(second.game.scoreEvents.length,first.game.scoreEvents.length);
  assert.equal(castawayScoreTotals(second.game)['cast-ori'],13);
  assert.equal(second.game.scoreEvents.filter(e=>e.castawayId==='cast-ori'&&e.episode===4).length,1);
});
test('point correction changes this action only and preserves the original award in the audit',async()=>{
  const game=correctionFixture(),result=await planScoreCorrection(game,commissioner,await correctionCommand(game,{recipientIds:awardedIds,points:3}),now);
  assert(result.game.scoreEvents.slice(0,7).every(e=>e.points===3));
  assert(result.preview.correction.before.every(e=>e.points===2));
  assert.equal(result.game.scoreEvents.at(-1)!.points,11);
  assert.equal(result.preview.correction.standings.find(row=>row.id===game.players[2].id)!.delta,1.25);
});
test('complete undo preserves seven tombstones without negative gameplay events; repeated undo is rejected',async()=>{
  const game=correctionFixture(),command=await correctionCommand(game,{kind:'undo'}),result=await planScoreCorrection(game,commissioner,command,now);
  assert.equal(result.game.scoreEvents.length,8);
  assert(result.game.scoreEvents.slice(0,7).every(e=>e.scoringStatus==='reversed'&&e.points===2&&effectiveScorePoints(e)===0));
  assert.equal(episodeActions(result.game,4).length,0);
  assert.equal(scoringActions(result.game,4)[0].active.length,0);
  await assert.rejects(planScoreCorrection(result.game,commissioner,await correctionCommand(result.game,{id:'repeat',kind:'undo'}),now),/already been reversed/);
});
test('individual point corrections leave other scores intact and action undo handles mixed point amounts',async()=>{
  const game=correctionFixture(),result=await planScoreCorrection(game,commissioner,await correctionCommand(game,{scope:'entry',eventId:'test-immunity:cast-ori',recipientIds:['cast-ori'],points:4}),now);
  assert.equal(result.game.scoreEvents.find(e=>e.id==='test-immunity:cast-ori')!.points,4);
  assert(result.game.scoreEvents.slice(0,6).every(e=>e.points===2));
  assert.equal(scoringActions(result.game,4).length,1);
  const undone=await planScoreCorrection(result.game,commissioner,await correctionCommand(result.game,{id:'undo-mixed',kind:'undo'}),now);
  assert.equal(castawayScoreTotals(undone.game)['cast-ori'],11);
  assert.equal(scoringActions(undone.game,4)[0].active.length,0);
});
test('individual recipient correction preserves the old entry, and rejects duplicate active recipients',async()=>{
  const game=correctionFixture();
  await assert.rejects(planScoreCorrection(game,commissioner,await correctionCommand(game,{scope:'entry',eventId:'test-immunity:cast-ori',recipientIds:['cast-brady']}),now),/already has an award/);
  const result=await planScoreCorrection(game,commissioner,await correctionCommand(game,{scope:'entry',eventId:'test-immunity:cast-ori',recipientIds:['cast-aaliyah']}),now);
  assert.equal(effectiveScorePoints(result.game.scoreEvents.find(e=>e.id==='test-immunity:cast-ori')!),0);
  assert.equal(castawayScoreTotals(result.game)['cast-aaliyah'],2);
  assert.equal(scoringActions(result.game,4)[0].active.length,7);
});
test('individual reversal does not undo the rest of a group',async()=>{
  const game=correctionFixture(),result=await planScoreCorrection(game,commissioner,await correctionCommand(game,{scope:'entry',kind:'undo',eventId:'test-immunity:cast-ori'}),now);
  assert.equal(scoringActions(result.game,4)[0].active.length,6);
  assert.equal(result.preview.correction.castaways.length,1);
});
test('direct player scoring supports edit, reassignment, undo and final standings without a draft multiplier',async()=>{
  const game=correctionFixture();game.scoreEvents.push({id:'player-bonus',playerId:game.players[0].id,points:5,createdAt:now});
  const changed=await planScoreCorrection(game,commissioner,await correctionCommand(game,{scope:'entry',eventId:'player-bonus',recipientIds:[game.players[1].id],points:7}),now);
  assert.equal(changed.preview.correction.standings.find(row=>row.id===game.players[0].id)!.delta,-5);
  assert.equal(changed.preview.correction.standings.find(row=>row.id===game.players[1].id)!.delta,7);
  const undone=await planScoreCorrection(changed.game,commissioner,await correctionCommand(changed.game,{id:'undo-player',eventId:'player-bonus',kind:'undo'}),now);
  assert.equal(seasonStandings(undone.game).find(row=>row.profileId===game.players[1].id)!.score,13);
  undone.game.draft.status='complete';
  const ordered=seasonStandings(undone.game).map(row=>row.profileId);
  assert.deepEqual(lockSeason(undone.game,ordered,now).history!.at(-1)!.results,seasonStandings(undone.game));
});
test('all fantasy picks apply their own multipliers, including repeated picks of the same castaway',async()=>{
  const game=correctionFixture();game.draftPicks.push({...game.draftPicks[2],id:'repeat-pick',playerId:game.players[0].id});
  const result=await planScoreCorrection(game,commissioner,await correctionCommand(game),now);
  assert.equal(result.preview.correction.standings.find(row=>row.id===game.players[0].id)!.delta,-4.5);
});
test('compound tribal batches are separated by action and never undo neighboring categories',async()=>{
  const game=correctionFixture();game.scoreEvents.push({...game.scoreEvents[0],id:'neighbor',categoryId:'tribal-reward-primary',actionLabel:'Primary tribal reward'});
  const result=await planScoreCorrection(game,commissioner,await correctionCommand(game,{kind:'undo'}),now);
  assert.deepEqual(result.game.scoreEvents.find(e=>e.id==='neighbor'),game.scoreEvents.find(e=>e.id==='neighbor'));
  assert.equal(scoringActions(result.game,4).length,2);
});
test('legacy entries without batch IDs remain individually addressable',async()=>{
  const game=correctionFixture(),result=await planScoreCorrection(game,commissioner,await correctionCommand(game,{eventId:'unrelated',recipientIds:['cast-ori'],points:10}),now);
  assert.equal(result.game.scoreEvents.at(-1)!.points,10);assert.deepEqual(result.game.scoreEvents.slice(0,7),game.scoreEvents.slice(0,7));
});
test('same-named possession outcomes at one council remain independent scoring actions',async()=>{
  const game=correctionFixture();
  const item={batchId:'council',episode:4,castawayId:'cast-ori',recipientName:'Ori Jean-Charles',source:'tribal-council' as const,categoryId:'idol-pocket',actionLabel:'Eliminated holding Immunity Idol',points:-10,createdAt:now};
  game.scoreEvents.push({...item,id:'council:pocket:item-1'},{...item,id:'council:pocket:item-2'});
  const result=await planScoreCorrection(game,commissioner,await correctionCommand(game,{eventId:'council:pocket:item-1',kind:'undo'}),now);
  assert.equal(result.preview.correction.before.length,1);
  assert.equal(effectiveScorePoints(result.game.scoreEvents.find(e=>e.id==='council:pocket:item-2')!),-10);
  assert.equal(result.preview.correction.castaways[0].delta,10);
});
test('individual reversal can repair a duplicate recipient without erasing its legitimate award',async()=>{
  const game=correctionFixture();game.scoreEvents.push({...game.scoreEvents[0],id:'duplicate'});
  await assert.rejects(planScoreCorrection(game,commissioner,await correctionCommand(game),now),/duplicate recipients/);
  const result=await planScoreCorrection(game,commissioner,await correctionCommand(game,{eventId:'duplicate',kind:'undo',scope:'entry'}),now);
  assert.equal(effectiveScorePoints(result.game.scoreEvents[0]),2);
  assert.equal(effectiveScorePoints(result.game.scoreEvents.at(-1)!),0);
  const edited=await planScoreCorrection(result.game,commissioner,await correctionCommand(result.game,{id:'edit-after-repair',recipientIds:awardedIds,points:3}),now);
  assert.equal(edited.game.scoreEvents.filter(e=>e.castawayId===awardedIds[0]&&e.scoringStatus!=='reversed').length,1);
  assert.equal(effectiveScorePoints(edited.game.scoreEvents.at(-1)!),0);
});
test('ordinary award retries cannot recreate reversed scoring',async()=>{
  const game=correctionFixture(),result=await planScoreCorrection(game,commissioner,await correctionCommand(game,{kind:'undo'}),now);
  assert.deepEqual(recordScoring(result.game,{categoryId:'tribal-immunity',batchId:'test-immunity',recipientId:'toka',episode:4,note:'',expectedRecipientIds:awardedIds}),result.game);
});
test('authorization rejects non-commissioners, unverified owners, empty UIDs and spoofed roles',async()=>{
  const game=correctionFixture(),command=await correctionCommand(game);
  for(const actor of [{...commissioner,email:'player@example.com'},{...commissioner,verified:false},{...commissioner,uid:''}]){
    assert.throws(()=>assertScoringCommissioner(actor),/Only the game master/);
    await assert.rejects(planScoreCorrection(game,{...actor,commissioner:false},command,now),/Only the game master/);
  }
  assert.doesNotThrow(()=>assertScoringCommissioner({...commissioner,email:'DONOHUE.JS@GMAIL.COM'}));
});
test('stale review rejects other scoring, draft multiplier, season, and roster changes',async()=>{
  const game=correctionFixture(),command=await correctionCommand(game);
  for(const mutate of [(g:typeof game)=>g.scoreEvents[7].points++,(g:typeof game)=>g.draftPicks[0].multiplier=1.25,(g:typeof game)=>g.players[0].entryBonus++,(g:typeof game)=>g.players[0].active=false]){
    const next=structuredClone(game);mutate(next);await assert.rejects(planScoreCorrection(next,commissioner,command,now),/changed during your review/);
  }
  await assert.rejects(planScoreCorrection({...game,season:{...game.season,number:52}},commissioner,command,now),/season changed/);
  await assert.rejects(planScoreCorrection({...game,season:{...game.season,finalized:true}},commissioner,command,now),/locked/);
});
test('version hash ignores Firestore object-key ordering and unrelated tribe changes',async()=>{
  const game=correctionFixture(),copy=JSON.parse(JSON.stringify(game,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).reverse()):value));
  copy.castaways.find((c:{id:string})=>c.id==='cast-ori').tribeId='toka';
  assert.equal(await scoringVersion(copy),await scoringVersion(game));
});
test('input validation rejects non-finite points, duplicate recipients, empty selections, missing recipients and no-op edits',async()=>{
  const game=correctionFixture(),command=await correctionCommand(game);
  for(const override of [{points:NaN},{points:Infinity},{points:100001},{recipientIds:['cast-ori','cast-ori']},{reason:''},{id:'../unsafe'},{kind:'delete'}])assert.throws(()=>parseScoreCorrection({...command,...override}));
  for(const override of [{recipientIds:[]},{recipientIds:['missing']},{recipientIds:awardedIds}])await assert.rejects(planScoreCorrection(game,commissioner,{...command,...override},now));
});
test('manual elimination corrections cannot be erased by elimination reason reconciliation',async()=>{
  const game=correctionFixture(),castaway=game.castaways[0];castaway.status='voted-out';castaway.eliminationEpisode=4;castaway.eliminationReason='voted-out';
  game.scoreEvents.push({id:'elimination',castawayId:castaway.id,episode:4,points:-1,source:'elimination',createdAt:now});
  const corrected=await planScoreCorrection(game,commissioner,await correctionCommand(game,{eventId:'elimination',kind:'undo'}),now);
  assert.throws(()=>updateEliminationReason(corrected.game,{castawayId:castaway.id,reason:'voluntary-quit'}),/corrected manually/);
});
test('audit paths deny browser writes; the API verifies revoked tokens and does not trust client roles',()=>{
  const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8'),route=readFileSync(new URL('../app/api/scoring/route.ts',import.meta.url),'utf8');
  assert.match(rules,/match \/\{document=\*\*\} \{ allow read, write: if false;/);
  assert.doesNotMatch(rules,/allow .*if (?!false)/);
  assert.match(route,/verifyIdToken\(header.slice\(7\),true\)/);
  assert.match(route,/assertScoringCommissioner\(actor\)/);
});
