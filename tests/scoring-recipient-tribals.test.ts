import assert from 'node:assert/strict';
import test from 'node:test';
import {initialGame,migrateLegacyTribalState} from '../lib/game-data.ts';
import {addTribalCouncil,mergeIsActive,recordScoring,recordTribalCouncilResolution,resolveRecipients,saveMergeEpisode,startEpisode,tribalCouncilId} from '../lib/scoring.ts';

function fixture(){
  const game=structuredClone(initialGame);
  game.season.episodeStarted=true;game.season.episodeStatus='in-progress';
  game.castaways.forEach(castaway=>{castaway.status='voted-out';delete castaway.tribeId;});
  game.castaways[0]={...game.castaways[0],tribeId:'savu',status:'active'};
  game.castaways[1]={...game.castaways[1],tribeId:'savu',status:'active'};
  game.castaways[2]={...game.castaways[2],tribeId:'savu',status:'active'};
  game.castaways[3]={...game.castaways[3],tribeId:'toka',status:'active'};
  game.castaways[4]={...game.castaways[4],tribeId:'toka',status:'voted-out'};
  return game;
}

function council(game:ReturnType<typeof fixture>,number:number,attendeeIds:string[],eliminatedCastawayId?:string){
  const id=tribalCouncilId(game,1,number);
  return recordTribalCouncilResolution(game,{tribalCouncilId:id,councilNumber:number,attendeeMode:'custom',attendeeIds,eliminatedCastawayId,episode:1,note:`Council ${number}`,expectedAttendeeIds:attendeeIds});
}

test('recipient modes snapshot actual recipients and exclude inactive group members',()=>{
  const game=fixture(),action=game.categories.find(category=>category.id==='orchestrate')!;
  const custom=recordScoring(game,{categoryId:action.id,recipientMode:'custom',recipientIds:[game.castaways[0].id,game.castaways[3].id],episode:1,note:'Custom group',expectedRecipientIds:[game.castaways[0].id,game.castaways[3].id],batchId:'custom-recipient'});
  assert.deepEqual(custom.scoreEvents.map(event=>event.castawayId),[game.castaways[0].id,game.castaways[3].id]);
  assert.deepEqual(custom.scoreEvents[0].recipientIds,[game.castaways[0].id,game.castaways[3].id]);
  const tribeAction=game.categories.find(category=>category.id==='tribal-reward-primary')!;
  const tribe=recordScoring(game,{categoryId:tribeAction.id,recipientMode:'tribe',recipientId:'savu',episode:1,note:'Savu reward',expectedRecipientIds:[game.castaways[0].id,game.castaways[1].id,game.castaways[2].id],batchId:'tribe-recipient'});
  assert.deepEqual(tribe.scoreEvents.slice(-3).map(event=>event.castawayId),[game.castaways[0].id,game.castaways[1].id,game.castaways[2].id]);
  assert.deepEqual(resolveRecipients(game,tribeAction,'tribe','toka').map(castaway=>castaway.id),[game.castaways[3].id]);
  const moved={...tribe,castaways:tribe.castaways.map(castaway=>castaway.id===game.castaways[0].id?{...castaway,tribeId:'toka'}:castaway)};
  assert.deepEqual(moved.scoreEvents.slice(-3).map(event=>event.castawayId),[game.castaways[0].id,game.castaways[1].id,game.castaways[2].id]);
});

test('all active resolves current active castaways only',()=>{
  const game=saveMergeEpisode(fixture(),1),action=game.categories.find(category=>category.id==='tribal-reward-primary')!;
  const next=recordScoring(game,{categoryId:action.id,recipientMode:'all-active',recipientIds:game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id),episode:1,note:'All active',expectedRecipientIds:game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id),batchId:'all-active'});
  assert.equal(next.scoreEvents.length,4);
  assert.equal(next.scoreEvents.some(event=>event.castawayId===game.castaways[4].id),false);
});

test('one episode supports independent repeatable Tribal Councils and repeat attendees',()=>{
  let game=fixture();
  game=addTribalCouncil(game,{episode:1,number:2});
  assert.deepEqual(game.tribalCouncils?.map(council=>council.number),[2]);
  const firstAttendees=[game.castaways[0].id,game.castaways[1].id];
  game=council(game,1,firstAttendees,game.castaways[0].id);
  assert.equal(game.tribalCouncils?.find(item=>item.number===1)?.status,'resolved');
  assert.equal(game.season.episodeStatus,'in-progress');
  const secondAttendees=[game.castaways[1].id,game.castaways[2].id];
  game=council(game,2,secondAttendees,game.castaways[2].id);
  assert.equal(game.tribalCouncils?.find(item=>item.number===2)?.status,'resolved');
  assert.equal(game.castaways[0].status,'voted-out');
  assert.equal(game.castaways[2].status,'voted-out');
  assert.equal(game.scoreEvents.filter(event=>event.categoryId==='survive-tribal'&&event.castawayId===game.castaways[1].id).length,2);
  assert.equal(game.scoreEvents.filter(event=>event.categoryId==='first-tribal-council'&&event.castawayId===game.castaways[1].id).length,1);
  assert.equal(game.scoreEvents.filter(event=>event.categoryId==='first-tribal-council'&&event.castawayId===game.castaways[2].id).length,1);
  assert.throws(()=>council(game,3,[game.castaways[0].id],undefined),/active castaway|eligible/);
  const remaining=game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id);
  game=saveMergeEpisode(game,1);
  assert.deepEqual(resolveRecipients(game,game.categories.find(category=>category.id==='tribal-reward-primary')!,'all-active').map(castaway=>castaway.id),remaining);
});

test('merge state is explicit, jury-like metadata cannot activate it, and episode appearance is independent of Tribal count',()=>{
  let game=structuredClone(initialGame);
  game.season.currentEpisode=5;game.season.episodeStarted=true;game.season.episodeStatus='in-progress';
  game.castaways.forEach(castaway=>{castaway.status='voted-out';delete castaway.tribeId;});
  game.castaways[0]={...game.castaways[0],status:'active',tribeId:'savu'};
  game.castaways[1]={...game.castaways[1],status:'active',tribeId:'savu'};
  assert.equal(mergeIsActive(game,5),false);
  game=recordTribalCouncilResolution(game,{tribeId:'savu',councilNumber:1,attendeeMode:'tribe',episode:5,note:'Pre-merge despite episode number',expectedAttendeeIds:[game.castaways[0].id,game.castaways[1].id],eliminatedCastawayId:game.castaways[0].id});
  assert.equal(game.scoreEvents.some(event=>event.categoryId==='voted-premerge'),true);
  game=saveMergeEpisode(game,5);
  assert.equal(mergeIsActive(game,5),true);
  const merged=recordTribalCouncilResolution(game,{tribalCouncilId:tribalCouncilId(game,5,2),councilNumber:2,attendeeMode:'all-active',attendeeIds:[game.castaways[1].id],episode:5,note:'Post-merge',expectedAttendeeIds:[game.castaways[1].id],eliminatedCastawayId:game.castaways[1].id});
  assert.equal(merged.scoreEvents.some(event=>event.categoryId==='voted-premerge'&&event.tribalCouncilId===tribalCouncilId(game,5,2)),false);
  const clean=structuredClone(initialGame),active=clean.castaways.map(castaway=>castaway.id),started=startEpisode(clean,{episode:1,expectedActiveCastawayIds:active});
  const twice=council(council(started,1,[active[0]],undefined),2,[active[0]],undefined);
  assert.equal(twice.scoreEvents.filter(event=>event.categoryId==='still-on-island').length,active.length);
});

test('legacy Tribal resolution rows migrate to resolved council one and attendance history without changing points',()=>{
  const game=fixture(),resolutionKey=`${game.season.id}:tribal-council:1:savu`;
  const legacy={...game,tribalCouncilResolutions:[{resolutionKey,tribeId:'savu',episode:1,eliminatedCastawayId:game.castaways[0].id,resolvedAt:'2026-01-01T00:00:00.000Z'}],scoreEvents:[{id:'legacy-first',awardKey:resolutionKey,batchId:resolutionKey,castawayId:game.castaways[0].id,points:1,episode:1,categoryId:'first-tribal-council',createdAt:'2026-01-01T00:00:00.000Z'}]};
  const migrated=migrateLegacyTribalState(legacy);
  assert.equal(migrated.tribalCouncils?.[0].number,1);
  assert.equal(migrated.tribalCouncils?.[0].status,'resolved');
  assert.deepEqual(migrated.tribalCouncils?.[0].attendeeIds,[game.castaways[0].id]);
  assert.equal(migrated.tribalAttendance?.[0].castawayId,game.castaways[0].id);
  assert.equal(migrated.scoreEvents[0].points,1);
});
