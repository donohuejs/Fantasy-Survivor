// Read-only: accepts an offline Firestore/game snapshot. No credentials, network or writes.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {planScoreCorrection} from '../lib/score-corrections.ts';
import {castawayScoreTotals,scoringActions,scoringVersion} from '../lib/score-ledger.ts';
import {seasonStandings} from '../lib/league.ts';
import type {GameState} from '../lib/game-data.ts';

const batch='e0c90d3b-786b-47bd-9fbc-261c5d65329b',oriId='cast-ori';
const recipients=['cast-thien-an','cast-brady','cast-carter','cast-kristin','cast-maggie','cast-mike','cast-ori'];
function decode(value:Record<string,unknown>):unknown{
  if('mapValue' in value){const map=value.mapValue as {fields?:Record<string,Record<string,unknown>>};return Object.fromEntries(Object.entries(map.fields??{}).map(([key,item])=>[key,decode(item)]));}
  if('arrayValue' in value)return ((value.arrayValue as {values?:Record<string,unknown>[]}).values??[]).map(decode);
  if('integerValue' in value)return Number(value.integerValue);
  for(const key of ['stringValue','doubleValue','booleanValue','nullValue','timestampValue'])if(key in value)return value[key];
  throw new Error('Unsupported snapshot value.');
}
async function main(){
  const path=process.argv[process.argv.indexOf('--snapshot')+1];
  if(!process.argv.includes('--snapshot')||!path)throw new Error('Provide --snapshot <read-only game or Firestore document JSON>.');
  const raw=JSON.parse(readFileSync(path,'utf8')),game=(raw.fields?decode({mapValue:{fields:raw.fields}}):raw) as GameState;
  if(raw.name)assert.equal(raw.name,'projects/fantasy-survivor-9da59/databases/(default)/documents/games/survivor-51');
  assert.equal(game.season.id,'season-51');assert.equal(game.season.number,51);assert(!game.season.finalized);
  assert.equal(game.castaways.find(c=>c.id===oriId)?.tribeId,'savu','Ori must remain assigned to Savu.');
  const awards=game.scoreEvents.filter(e=>e.batchId===batch);
  assert.equal(awards.length,7,'Expected exactly the seven original Toka entries, including tombstones.');
  assert.deepEqual(awards.map(e=>e.castawayId).sort(),[...recipients].sort());
  assert(awards.every(e=>e.episode===4&&e.categoryId==='tribal-immunity'&&e.tribeId==='toka'&&e.tribeName==='Toka'&&e.actionLabel==='Win tribal immunity'&&e.points===2));
  const ori=awards.find(e=>e.castawayId===oriId)!;
  assert.equal(ori.id,`${batch}:${oriId}`);
  if(ori.scoringStatus==='reversed'){
    assert(awards.filter(e=>e.castawayId!==oriId).every(e=>e.scoringStatus!=='reversed'));
    console.log(JSON.stringify({readOnly:true,alreadyCorrected:true,record:ori.id,activeRecipients:6,nextAction:'No writes.'},null,2));return;
  }
  assert(awards.every(e=>!e.correctionId&&e.scoringStatus!=='reversed'),'Existing corrections need a new review.');
  const action=scoringActions(game,4).find(a=>a.events.some(e=>e.id===ori.id))!;
  assert.equal(action.active.length,7);
  const command={id:'episode-4-toka-remove-ori-v1',season:51,kind:'edit' as const,scope:'action' as const,eventId:action.id,recipientIds:awards.filter(e=>e.castawayId!==oriId).map(e=>e.castawayId!),points:2,reason:'Ori Jean-Charles belonged to Savu when Episode 4 Toka tribal immunity was awarded. Remove only his erroneous +2 award.',expectedVersion:await scoringVersion(game)};
  const result=await planScoreCorrection(game,{uid:'dry-run-only',email:'donohue.js@gmail.com',verified:true},command,new Date().toISOString());
  assert.equal(result.preview.correction.castaways.length,1);assert.equal(result.preview.correction.castaways[0].id,oriId);assert.equal(result.preview.correction.castaways[0].delta,-2);
  for(const award of awards.filter(e=>e.castawayId!==oriId))assert.equal(result.game.scoreEvents.find(e=>e.id===award.id)!.points,2);
  const unrelated=game.scoreEvents.filter(e=>e.batchId!==batch);assert.deepEqual(result.game.scoreEvents.filter(e=>e.batchId!==batch),unrelated);
  assert.deepEqual(result.game.castaways,game.castaways);assert.deepEqual(result.game.draftPicks,game.draftPicks);
  const prior=new Map(seasonStandings(game).map(row=>[row.profileId,row]));
  const recap:{preservedByCorrection:boolean;separateReviewRequired:boolean;status?:string;snapshotUpdateTime?:string;erroneousOriAwardPresent?:boolean}={preservedByCorrection:true,separateReviewRequired:false};
  const recapIndex=process.argv.indexOf('--recap-snapshot');
  if(recapIndex>=0){
    const rawRecap=JSON.parse(readFileSync(process.argv[recapIndex+1],'utf8'));
    assert.equal(rawRecap.name,'projects/fantasy-survivor-9da59/databases/(default)/documents/games/survivor-51/episodes/51-4');
    const savedRecap=decode({mapValue:{fields:rawRecap.fields}}) as {season:number;episode:number;status:string;actions:Array<{label:string;tribeName:string;points:number;recipients:string[]}>};
    assert.equal(savedRecap.season,51);assert.equal(savedRecap.episode,4);
    recap.status=savedRecap.status;recap.snapshotUpdateTime=rawRecap.updateTime;
    recap.erroneousOriAwardPresent=savedRecap.actions.some(a=>a.label==='Win tribal immunity'&&a.tribeName==='Toka'&&a.points===2&&a.recipients.includes('Ori Jean-Charles'));
    recap.separateReviewRequired=recap.erroneousOriAwardPresent;
  }
  console.log(JSON.stringify({readOnly:true,project:'fantasy-survivor-9da59',document:'games/survivor-51',snapshotUpdateTime:raw.updateTime??'not supplied',batchId:batch,reverseEntryId:ori.id,originalRecipients:awards.map(e=>({id:e.castawayId,name:e.recipientName,points:e.points})),retainedRecipients:6,oriTotal:{before:castawayScoreTotals(game)[oriId],after:castawayScoreTotals(result.game)[oriId]},standings:seasonStandings(result.game).map(row=>({id:row.profileId,name:row.name,before:prior.get(row.profileId)!.score,after:row.score,delta:row.score-prior.get(row.profileId)!.score,priorRank:prior.get(row.profileId)!.finish,rank:row.finish})),auditPath:`games/survivor-51/scoreCorrections/${command.id}`,recap,command,changes:'Mark only Ori reversed; retain original +2; synchronize the seven original entries to six active recipient IDs and correction markers; append one immutable audit; increment scoringRevision. No negative gameplay entries or replacement awards.'},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Preview failed.');process.exitCode=1;});
