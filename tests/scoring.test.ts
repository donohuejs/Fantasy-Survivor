import assert from 'node:assert/strict';
import test from 'node:test';
import {assertGameMaster} from '../lib/admin-auth.ts';
import {initialGame,normalizeCategories,tribeForCastaway} from '../lib/game-data.ts';
import {episodeActions} from '../lib/community.ts';
import {assignCastaway,currentEpisodeStatus,finishEpisode,recordCastawayBonus,recordFirstTribalCouncil,recordScoring,recordStillOnIsland,recordTribalCouncilResolution,recordTribalCouncilSurvival,saveCustomAction,saveMergeEpisode,startEpisode,saveTribe,recipients} from '../lib/scoring.ts';

function fixture(){
  let game=structuredClone(initialGame);
  game.season.episodeStarted=true;game.season.episodeStatus='in-progress';
  game=assignCastaway(game,game.castaways[0].id,'savu','active');
  game=assignCastaway(game,game.castaways[1].id,'savu','active');
  game=assignCastaway(game,game.castaways[2].id,'savu','voted-out');
  game=assignCastaway(game,game.castaways[3].id,'toka','active');
  return game;
}
function award(game=fixture(),categoryId='tribal-immunity',recipientId='savu',batchId='test',episode=1,note='Immunity'){
  const action=game.categories.find(c=>c.id===categoryId)!;
  return recordScoring(game,{categoryId,recipientId,episode,note,expectedRecipientIds:recipients(game,action,recipientId).map(c=>c.id),batchId,historical:episode!==game.season.currentEpisode});
}
test('seed includes known colors with no guessed memberships',()=>{
  assert.deepEqual(initialGame.tribes.map(t=>t.name),['Savu','Toka']);
  assert.ok(initialGame.castaways.every(c=>!c.tribeId));
  assert.equal(initialGame.season.currentEpisode,1);
  assert.equal(initialGame.season.episodeStarted,false);
});
test('Episode 1 starts without jumping to Episode 2 and awards active castaways once',()=>{
  const game=structuredClone(initialGame);
  game.castaways[0].status='voted-out';
  const expected=game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id);
  const input={episode:1,expectedActiveCastawayIds:expected};
  const next=startEpisode(game,input);
  assert.equal(next.season.currentEpisode,1);
  assert.equal(next.season.episodeStarted,true);
  assert.equal(next.scoreEvents.length,expected.length);
  assert.ok(next.scoreEvents.every(event=>event.categoryId==='still-on-island'&&event.points===1&&event.episode===1));
  assert.deepEqual(startEpisode(next,input),next);
});
test('starting the next episode advances exactly once and ordinary scoring does not advance it',()=>{
  const game=fixture();
  game.scoreEvents=[];
  const next=startEpisode({...game,season:{...game.season,episodeStarted:false,episodeStatus:'not-started',currentEpisode:1}},{episode:1,expectedActiveCastawayIds:game.castaways.filter(c=>c.status==='active').map(c=>c.id)});
  const episodeTwo=startEpisode(finishEpisode(next,{episode:1}),{episode:2,expectedActiveCastawayIds:next.castaways.filter(c=>c.status==='active').map(c=>c.id)});
  assert.equal(episodeTwo.season.currentEpisode,2);
  const action=episodeTwo.categories.find(category=>category.id==='find-idol')!;
  const scored=recordScoring(episodeTwo,{categoryId:action.id,recipientId:episodeTwo.castaways[0].id,episode:2,note:'',expectedRecipientIds:[episodeTwo.castaways[0].id],batchId:'episode-two-idol'});
  assert.equal(scored.season.currentEpisode,2);
  assert.equal(scored.scoreEvents.at(-1)?.episode,2);
});
test('finishing an episode is explicit and does not start the next episode',()=>{
  const game=fixture();
  assert.throws(()=>startEpisode(game,{episode:2,expectedActiveCastawayIds:game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id)}),/Finish Episode 1/);
  const finished=finishEpisode(game,{episode:1});
  assert.equal(finished.season.currentEpisode,1);
  assert.equal(finished.season.episodeStatus,'complete');
  assert.equal(finished.season.episodeStarted,false);
  assert.deepEqual(finishEpisode(finished,{episode:1}),finished);
  assert.throws(()=>recordScoring(finished,{categoryId:'find-idol',recipientId:finished.castaways[0].id,episode:1,note:'too late',expectedRecipientIds:[finished.castaways[0].id],batchId:'closed-episode'}),/Start Episode 2/);
});
test('episode lifecycle mutations keep the existing game-master authorization guard',()=>{
  assert.throws(()=>assertGameMaster(false),/Only the game master/);
  assert.doesNotThrow(()=>assertGameMaster(true));
});
test('starting a completed episode creates the next sole active episode and awards every current active castaway once',()=>{
  let game=structuredClone(initialGame);
  const firstActive=game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id);
  game=startEpisode(game,{episode:1,expectedActiveCastawayIds:firstActive});
  game=finishEpisode(game,{episode:1});
  const secondActive=game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id);
  const episodeTwo=startEpisode(game,{episode:2,expectedActiveCastawayIds:secondActive});
  assert.equal(currentEpisodeStatus(episodeTwo),'in-progress');
  assert.equal(episodeTwo.season.currentEpisode,2);
  assert.equal(episodeTwo.scoreEvents.filter(event=>event.episode===2&&event.categoryId==='still-on-island').length,secondActive.length);
  assert.equal(episodeTwo.scoreEvents.filter(event=>event.episode===2&&event.categoryId==='still-on-island').map(event=>event.castawayId).filter((id,index,ids)=>ids.indexOf(id)===index).length,secondActive.length);
  assert.equal(episodeTwo.scoreEvents.filter(event=>event.episode===1&&event.categoryId==='still-on-island').length,firstActive.length);
});
test('an elimination after Episode 1 starts preserves Episode 1 appearance but excludes that castaway from Episode 2',()=>{
  let game=structuredClone(initialGame);
  const episodeOneActive=game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id);
  const eliminatedId=episodeOneActive[0];
  game=startEpisode(game,{episode:1,expectedActiveCastawayIds:episodeOneActive});
  game=assignCastaway(game,eliminatedId,'savu','voted-out');
  game=finishEpisode(game,{episode:1});
  const episodeTwoActive=game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id);
  const next=startEpisode(game,{episode:2,expectedActiveCastawayIds:episodeTwoActive});
  assert.ok(next.scoreEvents.some(event=>event.episode===1&&event.castawayId===eliminatedId&&event.categoryId==='still-on-island'));
  assert.equal(next.scoreEvents.some(event=>event.episode===2&&event.castawayId===eliminatedId&&event.categoryId==='still-on-island'),false);
});
test('repeated Episode 2 starts are idempotent and cannot duplicate the automatic awards',()=>{
  let game=structuredClone(initialGame);
  const active=game.castaways.map(castaway=>castaway.id);
  game=startEpisode(game,{episode:1,expectedActiveCastawayIds:active});
  game=finishEpisode(game,{episode:1});
  const input={episode:2,expectedActiveCastawayIds:active};
  const started=startEpisode(game,input);
  const retried=startEpisode(started,input);
  assert.deepEqual(retried,started);
  assert.equal(retried.scoreEvents.filter(event=>event.episode===2&&event.awardKey===`${retried.season.id}:episode-start:2`).length,active.length);
  assert.equal(retried.season.currentEpisode,2);
  assert.equal(currentEpisodeStatus(retried),'in-progress');
});
test('Episode 2 scoring and activity attach to Episode 2 while Episode 1 history remains intact',()=>{
  let game=structuredClone(initialGame);
  const active=game.castaways.map(castaway=>castaway.id);
  game=startEpisode(game,{episode:1,expectedActiveCastawayIds:active});
  const episodeOneActivity=episodeActions(game,1);
  game=finishEpisode(game,{episode:1});
  game=startEpisode(game,{episode:2,expectedActiveCastawayIds:active});
  const action=game.categories.find(category=>category.id==='find-idol')!;
  const next=recordScoring(game,{categoryId:action.id,recipientId:active[0],episode:2,note:'Episode 2 idol',expectedRecipientIds:[active[0]],batchId:'episode-2-action'});
  assert.equal(next.scoreEvents.at(-1)?.episode,2);
  assert.equal(episodeActions(next,1).length,episodeOneActivity.length);
  assert.ok(episodeActions(next,2).some(activity=>activity.label==='Still on the island'));
  assert.ok(episodeActions(next,2).some(activity=>activity.label==='Find an idol'));
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
  const game=recordTribalCouncilSurvival(base,{tribeId:'savu',episode:1,note:'Savu Tribal Council',expectedActiveCastawayIds:[base.castaways[0].id,base.castaways[1].id]});
  const eliminated=award(game,'voted-premerge',game.castaways[2].id,'elimination');
  assert.equal(eliminated.scoreEvents[0].points,1);
  assert.equal(eliminated.scoreEvents[1].points,1);
  assert.equal(eliminated.scoreEvents.at(-1)?.points,-1);
});
test('pre-merge Tribal Council survival awards every active tribe member once',()=>{
  let game=fixture();
  game=assignCastaway(game,game.castaways[4].id,'toka','active');
  game=assignCastaway(game,game.castaways[5].id,'toka','active');
  const expected=game.castaways.filter(castaway=>castaway.tribeId==='toka'&&castaway.status==='active').map(castaway=>castaway.id);
  const input={tribeId:'toka',episode:1,note:'Toka survived Tribal Council',expectedActiveCastawayIds:expected};
  const next=recordTribalCouncilSurvival(game,input);
  assert.equal(next.scoreEvents.length,3);
  assert.ok(next.scoreEvents.every(event=>event.categoryId==='survive-tribal'&&event.points===1&&event.source==='tribe-wide'&&event.tribeName==='Toka'));
  assert.deepEqual(recordTribalCouncilSurvival(next,input),next);
  assert.throws(()=>recordTribalCouncilSurvival(game,{...input,expectedActiveCastawayIds:expected.slice(1)}),/active tribe roster changed/);
});
test('first Tribal Council attendance awards the episode number to the full tribe once',()=>{
  let game=fixture();
  game=assignCastaway(game,game.castaways[3].id,'toka','voted-out');
  game=assignCastaway(game,game.castaways[4].id,'toka','active');
  const expected=game.castaways.filter(castaway=>castaway.tribeId==='toka').map(castaway=>castaway.id);
  const input={tribeId:'toka',episode:3,note:'First Toka Tribal Council',expectedCastawayIds:expected,historical:true};
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
test('Tribal Council resolution awards first attendance, elimination, status, and survival together',()=>{
  const game=fixture();
  const attendees=game.castaways.filter(castaway=>castaway.tribeId==='savu'&&castaway.status==='active');
  const input={tribeId:'savu',eliminatedCastawayId:attendees[1].id,episode:1,note:'Savu Tribal Council',expectedAttendeeIds:attendees.map(castaway=>castaway.id)};
  const next=recordTribalCouncilResolution(game,input);
  assert.equal(next.castaways.find(castaway=>castaway.id===attendees[1].id)?.status,'voted-out');
  assert.deepEqual(next.scoreEvents.map(event=>event.categoryId),['first-tribal-council','first-tribal-council','voted-premerge','survive-tribal']);
  assert.equal(next.scoreEvents.find(event=>event.categoryId==='voted-premerge')?.points,-1);
  assert.equal(next.scoreEvents.filter(event=>event.categoryId==='survive-tribal').length,1);
  assert.deepEqual(recordTribalCouncilResolution(next,input),next);
});
test('Tribal Council first attendance is castaway-specific across tribe swaps',()=>{
  let game=fixture();
  const firstAttendees=game.castaways.filter(castaway=>castaway.tribeId==='savu');
  game=recordFirstTribalCouncil(game,{tribeId:'savu',episode:1,note:'First Savu council',expectedCastawayIds:firstAttendees.map(castaway=>castaway.id)});
  game=assignCastaway(game,firstAttendees[1].id,'toka','active');
  game=assignCastaway(game,game.castaways[3].id,'savu','active');
  const attendees=game.castaways.filter(castaway=>castaway.tribeId==='savu'&&castaway.status==='active');
  const next=recordTribalCouncilResolution(game,{tribeId:'savu',eliminatedCastawayId:attendees[1].id,episode:1,note:'Changed roster',expectedAttendeeIds:attendees.map(castaway=>castaway.id)});
  const firstEvents=next.scoreEvents.filter(event=>event.categoryId==='first-tribal-council');
  assert.deepEqual(new Set(firstEvents.map(event=>event.castawayId)),new Set([...firstAttendees.map(castaway=>castaway.id),game.castaways[3].id]));
  assert.equal(firstEvents.filter(event=>event.castawayId===game.castaways[3].id).length,1);
});
test('Tribal Council resolution rejects a stale preview and preserves saved tribe names',()=>{
  let game=fixture();
  const attendees=game.castaways.filter(castaway=>castaway.tribeId==='savu'&&castaway.status==='active');
  const input={tribeId:'savu',eliminatedCastawayId:attendees[0].id,episode:1,note:'',expectedAttendeeIds:attendees.map(castaway=>castaway.id)};
  game=assignCastaway(game,game.castaways[3].id,'savu','active');
  assert.throws(()=>recordTribalCouncilResolution(game,input),/roster changed/);
  const current=game.castaways.filter(castaway=>castaway.tribeId==='savu'&&castaway.status==='active');
  const next=recordTribalCouncilResolution(game,{...input,expectedAttendeeIds:current.map(castaway=>castaway.id)});
  assert.ok(next.scoreEvents.every(event=>event.tribeName==='Savu'));
  const renamed=saveTribe(next,{id:'savu',name:'Renamed Savu',color:'#000000'});
  assert.ok(renamed.scoreEvents.every(event=>event.tribeName==='Savu'));
});
test('merged Tribal Council resolution keeps first attendance but omits pre-merge consequences',()=>{
  let game=fixture();
  game.season.currentEpisode=3;game.season.mergeEpisode=3;
  game=assignCastaway(game,game.castaways[4].id,'toka','active');
  const attendees=game.castaways.filter(castaway=>castaway.tribeId==='toka'&&castaway.status==='active');
  const next=recordTribalCouncilResolution(game,{tribeId:'toka',eliminatedCastawayId:attendees[0].id,episode:3,note:'Merged council',expectedAttendeeIds:attendees.map(castaway=>castaway.id)});
  assert.equal(next.castaways.find(castaway=>castaway.id===attendees[0].id)?.status,'voted-out');
  assert.equal(next.scoreEvents.some(event=>event.categoryId==='voted-premerge'||event.categoryId==='survive-tribal'),false);
  assert.ok(next.scoreEvents.every(event=>event.categoryId==='first-tribal-council'));
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
  assert.throws(()=>recordTribalCouncilSurvival(withBoundary,{tribeId:'savu',episode:3,note:'blocked-late',expectedActiveCastawayIds:[withBoundary.castaways[0].id,withBoundary.castaways[1].id],historical:true}),/before the merge/);
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
  assert.equal(normalized.find(c=>c.id==='survive-tribal')?.bulkOnly,true);
  assert.equal(normalized.find(c=>c.id==='survive-tribal')?.target,'tribe');
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
  const started=structuredClone(initialGame);started.season.episodeStarted=true;started.season.episodeStatus='in-progress';
  assert.throws(()=>award(started),/no active members/);
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
