import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceGame,acceptanceSnapshot,acceptanceFacts} from '../scripts/iphone-fixture.ts';
import {playerInJuryMode,leaderboardJuryPresentation} from '../lib/jury-public.ts';
import {juryEligibility,eligibleForEpisode,emptyFacts,applyJuryAwards,answerKey,saveJuryAnswer,type JuryPrediction,type JuryConfig,type QuestionId} from '../lib/jury.ts';
import {seasonStandings} from '../lib/league.ts';
import {activeLeaderRosterCount} from '../lib/homepage.ts';
import {MemoryFirestore} from './helpers/memory-firestore.ts';
import {JuryStore} from '../lib/jury-store.ts';
import {juryFixture,jurySnapshot,juryConfig,juryFacts,juryMember,before,airtime} from './helpers/jury-fixture.ts';
function fixture(){const game=acceptanceGame();game.juryMode={enabled:true,activationEpisode:5,reviewedEliminations:[]};return game;}
test('episode-based Jury status begins after the final elimination, including repeated slots',()=>{
  const game=fixture(),eligibility=juryEligibility(game,'synthetic-jury');assert.deepEqual(eligibility.slots,['synthetic-cinder','synthetic-echo','synthetic-echo']);assert.equal(eligibility.fromEpisode,5);
  assert.equal(playerInJuryMode(game,'synthetic-jury'),false);game.season.currentEpisode=5;
  for(const id of ['synthetic-jury','synthetic-complete'])assert.equal(playerInJuryMode(game,id),true);
  for(const id of ['synthetic-active','synthetic-legacy'])assert.equal(playerInJuryMode(game,id),false);
});

test('verified eliminated original slots receive transition styling before their first Jury episode',()=>{
  const game=fixture(),before=structuredClone(game);
  assert.equal(juryEligibility(game,'synthetic-jury').fromEpisode,5);
  assert.deepEqual(leaderboardJuryPresentation(game,'synthetic-jury'),{inJury:false});
  game.season.currentEpisode=5;
  assert.deepEqual(leaderboardJuryPresentation(game,'synthetic-jury'),{inJury:true});
  game.season.currentEpisode=4;assert.deepEqual(game,before);
});

test('presentation rejects surviving slots, incomplete original slots, missing history and eliminations in a later episode',()=>{
  const game=fixture();
  assert.equal(leaderboardJuryPresentation(game,'synthetic-active'),null);
  game.season.currentEpisode=3;assert.equal(leaderboardJuryPresentation(game,'synthetic-jury'),null);
  game.season.currentEpisode=4;delete game.castaways[1].eliminationEpisode;
  assert.equal(leaderboardJuryPresentation(game,'synthetic-jury'),null);
  game.castaways[1].eliminationEpisode=4;game.draftPicks=game.draftPicks.filter(p=>p.id!==game.draftPicks[0].id);
  assert.equal(leaderboardJuryPresentation(game,'synthetic-jury'),null);
});

test('muted presentation leaves approved activation and participation unchanged',()=>{
  const game=fixture();game.juryMode!.activationEpisode=7;
  assert.deepEqual(leaderboardJuryPresentation(game,'synthetic-jury'),{inJury:false});
  game.juryMode!.enabled=false;assert.equal(leaderboardJuryPresentation(game,'synthetic-jury'),null);
});

test('transition presentation cannot authorize an earlier answer or retroactive Jury points',async()=>{
  const game=juryFixture(),config=juryConfig(),db=new MemoryFirestore(),root='games/survivor-51';
  game.juryMode={enabled:config.enabled,activationEpisode:config.activationEpisode,reviewedEliminations:[]};
  db.seed(root,game);db.seed(root+'/juryConfig/51',config);
  for(const episode of [4,5])db.seed(root+'/juryEpisodes/51-'+episode,{snapshot:{...jurySnapshot(game),episode},facts:emptyFacts(),revision:1,key:null,keyRevision:0,confirmedAt:null,confirmedBy:null,gradedAt:null});
  const stored=structuredClone(db.data),store=new JuryStore(db.firestore,juryMember,()=>before);
  assert.deepEqual(leaderboardJuryPresentation(game,'jury-player'),{inJury:false});
  assert.equal(playerInJuryMode(game,'jury-player'),false);
  assert.equal(eligibleForEpisode(game,config,'jury-player',4),false);
  assert.equal(eligibleForEpisode(game,config,'jury-player',5),true);
  await assert.rejects(()=>store.mutate({action:'save-answer',season:51,episode:4,question:'q1',value:'red',expectedRevision:0,requestId:'transition-denied'}),/eligibility or activation/);
  assert.deepEqual(db.data,stored);
  await store.mutate({action:'save-answer',season:51,episode:5,question:'q1',value:'red',expectedRevision:0,requestId:'transition-allowed'});
  assert.deepEqual(db.read(root),game);
  const saved=db.read<JuryPrediction>(root+'/juryPredictions/51-5_jury-player'),earlierSnapshot={...jurySnapshot(game),episode:4};
  const graded=applyJuryAwards(game,earlierSnapshot,[{...saved,episode:4}],answerKey(earlierSnapshot,juryFacts(earlierSnapshot)),1,config,airtime);
  assert.equal(graded.scoreEvents.filter(e=>e.source==='jury').reduce((sum,e)=>sum+e.points,0),0);
  assert.deepEqual(seasonStandings(graded),seasonStandings(game));
  assert.deepEqual(graded.draftPicks,game.draftPicks);
});
test('zero remaining alone never guesses Jury eligibility or bypasses activation',()=>{
  const game=fixture();game.season.currentEpisode=5;delete game.castaways[1].eliminationEpisode;
  assert.equal(activeLeaderRosterCount(game,'synthetic-jury'),0);assert.equal(playerInJuryMode(game,'synthetic-jury'),false);
  game.castaways[1].eliminationEpisode=4;game.juryMode!.activationEpisode=6;assert.equal(playerInJuryMode(game,'synthetic-jury'),false);
  game.season.currentEpisode=6;assert.equal(playerInJuryMode(game,'synthetic-jury'),true);
});
test('Jury players retain the featured first position and unified totals, with no extra multiplier',()=>{
  const game=fixture(),snapshot=acceptanceSnapshot(game,'2099-01-01T00:00:00.000Z'),key=answerKey(snapshot,acceptanceFacts());
  const config:JuryConfig={season:51,enabled:true,activationEpisode:5,revision:1,approvedAt:'2098-01-01T00:00:00.000Z',approvedBy:'synthetic-commissioner',approval:'Synthetic approval',reconciliations:[]};
  const predictions=['jury','complete'].map(role=>{let p:JuryPrediction={season:51,episode:5,playerId:'synthetic-'+role,ownerUid:'iphone-'+role,snapshotVersion:1,answers:{},revision:0,eligibility:{fromEpisode:5,slots:[]}};const values:Partial<Record<QuestionId,string>>={q1:'amber',q2:'nothing',...(role==='complete'?{q3:'2',q4:'synthetic-fern'}:{}),q5:'synthetic-dusk'};for(const [q,value] of Object.entries(values))p=saveJuryAnswer(snapshot,p,q as QuestionId,value,p.revision,'fixture-'+q,'2098-01-01T00:00:00.000Z');return p;});
  const awarded=applyJuryAwards(game,snapshot,predictions,key,1,config,snapshot.airtime);awarded.season.currentEpisode=5;
  assert.deepEqual(awarded.scoreEvents.filter(e=>e.source!=='jury'),game.scoreEvents);assert.deepEqual(awarded.draftPicks,game.draftPicks);
  const standings=seasonStandings(awarded);assert.deepEqual(standings.map(p=>[p.profileId,p.score]),[['synthetic-complete',28],['synthetic-jury',24],['synthetic-active',11.5],['synthetic-legacy',11.5]]);
  assert.equal(standings[0].finish,1);assert.equal(playerInJuryMode(awarded,standings[0].profileId),true);assert.equal(activeLeaderRosterCount(awarded,standings[0].profileId),0);assert.equal(awarded.scoreEvents.filter(e=>e.source==='jury').length,2);
});
