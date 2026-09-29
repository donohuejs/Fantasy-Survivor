import assert from 'node:assert/strict';
import test from 'node:test';
import {currentSeasonOpenPolls,makePoll,pollDeepLinkTarget} from '../lib/community.ts';
import {initialGame} from '../lib/game-data.ts';
import {activeLeaderRosterCount,leaderRoster,liveDraftTurn,pointsLead} from '../lib/homepage.ts';

const copy=()=>structuredClone(initialGame);
const now='2026-09-28T12:00:00.000Z';

test('live draft action data exists only while the draft is live',()=>{
  const game=copy();game.draft.status='live';game.draft.currentPick=2;
  assert.equal(liveDraftTurn(game)?.playerId,game.draft.turns[2].playerId);
  game.draft.status='paused';assert.equal(liveDraftTurn(game),undefined);
  game.draft.status='complete';assert.equal(liveDraftTurn(game),undefined);
});

test('homepage poll filtering keeps only open polls from the active season',()=>{
  const game=copy();
  const newest=makePoll(game,{id:'newest',season:51,episode:3,question:'Newest?',options:['Yes','No']},now);
  const older=makePoll(game,{id:'older',season:51,episode:0,question:'Older?',options:['Yes','No']},'2026-09-27T12:00:00.000Z');
  const closed={...older,id:'closed',status:'closed' as const};
  const prior={...newest,id:'prior',season:50};
  assert.deepEqual(currentSeasonOpenPolls([older,prior,closed,newest],51).map(poll=>poll.id),['newest','older']);
});

test('poll deep links resolve the poll season and episode recap',()=>{
  const game=copy();
  const poll=makePoll(game,{id:'episode-three',season:51,episode:3,question:'Best move?',options:['A','B']},now);
  const target=pollDeepLinkTarget([poll],[{id:'51-3',season:51,episode:3} as never],'episode-three');
  assert.equal(target?.poll.id,'episode-three');
  assert.equal(target?.poll.season,51);
  assert.equal(target?.recapId,'51-3');
  assert.equal(pollDeepLinkTarget([poll],[],null),null);
});

test('leader roster follows current tribes, recognizes eliminations, and handles incomplete picks',()=>{
  const game=copy(),playerId=game.players[0].id;
  const first=game.castaways[0],second=game.castaways[1],unresolved=game.castaways[2];
  first.tribeId='savu';second.tribeId='toka';second.status='voted-out';
  game.draftPicks=[
    {id:'pick-one',playerId,castawayId:first.id,round:1,pickNumber:1,multiplier:1},
    {id:'pick-two',playerId,castawayId:second.id,round:2,pickNumber:1,multiplier:1},
    {id:'pick-three',playerId,castawayId:'',round:3,pickNumber:1,multiplier:1},
  ];
  const roster=leaderRoster(game,playerId);
  assert.deepEqual(roster.map(entry=>entry.castaway.id),[first.id,second.id]);
  assert.equal(roster[0].tribe?.color,'#7030A0');
  assert.equal(roster[1].tribe?.color,'#F2CC24');
  assert.equal(activeLeaderRosterCount(game,playerId),1);
  second.tribeId='savu';
  assert.equal(leaderRoster(game,playerId)[1].tribe?.color,'#7030A0');
  unresolved.status='active';
  assert.equal(leaderRoster(game,playerId).length,2);
});

test('points lead preserves decimals, omits single-player lead, and handles ties',()=>{
  assert.deepEqual(pointsLead([{score:21.5},{score:18}]),{kind:'lead',points:3.5});
  assert.deepEqual(pointsLead([{score:21},{score:21}]),{kind:'tied'});
  assert.equal(pointsLead([{score:21}]),null);
});
