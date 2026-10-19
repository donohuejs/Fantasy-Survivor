// Every destructive reset is restricted to this fixed loopback emulator, never cloud Firestore.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {acceptanceAccounts,acceptanceGame,acceptanceSnapshot,acceptanceFacts} from './iphone-fixture.ts';
import {localAcceptance} from '../lib/acceptance-environment.ts';
assert(localAcceptance());
const dir='work/iphone-acceptance',settings=JSON.parse(readFileSync(dir+'/settings.json','utf8'));
assert.equal(settings.project,'demo-fantasy-scoring');
const scenario=process.argv[2]??'open';assert(['open','lock','grading','wrong-merge','merge','postmerge'].includes(scenario),'Unknown scenario');
const service=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);
const app=initializeApp({projectId:settings.project,credential:cert({projectId:service.project_id,clientEmail:service.client_email,privateKey:service.private_key})});
const auth=getAuth(app),db=getFirestore(app),root=db.doc('games/survivor-51'),base='http://127.0.0.1:3106';
const users:Record<string,{idToken:string}>={};
for(const role of acceptanceAccounts){const email=role+'@jury.test';let user;try{user=await auth.getUser('iphone-'+role);}catch(e){if((e as {code?:string}).code!=='auth/user-not-found')throw e;}if(user)await auth.updateUser(user.uid,{email,emailVerified:true,password:settings.password,disabled:false});else await auth.createUser({uid:'iphone-'+role,email,emailVerified:true,password:settings.password,displayName:'Synthetic '+role});const response=await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:settings.password,returnSecureToken:true})});assert.equal(response.status,200);users[role]=await response.json();}
async function api(role:string,input:object){const r=await fetch(base+'/api/jury',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+users[role].idToken},body:JSON.stringify({...input,requestId:randomUUID()})});const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));return body;}
// Warm the route before setting a short real deadline.
await fetch(base+'/api/jury');
const game=acceptanceGame(scenario==='postmerge');
await db.recursiveDelete(root);await root.set(game);
const now=new Date().toISOString();
await root.collection('episodes').doc('51-4').set({id:'51-4',season:51,episode:4,status:'published',title:'Synthetic Episode 4',body:'Invented recap for iPhone acceptance testing.',actions:[],createdAt:now,updatedAt:now,publishedAt:now,discussionOpensAt:new Date(Date.now()-86400000).toISOString(),discussionSchemaVersion:2});
await root.collection('polls').doc('synthetic-poll').set({id:'synthetic-poll',season:51,episode:0,question:'Synthetic acceptance poll',options:['Amber','Violet'],counts:[0,0],status:'open',createdAt:now,updatedAt:now});
const prefilled=['lock','grading','wrong-merge','merge'].includes(scenario);
const seconds=scenario==='lock'?Number(process.argv[3]??180):prefilled?20:86400;
assert(Number.isFinite(seconds)&&seconds>=15&&seconds<=86400,'Deadline must be 15–86400 seconds from reset.');
const snapshot=acceptanceSnapshot(game,new Date(Date.now()+seconds*1000).toISOString()),episode=snapshot.episode;
await api('commissioner',{action:'snapshot',season:51,episode,snapshot});
await api('commissioner',{action:'configure',season:51,enabled:true,activationEpisode:episode,expectedRevision:0,reconciliations:[],approval:'Synthetic local acceptance activation only.'});
if(prefilled)for(const role of ['jury','complete']){const values={q1:scenario==='wrong-merge'||scenario==='merge'?'merge':'amber',q2:'nothing',...(role==='complete'?{q3:'2',q4:'synthetic-fern'}:{}),q5:'synthetic-dusk'};let revision=0;for(const [question,value] of Object.entries(values))await api(role,{action:'save-answer',season:51,episode,question,value,expectedRevision:revision++});}
const facts=acceptanceFacts(scenario==='merge');
if(scenario==='merge'||scenario==='postmerge'){
  if(scenario==='merge'){
    const response=await fetch(base+'/api/admin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+users.commissioner.idToken},body:JSON.stringify({id:randomUUID(),season:51,action:'setMergeEpisode',input:{episode:5}})});assert.equal(response.status,200,await response.text());
  }
  // Synthetic authoritative standard outcomes, independent of the immutable prediction snapshot.
  await root.update({'season.currentEpisode':episode,'season.episodeStatus':'complete',tribalCouncils:[{id:'synthetic-council',episode,number:1,attendeeMode:'all-active',attendeeIds:snapshot.castaways.map(c=>c.id),status:'resolved',eliminatedCastawayId:'synthetic-dusk',eliminationReason:'voted-out'}],tribalVotes:facts.councils[0].rounds[0].votes.map((v,i)=>({...v,id:'synthetic-vote-'+i,episode,tribalCouncilId:'synthetic-council',round:1,revote:false,recordedAt:now}))});
}
await api('commissioner',{action:'evidence',season:51,episode,expectedRevision:1,facts});
if(prefilled&&scenario!=='lock'){
  const remaining=Date.parse(snapshot.airtime)-Date.now()+200;if(remaining>0)await new Promise(r=>setTimeout(r,remaining));
  // Result fixtures represent this episode, rather than leaving the leaderboard in the prior episode.
  // Only synthetic episode metadata advances; predictions, snapshots and score events are untouched.
  await root.update({'season.currentEpisode':episode});
}
writeFileSync(dir+'/scenario.json',JSON.stringify({scenario,episode,airtime:snapshot.airtime,loadedAt:now,prefilled,expectedGrades:scenario==='wrong-merge'?{jury:6,complete:8}:scenario==='merge'?{jury:7,complete:11}:scenario==='grading'?{jury:7,complete:11}:null},null,2));
console.log(`Loaded synthetic ${scenario}: Episode ${episode}, canonical airtime ${snapshot.airtime}. No production data accessed.`);
await db.terminate();
