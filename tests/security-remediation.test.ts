import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {MemoryFirestore} from './helpers/memory-firestore.ts';
import {initialGame,historicalResults,withHistoricalSeed} from '../lib/private-league-seed.ts';
import {initialGame as publicGame,type GameState} from '../lib/game-data.ts';
import {executeAdminCommand} from '../lib/admin-store.ts';
import {registerAccount,registrationRows} from '../lib/registration-store.ts';
import {seasonStandings} from '../lib/league.ts';
const root='games/survivor-51',owner={uid:'owner',email:'donohue.js@gmail.com',verified:true},member={uid:'member',email:'member@example.com',verified:true};
function fixture(){const db=new MemoryFirestore(),game=structuredClone(initialGame);game.players[0].uid=member.uid;db.seed(root,game);return {db,game};}
const command=(id:string,action:string,input:object,season=51)=>({id,action,input,season});

test('public initial state contains only original roster and static rules, without league seeds',()=>{
  assert.equal(publicGame.castaways.length,21);assert(publicGame.castaways.every(c=>c.status==='active'&&!c.tribeId&&!c.eliminationEpisode));
  assert.deepEqual(publicGame.players,[]);assert.deepEqual(publicGame.tribes,[]);assert.deepEqual(publicGame.draft.turns,[]);assert.deepEqual(publicGame.scoreEvents,[]);
});
test('authenticated historical compatibility view retains all 73 rows without changing stored history',()=>{
  const game=structuredClone(initialGame),before=structuredClone(game),view=withHistoricalSeed(game);
  assert.equal(view.history!.flatMap(a=>a.results).length,73);assert.equal(historicalResults.length,73);assert.deepEqual(game,before);
  assert.equal(view.history!.find(a=>a.season===50)!.results.find(r=>r.profileId==='player-chad')!.score,338.2083333333333);
});
test('client module graph cannot import private server stores, seeds or commissioner authority',()=>{
  const roots=readdirSync('app',{recursive:true}).map(String).filter(p=>/\.(ts|tsx)$/.test(p)&&!p.replaceAll('\\','/').startsWith('api/'));
  const seen=new Set<string>();function visit(path:string){const full=resolve(path);if(seen.has(full))return;seen.add(full);assert(!/private-league-seed|admin-store|registration-store|scoring-authority|firebase-admin|legacy-possession-seed/.test(full),full);const source=readFileSync(full,'utf8');assert(!source.includes('donohue.js@gmail.com'),full);
    // Type-only references have no emitted values and may refer to server receipt types.
    for(const match of source.matchAll(/import\s+(?!type\b)[\s\S]*?from\s+['"]([^'"]+)['"]/g)){const target=match[1];if(!target.startsWith('.')&&!target.startsWith('@/'))continue;const next=target.startsWith('@/')?resolve(target.slice(2)):resolve(dirname(full),target);const candidates=/\.tsx?$/.test(next)?[next]:[next+'.ts',next+'.tsx'];for(const candidate of candidates)try{readFileSync(candidate);visit(candidate);break;}catch(error){if(error instanceof Error&&'code' in error&&error.code==='ENOENT')continue;throw error;}}
  }for(const path of roots)visit('app/'+path);
});
test('commissioner store rejects forged role flags and preserves all documents',async()=>{
  const {db}=fixture(),before=structuredClone(db.data);
  for(const actor of [member,{...owner,verified:false},{...member,commissioner:true}])await assert.rejects(()=>executeAdminCommand(db.firestore,actor,command('forged','setPlayerPaid',{playerId:initialGame.players[0].id,paid:true})),/game master/);
  assert.deepEqual(db.data,before);
});
test('standard scoring command is atomic and idempotent; changed reuse of ID is rejected',async()=>{
  const {db,game}=fixture(),cmd=command('start','startEpisode',{episode:1,expectedActiveCastawayIds:game.castaways.map(c=>c.id)});
  await executeAdminCommand(db.firestore,owner,cmd);const after=structuredClone(db.data);await executeAdminCommand(db.firestore,owner,cmd);assert.deepEqual(db.data,after);
  assert.equal(db.read<GameState>(root).scoreEvents.length,21);assert(db.data.has(root+'/adminOperations/start'));
  await assert.rejects(()=>executeAdminCommand(db.firestore,owner,{...cmd,input:{episode:2}}),/request ID/);assert.deepEqual(db.data,after);
});
test('concurrent ordinary scoring commands preserve both awards through transaction retries',async()=>{
  const {db,game}=fixture();await Promise.all(['one','two'].map(id=>executeAdminCommand(db.firestore,owner,command(id,'addAdjustment',{playerId:game.players[0].id,points:2,note:id}))));
  assert.equal(db.read<GameState>(root).scoreEvents.length,2);assert.equal(seasonStandings(db.read<GameState>(root))[0].score,4);assert(db.retries>0);
});
test('failure rolls back game and receipt together; retry creates one award',async()=>{
  const {db,game}=fixture(),cmd=command('retry','addAdjustment',{playerId:game.players[0].id,points:5,note:'Synthetic'}),before=structuredClone(db.data);db.failOnTransactionCall=db.transactionCalls+1;
  await assert.rejects(()=>executeAdminCommand(db.firestore,owner,cmd),/Simulated/);assert.deepEqual(db.data,before);await executeAdminCommand(db.firestore,owner,cmd);assert.equal(db.read<GameState>(root).scoreEvents.length,1);
});
test('profile assignment commits the game identity and signup assignment atomically',async()=>{
  const {db,game}=fixture();delete game.players[0].uid;db.seed(root,game);db.seed(root+'/signups/member',{uid:member.uid,name:'Synthetic chosen name',email:member.email,createdAt:'original'});
  await executeAdminCommand(db.firestore,owner,command('link','assignSignup',{uid:member.uid,playerId:game.players[0].id}));
  assert.equal(db.read<GameState>(root).players[0].id,game.players[0].id);assert.equal(db.read<GameState>(root).players[0].uid,member.uid);assert.equal(db.read<{assignedPlayerId:string}>(root+'/signups/member').assignedPlayerId,game.players[0].id);
});
test('season archival and transition commit together and idempotent retries cannot open another season',async()=>{
  const {db,game}=fixture();game.draft.status='complete';game.scoreEvents=[{id:'existing',playerId:game.players[0].id,points:5,createdAt:'original'}];db.seed(root,game);
  await executeAdminCommand(db.firestore,owner,command('lock','finalizeSeason',{order:seasonStandings(game).map(r=>r.profileId),expectedStandings:seasonStandings(game)}));
  const locked=db.read<GameState>(root);await executeAdminCommand(db.firestore,owner,command('next','beginNextSeason',{}));await executeAdminCommand(db.firestore,owner,command('next','beginNextSeason',{}));
  assert.equal(db.read<GameState>(root).season.number,52);assert.deepEqual(db.read<GameState>(root+'/archives/51'),locked);assert.equal(db.read<GameState>(root).history?.length,1);
});
test('stale season, stale finalization review and unknown commands write nothing',async()=>{
  const {db}=fixture(),before=structuredClone(db.data);
  for(const cmd of [command('stale','setPlayerPaid',{playerId:initialGame.players[0].id,paid:true},50),command('review','finalizeSeason',{order:[],expectedStandings:[]}),command('unknown','replace-game',{game:{}})])await assert.rejects(()=>executeAdminCommand(db.firestore,owner,cmd));
  assert.deepEqual(db.data,before);
});
test('onboarding stays UID-bound without granting access to other registrations',async()=>{
  const {db}=fixture();const first=await registerAccount(db.firestore,{...member,displayName:'Synthetic name'});await registerAccount(db.firestore,{...member,displayName:'Changed'});await registerAccount(db.firestore,{uid:'other',email:'other@example.com',verified:true});
  assert.deepEqual(await registrationRows(db.firestore,member),[first]);assert.equal((await registrationRows(db.firestore,owner)).length,2);assert.equal(first.uid,member.uid);assert.equal(first.name,'Synthetic name');
});
test('returning historical players keep their permanent ID without persisting imported score rows',async()=>{
  const {db,game}=fixture();game.players=game.players.filter(p=>p.id!=='player-zoda');db.seed(root,game);
  await executeAdminCommand(db.firestore,owner,command('returning','addPlayer',{name:'Zoda',email:'returning@example.com'}));
  const next=db.read<GameState>(root);assert.equal(next.players.find(p=>p.name==='Zoda')?.id,'player-zoda');assert.deepEqual(next.history,game.history??[]);
});
test('possession transfer commits optional fields safely while retaining item lineage and history',async()=>{
  const {db,game}=fixture();await executeAdminCommand(db.firestore,owner,command('item','createPossession',{castawayId:game.castaways[0].id,itemName:'Synthetic item',category:'idol'}));
  await executeAdminCommand(db.firestore,owner,command('transfer','transferPossession',{possessionId:'item',targetCastawayId:game.castaways[1].id,episode:1,notes:'Synthetic transfer'}));
  const stored=db.read<GameState>(root).possessions!,before=stored.find(p=>p.id==='item')!,after=stored.find(p=>p.id==='transfer')!;assert.equal(before.status,'transferred');assert.equal(after.lineageId,before.lineageId);assert.equal(after.castawayId,game.castaways[1].id);assert.equal(Object.hasOwn(after,'transferredToPossessionId'),false);assert.equal(after.history[0].action,'transferred-in');
});
