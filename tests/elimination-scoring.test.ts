import assert from 'node:assert/strict';
import test from 'node:test';
import {initialGame,type EliminationReason} from '../lib/game-data.ts';
import {episodeActions} from '../lib/community.ts';
import {effectiveEliminationScoringEpisode,eliminationPenalty,ensureEliminationScoringBoundary,recordCastawayElimination,recordTribalCouncilResolution,tribalCouncilId,updateEliminationReason} from '../lib/scoring.ts';

function fixture(boundary=2){
  const game=structuredClone(initialGame);
  game.season.id='test-season';
  game.season.name='Test season';
  game.season.number=52;
  game.season.currentEpisode=2;
  game.season.episodeStarted=true;
  game.season.episodeStatus='in-progress';
  game.season.eliminationScoringEffectiveEpisode=boundary;
  game.castaways=game.castaways.map((castaway,index)=>({...castaway,status:index<6?'active':'voted-out'}));
  return game;
}

function eliminate(game:ReturnType<typeof fixture>,castawayId:string,reason:EliminationReason){
  return recordCastawayElimination(game,{castawayId,reason,episode:game.season.currentEpisode,note:`Recorded ${reason}`,expectedActiveCastawayIds:game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id)});
}

function eliminationEvents(game:ReturnType<typeof fixture>,castawayId:string){
  return game.scoreEvents.filter(event=>event.source==='elimination'&&event.castawayId===castawayId);
}

test('Season 51 persists Episode 4 as the elimination boundary and never follows later episodes',()=>{
  const game=structuredClone(initialGame);
  game.season.currentEpisode=3;
  game.season.episodeStarted=true;
  game.season.episodeStatus='in-progress';
  delete game.season.eliminationScoringEffectiveEpisode;
  const normalized=ensureEliminationScoringBoundary(game);
  assert.equal(normalized.season.eliminationScoringEffectiveEpisode,4);
  assert.equal(effectiveEliminationScoringEpisode({...normalized,season:{...normalized.season,currentEpisode:12}}),4);
  assert.deepEqual(ensureEliminationScoringBoundary(normalized),normalized);
});

test('a malformed Season 51 boundary is corrected to Episode 4 without changing score events',()=>{
  const game=structuredClone(initialGame);
  game.season.eliminationScoringEffectiveEpisode=8;
  game.scoreEvents=[{id:'existing',castawayId:game.castaways[0].id,points:-3,episode:3,createdAt:'2026-10-08T00:00:00.000Z',source:'one-time-bonus'}];
  const normalized=ensureEliminationScoringBoundary(game);
  assert.equal(normalized.season.eliminationScoringEffectiveEpisode,4);
  assert.deepEqual(normalized.scoreEvents,game.scoreEvents);
});

test('eligible elimination reasons produce one mutually exclusive automatic outcome',()=>{
  let game=fixture();
  const [votedOut,quit,medical,other]=game.castaways.slice(0,4).map(castaway=>castaway.id);
  game=eliminate(game,votedOut,'voted-out');
  game=eliminate(game,quit,'voluntary-quit');
  game=eliminate(game,medical,'medical-evacuation');
  game=eliminate(game,other,'other-removal');
  assert.equal(eliminationPenalty('voted-out',true),-1);
  assert.equal(eliminationPenalty('voted-out',false),0);
  assert.equal(eliminationPenalty('voluntary-quit',true),-3);
  assert.equal(eliminationPenalty('voluntary-quit',false),-3);
  assert.deepEqual(eliminationEvents(game,votedOut).map(event=>({categoryId:event.categoryId,points:event.points})),[{categoryId:'elimination-voted-out',points:-1}]);
  assert.deepEqual(eliminationEvents(game,quit).map(event=>({categoryId:event.categoryId,points:event.points})),[{categoryId:'elimination-voluntary-quit',points:-3}]);
  assert.deepEqual(eliminationEvents(game,medical).map(event=>({categoryId:event.categoryId,points:event.points})),[{categoryId:'elimination-medical-evacuation',points:0}]);
  assert.deepEqual(eliminationEvents(game,other).map(event=>({categoryId:event.categoryId,points:event.points})),[{categoryId:'elimination-other-removal',points:0}]);
  assert.equal(game.castaways.find(castaway=>castaway.id===quit)?.status,'voted-out');
  assert.equal(game.castaways.find(castaway=>castaway.id===quit)?.eliminationEpisode,2);
});

test('voluntary quit keeps its penalty after the merge and post-merge vote-out stays zero',()=>{
  let game=fixture();
  game.season.mergeEpisode=2;
  game.season.mergeState='merged';
  game.season.mergeOccurred=true;
  const quit=game.castaways[0].id, votedOut=game.castaways[1].id;
  game=eliminate(game,quit,'voluntary-quit');
  game=eliminate(game,votedOut,'voted-out');
  assert.equal(eliminationEvents(game,quit)[0].points,-3);
  assert.equal(eliminationEvents(game,votedOut)[0].points,0);
});

test('Tribal Council defaults to voted out, persists the reason, and uses the future workflow',()=>{
  let game=fixture();
  game.castaways=game.castaways.map((castaway,index)=>index<3?{...castaway,tribeId:'savu'}:{...castaway,tribeId:undefined});
  const attendees=game.castaways.filter(castaway=>castaway.status==='active'&&castaway.tribeId==='savu').map(castaway=>castaway.id);
  const votedOut=attendees[0];
  game=recordTribalCouncilResolution(game,{tribalCouncilId:tribalCouncilId(game,2,1),councilNumber:1,tribeId:'savu',attendeeMode:'tribe',attendeeIds:attendees,eliminatedCastawayId:votedOut,episode:2,note:'Council',expectedAttendeeIds:attendees});
  assert.equal(game.castaways.find(castaway=>castaway.id===votedOut)?.eliminationReason,'voted-out');
  assert.equal(game.tribalCouncilResolutions?.[0].eliminationReason,'voted-out');
  assert.equal(game.tribalCouncils?.[0].eliminationReason,'voted-out');
  assert.deepEqual(eliminationEvents(game,votedOut).map(event=>event.points),[-1]);

  const quit=game.castaways.find(castaway=>castaway.status==='active')!.id;
  const remaining=game.castaways.filter(castaway=>castaway.status==='active'&&castaway.tribeId==='savu').map(castaway=>castaway.id);
  const quitGame=recordTribalCouncilResolution(game,{tribalCouncilId:tribalCouncilId(game,2,2),councilNumber:2,tribeId:'savu',attendeeMode:'custom',attendeeIds:remaining,eliminatedCastawayId:quit,eliminationReason:'voluntary-quit',episode:2,note:'Quit at council',expectedAttendeeIds:remaining});
  assert.equal(quitGame.castaways.find(castaway=>castaway.id===quit)?.eliminationReason,'voluntary-quit');
  assert.deepEqual(eliminationEvents(quitGame,quit).map(event=>event.points),[-3]);
  assert.equal(eliminationEvents(quitGame,quit).some(event=>event.categoryId==='voted-premerge'),false);
});

test('a protected current-episode Tribal quit records its reason without adding a new elimination penalty',()=>{
  let game=fixture(4);
  game.season.currentEpisode=3;
  game.castaways=game.castaways.map((castaway,index)=>index<3?{...castaway,tribeId:'savu'}:{...castaway,tribeId:undefined});
  const attendees=game.castaways.filter(castaway=>castaway.status==='active'&&castaway.tribeId==='savu').map(castaway=>castaway.id);
  const quitter=attendees[0];
  game=recordTribalCouncilResolution(game,{tribalCouncilId:tribalCouncilId(game,3,1),councilNumber:1,tribeId:'savu',attendeeMode:'tribe',attendeeIds:attendees,eliminatedCastawayId:quitter,eliminationReason:'voluntary-quit',episode:3,note:'Existing episode',expectedAttendeeIds:attendees});
  assert.equal(game.castaways.find(castaway=>castaway.id===quitter)?.eliminationReason,'voluntary-quit');
  assert.equal(eliminationEvents(game,quitter).length,0);
  assert.equal(game.scoreEvents.some(event=>event.categoryId==='voted-premerge'&&event.castawayId===quitter),false);
});

test('changing an eligible reason replaces only its automatic event and keeps manual history',()=>{
  let game=fixture();
  const id=game.castaways[0].id;
  game=eliminate(game,id,'voluntary-quit');
  game.scoreEvents.push({id:'manual-correction',castawayId:id,points:7,episode:2,note:'Existing manual correction',createdAt:'2026-10-07T00:00:00.000Z',source:'one-time-bonus'});
  const changed=updateEliminationReason(game,{castawayId:id,reason:'medical-evacuation'});
  assert.equal(changed.castaways.find(castaway=>castaway.id===id)?.eliminationReason,'medical-evacuation');
  assert.deepEqual(eliminationEvents(changed,id).map(event=>({categoryId:event.categoryId,points:event.points})),[{categoryId:'elimination-medical-evacuation',points:0}]);
  assert.deepEqual(changed.scoreEvents.find(event=>event.id==='manual-correction'),game.scoreEvents.find(event=>event.id==='manual-correction'));
  assert.equal(episodeActions(changed,2).filter(action=>action.label==='Medical evacuation').length,1);
  assert.equal(recordCastawayElimination(changed,{castawayId:id,reason:'medical-evacuation',episode:2,note:'Retry',expectedActiveCastawayIds:changed.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id)}),changed);
});

test('historical/current protected eliminations retain scores and do not receive a new quit penalty',()=>{
  const game=fixture(3);
  const id=game.castaways[0].id;
  game.scoreEvents=[{id:'manual-quit-adjustment',castawayId:id,points:-3,episode:2,note:'Existing one-time quit correction',createdAt:'2026-10-07T00:00:00.000Z',source:'one-time-bonus'}];
  const eliminated=eliminate(game,id,'voluntary-quit');
  assert.equal(eliminated.castaways.find(castaway=>castaway.id===id)?.status,'voted-out');
  assert.equal(eliminated.scoreEvents.some(event=>event.source==='elimination'),false);
  assert.deepEqual(eliminated.scoreEvents,game.scoreEvents);
  const changed=updateEliminationReason(eliminated,{castawayId:id,reason:'medical-evacuation'});
  assert.equal(changed.castaways.find(castaway=>castaway.id===id)?.eliminationReason,'medical-evacuation');
  assert.deepEqual(changed.scoreEvents,game.scoreEvents);
});

test('Season 51 Episode 3 preserves Rob Antonson’s existing manual quit adjustment',()=>{
  const game=structuredClone(initialGame);
  game.season.currentEpisode=3;
  game.season.episodeStarted=true;
  game.season.episodeStatus='in-progress';
  const rob=game.castaways.find(castaway=>castaway.id==='cast-rob')!;
  game.scoreEvents=[{id:'rob-manual-quit',castawayId:rob.id,recipientName:rob.name,points:-3,episode:3,note:'Existing quit correction',createdAt:'2026-10-08T00:00:00.000Z',source:'one-time-bonus'}];
  const next=recordCastawayElimination(game,{castawayId:rob.id,reason:'voluntary-quit',episode:3,expectedActiveCastawayIds:game.castaways.filter(castaway=>castaway.status==='active').map(castaway=>castaway.id)});
  assert.equal(next.season.eliminationScoringEffectiveEpisode,4);
  assert.equal(next.castaways.find(castaway=>castaway.id===rob.id)?.status,'voted-out');
  assert.deepEqual(next.scoreEvents,game.scoreEvents);
});

test('zero-point eliminations are visible once in the episode recap',()=>{
  const game=eliminate(fixture(),'cast-aaliyah','medical-evacuation');
  const actions=episodeActions(game,2).filter(action=>action.label==='Medical evacuation');
  assert.equal(actions.length,1);
  assert.equal(actions[0].points,0);
  assert.deepEqual(actions[0].recipients,['Aaliyah Puglia']);
});
