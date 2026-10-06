import assert from 'node:assert/strict';
import test from 'node:test';
import {initialGame} from '../lib/game-data.ts';
import {episodeActions} from '../lib/community.ts';
import {changePossessionStatus,createPossessionRecord,postMergeVoteTotals,recordTribalCouncilResolution,saveMergeEpisode,tribalCouncilId} from '../lib/scoring.ts';

function base(activeCount=6){
  const game=structuredClone(initialGame);
  game.possessions=[];
  game.season.currentEpisode=1;
  game.season.episodeStarted=true;
  game.season.episodeStatus='in-progress';
  game.castaways=game.castaways.map((castaway,index)=>({...castaway,status:index<activeCount?'active':'voted-out'}));
  return game;
}

function idol(game:ReturnType<typeof base>,id:string,castawayId:string){
  return createPossessionRecord(game,{id,castawayId,itemName:id,category:'idol',acquiredEpisode:1});
}

function merged(game=base()){
  return saveMergeEpisode(game,1);
}

function resolve(game:ReturnType<typeof base>,number:number,eliminatedCastawayId:string,votes:Parameters<typeof recordTribalCouncilResolution>[1]['postMergeVotes']=[]){
  const attendeeIds=game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id);
  return recordTribalCouncilResolution(game,{tribalCouncilId:tribalCouncilId(game,1,number),councilNumber:number,attendeeMode:'custom',attendeeIds,eliminatedCastawayId,episode:1,note:'',expectedAttendeeIds:attendeeIds,postMergeVotes:votes});
}

function votes(game:ReturnType<typeof base>,counts:number[],options:Partial<{nullifiedVotes:number;extraVotes:number;round:number}>={}){
  return game.castaways.filter(castaway=>castaway.status==='active').map((castaway,index)=>({castawayId:castaway.id,countedVotes:counts[index]??0,...options}));
}

test('merge awards one surviving-idol bonus per qualifying idol and is idempotent',()=>{
  let game=base();
  game=idol(game,'idol-a',game.castaways[0].id);
  game=idol(game,'idol-b',game.castaways[0].id);
  game=idol(game,'idol-c',game.castaways[1].id);
  const mergedGame=saveMergeEpisode(game,1);
  assert.equal(mergedGame.scoreEvents.filter(event=>event.categoryId==='merge-surviving-idol').length,3);
  assert.deepEqual(mergedGame.scoreEvents.filter(event=>event.categoryId==='merge-surviving-idol').map(event=>event.points),[2,2,2]);
  assert.deepEqual(saveMergeEpisode(mergedGame,1),mergedGame);
});

test('played or removed idols do not receive a merge bonus',()=>{
  let game=base();
  game=idol(game,'idol-played',game.castaways[0].id);
  game=changePossessionStatus(game,{possessionId:'idol-played',status:'played',episode:1,notes:'Played before merge'});
  assert.equal(saveMergeEpisode(game,1).scoreEvents.some(event=>event.categoryId==='merge-surviving-idol'),false);
});

test('merge awards the intact three-castaway fantasy roster once',()=>{
  const game=base();
  const player=game.players[0],second=game.players[1];
  game.draftPicks=[...game.castaways.slice(0,3).map((castaway,index)=>({id:`pick-${index}`,playerId:player.id,castawayId:castaway.id,round:index+1,pickNumber:index+1,multiplier:1})),...game.castaways.slice(0,2).map((castaway,index)=>({id:`other-${index}`,playerId:second.id,castawayId:castaway.id,round:index+1,pickNumber:index+1,multiplier:1}))];
  const mergedGame=merged(game);
  assert.equal(mergedGame.scoreEvents.filter(event=>event.playerId===player.id&&event.categoryId==='merge-intact-roster').length,1);
  assert.equal(mergedGame.scoreEvents.find(event=>event.playerId===player.id)?.points,5);
  assert.equal(mergedGame.scoreEvents.some(event=>event.playerId===second.id&&event.categoryId==='merge-intact-roster'),false);
});

test('post-merge vote totals count normal, extra, and revote votes but exclude nullified and pre-merge votes',()=>{
  let game=merged(base());
  const attendeeIds=game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id);
  assert.throws(()=>recordTribalCouncilResolution({...base(),season:{...base().season,mergeEpisode:undefined,mergeState:'pre-merge'}},{attendeeMode:'custom',attendeeIds,eliminatedCastawayId:attendeeIds[0],episode:1,note:'',expectedAttendeeIds:attendeeIds,postMergeVotes:[{castawayId:attendeeIds[0],countedVotes:3}]}),/only be recorded after the merge/);
  game=resolve(game,1,attendeeIds[5],[
    {castawayId:attendeeIds[0],countedVotes:4,nullifiedVotes:4},
    {castawayId:attendeeIds[1],countedVotes:2,extraVotes:1},
    {castawayId:attendeeIds[1],countedVotes:3,round:2,revote:true},
  ]);
  const totals=postMergeVoteTotals(game);
  assert.equal(totals[attendeeIds[0]],4);
  assert.equal(totals[attendeeIds[1]],5);
  assert.equal(totals[attendeeIds[2]],undefined);
  assert.equal(game.tribalVotes?.find(vote=>vote.castawayId===attendeeIds[0])?.nullifiedVotes,4);
});

test('Final 5 snapshots unique most and least vote totals and awards both once',()=>{
  const game=merged(base());
  const active=game.castaways.filter(castaway=>castaway.status==='active');
  const inputVotes=votes(game,[14,9,6,3,0,1]);
  const next=resolve(game,1,active[5].id,inputVotes);
  assert.deepEqual(next.season.finalFiveSnapshot?.activeCastawayIds,active.slice(0,5).map(castaway=>castaway.id));
  assert.equal(next.scoreEvents.filter(event=>event.categoryId==='final-five-most-votes').length,1);
  assert.equal(next.scoreEvents.find(event=>event.categoryId==='final-five-most-votes')?.castawayId,active[0].id);
  assert.equal(next.scoreEvents.filter(event=>event.categoryId==='final-five-least-votes').length,1);
  assert.equal(next.scoreEvents.find(event=>event.categoryId==='final-five-least-votes')?.castawayId,active[4].id);
  assert.equal(next.season.finalFiveSnapshot?.voteTotals[active[4].id],0);
  assert.deepEqual(resolve(next,1,active[5].id,inputVotes),next);
});

test('Final 5 high and low ties award no points',()=>{
  const game=merged(base());
  const active=game.castaways.filter(castaway=>castaway.status==='active');
  const next=resolve(game,1,active[5].id,votes(game,[9,9,4,2,2,1]));
  assert.equal(next.scoreEvents.some(event=>event.categoryId==='final-five-most-votes'),false);
  assert.equal(next.scoreEvents.some(event=>event.categoryId==='final-five-least-votes'),false);
  assert.equal(next.season.finalFiveSnapshot?.mostCastawayIds.length,2);
  assert.equal(next.season.finalFiveSnapshot?.leastCastawayIds.length,2);
});

test('stored unique Final 5 leader earns Final 3 survival bonus, but an eliminated leader does not',()=>{
  let game=merged(base());
  const firstActive=game.castaways.filter(castaway=>castaway.status==='active');
  game=resolve(game,1,firstActive[5].id,votes(game,[10,8,6,4,2,1]));
  const leader=firstActive[0].id;
  const remaining=()=>game.castaways.filter(castaway=>castaway.status==='active');
  game=resolve(game,2,remaining()[4].id);
  game=resolve(game,3,remaining().find(castaway=>castaway.id!==leader)!.id);
  assert.equal(game.castaways.filter(castaway=>castaway.status==='active').length,3);
  assert.equal(game.scoreEvents.filter(event=>event.categoryId==='final-three-vote-leader').length,1);
  assert.equal(game.scoreEvents.filter(event=>event.categoryId==='final-three-vote-leader')[0].castawayId,leader);

  let eliminated=merged(base());
  const six=eliminated.castaways.filter(castaway=>castaway.status==='active');
  eliminated=resolve(eliminated,1,six[5].id,votes(eliminated,[10,8,6,4,2,1]));
  eliminated=resolve(eliminated,2,six[0].id);
  eliminated=resolve(eliminated,3,eliminated.castaways.find(castaway=>castaway.status==='active')!.id);
  assert.equal(eliminated.scoreEvents.some(event=>event.categoryId==='final-three-vote-leader'),false);
});

test('Final 5 high-vote tie never creates a Final 3 leader bonus',()=>{
  let game=merged(base());
  const six=game.castaways.filter(castaway=>castaway.status==='active');
  game=resolve(game,1,six[5].id,votes(game,[10,10,6,4,2,1]));
  game=resolve(game,2,six[4].id);
  game=resolve(game,3,six[3].id);
  assert.equal(game.castaways.filter(castaway=>castaway.status==='active').length,3);
  assert.equal(game.scoreEvents.some(event=>event.categoryId==='final-three-vote-leader'),false);
});

test('automated and manual scoring share Episode Recap actions and automated rules are not manual categories',()=>{
  let game=base();
  game=idol(game,'idol-recap',game.castaways[0].id);
  game=saveMergeEpisode(game,1);
  game.scoreEvents.push({id:'manual',batchId:'manual',castawayId:game.castaways[1].id,recipientName:game.castaways[1].name,categoryId:'find-idol',actionLabel:'Find an idol',points:5,episode:1,note:'Manual action',createdAt:'2026-01-01T00:00:00.000Z'});
  const actions=episodeActions(game,1);
  assert.ok(actions.some(action=>action.label==='Surviving pre-merge idol reached the merge'));
  assert.ok(actions.some(action=>action.label==='Find an idol'));
  for(const id of ['merge-surviving-idol','merge-intact-roster','final-five-most-votes','final-five-least-votes','final-three-vote-leader'])assert.equal(initialGame.categories.find(category=>category.id===id)?.systemManaged,true);
});

