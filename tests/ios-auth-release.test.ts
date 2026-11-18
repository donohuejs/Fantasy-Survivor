import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {inspectIosAuthCandidate,makeIosAuthCandidatePackage} from '../scripts/package-ios-auth-candidate.mjs';

test('iPhone auth candidate changes exactly five reviewed deployment inputs',async()=>{
  const result=await inspectIosAuthCandidate();
  assert.equal(result.status,'review-only');
  assert.equal(result.baselineDeployment,'dpl_HhFiTj5Zix6bWELxu9BuQ5EUqcUR');
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

test('iPhone auth candidate packages only the reviewed source without test credentials',async()=>{
  const result=await makeIosAuthCandidatePackage();
  try{
    assert.equal(result.files.length,111);
    for(const file of result.files){
      const bytes=await readFile(path.join(result.destination,file.path));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
    }
    const descriptor=JSON.parse(await readFile(path.join(result.destination,'production-package.json'),'utf8'));
    assert.equal(descriptor.status,'review-only');
    assert.equal(descriptor.sourceDigest,result.sourceDigest);
    assert(await readFile(path.join(result.destination,'.vercelignore'),'utf8').then(value=>value.includes('production-package.json')));
    await assert.rejects(readFile(path.join(result.destination,'.env.local')));
    await assert.rejects(readFile(path.join(result.destination,'firestore.rules')));
  }finally{
    await rm(result.destination,{recursive:true});
  }
});
