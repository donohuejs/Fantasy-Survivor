// One-time/resumable bootstrap for this newly authorized project only. Never resets existing data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {stagingGame,acceptanceAccounts} from '../lib/staging-fixture.ts';
import {STAGING_PROJECT,STAGING_SCHEMA} from '../lib/staging-environment.ts';
assert.equal(process.argv[2],STAGING_PROJECT,'Explicit fixed staging project argument required.');
assert(!process.env.FIRESTORE_EMULATOR_HOST&&!process.env.FIREBASE_AUTH_EMULATOR_HOST,'No emulator selectors permitted.');
const require=createRequire(import.meta.url),cli=require(path.join(process.env.APPDATA,'npm/node_modules/firebase-tools/lib/auth.js'));
const account=cli.getGlobalDefaultAccount();assert(account?.tokens?.access_token&&account.tokens.expires_at>Date.now()+60000,'Refresh the authorized Firebase CLI session first.');
async function read(url){assert(url.includes('/projects/'+STAGING_PROJECT+'/'));const r=await fetch(url,{headers:{Authorization:'Bearer '+account.tokens.access_token}});const d=await r.json();assert(r.ok,d.error?.message??'Staging verification failed.');return d;}
const billing=await read(`https://cloudbilling.googleapis.com/v1/projects/${STAGING_PROJECT}/billingInfo`);assert.equal(billing.billingEnabled,false);assert.equal(billing.billingAccountName,'');
const release=await read(`https://firebaserules.googleapis.com/v1/projects/${STAGING_PROJECT}/releases/cloud.firestore`);
const rules=await read('https://firebaserules.googleapis.com/v1/'+release.rulesetName);assert.equal(rules.source.files[0].content.replace(/\r/g,''),(await readFile('firestore.rules','utf8')).replace(/\r/g,''),'Publish the reviewed deny-all Rules before initializing data.');
const credentialPath='work/jury-staging/deployment/synthetic-credentials.json';let credentials;
try{credentials=JSON.parse(await readFile(credentialPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;credentials=Object.fromEntries(acceptanceAccounts.map(role=>[role,{uid:'staging-'+role,email:role+'@jury.test',password:randomBytes(24).toString('base64url')+'!'}]));await writeFile(credentialPath,JSON.stringify(credentials,null,2),{mode:0o600});}
assert.equal(Object.keys(credentials).length,6);assert(acceptanceAccounts.every(role=>credentials[role]?.uid==='staging-'+role&&credentials[role]?.email===role+'@jury.test'&&credentials[role]?.password.length>=20));
const app=initializeApp({projectId:STAGING_PROJECT,credential:{getAccessToken:async()=>({access_token:account.tokens.access_token,expires_in:Math.floor((account.tokens.expires_at-Date.now())/1000)})}},'staging-bootstrap');
const runtime=JSON.parse(await readFile('work/jury-staging/deployment/staging-runtime-service-account.json','utf8'));assert.equal(runtime.project_id,STAGING_PROJECT);assert.equal(runtime.client_email,`jury-staging-runtime@${STAGING_PROJECT}.iam.gserviceaccount.com`);
const dataApp=initializeApp({projectId:STAGING_PROJECT,credential:cert({projectId:runtime.project_id,clientEmail:runtime.client_email,privateKey:runtime.private_key})},'staging-data-bootstrap');
const auth=getAuth(app),db=getFirestore(dataApp);assert.equal(db.projectId,STAGING_PROJECT);let created=0;
for(const role of acceptanceAccounts){const c=credentials[role];let user;try{user=await auth.getUser(c.uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
  if(user)assert(user.email===c.email&&user.emailVerified&&!user.disabled,'Unexpected existing account; refusing to overwrite.');else{await auth.createUser({uid:c.uid,email:c.email,password:c.password,emailVerified:true,displayName:'Synthetic '+role});created++;}}
const initialized=await db.runTransaction(async tx=>{const root=db.doc('games/survivor-51'),control=db.doc('stagingControl/state'),[game,state]=await Promise.all([tx.get(root),tx.get(control)]);
  if(game.exists||state.exists){assert.equal(game.data()?.stagingFixture?.projectId,STAGING_PROJECT);assert.equal(state.data()?.projectId,STAGING_PROJECT);return false;}
  tx.create(root,stagingGame(1));tx.create(control,{projectId:STAGING_PROJECT,schema:STAGING_SCHEMA,version:1,phase:'ready',scenario:'initial',updatedAt:new Date().toISOString()});return true;});
const finalBilling=await read(`https://cloudbilling.googleapis.com/v1/projects/${STAGING_PROJECT}/billingInfo`);assert.equal(finalBilling.billingEnabled,false);
console.log(JSON.stringify({projectId:STAGING_PROJECT,syntheticAccounts:6,newAccountsCreated:created,fixtureInitialized:initialized,billingEnabled:false,passwordsPrinted:false}));await db.terminate();
