import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {initialGame} from '../lib/game-data.ts';
import {availableEpisodeNumbers,hasAuthoredRecap,linkedAuthor,type EpisodeRecap} from '../lib/community.ts';
import {bindProfile,signupAssociation} from '../lib/league.ts';
import {DiscussionStore} from '../lib/discussion-store.ts';
import {saveEpisodeRecap} from '../lib/recap-store.ts';
import {MemoryFirestore} from './helpers/memory-firestore.ts';

const root='games/survivor-51',now='2026-10-15T12:00:00.000Z';
const owner={uid:'owner',email:'donohue.js@gmail.com',verified:true},member={uid:'member',email:'stanzi@example.com',verified:true};
const input={season:51,episode:4,title:'Episode 4 recap',body:'Preserve commentary',status:'published',expectedUpdatedAt:''};
const placeholder=(episode:number):EpisodeRecap=>({id:`51-${episode}`,season:51,episode,status:'draft',title:`Episode ${episode}`,body:'',actions:[],createdAt:now,updatedAt:'',publishedAt:''});
function fixture(){
  const db=new MemoryFirestore(),game=structuredClone(initialGame);
  game.players=[game.players.find(player=>player.id==='player-stanzi')!,...game.players.filter(player=>player.id!=='player-stanzi')];
  game.season.currentEpisode=4;game.draft.status='complete';game.players[0].email=member.email;delete game.players[0].uid;
  db.seed(root,game);return {db,game,admin:new DiscussionStore(db.firestore,owner,()=>now),member:new DiscussionStore(db.firestore,member,()=>now)};
}
test('Issue 1: only open discussions join public episode navigation, future dates appear when available',()=>{
  const {game}=fixture(),rows=Array.from({length:13},(_,index)=>({season:51,episode:index+1,available:index<4}));
  const before=structuredClone(rows),recaps=[1,2,3].map(episode=>({...placeholder(episode),status:'published' as const}));
  assert.deepEqual(availableEpisodeNumbers(game,recaps,[],51,rows),[4,3,2,1]);
  assert.deepEqual(availableEpisodeNumbers(game,recaps,[],51,rows.map(row=>row.episode===5?{...row,available:true}:row)),[5,4,3,2,1]);
  assert.deepEqual(rows,before);assert.deepEqual(availableEpisodeNumbers(game,[],[],50,rows),[]);
});
test('Issue 6: calendar placeholders are not authored drafts; real future drafts remain discoverable',()=>{
  const records=Array.from({length:13},(_,index)=>placeholder(index+1)),before=structuredClone(records);
  assert(records.every(row=>!hasAuthoredRecap(row)));
  for(const edit of [{updatedAt:now},{body:'Real commentary'},{title:'Authored title'},{actions:[{id:'a',label:'Win',points:2,recipients:['A'],tribeName:'',note:'',target:'castaway' as const}]}])assert(hasAuthoredRecap({...placeholder(7),...edit}));
  assert(hasAuthoredRecap({...placeholder(8),status:'published'}));assert.deepEqual(records,before);
});
test('Issues 3 and 4: calendar stays mounted at the bottom, collapsed; duplicate inventory removed',()=>{
  const recap=readFileSync(new URL('../app/admin/recap-manager.tsx',import.meta.url),'utf8'),schedule=readFileSync(new URL('../app/admin/discussion-schedule.tsx',import.meta.url),'utf8');
  assert(recap.indexOf('<DiscussionSchedule/>')>recap.indexOf('Manage polls'));
  assert.match(schedule,/<details className="admin-panel discussion-calendar"><summary>Automatic episode discussions<\/summary>/);
  assert.match(schedule,/<CalendarForm/);assert.match(schedule,/<EpisodeOverride/);
  assert(!recap.includes('WhoHasWhat'));assert.match(recap,/<PossessionManager\/>/);
  assert.match(readFileSync(new URL('../app/episodes/page.tsx',import.meta.url),'utf8'),/<WhoHasWhat\/>/);
});
test('Issue 5: active management and collapsed historical management keep every record editable',()=>{
  const manager=readFileSync(new URL('../app/admin/possession-manager.tsx',import.meta.url),'utf8');
  assert.match(manager,/active=records.filter\(record=>record.status==='active'\)/);
  assert.match(manager,/history=records.filter\(record=>record.status!=='active'\)/);
  assert.match(manager,/<details className="closed-possession-history"><summary>/);
  assert.match(manager,/active.map\(record=><PossessionRow/);assert.match(manager,/history.map\(record=><PossessionRow/);
});
test('Issue 7: exact legacy email association shows the authoritative drafted profile without writes',()=>{
  const {game}=fixture(),signup={...member,name:'A different display name',createdAt:now},before=structuredClone(game);
  const result=signupAssociation(game.players,signup);assert.equal(result.status,'legacy-email');assert.equal(result.player?.id,'player-stanzi');
  assert.equal(linkedAuthor(game,member).id,result.player?.id);
  assert.throws(()=>bindProfile(game,signup,'player-stanzi'),/before/);assert.deepEqual(game,before);
  assert.equal(signupAssociation(game.players,{...signup,email:'unmatched@example.com',name:'Stanzi Lowe'}).status,'unassigned');
});
test('Issue 7: conflicting UIDs, duplicate emails and stale assignments never suggest a reassignment',()=>{
  const {game}=fixture(),signup={...member,name:'Stanzi',createdAt:now};
  game.players[0].uid='someone-else';assert.equal(signupAssociation(game.players,signup).status,'conflict');
  assert.throws(()=>linkedAuthor(game,member),/linked/);
  delete game.players[0].uid;game.players[1].email=member.email;assert.equal(signupAssociation(game.players,signup).status,'conflict');
  game.players[1].email='';assert.equal(signupAssociation(game.players,{...signup,assignedPlayerId:'missing'}).status,'conflict');
  assert.equal(signupAssociation(game.players,{...signup,assignedPlayerId:game.players[1].id}).status,'conflict');
  game.players[0].uid=member.uid;game.players[0].email='';assert.equal(signupAssociation(game.players,signup).status,'linked');
});
test('Issue 2: a newly authored recap initializes threading and allows a member post and reply',async()=>{
  const f=fixture(),before=structuredClone(f.game);await saveEpisodeRecap(f.db.firestore,owner,input,now);
  assert.equal(f.db.read<{discussionSchemaVersion:number}>(root+'/episodes/51-4').discussionSchemaVersion,2);
  const posted=await f.member.post({episodeId:'51-4',id:'root',text:'New conversation'});
  await f.admin.post({episodeId:'51-4',id:'reply',text:'Reply',replyToCommentId:'root'});
  const comments=(await f.member.conversation(posted.threadId)).comments;
  assert.deepEqual(comments.map(row=>row.text),['New conversation','Reply']);assert.equal(comments[1].replyToCommentId,'root');assert.deepEqual(f.db.read(root),before);
});
test('Issue 2: existing historical and orphaned comments still require an explicit owner migration',async()=>{
  for(const existingParent of [true,false]){
    const f=fixture();if(existingParent)f.db.seed(root+'/episodes/51-4',placeholder(4));
    const original={id:'historical',authorId:'player-stanzi',authorName:'Original author',text:'Original text',createdAt:now};
    f.db.seed(root+'/episodes/51-4/comments/historical',original);
    await saveEpisodeRecap(f.db.firestore,owner,input,now);
    assert.equal(f.db.read<{discussionSchemaVersion?:number}>(root+'/episodes/51-4').discussionSchemaVersion,undefined);
    await assert.rejects(f.member.post({episodeId:'51-4',id:'new',text:'Wait'}),/migrate/);
    const before=structuredClone(f.db.data),first=await f.admin.migrateEpisode('51-4',{dryRun:true}),second=await f.admin.migrateEpisode('51-4',{dryRun:true});
    assert.deepEqual(first,second);assert.deepEqual(f.db.data,before);
    await assert.rejects(f.member.migrateEpisode('51-4'),/game master/);
    await f.admin.migrateEpisode('51-4');await f.member.post({episodeId:'51-4',id:'new',text:'Now allowed',replyToCommentId:'historical'});
    const saved=f.db.read<Record<string,unknown>>(root+'/episodes/51-4/comments/historical');
    for(const [key,value] of Object.entries(original))assert.deepEqual(saved[key],value);
  }
});
test('Issue 2: migration persists nested reply context, is idempotent, and preserves published recap metadata',async()=>{
  const f=fixture(),episode={...placeholder(4),status:'published',body:'Original commentary',discussionOpensAt:now,discussionOverride:true,discussionVersion:'keep-me'};
  f.db.seed(root+'/episodes/51-4',episode);
  const historical=[{id:'root',authorId:'player-stanzi',authorName:'Stanzi',text:'Original',createdAt:now},{id:'reply',authorId:'player-zoda',authorName:'Zoda',text:'Historical reply',createdAt:now,parentId:'root'}];
  for(const row of historical)f.db.seed(root+'/episodes/51-4/comments/'+row.id,row);
  await f.admin.migrateEpisode('51-4');const before=structuredClone(f.db.data);await f.admin.migrateEpisode('51-4');assert.deepEqual(f.db.data,before);
  assert.equal(f.db.read<{replyToCommentId:string}>(root+'/episodes/51-4/comments/reply').replyToCommentId,'root');
  const saved=f.db.read<Record<string,unknown>>(root+'/episodes/51-4');for(const [key,value] of Object.entries(episode))assert.deepEqual(saved[key],value);
  await saveEpisodeRecap(f.db.firestore,owner,{...input,body:'Updated commentary'},now);
  assert.equal(f.db.read<{discussionVersion:string}>(root+'/episodes/51-4').discussionVersion,'keep-me');assert.equal(f.db.read<{discussionSchemaVersion:number}>(root+'/episodes/51-4').discussionSchemaVersion,2);
});
test('Issue 2: recap authoring and threaded posts retain authorization, stale-save and opening checks',async()=>{
  const f=fixture(),before=structuredClone(f.db.data);
  for(const actor of [member,{...owner,verified:false},{uid:'',email:'',verified:false}])await assert.rejects(saveEpisodeRecap(f.db.firestore,actor,input,now),/game master/);
  assert.deepEqual(f.db.data,before);
  await saveEpisodeRecap(f.db.firestore,owner,{...input,status:'draft'},now);
  await assert.rejects(f.member.post({episodeId:'51-4',id:'held',text:'Held'}),/not opened/);
  await assert.rejects(saveEpisodeRecap(f.db.firestore,owner,input,now),/another window/);
  await saveEpisodeRecap(f.db.firestore,owner,{...input,expectedUpdatedAt:now},now);
  await f.admin.override({episodeId:'51-4',expectedVersion:'',mode:'open'});
  const stranger=new DiscussionStore(f.db.firestore,{uid:'stranger',email:'stranger@example.com',verified:true},()=>now);
  await assert.rejects(stranger.post({episodeId:'51-4',id:'stranger',text:'No access'}),/linked/);
});
test('Issue 2: a new draft later published opens discussions; a deliberate hold remains held',async()=>{
  const f=fixture();await saveEpisodeRecap(f.db.firestore,owner,{...input,status:'draft'},now);
  assert.equal(f.db.read<Record<string,unknown>>(root+'/episodes/51-4').discussionOpensAt,undefined);
  await saveEpisodeRecap(f.db.firestore,owner,{...input,expectedUpdatedAt:now},now);
  await f.member.post({episodeId:'51-4',id:'new',text:'Published from draft'});
  await f.admin.override({episodeId:'51-4',expectedVersion:'',mode:'hold'});
  await saveEpisodeRecap(f.db.firestore,owner,{...input,expectedUpdatedAt:now},now);
  await assert.rejects(f.admin.post({episodeId:'51-4',id:'held',text:'Stay held'}),/not opened/);
});
