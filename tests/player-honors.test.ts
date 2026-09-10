import test from 'node:test';
import assert from 'node:assert/strict';
import {getPlayerHonors,playerDisplayName} from '../lib/player-honors.ts';

test('historical winners receive one star per past win',()=>{
  assert.deepEqual(getPlayerHonors('player-ross','Ross'),{wins:1,reigning:false});
  assert.deepEqual(getPlayerHonors('player-josh','Josh'),{wins:1,reigning:false});
  assert.deepEqual(getPlayerHonors('player-zoda','Zoda'),{wins:2,reigning:false});
  assert.deepEqual(getPlayerHonors('player-chad','Chad'),{wins:1,reigning:true});
});

test('display labels include trophy and one star per win',()=>{
  assert.equal(playerDisplayName('player-zoda','Zoda'),'Zoda ★★');
  assert.equal(playerDisplayName('player-chad','Chad'),'Chad 🏆 ★');
});

test('an archived later season moves the reigning champion',()=>{
  const history=[{season:51,finalizedAt:'2026-01-01',results:[{profileId:'player-ross',name:'Ross',score:300,finish:1},{profileId:'player-chad',name:'Chad',score:200,finish:2}]}];
  assert.deepEqual(getPlayerHonors('player-ross','Ross',history),{wins:1,reigning:true});
  assert.deepEqual(getPlayerHonors('player-chad','Chad',history),{wins:2,reigning:false});
});
