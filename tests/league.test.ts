import assert from 'node:assert/strict';
import test from 'node:test';
import {initialGame,buildDraftTurns} from '../lib/game-data.ts';
import {bindProfile,seasonStandings,lockSeason,nextSeasonRoster,prepareNextSeason} from '../lib/league.ts';
import {historicalResults,allTimeStandings,combinedHistory} from '../lib/history-data.ts';

const signup={uid:'google-one',name:'New display name',email:'player@example.com',createdAt:'2026-09-03T12:00:00Z'};
function finished(){const game=structuredClone(initialGame);game.players=game.players.slice(0,3).map((p,index)=>({...p,uid:`google-${index}`,paid:true,entryBonus:0}));game.draft.status='complete';game.scoreEvents=game.players.map((p,index)=>({id:`score-${index}`,playerId:p.id,points:30-index*10,createdAt:'2026-12-01T00:00:00Z'}));return game;}
test('first assignment preserves permanent historical identity and removes public email',()=>{
  const game=bindProfile(initialGame,signup,'player-stanzi');const player=game.players.find(p=>p.id==='player-stanzi')!;
  assert.equal(player.uid,signup.uid);assert.equal(player.name,signup.name);assert.equal(player.email,'');assert.equal(player.draftSlot,1);
  const row=allTimeStandings(historicalResults,game.players).find(r=>r.profileId==='player-stanzi')!;
  assert.equal(row.name,signup.name);assert.equal(row.total,825);assert.equal(row.seasons,6);
});
test('one account cannot take two profiles or replace another account',()=>{
  const game=bindProfile(initialGame,signup,'player-stanzi');
  assert.throws(()=>bindProfile(game,signup,'player-zoda'),/already/);
  assert.throws(()=>bindProfile(game,{...signup,uid:'different'},'player-stanzi'),/another account/);
  assert.throws(()=>bindProfile(initialGame,{...signup,assignedPlayerId:'player-stanzi'},'player-zoda'),/locked/);
});
test('assignment validates existence and does not hijack manually linked emails',()=>{
  assert.throws(()=>bindProfile(initialGame,signup,'missing'),/existing/);
  const game=structuredClone(initialGame);game.players[0].email='someone-else@example.com';
  assert.throws(()=>bindProfile(game,signup,game.players[0].id),/different email/);
  game.draft.status='live';assert.throws(()=>bindProfile(game,signup,game.players[1].id),/before/);
});
test('draft turn identity uses UID and preserves reverse/snake order',()=>{
  const game=bindProfile(initialGame,signup,'player-stanzi');const turns=buildDraftTurns(game.players);
  assert.equal(turns[0].uid,signup.uid);assert.equal(turns[0].email,'');assert.equal(turns[13].playerId,'player-chad');
});
test('season scoring includes castaway multiplier, bonus, and adjustments',()=>{
  const game=finished();game.players[0].entryBonus=2;game.draftPicks=[{id:'p',playerId:game.players[0].id,castawayId:'c',round:3,pickNumber:1,multiplier:1.25}];game.scoreEvents.push({id:'cast',castawayId:'c',points:8,createdAt:''});
  assert.equal(seasonStandings(game)[0].score,42);
});
test('locking is explicit, validated, immutable, and idempotent',()=>{
  assert.throws(()=>lockSeason(initialGame,[],''),/Complete/);
  const game=finished(),ids=seasonStandings(game).map(r=>r.profileId);
  assert.throws(()=>lockSeason(game,[ids[0],ids[0],ids[2]],''),/exactly once/);
  assert.throws(()=>lockSeason(game,[...ids].reverse(),''),/Only tied/);
  const locked=lockSeason(game,ids,'final-time');assert.equal(locked.history!.length,1);assert.equal(game.history,undefined);
  assert.deepEqual(lockSeason(locked,ids,'new-time'),locked);
  assert.equal(locked.history![0].finalizedAt,'final-time');
});
test('admin-specified tied order determines next draft slots',()=>{
  const game=finished();game.scoreEvents[1].points=30;const ids=[game.players[1].id,game.players[0].id,game.players[2].id];
  const locked=lockSeason(game,ids,'now'),next=nextSeasonRoster(locked);
  assert.equal(next[0].id,ids[0]);assert.equal(next[0].draftSlot,3);assert.equal(next[1].draftSlot,2);
});
test('new season keeps identities, archives and custom actions; clears seasonal state',()=>{
  const game=finished(),locked=lockSeason(game,seasonStandings(game).map(r=>r.profileId),'now'),next=prepareNextSeason(locked);
  assert.equal(next.season.number,52);assert.equal(next.season.finalized,false);assert.equal(next.players[0].uid,game.players[0].uid);assert.equal(next.players[0].id,game.players[0].id);
  assert.equal(next.players[0].draftSlot,3);assert.equal(next.players[2].draftSlot,1);assert.ok(next.players.every(p=>!p.paid&&p.entryBonus===0));
  assert.deepEqual(next.history,locked.history);assert.deepEqual(next.categories,game.categories);assert.equal(next.castaways.length,0);assert.equal(next.tribes.length,0);assert.equal(next.scoreEvents.length,0);assert.equal(next.draftPicks.length,0);
  assert.throws(()=>prepareNextSeason(game),/Lock/);assert.throws(()=>prepareNextSeason(next),/Lock/);
});
test('Season 53 carries the same profile IDs after another complete cycle',()=>{
  let game=finished();game=prepareNextSeason(lockSeason(game,seasonStandings(game).map(r=>r.profileId),'51'));
  game.draft.status='complete';game.scoreEvents=game.players.map((p,i)=>({id:p.id,playerId:p.id,points:i*10,createdAt:'52'}));
  game=prepareNextSeason(lockSeason(game,seasonStandings(game).map(r=>r.profileId),'52'));
  assert.equal(game.season.number,53);assert.equal(game.history!.length,2);assert.ok(game.players.every(p=>p.uid));assert.equal(game.players.find(p=>p.id==='player-chad')!.draftSlot,1);
});
test('historical import has 73 results, 15 distinct people, six seasons, and preserves missing seasons',()=>{
  assert.equal(historicalResults.length,73);assert.equal(new Set(historicalResults.map(r=>r.profileId)).size,15);assert.equal(new Set(historicalResults.map(r=>r.season)).size,6);
  const board=allTimeStandings(historicalResults);assert.equal(board[0].name,'Zoda');assert.equal(board[0].total,1064.75);assert.equal(board[0].wins,2);
  assert.equal(board.find(r=>r.name==='Anna')!.total,165);assert.equal(board.find(r=>r.name==='Anna')!.seasons,1);
  assert.equal(board.find(r=>r.name==='Jackie')!.seasons,2);assert.equal(board.find(r=>r.name==='Chad')!.wins,2);
});
test('historical tied Season 49 scores share rank 13',()=>{
  const tied=historicalResults.filter(r=>r.season===49&&r.score===93);assert.equal(tied.length,2);assert.ok(tied.every(r=>r.finish===13));
});
test('finalized season is appended once and unfinalized scores are excluded',()=>{
  const game=finished();assert.equal(combinedHistory(game.history).length,73);
  const locked=lockSeason(game,seasonStandings(game).map(r=>r.profileId),'now');
  assert.equal(combinedHistory(locked.history).length,76);assert.equal(combinedHistory([...locked.history!,...locked.history!]).length,76);
  const chad=allTimeStandings(combinedHistory(locked.history)).find(r=>r.profileId==='player-chad')!;
  assert.equal(chad.seasons,7);assert.ok(Math.abs(chad.total-961.2083333333333)<1e-8);
});
