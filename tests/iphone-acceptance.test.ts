import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localAcceptance} from '../lib/acceptance-environment.ts';
import {requestId} from '../lib/request-id.ts';
import {acceptanceGame,acceptanceSnapshot,acceptanceFacts} from '../scripts/iphone-fixture.ts';
import {juryEligibility,answerKey,saveJuryAnswer,gradePrediction,type JuryPrediction} from '../lib/jury.ts';
const env={NODE_ENV:'development',LOCAL_ACCEPTANCE:'1',NEXT_PUBLIC_LOCAL_ACCEPTANCE:'1',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'demo-fantasy-scoring',NEXT_PUBLIC_FIREBASE_API_KEY:'demo-api-key',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098',FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'demo-fantasy-scoring',client_email:'synthetic-server@demo-fantasy-scoring.iam.gserviceaccount.com'})};
test('acceptance refuses production, cloud hosts, mixed projects and incomplete emulator configuration',()=>{
  assert.equal(localAcceptance(env),true);assert.equal(localAcceptance({}),false);
  for(const changed of [{NODE_ENV:'production'},{FIRESTORE_EMULATOR_HOST:'firestore.googleapis.com'},{FIREBASE_AUTH_EMULATOR_HOST:''},{NEXT_PUBLIC_FIREBASE_PROJECT_ID:'real-project'},{NEXT_PUBLIC_LOCAL_ACCEPTANCE:''},{FIREBASE_SERVICE_ACCOUNT_JSON:'{}'}])assert.throws(()=>localAcceptance({...env,...changed}),/local acceptance|Local acceptance/);
});
test('synthetic fixture uses three slots with a repeated pick and Episode 3/4 eligibility, without real league records',()=>{
  const game=acceptanceGame();assert.equal(juryEligibility(game,'synthetic-jury').fromEpisode,5);assert.equal(juryEligibility(game,'synthetic-active').fromEpisode,null);
  assert.equal(game.draftPicks.filter(p=>p.playerId==='synthetic-jury'&&p.castawayId==='synthetic-echo').length,2);
  assert(game.players.every(p=>p.email.endsWith('@jury.test')));assert(game.castaways.every(c=>c.name.startsWith('Synthetic ')));assert.deepEqual(game.history,[]);assert.equal(game.scoreEvents.length,5);
  assert(!readFileSync('scripts/iphone-fixture.ts','utf8').includes('private-league-seed'));
});
test('synthetic grading fixture gives partial 7 and Clean Sweep 11 without draft multipliers; postmerge Q1 is 3',()=>{
  const game=acceptanceGame(),snapshot=acceptanceSnapshot(game,'2099-01-01T00:00:00.000Z'),key=answerKey(snapshot,acceptanceFacts());
  let p:JuryPrediction={season:51,episode:5,playerId:'synthetic-jury',ownerUid:'iphone-jury',snapshotVersion:1,answers:{},revision:0,eligibility:{fromEpisode:5,slots:[]}};
  for(const [q,value] of [['q1','amber'],['q2','nothing'],['q5','synthetic-dusk']] as const)p=saveJuryAnswer(snapshot,p,q,value,p.revision,requestId(),'2098-01-01T00:00:00.000Z');assert.equal(gradePrediction(snapshot,p,key,1).total,7);
  for(const [q,value] of [['q3','2'],['q4','synthetic-fern']] as const)p=saveJuryAnswer(snapshot,p,q,value,p.revision,requestId(),'2098-01-01T00:00:00.000Z');assert.equal(gradePrediction(snapshot,p,key,1).total,11);
  const post=acceptanceSnapshot(acceptanceGame(true),snapshot.airtime);assert.equal(post.format,'post-merge');assert.deepEqual(answerKey(post,acceptanceFacts()).q1,['synthetic-dusk']);
});
test('private HTTP LAN requests get unique valid UUIDs when randomUUID is unavailable',()=>{
  const original=Object.getOwnPropertyDescriptor(crypto,'randomUUID');Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true});
  try{const ids=Array.from({length:100},requestId);assert.equal(new Set(ids).size,100);assert(ids.every(id=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)));}finally{if(original)Object.defineProperty(crypto,'randomUUID',original);else delete (crypto as unknown as Record<string,unknown>).randomUUID;}
});
