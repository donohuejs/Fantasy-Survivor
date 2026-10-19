// Revokes only the disposable staging commissioner session. Password and fixtures stay intact.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
const project='fantasy-survivor-jury-staging',dir='work/jury-staging/deployment';
assert.equal(process.argv[2],project);assert(!process.env.FIREBASE_AUTH_EMULATOR_HOST&&!process.env.FIRESTORE_EMULATOR_HOST);
const require=createRequire(import.meta.url),account=require(path.join(process.env.APPDATA,'npm/node_modules/firebase-tools/lib/auth.js')).getGlobalDefaultAccount();
assert(account?.tokens?.expires_at>Date.now()+60000,'Refresh the authorized Firebase CLI session first.');
const service=JSON.parse(await readFile(dir+'/staging-runtime-service-account.json','utf8')),web=JSON.parse(await readFile(dir+'/firebase-web-config.json','utf8')),credentials=JSON.parse(await readFile(dir+'/synthetic-credentials.json','utf8'));
assert.equal(service.project_id,project);assert.equal(web.projectId,project);assert.equal(credentials.commissioner.uid,'staging-commissioner');
const owner=initializeApp({projectId:project,credential:{getAccessToken:async()=>({access_token:account.tokens.access_token,expires_in:Math.floor((account.tokens.expires_at-Date.now())/1000)})}},'staging-revocation-owner');
const runtime=initializeApp({projectId:project,credential:cert({projectId:project,clientEmail:service.client_email,privateKey:service.private_key})},'staging-revocation-runtime'),auth=getAuth(runtime),db=getFirestore(runtime);assert.equal(db.projectId,project);
const root=db.doc('games/survivor-51'),digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),before=digest((await root.get()).data());
const signIn=async()=>{const c=credentials.commissioner,r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+web.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:c.email,password:c.password,returnSecureToken:true})});assert.equal(r.status,200);return (await r.json()).idToken;};
const oldToken=await signIn(),identity=await auth.verifyIdToken(oldToken,true);assert.equal(identity.uid,'staging-commissioner');
await new Promise(resolve=>setTimeout(resolve,2100));await getAuth(owner).revokeRefreshTokens(identity.uid);
assert.equal((await auth.verifyIdToken(oldToken,false)).uid,identity.uid);
await assert.rejects(()=>auth.verifyIdToken(oldToken,true),error=>error.code==='auth/id-token-revoked');
const checks=[{check:'otherwise valid token rejected with revocation checking',passed:true}];
for(const method of ['GET','PATCH']){const r=await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/games/survivor-51`+(method==='PATCH'?'?updateMask.fieldPaths=stagingDeniedProbe':''),{method,headers:{Authorization:'Bearer '+oldToken,'Content-Type':'application/json'},...(method==='PATCH'?{body:JSON.stringify({fields:{stagingDeniedProbe:{booleanValue:true}}})}:{})});assert.equal(r.status,403);checks.push({check:'revoked commissioner direct Firestore '+method,status:403,passed:true});}
const newToken=await signIn();assert.equal((await auth.verifyIdToken(newToken,true)).uid,identity.uid);checks.push({check:'same password reauthentication succeeds',passed:true});
assert.equal(digest((await root.get()).data()),before);checks.push({check:'game data unchanged',passed:true});
await writeFile(dir+'/revocation-tests.json',JSON.stringify({projectId:project,passed:checks.length,failed:0,results:checks},null,2));console.log(JSON.stringify({projectId:project,passed:checks.length,failed:0,credentialsRegenerated:false,gameUnchanged:true}));await db.terminate();
