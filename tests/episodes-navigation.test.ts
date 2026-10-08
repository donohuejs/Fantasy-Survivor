import assert from 'node:assert/strict';
import test from 'node:test';
import {availableEpisodeNumbers,type EpisodeRecap} from '../lib/community.ts';
import {finishEpisode,startEpisode} from '../lib/scoring.ts';
import {initialGame} from '../lib/game-data.ts';

const activeIds=()=>initialGame.castaways.map(castaway=>castaway.id);
const recap=(episode:number,status:'draft'|'published'='published'):EpisodeRecap=>({id:`51-${episode}`,season:51,episode,title:`Episode ${episode}`,body:status==='draft'?'Private draft':'Published commentary',status,actions:[],createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z',publishedAt:status==='published'?'2026-10-01T00:00:00.000Z':''});

test('starting an episode makes it available for navigation without a recap',()=>{
  let game=structuredClone(initialGame);
  game=startEpisode(game,{episode:1,expectedActiveCastawayIds:activeIds()});
  game=finishEpisode(game,{episode:1});
  game=startEpisode(game,{episode:2,expectedActiveCastawayIds:activeIds()});
  assert.deepEqual(availableEpisodeNumbers(game,[],[],51),[2,1]);
});

test('existing Episode 3 lifecycle and scoring records create one newest-first navigation entry',()=>{
  const game=structuredClone(initialGame);
  game.season.currentEpisode=3;
  game.season.episodeStarted=true;
  game.season.episodeStatus='in-progress';
  game.scoreEvents=[{id:'episode-3-action',castawayId:game.castaways[0].id,points:1,episode:3,createdAt:'2026-10-08T00:00:00.000Z'}];
  assert.deepEqual(availableEpisodeNumbers(game,[recap(1),recap(2)],[{id:'episode-3-poll',season:51,episode:3,question:'Question',options:['A','B'],counts:[0,0],status:'open',createdAt:'2026-10-08T00:00:00.000Z',updatedAt:'2026-10-08T00:00:00.000Z'}],51),[3,2,1]);
});

test('draft recap content does not make a public navigation episode and publishing does not duplicate it',()=>{
  const game=structuredClone(initialGame);
  game.season.currentEpisode=2;
  const withDraft=availableEpisodeNumbers(game,[recap(1),recap(2),recap(3,'draft')],[],51);
  assert.deepEqual(withDraft,[2,1]);
  const published=availableEpisodeNumbers(game,[recap(1),recap(2),recap(3)],[],51);
  assert.deepEqual(published,[3,2,1]);
  assert.equal(new Set(published).size,published.length);
});
