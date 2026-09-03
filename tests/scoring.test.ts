import assert from 'node:assert/strict';
import test from 'node:test';
import {initialGame} from '../lib/game-data.ts';
import {assignCastaway,recordScoring,saveCustomAction,saveTribe,recipients} from '../lib/scoring.ts';

function fixture(){
  let game=structuredClone(initialGame);
  game=assignCastaway(game,game.castaways[0].id,'savu','active');
  game=assignCastaway(game,game.castaways[1].id,'savu','active');
  game=assignCastaway(game,game.castaways[2].id,'savu','voted-out');
  game=assignCastaway(game,game.castaways[3].id,'toka','active');
  return game;
}
function award(game=fixture(),categoryId='tribe-first',recipientId='savu',batchId='test'){
  const action=game.categories.find(c=>c.id===categoryId)!;
  return recordScoring(game,{categoryId,recipientId,episode:1,note:'Immunity',expectedRecipientIds:recipients(game,action,recipientId).map(c=>c.id),batchId});
}
test('seed includes known colors with no guessed memberships',()=>{
  assert.deepEqual(initialGame.tribes.map(t=>t.name),['Savu','Toka']);
  assert.ok(initialGame.castaways.every(c=>!c.tribeId));
});
test('tribe award includes active members only, once each',()=>{
  const game=award();assert.equal(game.scoreEvents.length,2);
  assert.ok(game.scoreEvents.every(e=>e.points===2&&e.tribeName==='Savu'));
  assert.equal(new Set(game.scoreEvents.map(e=>e.castawayId)).size,2);
});
test('second-place award does not touch the first-place tribe',()=>{
  const game=award(award(),'tribe-second','toka','second');
  assert.deepEqual(game.scoreEvents.map(e=>e.points),[2,2,1]);
});
test('individual idol award targets exactly one castaway',()=>{
  const game=fixture();const next=award(game,'find-idol',game.castaways[0].id);
  assert.equal(next.scoreEvents.length,1);assert.equal(next.scoreEvents[0].points,5);
  assert.equal(next.scoreEvents[0].tribeId,undefined);
});
test('later swaps and eliminations do not rewrite historical recipients or points',()=>{
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
  assert.throws(()=>recordScoring(fixture(),{categoryId:'tribe-first',recipientId:'savu',episode:0,note:'',expectedRecipientIds:[],batchId:'bad'}),/Episode/);
});
test('membership changes after preview require another review',()=>{
  assert.throws(()=>recordScoring(fixture(),{categoryId:'tribe-first',recipientId:'savu',episode:1,note:'',expectedRecipientIds:['outdated'],batchId:'bad'}),/membership changed/);
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
