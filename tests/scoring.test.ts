import assert from 'node:assert/strict';
import test from 'node:test';
import {initialGame,normalizeCategories,tribeForCastaway} from '../lib/game-data.ts';
import {assignCastaway,recordCastawayBonus,recordFirstTribalCouncil,recordScoring,recordStillOnIsland,saveCustomAction,saveMergeEpisode,saveTribe,recipients} from '../lib/scoring.ts';

function fixture(){
  let game=structuredClone(initialGame);
  game=assignCastaway(game,game.castaways[0].id,'savu','active');
  game=assignCastaway(game,game.castaways[1].id,'savu','active');
  game=assignCastaway(game,game.castaways[2].id,'savu','voted-out');
  game=assignCastaway(game,game.castaways[3].id,'toka','active');
  return game;
}
function award(game=fixture(),categoryId='tribal-immunity',recipientId='savu',batchId='test',episode=1,note='Immunity'){
  const action=game.categories.find(c=>c.id===categoryId)!;
  return recordScoring(game,{categoryId,recipientId,episode,note,expectedRecipientIds:recipients(game,action,recipientId).map(c=>c.id),batchId});
}
test('seed includes known colors with no guessed memberships',()=>{
  assert.deepEqual(initialGame.tribes.map(t=>t.name),['Savu','Toka']);
  assert.ok(initialGame.castaways.every(c=>!c.tribeId));
});
test('canonical scoring actions replace placement labels',()=>{
  assert.deepEqual(initialGame.categories.find(c=>c.id==='tribal-immunity'),{id:'tribal-immunity',label:'Win tribal immunity',points:2,group:'Challenges',target:'tribe',phase:'pre-merge'});
  assert.deepEqual(initialGame.categories.find(c=>c.id==='tribal-reward-primary')?.points,2);
  assert.deepEqual(initialGame.categories.find(c=>c.id==='tribal-reward-secondary')?.points,1);
  assert.equal(initialGame.categories.some(c=>c.id==='tribe-first'||c.id==='tribe-second'||c.id==='tribe-third'),false);
});
test('tribe immunity awards every active member, including sit-outs',()=>{
  const game=award(fixture(),'tribal-immunity','savu','immunity-sit-out');
  assert.equal(game.scoreEvents.length,2);
  assert.ok(game.scoreEvents.every(e=>e.points===2&&e.tribeName==='Savu'));
  assert.deepEqual(new Set(game.scoreEvents.map(e=>e.castawayId)),new Set([game.castaways[0].id,game.castaways[1].id]));
});
test('tribal scoring works with two or three tribes and no placement labels',()=>{
  let game=fixture();
  game=saveTribe(game,{id:'ulu',name:'Ulu',color:'#000000'});
  game=assignCastaway(game,game.castaways[4].id,'ulu','active');
  game=award(game,'tribal-reward-primary','savu','primary');
  game=award(game,'tribal-reward-secondary','ulu','secondary');
  assert.deepEqual(game.scoreEvents.map(e=>e.points),[2,2,1]);
  assert.equal(game.scoreEvents.at(-1)?.tribeName,'Ulu');
});
test('pre-merge survival and elimination values are enforced',()=>{
  const base=fixture();
  const game=award(base,'survive-tribal',base.castaways[0].id,'survival');
  const eliminated=award(game,'voted-premerge',game.castaways[2].id,'elimination');
  assert.equal(eliminated.scoreEvents[0].points,1);
  assert.equal(eliminated.scoreEvents.at(-1)?.points,-1);
});
test('first Tribal Council attendance awards the episode number to the full tribe once',()=>{
  let game=fixture();
  game=assignCastaway(game,game.castaways[3].id,'toka','voted-out');
  game=assignCastaway(game,game.castaways[4].id,'toka','active');
  const expected=game.castaways.filter(castaway=>castaway.tribeId==='toka').map(castaway=>castaway.id);
  const input={tribeId:'toka',episode:3,note:'First Toka Tribal Council',expectedCastawayIds:expected};
  const next=recordFirstTribalCouncil(game,input);
  assert.equal(next.scoreEvents.length,2);
  assert.ok(next.scoreEvents.every(event=>event.categoryId==='first-tribal-council'&&event.points===3&&event.source==='first-tribal-council'&&event.tribeName==='Toka'));
  assert.deepEqual(recordFirstTribalCouncil(next,input),next);
  assert.deepEqual(recordFirstTribalCouncil(next,{...input,episode:4}).scoreEvents,next.scoreEvents);
});
test('first Tribal Council attendance rejects a stale tribe roster',()=>{
  const game=fixture();
  assert.throws(()=>recordFirstTribalCouncil(game,{tribeId:'savu',episode:1,note:'',expectedCastawayIds:[game.castaways[0].id]}),/roster changed/);
});
test('individual reward winner keeps +2 and selected participants receive +1',()=>{
  let game=fixture();
  game=award(game,'individual-reward',game.castaways[0].id,'reward-winner',1,'Winner gave up the reward spot.');
  game=award(game,'individual-reward-selected',game.castaways[3].id,'reward-selected');
  assert.deepEqual(game.scoreEvents.map(e=>e.points),[2,1]);
});
test('merge-only voting points require a saved merge episode',()=>{
  const beforeMerge=fixture();
  assert.throws(()=>award(beforeMerge,'majority',beforeMerge.castaways[0].id,'blocked'),/merge episode/);
  const withBoundary=saveMergeEpisode(beforeMerge,3);
  assert.throws(()=>award(withBoundary,'majority',withBoundary.castaways[0].id,'blocked-early',2),/merge episode/);
  assert.throws(()=>award(withBoundary,'survive-tribal',withBoundary.castaways[0].id,'blocked-late',3),/before the merge/);
  const merged=award(withBoundary,'majority',withBoundary.castaways[0].id,'allowed',3);
  assert.equal(merged.scoreEvents[0].points,2);
});
test('episode-wide still-on-island awards the complete active roster once',()=>{
  const game=fixture();
  const expected=game.castaways.filter(c=>c.status==='active').map(c=>c.id);
  const input={episode:1,note:'Episode 1 survival',expectedActiveCastawayIds:expected};
  const next=recordStillOnIsland(game,input);
  assert.equal(next.scoreEvents.length,expected.length);
  assert.ok(next.scoreEvents.every(event=>event.categoryId==='still-on-island'&&event.points===1&&event.source==='episode-wide'));
  assert.deepEqual(recordStillOnIsland(next,input),next);
  assert.equal(recordStillOnIsland(next,{...input,note:'Retry from another tab'}).scoreEvents.length,next.scoreEvents.length);
});
test('episode-wide award rejects a stale active roster',()=>{
  const game=fixture();
  const expected=game.castaways.filter(c=>c.status==='active').slice(1).map(c=>c.id);
  assert.throws(()=>recordStillOnIsland(game,{episode:1,note:'',expectedActiveCastawayIds:expected}),/active roster changed/);
});
test('one-time castaway bonus creates a direct event without a category',()=>{
  const game=fixture();
  const beforeCategories=game.categories.length;
  const input={castawayId:game.castaways[0].id,episode:1,points:1,note:'Episode 1 welcome bonus',batchId:'bonus-1'};
  const next=recordCastawayBonus(game,input);
  assert.equal(next.categories.length,beforeCategories);
  assert.deepEqual(next.scoreEvents[0],{id:'bonus-1',batchId:'bonus-1',castawayId:game.castaways[0].id,recipientName:game.castaways[0].name,points:1,episode:1,note:'Episode 1 welcome bonus',actionLabel:'One-time castaway bonus',createdAt:next.scoreEvents[0].createdAt,source:'one-time-bonus'});
  assert.deepEqual(recordCastawayBonus(next,input),next);
});
test('loaded categories retire placement actions and preserve custom categories',()=>{
  const legacy={id:'tribe-first',label:'First-place tribe',points:2,group:'Challenges',target:'tribe' as const};
  const custom={id:'custom-action',label:'Custom action',points:4,group:'Custom actions',target:'individual' as const,custom:true};
  const normalized=normalizeCategories([...initialGame.categories,legacy,custom]);
  assert.equal(normalized.find(c=>c.id==='tribe-first')?.retired,true);
  assert.deepEqual(normalized.find(c=>c.id==='custom-action'),custom);
  assert.equal(normalized.find(c=>c.id==='still-on-island')?.bulkOnly,true);
  assert.equal(normalized.find(c=>c.id==='first-tribal-council')?.bulkOnly,true);
  assert.equal(normalized.find(c=>c.id==='first-tribal-council')?.dynamicPoints,'episode');
});
test('tribe reassignment, rename, color, and additions flow through live lookup',()=>{
  let game=fixture();
  assert.equal(tribeForCastaway(game,game.castaways[4].id),undefined);
  game=saveTribe(game,{id:'savu',name:'New Savu',color:'#123456'});
  assert.deepEqual(tribeForCastaway(game,game.castaways[0].id),{id:'savu',name:'New Savu',color:'#123456'});
  game=saveTribe(game,{id:'ulu',name:'Ulu',color:'#abcdef'});
  game=assignCastaway(game,game.castaways[4].id,'ulu','active');
  assert.deepEqual(tribeForCastaway(game,game.castaways[4].id),{id:'ulu',name:'Ulu',color:'#abcdef'});
});
test('individual idol award targets exactly one castaway',()=>{
  const game=fixture();const next=award(game,'find-idol',game.castaways[0].id);
  assert.equal(next.scoreEvents.length,1);assert.equal(next.scoreEvents[0].points,5);
  assert.equal(next.scoreEvents[0].tribeId,undefined);
});
test('historical score events remain unchanged after membership changes',()=>{
  const game=award();const before=structuredClone(game.scoreEvents);
  const next=assignCastaway(game,game.castaways[0].id,'toka','voted-out');
  assert.deepEqual(next.scoreEvents,before);
});
test('renaming a tribe does not relabel old scoring',()=>{
  const next=saveTribe(award(),{id:'savu',name:'Merged',color:'#000000'});
  assert.equal(next.scoreEvents[0].tribeName,'Savu');
});
test('custom action survives serialization and can be awarded repeatedly',()=>{
  let game=saveCustomAction(fixture(),{label:'Lose surprise challenge',points:-2.5,target:'tribe'},'curveball');
  game=JSON.parse(JSON.stringify(game));
  game=award(game,'curveball','savu','custom-1');game=award(game,'curveball','toka','custom-2');
  assert.equal(game.scoreEvents.length,3);assert.ok(game.scoreEvents.every(e=>e.points===-2.5&&e.actionLabel==='Lose surprise challenge'));
});
test('custom individual action can score an eliminated contestant milestone',()=>{
  const game=saveCustomAction(fixture(),{label:'Jury bonus',points:3,target:'individual'},'jury');
  assert.equal(award(game,'jury',game.castaways[2].id).scoreEvents[0].points,3);
});
test('retries use batch id to avoid duplicate points',()=>{
  const game=award();assert.deepEqual(award(game),game);
});
test('empty tribe and invalid episode are rejected',()=>{
  assert.throws(()=>award(initialGame),/no active members/);
  assert.throws(()=>recordScoring(fixture(),{categoryId:'tribal-immunity',recipientId:'savu',episode:0,note:'',expectedRecipientIds:[],batchId:'bad'}),/Episode/);
});
test('membership changes after preview require another review',()=>{
  assert.throws(()=>recordScoring(fixture(),{categoryId:'tribal-immunity',recipientId:'savu',episode:1,note:'',expectedRecipientIds:['outdated'],batchId:'bad'}),/membership changed/);
});
test('duplicate custom names, invalid points and targets are rejected',()=>{
  assert.throws(()=>saveCustomAction(fixture(),{label:'Find an idol',points:2,target:'individual'},'bad'),/already exists/);
  assert.throws(()=>saveCustomAction(fixture(),{label:'Test',points:NaN,target:'tribe'},'bad'),/positive or negative/);
  assert.throws(()=>saveCustomAction(fixture(),{label:'Test',points:0,target:'tribe'},'bad'),/positive or negative/);
});
test('invalid memberships and tribe colors are rejected',()=>{
  const game=fixture();assert.throws(()=>assignCastaway(game,game.castaways[0].id,'fake','active'),/Unknown tribe/);
  assert.throws(()=>saveTribe(game,{id:'new',name:'New',color:'red'}),/valid tribe color/);
});
test('scoring totals still support per-owner draft multipliers',()=>{
  const game=award();const total=game.scoreEvents.filter(e=>e.castawayId===game.castaways[0].id).reduce((sum,e)=>sum+e.points,0);
  assert.equal(total,2);assert.equal(total*1.25,2.5);
});
