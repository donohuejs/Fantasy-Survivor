// Approved one-off snapshot correction. Dry-run by default; --apply is explicitly required.
// This script never changes the game ledger or regenerates the recap.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {planEpisode4RecapCorrection} from '../lib/episode4-recap-correction.ts';
import {canonicalJson,castawayScoreTotals} from '../lib/score-ledger.ts';
import {planScoreCorrection} from '../lib/score-corrections.ts';
import {seasonStandings} from '../lib/league.ts';

const project='fantasy-survivor-9da59',document='games/survivor-51/episodes/51-4',base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/`;
function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields??{}).map(([k,x])=>[k,decode(x)]));if('arrayValue'in v)return(v.arrayValue.values??[]).map(decode);if('integerValue'in v)return Number(v.integerValue);for(const k of ['doubleValue','stringValue','booleanValue','nullValue','timestampValue'])if(k in v)return v[k];throw Error('Unsupported Firestore value.');}
async function main(){
  const preflight=JSON.parse(readFileSync('work/production-preflight.json','utf8')),archive=JSON.parse(readFileSync('work/production-backup-archive-verification.json','utf8'));
  assert(preflight.backupVerified&&preflight.expectedStateMatches&&archive.recoveryVerified);
  assert.equal(createHash('sha256').update(readFileSync(archive.archive)).digest('hex'),archive.archiveSHA256,'Backup archive hash failed.');
  const manifest=JSON.parse(readFileSync(preflight.manifest,'utf8'));assert.equal(manifest.project,project);
  for(const file of manifest.files)assert.equal(createHash('sha256').update(readFileSync(path.join(preflight.folder,file.name))).digest('hex'),file.sha256,'Backup file hash failed.');
  const backup=JSON.parse(readFileSync(path.join(preflight.folder,'episode4-recap-document.json'),'utf8'));
  const require=process.env.FIREBASE_CLI_PACKAGE?createRequire(process.env.FIREBASE_CLI_PACKAGE):createRequire(import.meta.url),auth=process.env.FIREBASE_CLI_PACKAGE?require('./lib/auth.js'):require('firebase-tools/lib/auth.js');
  const account=auth.getGlobalDefaultAccount();assert.equal(account?.user?.email,'donohue.js@gmail.com');const credential=await auth.getAccessToken(account.tokens.refresh_token,[]);
  async function get(id){const response=await fetch(base+id,{method:'GET',headers:{Authorization:'Bearer '+credential.access_token}});if(!response.ok)throw Error('Production read failed: HTTP '+response.status);return response.json();}
  const current=await get(document),plan=planEpisode4RecapCorrection(current,backup);
  if(plan.alreadyCorrected){console.log(JSON.stringify({alreadyCorrected:true,document,recipientCount:6,totalPoints:12,productionWrites:0}));return;}
  const preview={document,expectedUpdateTime:current.updateTime,recipientCount:6,totalPoints:12,storedAggregates:plan.storedAggregates,fieldsToWrite:['actions'],preserved:'All other scoring snapshots, editorial content, identity, metadata, timestamps and private draft status.',apply:process.argv.includes('--apply')};
  writeFileSync('work/production-recap-correction-preview.json',JSON.stringify(preview,null,2));
  if(!process.argv.includes('--apply')){console.log(JSON.stringify({...preview,productionWrites:0},null,2));return;}
  // Applying the recap correction is allowed only after the deployed Edit correction is audited.
  const gameRaw=await get('games/survivor-51'),game=decode({mapValue:{fields:gameRaw.fields}}),originalRaw=JSON.parse(readFileSync(path.join(preflight.folder,'game-document.json'),'utf8')),original=decode({mapValue:{fields:originalRaw.fields}});
  const ori=game.scoreEvents.find(e=>e.id==='e0c90d3b-786b-47bd-9fbc-261c5d65329b:cast-ori');assert.equal(ori?.scoringStatus,'reversed');assert(/^[a-zA-Z0-9_-]{1,100}$/.test(ori.correctionId));
  const auditRaw=await get('games/survivor-51/scoreCorrections/'+ori.correctionId),audit=decode({mapValue:{fields:auditRaw.fields}});
  const expected=await planScoreCorrection(original,{uid:audit.actorUid,email:'donohue.js@gmail.com',verified:true,commissioner:true},audit.command,audit.at);
  assert.equal(canonicalJson(game),canonicalJson(expected.game),'Game differs from the single approved Edit correction. Stop.');
  assert.equal(castawayScoreTotals(game)['cast-ori'],13);assert.equal(game.castaways.find(c=>c.id==='cast-ori').tribeId,'savu');
  const scores=new Map(seasonStandings(game).map(p=>[p.profileId,p.score]));for(const [id,score] of [['player-katie',58.25],['player-zoda',55.75],['player-chad',51]])assert.equal(scores.get(id),score);
  // Re-read immediately before the PATCH, then enforce the same version atomically.
  const latest=await get(document);planEpisode4RecapCorrection(latest,backup);assert.equal(latest.updateTime,current.updateTime);
  const query=new URLSearchParams({'updateMask.fieldPaths':'actions','currentDocument.updateTime':current.updateTime});
  const response=await fetch(base+document+'?'+query,{method:'PATCH',headers:{Authorization:'Bearer '+credential.access_token,'Content-Type':'application/json'},body:JSON.stringify({fields:{actions:plan.fields.actions}})});
  if(!response.ok)throw Error('Scoped recap PATCH failed: HTTP '+response.status+'. Do not retry without inspecting current state.');
  const written=await response.json(),verified=await get(document);assert.equal(canonicalJson(verified.fields),canonicalJson(plan.fields),'Post-write recap verification failed.');
  const receipt={...preview,completed:true,updateTime:written.updateTime,verifiedUpdateTime:verified.updateTime,scoringAuditId:ori.correctionId,backupManifest:preflight.manifest,productionWrites:1};
  writeFileSync('work/production-recap-correction-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Scoped correction failed.');process.exitCode=1;});
