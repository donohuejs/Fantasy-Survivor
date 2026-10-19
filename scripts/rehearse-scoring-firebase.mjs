// Isolated integration rehearsal: real local Auth/Firestore emulators + the actual Next API.
// Run only with the fixed demo project and loopback emulator hosts below. No cloud credentials.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {correctionFixture,correctionCommand} from '../tests/helpers/scoring-fixture.ts';
import {canonicalJson,castawayScoreTotals} from '../lib/score-ledger.ts';
import {seasonStandings} from '../lib/league.ts';
import {episodeActions} from '../lib/community.ts';

const project='demo-fantasy-scoring',firestoreHost='127.0.0.1:8085',authHost='127.0.0.1:9098';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,firestoreHost);
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,authHost);
assert.equal(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,project);
const apiBase=process.env.SCORING_TEST_URL??'http://127.0.0.1:3102';
assert.equal(new URL(apiBase).hostname,'127.0.0.1');
const service=JSON.parse(readFileSync('work/firebase-rehearsal/server-service-account.json','utf8'));
assert.equal(service.project_id,project);
const rules=readFileSync('firestore.rules','utf8');
assert.equal(readFileSync('work/firebase-rehearsal/firestore.rules','utf8'),rules,'Rehearsal must use the exact repository rules.');
const app=initializeApp({projectId:project,credential:cert({projectId:project,clientEmail:service.client_email,privateKey:service.private_key})},'scoring-rehearsal');
const auth=getAuth(app),db=getFirestore(app),gameRef=db.doc('games/survivor-51');
const results=[];
async function check(name,run){await run();results.push({name,passed:true});console.log('PASS '+name);}
async function localFetch(url,options={}){assert.equal(new URL(url).hostname,'127.0.0.1');return fetch(url,options);}
async function api(token,command,phase='preview'){
  const response=await localFetch(apiBase+'/api/scoring',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({...command,phase})});
  return {status:response.status,body:await response.json()};
}
async function history(token){return localFetch(apiBase+'/api/scoring?eventId='+encodeURIComponent('test-immunity:cast-ori'),{headers:token?{Authorization:'Bearer '+token}:{}});}
async function direct(path,method,token,fields){
  const endpoint=`http://${firestoreHost}/v1/projects/${project}/databases/(default)/documents/${path}`;
  return localFetch(endpoint,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(fields?{body:JSON.stringify({fields})}:{})});
}
async function login(email){
  const response=await localFetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'Synthetic-test-password-42!',returnSecureToken:true})});
  assert.equal(response.status,200);const data=await response.json();assert.equal(typeof data.idToken,'string');return data.idToken;
}
async function user(email,verified){
  let found;try{found=await auth.getUserByEmail(email);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
  return found?auth.updateUser(found.uid,{emailVerified:verified,disabled:false,password:'Synthetic-test-password-42!'}):auth.createUser({email,emailVerified:verified,password:'Synthetic-test-password-42!'});
}
function changeClaims(token,changes){const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());return Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({...claims,...changes})).toString('base64url')+'.';}

async function main(){
  const game=correctionFixture(),recap={id:'51-4',season:51,episode:4,status:'draft',title:'Synthetic recap',body:'Preserve this synthetic commentary.',actions:episodeActions(game,4),createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',discussionVersion:2};
  await gameRef.set({...game,unknownField:{preserve:true}});
  await gameRef.collection('episodes').doc('51-4').set(recap);
  await gameRef.collection('scoreCorrections').doc('private-test-record').set({private:true});
  const owner=await user('donohue.js@gmail.com',false),member=await user('member@example.com',true);
  await auth.setCustomUserClaims(member.uid,{admin:true,commissioner:true});
  const unverifiedToken=await login(owner.email),memberToken=await login(member.email),command=await correctionCommand(game,{id:'emulator-remove-ori'});
  const original=(await gameRef.get()).data();
  for(const [actor,token] of [['anonymous',null],['unverified owner',unverifiedToken],['member with spoofed commissioner claims',memberToken]]){
    await check(`${actor}: direct game update denied`,async()=>assert.equal((await direct('games/survivor-51?updateMask.fieldPaths=scoreEvents','PATCH',token,{scoreEvents:{arrayValue:{values:[]}}})).status,403));
    await check(`${actor}: direct game create denied`,async()=>assert.equal((await direct('games/unauthorized-create','PATCH',token,{scoreEvents:{arrayValue:{values:[]}}})).status,403));
    await check(`${actor}: direct game delete denied`,async()=>assert.equal((await direct('games/survivor-51','DELETE',token)).status,403));
    await check(`${actor}: direct audit write denied`,async()=>assert.equal((await direct('games/survivor-51/scoreCorrections/forged','PATCH',token,{private:{booleanValue:false}})).status,403));
    await check(`${actor}: direct audit read/delete denied`,async()=>{assert.equal((await direct('games/survivor-51/scoreCorrections/private-test-record','GET',token)).status,403);assert.equal((await direct('games/survivor-51/scoreCorrections/private-test-record','DELETE',token)).status,403);});
    await check(`${actor}: private recap read/write denied`,async()=>{assert.equal((await direct('games/survivor-51/episodes/51-4','GET',token)).status,403);assert.equal((await direct('games/survivor-51/episodes/51-4?updateMask.fieldPaths=body','PATCH',token,{body:{stringValue:'unauthorized'}})).status,403);});
    await check(`${actor}: scoring API preview/save/history denied`,async()=>{const status=token?403:401;assert.equal((await api(token,{...command,isAdmin:true,role:'commissioner'},'preview')).status,status);assert.equal((await api(token,command,'save')).status,status);assert.equal((await history(token)).status,status);});
  }
  await check('unauthorized attempts preserve authoritative game, recap and audit',async()=>{assert.deepEqual((await gameRef.get()).data(),original);assert.deepEqual((await gameRef.collection('episodes').doc('51-4').get()).data(),recap);assert(!(await gameRef.collection('scoreCorrections').doc('forged').get()).exists);});
  await auth.updateUser(owner.uid,{emailVerified:true});let ownerToken=await login(owner.email);
  await check('verified commissioner: direct game update denied; scoring uses authenticated API',async()=>assert.equal((await direct('games/survivor-51?updateMask.fieldPaths=scoringRevision','PATCH',ownerToken,{scoringRevision:{integerValue:'0'}})).status,403));
  await check('verified commissioner: direct recap reads/writes denied; authenticated recap view allowed',async()=>{assert.equal((await direct('games/survivor-51/episodes/51-4','GET',ownerToken)).status,403);assert.equal((await direct('games/survivor-51/episodes/51-4?updateMask.fieldPaths=body','PATCH',ownerToken,{body:{stringValue:'not permitted'}})).status,403);assert.equal((await localFetch(apiBase+'/api/league?view=recaps',{headers:{Authorization:'Bearer '+ownerToken}})).status,200);});
  await check('verified commissioner: direct audit read/create/update/delete denied',async()=>{for(const method of ['GET','PATCH','DELETE'])assert.equal((await direct('games/survivor-51/scoreCorrections/private-test-record',method,ownerToken,method==='PATCH'?{private:{booleanValue:false}}:undefined)).status,403);assert.equal((await direct('games/survivor-51/scoreCorrections/forged','PATCH',ownerToken,{private:{booleanValue:false}})).status,403);});
  await check('invalid, wrong-project and expired bearer tokens rejected',async()=>{for(const token of ['invalid',changeClaims(ownerToken,{aud:'demo-unrelated-project'}),changeClaims(ownerToken,{exp:Math.floor(Date.now()/1000)-100})])assert.equal((await api(token,command)).status,401);});
  await check('disabled commissioner rejected by revocation-aware verification',async()=>{await auth.updateUser(owner.uid,{disabled:true});assert.equal((await api(ownerToken,command)).status,401);await auth.updateUser(owner.uid,{disabled:false});ownerToken=await login(owner.email);});
  await check('revoked commissioner token rejected by API and protected direct GET/PATCH',async()=>{await new Promise(resolve=>setTimeout(resolve,1100));await auth.revokeRefreshTokens(owner.uid);assert.equal((await api(ownerToken,command)).status,401);assert.equal((await direct('games/survivor-51','GET',ownerToken)).status,403);assert.equal((await direct('games/survivor-51?updateMask.fieldPaths=scoringRevision','PATCH',ownerToken,{scoringRevision:{integerValue:'0'}})).status,403);ownerToken=await login(owner.email);});
  await check('commissioner preview is read-only and flags the stored recap discrepancy',async()=>{const before=(await gameRef.get()).data(),result=await api(ownerToken,command);assert.equal(result.status,200);assert.equal(result.body.recap.scoringDiffersAfterSave,true);assert.deepEqual((await gameRef.get()).data(),before);assert(!(await gameRef.collection('scoreCorrections').doc(command.id).get()).exists);});
  await check('commissioner save changes only Ori scoring, creates audit, preserves recap and multipliers',async()=>{
    const result=await api(ownerToken,command,'save');assert.equal(result.status,200,JSON.stringify(result.body));
    const next=(await gameRef.get()).data();assert.equal(castawayScoreTotals(next)['cast-ori'],11);assert.equal(next.castaways.find(c=>c.id==='cast-ori').tribeId,'savu');assert.equal(next.scoreEvents.filter(e=>e.scoringStatus==='reversed').length,1);
    assert(next.scoreEvents.filter(e=>e.batchId==='test-immunity'&&e.castawayId!=='cast-ori').every(e=>e.points===2));assert.deepEqual(next.draftPicks,game.draftPicks);assert.deepEqual(next.unknownField,{preserve:true});
    assert.equal(seasonStandings(next).find(row=>row.profileId===game.players[2].id).score,13.75);
    assert.deepEqual((await gameRef.collection('episodes').doc('51-4').get()).data(),recap);assert((await gameRef.collection('scoreCorrections').doc(command.id).get()).exists);
    assert.equal((await history(ownerToken)).status,200);
  });
  await check('retry of the same request is idempotent; reusing its ID for another change fails',async()=>{const before=canonicalJson((await gameRef.get()).data());const retry=await api(ownerToken,command,'save');assert.equal(retry.status,200);assert.equal(retry.body.alreadyApplied,true);assert.equal(canonicalJson((await gameRef.get()).data()),before);assert.equal((await api(ownerToken,{...command,points:99},'save')).status,409);});
  await check('undo reverses remaining six awards once; a new repeated undo fails',async()=>{const next=(await gameRef.get()).data(),undo=await correctionCommand(next,{id:'emulator-undo-action',kind:'undo'});assert.equal((await api(ownerToken,undo,'save')).status,200);const undone=(await gameRef.get()).data();assert.equal(undone.scoreEvents.filter(e=>e.scoringStatus==='reversed').length,7);assert.equal((await api(ownerToken,await correctionCommand(undone,{id:'emulator-repeat-undo',kind:'undo'}),'save')).status,409);assert.deepEqual((await gameRef.collection('episodes').doc('51-4').get()).data(),recap);});
  await check('concurrent API edits allow one winner and one stale-review rejection',async()=>{
    await gameRef.set(game);const one=await correctionCommand(game,{id:'emulator-concurrent-a'}),two={...one,id:'emulator-concurrent-b',kind:'undo'};
    const statuses=(await Promise.all([api(ownerToken,one,'save'),api(ownerToken,two,'save')])).map(r=>r.status).sort();assert.deepEqual(statuses,[200,409]);
    const audits=await Promise.all([gameRef.collection('scoreCorrections').doc(one.id).get(),gameRef.collection('scoreCorrections').doc(two.id).get()]);assert.equal(audits.filter(doc=>doc.exists).length,1);
  });
  const report={project,firestoreHost,authHost,apiBase,syntheticDataOnly:true,productionWrites:0,rulesSHA256:createHash('sha256').update(rules).digest('hex'),passed:results.length,results};
  writeFileSync('work/firebase-rehearsal/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:results.length,project,productionWrites:0}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Rehearsal failed.');process.exitCode=1;}).finally(()=>db.terminate());
