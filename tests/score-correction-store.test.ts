import assert from 'node:assert/strict';
import test from 'node:test';
import {correctScoring,scoringCorrectionHistory} from '../lib/score-correction-store.ts';
import {episodeActions} from '../lib/community.ts';
import {MemoryFirestore} from './helpers/memory-firestore.ts';
import {commissioner,correctionCommand,correctionFixture} from './helpers/scoring-fixture.ts';
import type {GameState} from '../lib/game-data.ts';

const gamePath='games/survivor-51',now='2026-10-15T03:00:00.000Z';
function fixture(){const db=new MemoryFirestore(),game=correctionFixture();db.seed(gamePath,{...game,unknownField:{preserve:true}});return {db,game};}
test('dry run flags the recap discrepancy; save atomically updates ledger/audit and preserves every recap field',async()=>{
  const {db,game}=fixture(),command=await correctionCommand(game),recap={id:'51-4',season:51,episode:4,title:'Preserve title',body:'Preserve commentary',status:'published',actions:episodeActions(game,4),createdAt:now,updatedAt:now,discussion:{preserve:true}};
  db.seed(gamePath+'/episodes/51-4',recap);db.seed(gamePath+'/episodes/51-3',{unrelated:true});db.seed(gamePath+'/signups/test-member',{preserve:true});
  const original=structuredClone(db.data),version=db.version;
  const preview=await correctScoring(db.firestore,commissioner,command,false,now);
  assert.deepEqual(preview.recap,{id:'51-4',exists:true,status:'published',scoringDiffersAfterSave:true});
  assert.deepEqual(db.data,original);assert.equal(db.version,version);
  const saved=await correctScoring(db.firestore,commissioner,command,true,now);
  assert.deepEqual(saved,preview);
  assert.deepEqual(db.read(gamePath+'/scoreCorrections/'+command.id),saved.correction);
  const next=db.read<GameState&{unknownField:unknown}>(gamePath);
  assert.deepEqual(next.unknownField,{preserve:true});
  assert.deepEqual(db.read(gamePath+'/episodes/51-4'),recap);
  assert.deepEqual(db.read(gamePath+'/episodes/51-3'),{unrelated:true});assert.deepEqual(db.read(gamePath+'/signups/test-member'),{preserve:true});
  assert.equal(db.version,version+1);
});
test('duplicate save or lost-response retry returns its audit receipt with no second write',async()=>{
  const {db,game}=fixture(),command=await correctionCommand(game,{kind:'undo'});
  const first=await correctScoring(db.firestore,commissioner,command,true,now),version=db.version;
  const again=await correctScoring(db.firestore,commissioner,command,true,'2026-10-16T03:00:00.000Z');
  assert.equal(again.alreadyApplied,true);assert.deepEqual(again.correction,first.correction);assert.equal(db.version,version);
  await assert.rejects(correctScoring(db.firestore,commissioner,{...command,points:99},true),/different request/);
  const next=db.read<GameState>(gamePath);await assert.rejects(correctScoring(db.firestore,commissioner,await correctionCommand(next,{id:'new-undo',kind:'undo'}),true),/already been reversed/);
});
test('an already-correct recap is identified without changing any snapshot fields',async()=>{
  const {db,game}=fixture(),command=await correctionCommand(game);
  const futureGame=structuredClone(game);futureGame.scoreEvents=futureGame.scoreEvents.filter(e=>e.id!=='test-immunity:cast-ori');
  const recap={season:51,episode:4,status:'draft',actions:episodeActions(futureGame,4),updatedAt:'preserve timestamp'};
  db.seed(gamePath+'/episodes/51-4',recap);
  const result=await correctScoring(db.firestore,commissioner,command,true,now);
  assert.equal(result.recap?.scoringDiffersAfterSave,false);
  assert.deepEqual(db.read(gamePath+'/episodes/51-4'),recap);
});
test('draft recap changes made after preview survive the ledger correction untouched',async()=>{
  const {db,game}=fixture(),command=await correctionCommand(game);
  db.seed(gamePath+'/episodes/51-4',{season:51,episode:4,status:'draft',actions:episodeActions(game,4),body:'first draft'});
  await correctScoring(db.firestore,commissioner,command,false,now);
  const edited={season:51,episode:4,status:'draft',actions:episodeActions(game,4),body:'A newer commissioner draft',updatedAt:'new timestamp',discussionOpensAt:'preserve schedule'};
  db.seed(gamePath+'/episodes/51-4',edited);
  await correctScoring(db.firestore,commissioner,command,true,now);
  assert.deepEqual(db.read(gamePath+'/episodes/51-4'),edited);
});
test('two concurrent edits with the same review allow exactly one correction and keep audit consistent',async()=>{
  const {db,game}=fixture(),command=await correctionCommand(game);
  const results=await Promise.allSettled([correctScoring(db.firestore,commissioner,command,true,now),correctScoring(db.firestore,commissioner,{...command,id:'competing-edit',kind:'undo'},true,now)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal([...db.data.keys()].filter(path=>path.includes('/scoreCorrections/')).length,1);assert(db.retries>0);
  assert.equal(db.read<GameState>(gamePath).scoringRevision,1);
});
test('concurrent retries of the same command produce one audit and one update',async()=>{
  const {db,game}=fixture(),command=await correctionCommand(game);
  const results=await Promise.all([correctScoring(db.firestore,commissioner,command,true,now),correctScoring(db.firestore,commissioner,command,true,now)]);
  assert.equal(results.filter(row=>row.alreadyApplied).length,1);assert.equal(db.read<GameState>(gamePath).scoringRevision,1);
});
test('transaction failure and recap identity failure leave scores and audit untouched',async()=>{
  const {db,game}=fixture(),command=await correctionCommand(game);db.failOnTransactionCall=1;
  const before=structuredClone(db.data);await assert.rejects(correctScoring(db.firestore,commissioner,command,true,now));assert.deepEqual(db.data,before);
  db.seed(gamePath+'/episodes/51-4',{season:50,episode:4});const inconsistent=structuredClone(db.data);
  await assert.rejects(correctScoring(db.firestore,commissioner,command,true,now),/identity/);assert.deepEqual(db.data,inconsistent);
});
test('store rejects non-owner preview, save, and history before any transaction or reads',async()=>{
  const {db,game}=fixture(),command=await correctionCommand(game),actor={...commissioner,email:'member@example.com'};
  await assert.rejects(correctScoring(db.firestore,actor,command,false));await assert.rejects(correctScoring(db.firestore,actor,command,true));await assert.rejects(scoringCorrectionHistory(db.firestore,actor,command.eventId));
  assert.equal(db.transactionCalls,0);assert.equal(db.documentReads,0);
});
test('audit lookup includes original and newly added entries and remains append only across edits',async()=>{
  const {db,game}=fixture(),command=await correctionCommand(game);
  await correctScoring(db.firestore,commissioner,command,true,now);
  const first=db.read(gamePath+'/scoreCorrections/'+command.id),next=db.read<GameState>(gamePath);
  const added=await correctionCommand(next,{id:'add-next',recipientIds:[...command.recipientIds,'cast-aaliyah']});
  const result=await correctScoring(db.firestore,commissioner,added,true,'2026-10-15T03:10:00.000Z');
  assert.deepEqual(db.read(gamePath+'/scoreCorrections/'+command.id),first);
  assert.equal((await scoringCorrectionHistory(db.firestore,commissioner,command.eventId)).length,2);
  const newId=result.correction.after.find(e=>e.castawayId==='cast-aaliyah')!.id;
  assert.equal((await scoringCorrectionHistory(db.firestore,commissioner,newId)).length,1);
});
