import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
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

test('observed serving source has five additional files and thirteen newer game/Jury inputs',async()=>{
  const serving=JSON.parse(await readFile('deployment/serving-source-2026-11-18.json','utf8'));
  const historical=JSON.parse(await readFile('deployment/production-source.json','utf8'));
  assert.equal(serving.deployment,'dpl_H5hcgzYvRyDr2UedkddjQKsQKw7D');
  assert.equal(serving.alias,'fantasy-survivor-theta.vercel.app');
  assert.equal(serving.files.length,115);
  const source=new Map<string,string>(serving.files.map((file:{path:string;sha1:string})=>[file.path,file.sha1]));
  assert.equal(source.size,115);
  const oldPaths=new Set<string>(historical.files.map((file:{path:string})=>file.path));
  assert(historical.files.every((file:{path:string})=>source.has(file.path)));
  assert.deepEqual([...source.keys()].filter(name=>!oldPaths.has(name)).sort(),[
    'app/admin/jury-snapshot-form.tsx','app/jury/prediction-episode.tsx','lib/jury-airtime.ts','lib/jury-q3-audit.ts','lib/jury-questions.ts',
  ]);
  const authChanged=new Set(['app/game-provider.tsx','lib/firebase.ts','next.config.ts','vercel.json']);
  const drift=[];
  for(const file of historical.files){
    if(authChanged.has(file.path))continue;
    const sha1=createHash('sha1').update(await readFile(file.path)).digest('hex');
    if(source.get(file.path)!==sha1)drift.push(file.path);
  }
  assert.deepEqual(drift.sort(),[
    'app/admin/jury-manager.tsx','app/api/discussions/route.ts','app/episodes/episode-content.tsx',
    'app/episodes/page.tsx','app/globals.css','app/jury/client.ts','app/jury/page.tsx','app/rules/page.tsx',
    'lib/discussion-store.ts','lib/discussions.ts','lib/jury-results.ts','lib/jury-store.ts','lib/jury.ts',
  ]);
});
