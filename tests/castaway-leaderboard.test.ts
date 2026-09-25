import assert from 'node:assert/strict';
import test from 'node:test';
import {initialGame} from '../lib/game-data.ts';
import {castawayLeaderboard} from '../lib/castaway-leaderboard.ts';

test('castaway leaderboard totals episodes and keeps eliminated castaways at the bottom',()=>{
  const game=structuredClone(initialGame);
  game.season.currentEpisode=2;
  game.castaways[2].status='voted-out';
  game.scoreEvents=[
    {id:'a',castawayId:game.castaways[0].id,points:2,episode:1,createdAt:''},
    {id:'b',castawayId:game.castaways[0].id,points:3,episode:2,createdAt:''},
    {id:'c',castawayId:game.castaways[1].id,points:4,episode:1,createdAt:''},
    {id:'d',castawayId:game.castaways[2].id,points:20,episode:1,createdAt:''},
  ];
  const result=castawayLeaderboard(game);
  assert.deepEqual(result.episodes,[1,2]);
  assert.equal(result.active[0].castawayId,game.castaways[0].id);
  assert.deepEqual(result.active.find(row=>row.castawayId===game.castaways[0].id)?.byEpisode,{1:2,2:3});
  assert.equal(result.active.find(row=>row.castawayId===game.castaways[0].id)?.total,5);
  assert.equal(result.eliminated[0].castawayId,game.castaways[2].id);
});
