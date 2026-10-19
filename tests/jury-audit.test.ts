import assert from 'node:assert/strict';
import test from 'node:test';
import {MemoryFirestore} from './helpers/memory-firestore.ts';
import {JuryStore} from '../lib/jury-store.ts';
import {juryFixture,jurySnapshot,juryFacts,juryOwner,juryMember,before} from './helpers/jury-fixture.ts';
import {confirmedFacts,eliminationSource,juryEligibility,validateSnapshot,type JuryPrediction} from '../lib/jury.ts';
import {initialGame} from '../lib/private-league-seed.ts';
import {type GameState} from '../lib/game-data.ts';
import {finishEpisode,recordScoring} from '../lib/scoring.ts';
import {saveEpisodeRecap} from '../lib/recap-store.ts';
import type {JuryEpisode} from '../lib/jury.ts';
const root='games/survivor-51';

test('player catalogs omit commissioner snapshot verification notes',async()=>{
  const db=new MemoryFirestore();db.seed(root,juryFixture());
  const owner=new JuryStore(db.firestore,juryOwner,()=>before),member=new JuryStore(db.firestore,juryMember,()=>before);
  await owner.mutate({action:'snapshot',season:51,episode:5,snapshot:{...jurySnapshot(),provenance:'PRIVATE_GM_SNAPSHOT_EVIDENCE: source and commissioner notes'},requestId:'snapshot'});
  await owner.mutate({action:'configure',season:51,enabled:true,activationEpisode:5,expectedRevision:0,reconciliations:[],approval:'Synthetic audit activation',requestId:'config'});
  assert(!JSON.stringify(await member.catalog()).includes('PRIVATE_GM_SNAPSHOT_EVIDENCE'));
  assert(JSON.stringify(await owner.catalog(true)).includes('PRIVATE_GM_SNAPSHOT_EVIDENCE'));
});
test('a corrected prior merge cannot silently grade an incompatible premerge snapshot',()=>{
  const g=juryFixture(),s=jurySnapshot(g),f=juryFacts(s);g.season.mergeOccurred=true;g.season.mergeEpisode=4;
  assert.throws(()=>confirmedFacts(f,s,g),/snapshot.*merge|merge.*snapshot/i);
});
test('canonical airtime rejects impossible calendar dates rather than normalizing them',()=>{
  assert.throws(()=>validateSnapshot({...jurySnapshot(),airtime:'2027-02-30T20:00:00-05:00'},juryFixture(),before),/airtime|timestamp/i);
});
test('merge correction pauses incompatible predictions and prevents evidence or award writes',async()=>{
  const db=new MemoryFirestore();db.seed(root,juryFixture());
  const owner=new JuryStore(db.firestore,juryOwner,()=>before),member=new JuryStore(db.firestore,juryMember,()=>before);
  await owner.mutate({action:'snapshot',season:51,episode:5,snapshot:jurySnapshot(),requestId:'snapshot'});
  await owner.mutate({action:'configure',season:51,enabled:true,activationEpisode:5,expectedRevision:0,reconciliations:[],approval:'Synthetic audit activation',requestId:'config'});
  await member.mutate({action:'save-answer',season:51,episode:5,question:'q1',value:'merge',expectedRevision:0,requestId:'answer'});
  const g=db.read<GameState>(root);g.season.mergeOccurred=true;g.season.mergeEpisode=4;db.seed(root,g);
  const original=structuredClone(db.data);
  const catalog=await member.catalog();assert('canSave' in catalog.episodes[0]);assert.equal(catalog.episodes[0].canSave,false);assert.match(catalog.episodes[0].status,/review/);
  await assert.rejects(()=>member.mutate({action:'save-answer',season:51,episode:5,question:'q2',value:'nothing',expectedRevision:1,requestId:'late-format'}),/Snapshot conflicts/);
  await assert.rejects(()=>owner.mutate({action:'evidence',season:51,episode:5,facts:juryFacts(),expectedRevision:1,requestId:'facts'}),/Snapshot conflicts/);
  assert.deepEqual(db.data,original);assert.equal(db.read<JuryPrediction>(root+'/juryPredictions/51-5_jury-player').answers.q1?.value,'merge');
});
test('Jackie qualifies for Episode 5 only after sourced Rob Episode 3 reconciliation',()=>{
  const g=structuredClone(initialGame),player=g.players.find(p=>p.name==='Jackie')!,rob=g.castaways.find(c=>c.shortName==='Rob')!,jenna=g.castaways.find(c=>c.shortName==='Jenna')!;
  g.season.currentEpisode=4;rob.status='voted-out';rob.eliminationReason='voluntary-quit';jenna.status='voted-out';jenna.eliminationReason='voted-out';jenna.eliminationEpisode=4;
  g.draftPicks=[jenna,rob,jenna].map((c,i)=>({id:'slot-'+i,playerId:player.id,castawayId:c.id,round:i+1,pickNumber:i+1,multiplier:i===2?1.25:1}));
  assert.equal(juryEligibility(g,player.id).fromEpisode,null);const original=structuredClone(g);
  assert.equal(juryEligibility(g,player.id,[{castawayId:rob.id,episode:3,provenance:'Commissioner confirmation in chat, October 15, 2026',source:eliminationSource(rob)}]).fromEpisode,5);
  assert.deepEqual(g,original);
});
test('normal scoring, episode completion and recap publication do not require Jury evidence',async()=>{
  const db=new MemoryFirestore(),g=juryFixture();g.season.episodeStarted=true;g.season.episodeStatus='in-progress';db.seed(root,g);
  const owner=new JuryStore(db.firestore,juryOwner,()=>before);
  await owner.mutate({action:'snapshot',season:51,episode:5,snapshot:jurySnapshot(),requestId:'snapshot'});
  const current=recordScoring(g,{episode:4,categoryId:'individual-reward',recipientMode:'individual',recipientId:g.castaways[2].id,expectedRecipientIds:[g.castaways[2].id],batchId:'ordinary-reward',note:''});
  db.seed(root,finishEpisode(current,{episode:4}));
  await saveEpisodeRecap(db.firestore,juryOwner,{season:51,episode:4,status:'published',expectedUpdatedAt:'',title:'Synthetic recap',body:'Ordinary episode completed before Jury grading.'},before);
  assert.equal(db.read<GameState>(root).season.episodeStatus,'complete');assert.equal(db.read<{status:string}>(root+'/episodes/51-4').status,'published');
  assert.equal(db.read<JuryEpisode>(root+'/juryEpisodes/51-5').key,null);assert.equal(db.read<JuryEpisode>(root+'/juryEpisodes/51-5').facts.councilsComplete,false);
});
