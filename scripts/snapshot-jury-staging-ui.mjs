// Read-only preservation record. Never resets fixtures, changes users, or prints credentials.
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';import {getFirestore} from 'firebase-admin/firestore';
import {canonicalJson} from '../lib/score-ledger.ts';import {seasonStandings} from '../lib/league.ts';
const project='fantasy-survivor-jury-staging',mode=process.argv[3];assert.equal(process.argv[2],project);assert(['before','after'].includes(mode));assert(!process.env.FIRESTORE_EMULATOR_HOST&&!process.env.FIREBASE_AUTH_EMULATOR_HOST);
const service=JSON.parse(await readFile('work/jury-staging/deployment/staging-runtime-service-account.json','utf8'));assert.equal(service.project_id,project);assert.equal(service.client_email,`jury-staging-runtime@${project}.iam.gserviceaccount.com`);
const db=getFirestore(initializeApp({projectId:project,credential:cert({projectId:project,clientEmail:service.client_email,privateKey:service.private_key})},'ui-preservation'));assert.equal(db.projectId,project);
const rows={};async function collection(ref){for(const doc of (await ref.get()).docs){rows[doc.ref.path]=doc.data();for(const child of await doc.ref.listCollections())await collection(child);}}
for(const ref of await db.listCollections())await collection(ref);
const game=rows['games/survivor-51'];assert.equal(game.stagingFixture.projectId,project);const hashes=Object.fromEntries(Object.entries(rows).map(([name,value])=>[name,createHash('sha256').update(canonicalJson(value)).digest('hex')]));
if(mode==='before'){await writeFile('work/jury-ui-refinement/staging-before.json',JSON.stringify({projectId:project,hashes,rows},null,2),{flag:'wx',mode:0o600});}
else{const before=JSON.parse(await readFile('work/jury-ui-refinement/staging-before.json','utf8'));const changed=Object.keys(before.hashes).filter(name=>hashes[name]!==before.hashes[name]),added=Object.keys(hashes).filter(name=>!(name in before.hashes));await writeFile('work/jury-ui-refinement/staging-preservation.json',JSON.stringify({projectId:project,changed,added,documentsBefore:Object.keys(before.hashes).length,documentsAfter:Object.keys(hashes).length},null,2));assert.deepEqual(changed,[],'Existing staging documents changed.');}
console.log(JSON.stringify({projectId:project,mode,documents:Object.keys(rows).length,standings:seasonStandings(game).map(row=>({name:row.name,score:row.score})),scoreEvents:game.scoreEvents.length}));await db.terminate();
