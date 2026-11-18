import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectIosAuthCandidate,makeIosAuthCandidatePackage} from '../scripts/package-ios-auth-candidate.mjs';

test('iPhone auth candidate changes exactly five reviewed deployment inputs',async()=>{
  const result=await inspectIosAuthCandidate();
  assert.equal(result.status,'historical-review-only');
  assert.equal(result.baselineDeployment,'dpl_HhFiTj5Zix6bWELxu9BuQ5EUqcUR');
  assert.equal(result.observedServingDeployment,'dpl_H5hcgzYvRyDr2UedkddjQKsQKw7D');
  assert.deepEqual(result.changedInputs,['app/game-provider.tsx','lib/firebase.ts','next.config.ts','vercel.json']);
  assert.deepEqual(result.newInputs,['lib/pwa-auth.ts']);
  assert.equal(result.files.length,111);
  assert.equal(new Set(result.files.map(file=>file.path)).size,result.files.length);
  assert(!result.files.some(file=>/^(?:staging|tests|scripts|docs|work)\//.test(file.path)));
  assert(!result.files.some(file=>/\.env|service.account|firebase-adminsdk|\.pem$/i.test(file.path)));
  for(const unchanged of ['lib/production-policy.ts','app/api/league/route.ts','app/api/jury/route.ts']){
    const baseline=JSON.parse(await readFile('deployment/production-source.json','utf8'));
    assert.equal(result.files.find(file=>file.path===unchanged)?.sha256,baseline.files.find(file=>file.path===unchanged)?.sha256);
  }
});

test('historical candidate refuses packaging while a newer production deployment is serving',async()=>{
  await assert.rejects(makeIosAuthCandidatePackage(),/Refusing to package: the current serving deployment is newer/);
});
