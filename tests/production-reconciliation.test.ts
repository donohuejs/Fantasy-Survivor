import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assertProductionConfiguration,productionProject,productionApp} from '../lib/production-policy.ts';
import {productionFiles} from '../scripts/package-production.mjs';
const valid={NEXT_PUBLIC_FIREBASE_PROJECT_ID:productionProject,NEXT_PUBLIC_FIREBASE_APP_ID:productionApp,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:productionProject+'.firebaseapp.com',NEXT_PUBLIC_FIREBASE_API_KEY:'AIza'+'x'.repeat(35),VERCEL_ENV:'production'};
test('reviewed source manifest detects changes and excludes test/staging/credential material',async()=>{
  const manifest=JSON.parse(readFileSync('deployment/production-source.json','utf8'));
  assert.equal(manifest.provenance.deployment,'dpl_HhFiTj5Zix6bWELxu9BuQ5EUqcUR');
  const files=await productionFiles();assert(files.includes('lib/production-policy.ts'));assert(files.includes('app/api/jury/route.ts'));
  for(const file of manifest.files)assert.equal(createHash('sha256').update(readFileSync(file.path)).digest('hex'),file.sha256,file.path);
  assert(!files.some((name:string)=>/^(tests|scripts|staging|docs|work)\//.test(name)));
});
test('production guards reject staging, emulator, wrong-project and missing server credentials',()=>{
  assertProductionConfiguration(valid,'production');
  for(const key of ['LOCAL_ACCEPTANCE','NEXT_PUBLIC_LOCAL_ACCEPTANCE','JURY_STAGING','NEXT_PUBLIC_JURY_STAGING','STAGING_OPERATOR_SECRET','FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST'])assert.throws(()=>assertProductionConfiguration({...valid,[key]:'1'},'production'));
  assert.throws(()=>assertProductionConfiguration({...valid,NEXT_PUBLIC_FIREBASE_PROJECT_ID:'other'},'production'));
  assert.throws(()=>assertProductionConfiguration({...valid,VERCEL_ENV:'preview'},'production'));
  assert.throws(()=>assertProductionConfiguration(valid,'production',true));
});
test('reconciled registration and Jury accuracy cache preserve the serving optimizations',()=>{
  assert(readFileSync('app/game-provider.tsx','utf8').includes('if(!firebaseConfigured||!user||!isAdmin)return;'));
  assert(readFileSync('lib/jury-results.ts','utf8').includes('confirmedAccuracy(record)??juryQuestionAccuracy'));
  assert(readFileSync('lib/jury-store.ts','utf8').includes('confirmedAccuracy(e)'));
});
