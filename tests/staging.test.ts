import test from 'node:test';import assert from 'node:assert/strict';
import {requireCloudStaging,stagingCommissioner,assertStagingControl,STAGING_PROJECT,STAGING_APP_ID,STAGING_SERVICE_ACCOUNT,STAGING_SCHEMA} from '../lib/staging-environment.ts';
import {stagingGame,stagingParameters} from '../lib/staging-fixture.ts';
import {seasonStandings} from '../lib/league.ts';
import {stagingRequestDatabase} from '../lib/staging-request.ts';
import type {Firestore,Transaction} from 'firebase-admin/firestore';
import type {NextRequest} from 'next/server';
const environment={JURY_STAGING:'1',NEXT_PUBLIC_JURY_STAGING:'1',NODE_ENV:'production',VERCEL_ENV:'preview',NEXT_PUBLIC_FIREBASE_PROJECT_ID:STAGING_PROJECT,NEXT_PUBLIC_FIREBASE_APP_ID:STAGING_APP_ID,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:STAGING_PROJECT+'.firebaseapp.com',FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:STAGING_PROJECT,client_email:STAGING_SERVICE_ACCOUNT})};
test('cloud staging requires exact Preview project, app, runtime identity and no emulator selectors',()=>{
  assert.equal(requireCloudStaging(environment),true);
  for(const change of [{VERCEL_ENV:'production'},{NEXT_PUBLIC_FIREBASE_PROJECT_ID:'unknown'},{NEXT_PUBLIC_FIREBASE_APP_ID:'wrong'},{FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:STAGING_PROJECT,client_email:'unknown'})},{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098'},{LOCAL_ACCEPTANCE:'1'},{JURY_STAGING:''}])assert.throws(()=>requireCloudStaging({...environment,...change}));
});
test('staging commissioner requires verified UID and email together',()=>{
  const actor={uid:'staging-commissioner',email:'commissioner@jury.test',verified:true};assert.equal(stagingCommissioner(actor),true);
  for(const change of [{uid:'staging-jury'},{email:'jury@jury.test'},{verified:false}])assert.equal(stagingCommissioner({...actor,...change}),false);
});
test('staging marker rejects another project, schema or missing version',()=>{
  const state={projectId:STAGING_PROJECT,schema:STAGING_SCHEMA,version:1};assert.doesNotThrow(()=>assertStagingControl(state));for(const change of [{projectId:'unknown'},{schema:'unknown'},{version:0}])assert.throws(()=>assertStagingControl({...state,...change}));
});
test('phone reset validates explicit confirmation, scenario, version and bounded deadline',()=>{
  const input={scenario:'grading',expectedVersion:1,seconds:180,confirmed:true,requestId:'synthetic-request-1234'};assert.equal(stagingParameters(input).seconds,180);
  for(const change of [{scenario:'unknown'},{confirmed:false},{expectedVersion:0},{seconds:59},{seconds:86401},{requestId:'../other/path'}])assert.throws(()=>stagingParameters({...input,...change}));
});
test('cloud fixture remaps only invented identities and preserves ordinary baseline points',()=>{
  const game=stagingGame(3);assert.equal(game.stagingFixture.projectId,STAGING_PROJECT);assert.equal(game.stagingFixture.version,3);assert.equal(game.players.find(p=>p.id==='synthetic-jury')!.uid,'staging-jury');assert.equal(game.players.find(p=>p.id==='synthetic-legacy')!.uid,undefined);assert.deepEqual(game.history,[]);assert.deepEqual(seasonStandings(game).map(p=>p.score),[17,17,11.5,11.5]);
});
test('staging transaction fence rejects a reset that races an authenticated scoring request',async()=>{
  const before={...process.env};Object.assign(process.env,environment);
  for(const key of ['LOCAL_ACCEPTANCE','NEXT_PUBLIC_LOCAL_ACCEPTANCE','FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST'])delete process.env[key];
  let version=1,phase='ready',writes=0;
  const snapshot=()=>({data:()=>({projectId:STAGING_PROJECT,schema:STAGING_SCHEMA,version,phase})});
  const fake={projectId:STAGING_PROJECT,doc:()=>({get:async()=>snapshot()}),runTransaction:async(callback:(tx:Transaction)=>Promise<unknown>)=>callback({get:async()=>snapshot()} as unknown as Transaction)} as unknown as Firestore;
  const request={method:'POST',headers:new Headers({'x-jury-staging-fixture':'1'})} as unknown as NextRequest;
  try{
    const guarded=await stagingRequestDatabase(fake,request);version=2;
    await assert.rejects(()=>guarded.runTransaction(async()=>{writes++;}),/scenario changed/);assert.equal(writes,0);
    phase='preparing';await assert.rejects(()=>stagingRequestDatabase(fake,request),/preparation/);
  }finally{for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];Object.assign(process.env,before);}
});
