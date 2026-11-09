import assert from 'node:assert/strict';
import test from 'node:test';
import {juryAdminStatus} from '../lib/jury-admin-status.ts';

const base={episode:8,activationEnabled:true,activationEpisode:7,hasSnapshot:false,snapshotAirtime:null,graded:false,serverTime:'2026-11-09T12:00:00Z'};

test('enabled activation does not imply an episode snapshot is open',()=>{
  assert.equal(juryAdminStatus(base),'NEEDS_REVIEW');
});
test('disabled or later activation blocks predictions',()=>{
  assert.equal(juryAdminStatus({...base,activationEnabled:false}),'BLOCKED');
  assert.equal(juryAdminStatus({...base,activationEpisode:9}),'BLOCKED');
  assert.equal(juryAdminStatus({...base,activationEpisode:null}),'BLOCKED');
});
test('snapshot opens until server-verified airtime then locks',()=>{
  const ready={...base,hasSnapshot:true,snapshotAirtime:'2026-11-11T20:00:00-05:00'};
  assert.equal(juryAdminStatus(ready),'OPEN');
  assert.equal(juryAdminStatus({...ready,serverTime:'2026-11-12T01:00:00Z'}),'LOCKED');
  assert.equal(juryAdminStatus({...ready,serverTime:'2026-11-12T02:00:00Z',graded:true}),'GRADED');
});
test('bad timestamps fail closed',()=>{
  assert.equal(juryAdminStatus({...base,hasSnapshot:true,snapshotAirtime:'bad'}),'BLOCKED');
  assert.equal(juryAdminStatus({...base,hasSnapshot:true,snapshotAirtime:'2026-11-11T20:00:00-05:00',serverTime:'unknown'}),'BLOCKED');
});
