import assert from 'node:assert/strict';
import test from 'node:test';
import {buildDraftTurns,initialGame} from '../lib/game-data.ts';
import {castawayBoard,draftHistoryEntries,draftOverallPickNumber,draftRounds,draftRosterSize} from '../lib/draft-board.ts';

const copy=()=>structuredClone(initialGame);

test('setup board shows the full castaway pool as available',()=>{
  const board=castawayBoard(copy());
  assert.equal(board.round,1);
  assert.equal(board.items.length,initialGame.castaways.length);
  assert(board.items.every(item=>item.status==='available'));
});
test('voted-out castaways are unavailable on the public draft board',()=>{
  const game=copy();game.castaways[0].status='voted-out';
  const board=castawayBoard(game);
  assert.equal(board.items.find(item=>item.castawayId===game.castaways[0].id)?.status,'unavailable');
});

test('round one board marks picked names and leaves legal choices available',()=>{
  const game=copy();
  game.draft.status='live';game.draft.currentPick=1;
  game.draftPicks=[{id:'pick-1',playerId:game.draft.turns[0].playerId,castawayId:game.castaways[0].id,round:1,pickNumber:1,multiplier:1}];
  const board=castawayBoard(game);
  assert.equal(board.items.find(item=>item.castawayId===game.castaways[0].id)?.status,'drafted');
  assert.equal(board.items.find(item=>item.castawayId===game.castaways[1].id)?.status,'available');
  assert.equal(board.items.find(item=>item.castawayId===game.castaways[0].id)?.draftedBy,game.draft.turns[0].playerName);
});

test('round three board never exposes hidden dealt-card identities',()=>{
  const game=copy();
  game.draft.status='live';game.draft.turns=buildDraftTurns(game.players,game.players);game.draft.currentPick=26;
  game.draft.blind={discards:[game.castaways[0].id],keptCount:0};
  const board=castawayBoard(game);
  assert.equal(board.round,3);
  assert.equal(board.items.find(item=>item.castawayId===game.castaways[0].id)?.status,'available');
  assert(board.items.slice(1).every(item=>item.status==='private'));
});

test('round three swaps are shown as drafted while remaining discards stay available',()=>{
  const game=copy();
  game.draft.status='live';game.draft.turns=buildDraftTurns(game.players,game.players);game.draft.currentPick=27;
  game.draft.blind={discards:[game.castaways[0].id,game.castaways[1].id],keptCount:0};
  game.draftPicks=[{id:'pick-3',playerId:game.draft.turns[26].playerId,castawayId:game.castaways[0].id,round:3,pickNumber:1,multiplier:1,decision:'swap'}];
  const board=castawayBoard(game);
  assert.equal(board.items.find(item=>item.castawayId===game.castaways[0].id)?.status,'drafted');
  assert.equal(board.items.find(item=>item.castawayId===game.castaways[1].id)?.status,'available');
});

test('draft history uses the authoritative randomized turn sequence for overall pick numbers',()=>{
  const game=copy();
  game.draft.turns=buildDraftTurns(game.players,[...game.players].reverse());
  const roundThree=game.draft.turns.filter(turn=>turn.round===3);
  const firstRandomTurn=roundThree[0];
  const firstPick={id:'round-three-pick',playerId:firstRandomTurn.playerId,castawayId:game.castaways[0].id,round:3,pickNumber:firstRandomTurn.pickNumber,multiplier:1};
  game.draftPicks=[firstPick];
  const history=draftHistoryEntries(game);
  const entry=history.find(item=>item.pick?.id===firstPick.id)!;
  assert.equal(entry.playerId,firstRandomTurn.playerId);
  assert.equal(entry.overallPickNumber,game.players.length*2+1);
  assert.equal(draftOverallPickNumber(game,firstPick),game.players.length*2+1);
  assert.deepEqual(history.filter(item=>item.round===3).map(item=>item.playerId),roundThree.map(turn=>turn.playerId));
});

test('current draft configuration exposes all three rounds and a three-pick roster before picks exist',()=>{
  const game=copy();
  assert.deepEqual(draftRounds(game),[1,2,3]);
  assert.equal(draftRosterSize(game,game.players[0].id),3);
});
