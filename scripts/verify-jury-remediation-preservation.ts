// Offline verification only. MemoryFirestore has no network connection.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MemoryFirestore} from '../tests/helpers/memory-firestore.ts';
import {executeAdminCommand} from '../lib/admin-store.ts';
import type {GameState} from '../lib/game-data.ts';
import {canonicalJson} from '../lib/score-ledger.ts';
const path=process.argv[process.argv.indexOf('--fixture')+1];
assert(process.argv.includes('--fixture')&&path,'Provide --fixture with the existing local audited game copy.');
const original=JSON.parse(readFileSync(path,'utf8')) as GameState;assert.equal(original.scoreEvents.length,241);
const db=new MemoryFirestore(),root='games/survivor-51';db.seed(root,original);
await executeAdminCommand(db.firestore,{uid:'offline-audit',email:'donohue.js@gmail.com',verified:true},{id:'offline-preservation',season:original.season.number,action:'setPlayerPaid',input:{playerId:original.players[0].id,paid:!original.players[0].paid}});
const after=db.read<GameState>(root);
assert.deepEqual(after.scoreEvents,original.scoreEvents);assert.deepEqual(after.draftPicks,original.draftPicks);assert.deepEqual(after.history,original.history??[]);
const identities=(g:GameState)=>g.players.map(({paid:_paid,...p})=>{void _paid;return p;});assert.deepEqual(identities(after),identities(original));
const hash=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
const report={offlineFixture:true,productionAccesses:0,productionWrites:0,scoreEvents:241,originalScoreSHA256:hash(original.scoreEvents),afterScoreSHA256:hash(after.scoreEvents),exactScoreEventsPreserved:true,picksPreserved:true,identitiesPreserved:true,storedHistoryPreserved:true};
mkdirSync('work/security-remediation',{recursive:true});writeFileSync('work/security-remediation/original-241-preservation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
