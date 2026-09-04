import assert from 'node:assert/strict';
import test from 'node:test';
import {adminTabs,tabFromHash,tabForKey} from '../lib/admin-navigation.ts';

test('all six game-master sections have distinct deep links',()=>{
  assert.deepEqual(adminTabs.map(t=>t.label),['Scoring','League setup','Tribe membership','Player check-in','Draft room','Activity log']);
  assert.equal(new Set(adminTabs.map(t=>t.id)).size,6);
  for(const tab of adminTabs)assert.equal(tabFromHash('#'+tab.id),tab.id);
});
test('empty and invalid section links safely open Scoring',()=>{
  for(const hash of ['','#unknown','#SCORING','scoring'])assert.equal(tabFromHash(hash),'scoring');
});
test('keyboard arrows wrap across the tab row',()=>{
  assert.equal(tabForKey('scoring','ArrowLeft'),'activity-log');
  assert.equal(tabForKey('activity-log','ArrowRight'),'scoring');
  assert.equal(tabForKey('tribe-membership','ArrowRight'),'player-check-in');
});
test('Home and End select edge tabs; unrelated keys are not intercepted',()=>{
  assert.equal(tabForKey('draft-room','Home'),'scoring');
  assert.equal(tabForKey('scoring','End'),'activity-log');
  assert.equal(tabForKey('scoring','Tab'),null);
  assert.equal(tabForKey('scoring','Enter'),null);
});
