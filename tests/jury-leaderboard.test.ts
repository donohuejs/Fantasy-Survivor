import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceGame,acceptanceSnapshot,acceptanceFacts} from '../scripts/iphone-fixture.ts';
import {playerInJuryMode} from '../lib/jury-public.ts';
import {juryEligibility,applyJuryAwards,answerKey,saveJuryAnswer,type JuryPrediction,type JuryConfig,type QuestionId} from '../lib/jury.ts';
import {seasonStandings} from '../lib/league.ts';
import {activeLeaderRosterCount} from '../lib/homepage.ts';
function fixture(){const game=acceptanceGame();game.juryMode={enabled:true,activationEpisode:5,reviewedEliminations:[]};return game;}
test('leaderboard Jury status begins the episode after the final elimination, including repeated slots',()=>{
  const game=fixture(),eligibility=juryEligibility(game,'synthetic-jury');assert.deepEqual(eligibility.slots,['synthetic-cinder','synthetic-echo','synthetic-echo']);assert.equal(eligibility.fromEpisode,5);
  assert.equal(playerInJuryMode(game,'synthetic-jury'),false);game.season.currentEpisode=5;
  for(const id of ['synthetic-jury','synthetic-complete'])assert.equal(playerInJuryMode(game,id),true);
  for(const id of ['synthetic-active','synthetic-legacy'])assert.equal(playerInJuryMode(game,id),false);
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
